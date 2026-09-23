import type { SupabaseClient } from "@supabase/supabase-js";
import { createEventDrive, deleteDriveItem, isOneDriveConfigured, uploadBill } from "@/lib/onedrive";

/**
 * Bill lifecycle:
 *  - Every upload (submit or edit) goes to Supabase Storage only. That copy is
 *    the source of truth and is never removed while the expense exists.
 *  - Only when the admin approves is the bill pushed to the club OneDrive, so
 *    OneDrive holds verified bills only.
 *  - If an approved expense leaves "approved" (edited → pending) its OneDrive
 *    copy is removed; re-approval pushes it again.
 */

export const MAX_BILL_BYTES = 10 * 1024 * 1024;

type Svc = SupabaseClient;

function cleanName(name: string): string {
  return name.replace(/[\\/:*?"<>|#%&{}$!'@+=`~]/g, "-").slice(0, 80) || "bill";
}

function storageLink(svc: Svc, path: string): string | null {
  return svc.storage.from("bills").getPublicUrl(path).data?.publicUrl ?? null;
}

/** Store an uploaded bill in Supabase Storage (never OneDrive). */
export async function storeBill(svc: Svc, eventId: string, expenseId: string, file: File): Promise<{ bill_path: string; bill_link: string | null }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${eventId}/${expenseId}_${Date.now()}_${cleanName(file.name)}`;
  const { error } = await svc.storage.from("bills").upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`Bill upload failed: ${error.message}`);
  return { bill_path: path, bill_link: storageLink(svc, path) };
}

/** Make sure the event has its OneDrive folder + bills folder + sheet; create lazily if missing. */
export async function ensureBillsFolder(svc: Svc, eventId: string): Promise<string> {
  const { data: event } = await svc.from("events").select("id,name,onedrive_bills_folder_id").eq("id", eventId).single();
  if (!event) throw new Error("Event not found");
  if (event.onedrive_bills_folder_id) return event.onedrive_bills_folder_id;

  const drive = await createEventDrive(event.name);
  await svc.from("events").update({
    onedrive_folder_id: drive.folderId,
    onedrive_bills_folder_id: drive.billsFolderId,
    onedrive_sheet_id: drive.sheetItemId,
    sheet_web_url: drive.sheetWebUrl,
  }).eq("id", event.id);
  return drive.billsFolderId;
}

/**
 * Push the stored bill to OneDrive (called on approval). Returns the columns to
 * save on the expense, or null when OneDrive isn't configured. Throws on failure
 * so the caller can refuse the approval — approved must mean "on OneDrive".
 */
export async function publishBill(
  svc: Svc,
  expense: { id: string; event_id: string; bill_type?: string | null; bill_path: string | null; bill_onedrive_id: string | null }
): Promise<{ bill_onedrive_id: string; bill_link: string | null } | null> {
  if (!isOneDriveConfigured()) return null;
  if (!expense.bill_path) {
    // Legacy row uploaded straight to OneDrive before this flow; nothing to push.
    if (expense.bill_onedrive_id) return null;
    // Cash payments may have no attachment at all.
    if (expense.bill_type === "unbilled_cash") return null;
    throw new Error("This expense has no stored bill to publish");
  }

  const { data: blob, error } = await svc.storage.from("bills").download(expense.bill_path);
  if (error || !blob) throw new Error(`Could not read stored bill: ${error?.message ?? "missing file"}`);

  const billsFolderId = await ensureBillsFolder(svc, expense.event_id);
  const originalName = expense.bill_path.split("/").pop()!.replace(/^[^_]+_\d+_/, "");
  const up = await uploadBill(billsFolderId, expense.id, originalName, Buffer.from(await blob.arrayBuffer()), blob.type || "application/octet-stream");

  // Replace any stale copy from an earlier approval.
  if (expense.bill_onedrive_id && expense.bill_onedrive_id !== up.itemId) await deleteDriveItem(expense.bill_onedrive_id);
  return { bill_onedrive_id: up.itemId, bill_link: up.link };
}

/**
 * Remove the OneDrive copy (expense no longer approved) and point the link back
 * at our stored copy. Legacy rows with no stored copy keep their OneDrive bill.
 */
export async function unpublishBill(
  svc: Svc,
  expense: { bill_path: string | null; bill_onedrive_id: string | null }
): Promise<{ bill_onedrive_id: null; bill_link: string | null } | null> {
  if (!expense.bill_onedrive_id || !expense.bill_path) return null;
  if (isOneDriveConfigured()) await deleteDriveItem(expense.bill_onedrive_id);
  return { bill_onedrive_id: null, bill_link: storageLink(svc, expense.bill_path) };
}

/** Delete every copy of a bill (expense deleted). Best-effort. */
export async function purgeBill(svc: Svc, expense: { bill_path: string | null; bill_onedrive_id: string | null }): Promise<void> {
  try {
    if (expense.bill_onedrive_id && isOneDriveConfigured()) await deleteDriveItem(expense.bill_onedrive_id);
    if (expense.bill_path) await svc.storage.from("bills").remove([expense.bill_path]);
  } catch (e) {
    console.error("Bill cleanup failed:", e);
  }
}
