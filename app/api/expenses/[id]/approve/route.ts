import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, requireAdmin, resyncSheet } from "@/lib/api-helpers";
import { notifyMemberDecision } from "@/lib/notify";
import { publishBill } from "@/lib/bills";

export async function POST(_req: Request, ctx: RouteContext<"/api/expenses/[id]/approve">) {
  const { id } = await ctx.params;
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);

  const svc = await createServiceClient();
  const { data: existing } = await svc
    .from("expenses")
    .select("id,event_id,status,bill_type,bill_path,bill_onedrive_id")
    .eq("id", id)
    .single();
  if (!existing) return jsonError("Expense not found", 404);
  if (existing.status !== "pending" && existing.status !== "rejected") {
    return jsonError(`Only pending expenses can be approved (current: ${existing.status})`);
  }

  // Only now — on approval — does the verified bill go to the club OneDrive.
  // If the push fails the expense stays pending, so "approved" always means "on OneDrive".
  let published: Awaited<ReturnType<typeof publishBill>> = null;
  try {
    published = await publishBill(svc, existing);
  } catch (e) {
    console.error("OneDrive bill push failed:", e);
    return jsonError(`Could not upload the bill to OneDrive, so the expense was not approved. ${(e as Error).message}`, 502);
  }

  const { data, error: dbErr } = await svc
    .from("expenses")
    .update({ status: "approved", ...(published ?? {}) })
    .eq("id", id)
    .select("*")
    .single();
  if (dbErr) return jsonError(dbErr.message, 500);

  // Sheet row appears only after approval.
  const warning = await resyncSheet(existing.event_id);
  if (data) await notifyMemberDecision(data, "approved");
  return Response.json({ expense: data, warning });
}
