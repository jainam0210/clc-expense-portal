import { createServiceClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";
import { jsonError, requireAdmin } from "@/lib/api-helpers";
import { notifyMemberAccount } from "@/lib/notify";

/** Admin approves or declines a member account. Body: { action: "approve" | "reject" }. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/members/[id]">) {
  const { id } = await ctx.params;
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") return jsonError("action must be approve or reject");

  const svc = createServiceClient();
  const { data: target, error: getErr } = await svc.auth.admin.getUserById(id);
  if (getErr || !target?.user) return jsonError("Member not found", 404);
  if (isAdminEmail(target.user.email)) return jsonError("The admin account can't be changed here");

  const approval = action === "approve" ? "approved" : "rejected";
  const { error: upErr } = await svc.auth.admin.updateUserById(id, {
    app_metadata: { ...target.user.app_metadata, approval },
  });
  if (upErr) return jsonError(upErr.message, 500);
  // Only email on an actual change (not re-clicking the same state).
  if (target.user.app_metadata?.approval !== approval && target.user.email) {
    await notifyMemberAccount(target.user.email, (target.user.user_metadata?.display_name as string | undefined) ?? null, approval === "approved");
  }
  return Response.json({ ok: true, approval });
}
