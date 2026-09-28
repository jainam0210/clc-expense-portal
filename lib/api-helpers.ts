import { createClient, createServiceClient } from "@/lib/supabase/server";
import { approvalOf, isAdminEmail } from "@/lib/auth";
import { isOneDriveConfigured, syncSheetToOneDrive } from "@/lib/onedrive";
import type { Expense } from "@/lib/types";

export async function requireUser() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  return { user, error: null };
}

/** Signed in AND approved by the admin (members awaiting approval can't touch expenses). */
export async function requireApprovedUser() {
  const { user, error } = await requireUser();
  if (error || !user) return { user: null, error: "Not authenticated" as const, status: 401 };
  if (approvalOf(user) !== "approved") return { user: null, error: "Your account is waiting for admin approval" as const, status: 403 };
  return { user, error: null, status: 200 };
}

export async function requireAdmin() {
  const { user, error } = await requireUser();
  if (error || !user) return { user: null, error: "Not authenticated" as const };
  if (!isAdminEmail(user.email)) return { user: null, error: "Admin only" as const };
  return { user, error: null };
}

export function jsonError(error: string, status = 400) {
  return Response.json({ error }, { status });
}

/** Load event + its sheet-visible expenses (approved/reimbursed) with payer emails. */
export async function getSheetExpenses(eventId: string): Promise<{ event: { id: string; name: string; onedrive_folder_id: string | null } | null; expenses: Expense[] }> {
  const svc = createServiceClient();
  const { data: event } = await svc.from("events").select("id,name,onedrive_folder_id").eq("id", eventId).single();
  const { data: rows } = await svc
    .from("expenses")
    .select("*")
    .eq("event_id", eventId)
    .in("status", ["approved", "reimbursed"])
    .order("created_at", { ascending: true });
  const list = (rows ?? []) as Expense[];
  const payerIds = [...new Set(list.map((r) => r.paid_by))];
  const emailById = new Map<string, string>();
  const nameById = new Map<string, string | null>();
  if (payerIds.length > 0) {
    const { data: profiles } = await svc.from("profiles").select("id,email,display_name").in("id", payerIds);
    for (const p of (profiles ?? []) as Array<{ id: string; email: string; display_name: string | null }>) {
      emailById.set(p.id, p.email);
      nameById.set(p.id, p.display_name);
    }
  }
  const expenses: Expense[] = list.map((r) => ({
    ...r,
    payer_email: emailById.get(r.paid_by) ?? r.paid_by,
    payer_name: nameById.get(r.paid_by) ?? null,
  }));
  return { event, expenses };
}

/**
 * Bring the event's live OneDrive sheet up to date after any sheet-visible change.
 * Never throws: returns a warning to show the admin when the sync failed, so a
 * failure is visible (and retryable with "Sync sheet") instead of silent.
 */
export async function resyncSheet(eventId: string): Promise<string | null> {
  if (!isOneDriveConfigured()) return null;
  try {
    const svc = createServiceClient();
    const { data: ev } = await svc.from("events").select("onedrive_sheet_id").eq("id", eventId).single();
    const { event, expenses } = await getSheetExpenses(eventId);
    if (!event?.onedrive_folder_id) return null;
    const synced = await syncSheetToOneDrive(event.onedrive_folder_id, ev?.onedrive_sheet_id ?? null, event.name, expenses);
    await svc.from("events").update({
      onedrive_sheet_id: synced.sheetItemId,
      sheet_web_url: synced.sheetWebUrl,
    }).eq("id", eventId);
    return null;
  } catch (e) {
    console.error("Sheet resync failed:", e);
    return "Saved, but the OneDrive sheet couldn't be updated. Use “Sync sheet” on the event page to retry.";
  }
}
