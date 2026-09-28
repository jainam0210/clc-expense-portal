import { createServiceClient } from "@/lib/supabase/server";
import { approvalOf, type Approval } from "@/lib/auth";

/** Approval status of every account, keyed by user id (server-only; uses the service role). */
export async function listApprovals(): Promise<Map<string, Approval>> {
  const svc = createServiceClient();
  const out = new Map<string, Approval>();
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) out.set(u.id, approvalOf(u));
    if (data.users.length < 1000) break;
  }
  return out;
}
