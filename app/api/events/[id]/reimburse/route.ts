import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, requireAdmin, resyncSheet } from "@/lib/api-helpers";
import { notifyMemberSettled } from "@/lib/notify";

/**
 * Admin settles up with one member for one event: every APPROVED expense they
 * paid for in this event becomes reimbursed (pending/rejected are untouched).
 * Body: { paid_by: <user id> }.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/events/[id]/reimburse">) {
  const { id } = await ctx.params;
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);

  const body = await req.json().catch(() => null);
  const paidBy = String(body?.paid_by ?? "");
  if (!paidBy) return jsonError("paid_by is required");

  const svc = createServiceClient();
  const { data, error: dbErr } = await svc
    .from("expenses")
    .update({ status: "reimbursed", reimbursed_at: new Date().toISOString() })
    .eq("event_id", id)
    .eq("paid_by", paidBy)
    .eq("status", "approved")
    .select("id,amount");
  if (dbErr) return jsonError(dbErr.message, 500);
  if (!data || data.length === 0) return jsonError("Nothing approved to reimburse for this member");

  const warning = await resyncSheet(id);
  const total = data.reduce((s, e) => s + Number(e.amount), 0);
  await notifyMemberSettled(id, paidBy, data.length, total);
  return Response.json({ count: data.length, total, warning });
}
