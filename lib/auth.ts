/** The single admin account. Public so the browser can route the admin; set it in the environment. */
export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
}

export function roleForEmail(email: string | null | undefined): "admin" | "member" {
  return isAdminEmail(email) ? "admin" : "member";
}

export type Approval = "pending" | "approved" | "rejected";

/**
 * Member approval lives in auth `app_metadata.approval`, which only the service
 * role can write. New signups have none → pending until the admin approves.
 * The admin is always approved.
 */
export function approvalOf(user: { email?: string | null; app_metadata?: Record<string, unknown> } | null | undefined): Approval {
  if (!user) return "pending";
  if (isAdminEmail(user.email)) return "approved";
  const a = user.app_metadata?.approval;
  return a === "approved" || a === "rejected" ? a : "pending";
}
