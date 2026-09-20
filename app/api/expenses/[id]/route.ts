import { createServiceClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";
import { jsonError, requireApprovedUser, resyncSheet } from "@/lib/api-helpers";
import { MAX_BILL_BYTES, purgeBill, storeBill, unpublishBill } from "@/lib/bills";
import { notifyAdminSubmitted } from "@/lib/notify";
import { BILL_ATTACHMENT, BILL_TYPES, type BillType } from "@/lib/types";

async function loadExpense(svc: Awaited<ReturnType<typeof createServiceClient>>, id: string) {
  const { data } = await svc.from("expenses").select("id,event_id,paid_by,status,bill_type,bill_path,bill_onedrive_id").eq("id", id).single();
  return data as null | {
    id: string;
    event_id: string;
    paid_by: string;
    status: string;
    bill_type: BillType | null;
    bill_path: string | null;
    bill_onedrive_id: string | null;
  };
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/expenses/[id]">) {
  const { id } = await ctx.params;
  const { user, error, status } = await requireApprovedUser();
  if (error || !user) return jsonError(error ?? "Not authenticated", status);

  const svc = await createServiceClient();
  const existing = await loadExpense(svc, id);
  if (!existing) return jsonError("Expense not found", 404);
  if (existing.status === "reimbursed") return jsonError("Reimbursed expenses cannot be edited", 403);
  const admin = isAdminEmail(user.email);
  if (!admin && existing.paid_by !== user.id) return jsonError("Not allowed", 403);

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("Expected form data");

  const patch: Record<string, string | number | null> = {};
  const item_desc = String(form.get("item_desc") ?? "").trim();
  const vendor_name = String(form.get("vendor_name") ?? "").trim();
  const amountRaw = form.get("amount");
  const invoice_date = String(form.get("invoice_date") ?? "").trim();
  const invoice_number = String(form.get("invoice_number") ?? "").trim();

  if (item_desc) patch.item_desc = item_desc;
  if (vendor_name) patch.vendor_name = vendor_name;
  if (amountRaw !== null && String(amountRaw) !== "") {
    const amount = Number(amountRaw);
    if (Number.isNaN(amount) || amount <= 0) return jsonError("Valid amount is required");
    patch.amount = amount;
  }
  if (invoice_date) patch.invoice_date = invoice_date;
  if (form.has("invoice_number")) patch.invoice_number = invoice_number || null;
  if (form.has("bill_type")) {
    const bt = String(form.get("bill_type")) as BillType;
    if (!BILL_TYPES.includes(bt)) return jsonError("Invalid bill type");
    patch.bill_type = bt;
  }

  // Any edit after approval or rejection moves back to pending (sheet row removed until re-approval).
  if (existing.status === "approved" || existing.status === "rejected") patch.status = "pending";

  const bill = form.get("bill") as File | null;
  const newBill = bill && bill instanceof File && bill.size > 0 ? bill : null;
  if (newBill && newBill.size > MAX_BILL_BYTES) return jsonError("Bill file must be under 10MB");
  if (Object.keys(patch).length === 0 && !newBill) return jsonError("Nothing to update");
  const finalType = (patch.bill_type as BillType | undefined) ?? existing.bill_type ?? "digital";
  if (!newBill && !existing.bill_path && !existing.bill_onedrive_id && BILL_ATTACHMENT[finalType].required) {
    return jsonError(`${BILL_ATTACHMENT[finalType].label} is required for this type`);
  }

  // New bills always go to our storage first, never straight to OneDrive.
  let stored: { bill_path: string; bill_link: string | null } | null = null;
  if (newBill) {
    try {
      stored = await storeBill(svc, existing.event_id, existing.id, newBill);
      Object.assign(patch, stored);
    } catch (e) {
      console.error("Bill replace failed:", e);
      return jsonError("Bill upload failed", 500);
    }
  }

  // Leaving "approved" means the bill is no longer verified: pull it off OneDrive.
  if (patch.status === "pending" && existing.bill_onedrive_id) {
    const pulled = await unpublishBill(svc, { bill_path: stored?.bill_path ?? existing.bill_path, bill_onedrive_id: existing.bill_onedrive_id });
    if (pulled) Object.assign(patch, pulled);
  }

  const { data, error: dbErr } = await svc.from("expenses").update(patch).eq("id", id).select("*").single();
  if (dbErr) return jsonError(dbErr.message, 500);
  if (stored && existing.bill_path) await svc.storage.from("bills").remove([existing.bill_path]).catch(() => null);
  // Back in the review queue (was approved/rejected) → tell the admin.
  if (patch.status === "pending" && data) await notifyAdminSubmitted(data, "edited");

  const warning = await resyncSheet(existing.event_id);
  return Response.json({ expense: data, warning });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/expenses/[id]">) {
  const { id } = await ctx.params;
  const { user, error, status } = await requireApprovedUser();
  if (error || !user) return jsonError(error ?? "Not authenticated", status);

  const svc = await createServiceClient();
  const existing = await loadExpense(svc, id);
  if (!existing) return jsonError("Expense not found", 404);
  if (existing.status === "reimbursed") return jsonError("Reimbursed expenses cannot be deleted", 403);
  const admin = isAdminEmail(user.email);
  if (!admin && existing.paid_by !== user.id) return jsonError("Not allowed", 403);

  const { error: dbErr } = await svc.from("expenses").delete().eq("id", id);
  if (dbErr) return jsonError(dbErr.message, 500);

  await purgeBill(svc, existing);
  const warning = await resyncSheet(existing.event_id);
  return Response.json({ ok: true, warning });
}
