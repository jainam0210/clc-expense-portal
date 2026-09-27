// Seed the single admin user via the Supabase Auth admin API.
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   NEXT_PUBLIC_ADMIN_EMAIL=admin@yourclub.org ADMIN_PASSWORD='<strong password>' node scripts/seed-admin.mjs

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_ADMIN_EMAIL and ADMIN_PASSWORD");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { approval: "approved" }, user_metadata: { display_name: "Admin" } }),
});
if (!res.ok) {
  console.error(`Seed failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log(`Admin seeded: ${email}`);
