import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, requireAdmin } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const { user, error } = await requireAdmin();
  if (error || !user) return jsonError(error ?? "Admin only", 401);

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");
  if (password.length < 6) return jsonError("Password must be at least 6 characters");

  const svc = await createServiceClient();
  const { error: upErr } = await svc.auth.admin.updateUserById(user.id, { password });
  if (upErr) return jsonError(upErr.message, 500);
  return Response.json({ ok: true });
}
