import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, requireAdmin, resyncSheet } from "@/lib/api-helpers";
import { notifyMemberDecision } from "@/lib/notify";

export async function POST(_req: Request, ctx: RouteContext<"/api/expenses/[id]/reimburse">) {
  const { id } = await ctx.params;
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);

  const svc = await createServiceClient();
  const { data: existing } = await svc.from("expenses").select("id,event_id,status").eq("id", id).single();
  if (!existing) return jsonError("Expense not found", 404);
  if (existing.status !== "approved") return jsonError("Only approved expenses can be reimbursed");

  const { data, error: dbErr } = await svc
    .from("expenses")
    .update({ status: "reimbursed", reimbursed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (dbErr) return jsonError(dbErr.message, 500);

  const warning = await resyncSheet(existing.event_id);
  if (data) await notifyMemberDecision(data, "reimbursed");
  return Response.json({ expense: data, warning });
}
