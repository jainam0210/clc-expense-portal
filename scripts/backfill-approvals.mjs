// One-time: mark every existing account as approved so the new member-approval
// gate doesn't lock out people who registered before it existed.
// Usage: node --env-file=.env.local scripts/backfill-approvals.mjs
import { createClient } from "@supabase/supabase-js";

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let page = 1, updated = 0, skipped = 0;
for (;;) {
  const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) {
    if (u.app_metadata?.approval) { skipped++; continue; }
    const { error: e } = await svc.auth.admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, approval: "approved" } });
    if (e) console.error(u.email, e.message); else updated++;
  }
  if (data.users.length < 1000) break;
  page++;
}
console.log(`approved ${updated} existing account(s), ${skipped} already had a status`);
