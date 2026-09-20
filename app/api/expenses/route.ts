import { createServiceClient, createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";
import { jsonError, requireApprovedUser } from "@/lib/api-helpers";
import { MAX_BILL_BYTES, storeBill } from "@/lib/bills";
import { notifyAdminSubmitted } from "@/lib/notify";
import { BILL_ATTACHMENT, BILL_TYPES, type BillType } from "@/lib/types";

export async function POST(req: Request) {
  const { user, error, status } = await requireApprovedUser();
  if (error || !user) return jsonError(error ?? "Not authenticated", status);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Expected multipart form data");
  }

  const event_id = String(form.get("event_id") ?? "");
  const item_desc = String(form.get("item_desc") ?? "").trim();
  const vendor_name = String(form.get("vendor_name") ?? "").trim();
  const amount = Number(form.get("amount"));
  const invoice_date = String(form.get("invoice_date") ?? "");
  const invoice_number = String(form.get("invoice_number") ?? "").trim() || null;
  const bill_type = String(form.get("bill_type") ?? "digital") as BillType;
  const bill = form.get("bill") as File | null;
  const hasBill = !!bill && bill instanceof File && bill.size > 0;

  if (!event_id) return jsonError("event_id is required");
  if (!item_desc) return jsonError("Item description is required");
  if (!vendor_name) return jsonError("Vendor name is required");
  if (!amount || Number.isNaN(amount) || amount <= 0) return jsonError("Valid amount is required");
  if (!invoice_date) return jsonError("Invoice date is required");
  if (!BILL_TYPES.includes(bill_type)) return jsonError("Choose how this was paid / billed");
  if (!hasBill && BILL_ATTACHMENT[bill_type].required) return jsonError(`${BILL_ATTACHMENT[bill_type].label} is required`);
  if (hasBill && bill.size > MAX_BILL_BYTES) return jsonError("Bill file must be under 10MB");

  const svc = await createServiceClient();
  const { data: event } = await svc.from("events").select("id").eq("id", event_id).single();
  if (!event) return jsonError("Event not found", 404);

  // Insert first to get an expense id for stable filenames.
  const { data: created, error: dbErr } = await svc
    .from("expenses")
    .insert({
      event_id,
      item_desc,
      vendor_name,
      amount,
      invoice_date,
      invoice_number,
      bill_type,
      paid_by: user.id,
      status: "pending",
    })
    .select("*")
    .single();
  if (dbErr || !created) return jsonError(dbErr?.message ?? "Failed to create expense", 500);

  // Bills stay in our storage until the admin approves; only then are they pushed to OneDrive.
  await notifyAdminSubmitted(created, "new");
  if (!hasBill) return Response.json({ expense: created });
  try {
    const stored = await storeBill(svc, event_id, created.id, bill);
    await svc.from("expenses").update(stored).eq("id", created.id);
  } catch (e) {
    // Keep the expense record even if the bill upload failed, so nothing is lost silently.
    console.error("Bill upload failed:", e);
    return Response.json({
      expense: created,
      warning: "Expense saved but bill upload failed. Please edit and re-attach the bill.",
    });
  }

  const { data: final } = await svc.from("expenses").select("*").eq("id", created.id).single();
  return Response.json({ expense: final ?? created });
}

export async function GET(req: Request) {
  // Client components use Server Components for reads; this supports ?event_id= &mine=1.
  const { user, error, status } = await requireApprovedUser();
  if (error || !user) return jsonError(error ?? "Not authenticated", status);
  const url = new URL(req.url);
  const event_id = url.searchParams.get("event_id");
  const mine = url.searchParams.get("mine") === "1";

  // Fresh session check for role (anon client reads cookies).
  const anon = await createClient();
  const { data: { user: u } } = await anon.auth.getUser();
  const admin = !!u?.email && isAdminEmail(u.email);

  const svc = await createServiceClient();
  let q = svc.from("expenses").select("*").order("created_at", { ascending: false });
  if (event_id) q = q.eq("event_id", event_id);
  if (mine || !admin) q = q.eq("paid_by", user.id);
  const { data, error: dbErr } = await q;
  if (dbErr) return jsonError(dbErr.message, 500);
  return Response.json({ expenses: data });
}
