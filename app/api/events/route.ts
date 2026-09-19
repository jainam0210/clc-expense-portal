import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, requireAdmin } from "@/lib/api-helpers";
import { createEventDrive, isOneDriveConfigured } from "@/lib/onedrive";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);
  const svc = await createServiceClient();
  const { data, error: dbErr } = await svc.from("events").select("*").order("created_at", { ascending: false });
  if (dbErr) return jsonError(dbErr.message, 500);
  return Response.json({ events: data });
}

export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return jsonError("Event name is required");
  const event_date = body?.event_date || null;
  const description = body?.description || null;

  const svc = await createServiceClient();
  const { data: { user } } = await (await import("@/lib/supabase/server")).createClient().then((c) => c.auth.getUser());

  const { data: event, error: dbErr } = await svc
    .from("events")
    .insert({ name, event_date, description, created_by: user?.id ?? null })
    .select("*")
    .single();
  if (dbErr || !event) return jsonError(dbErr?.message ?? "Failed to create event", 500);

  // OneDrive: folder + bills + sheet. Best-effort so event creation never fails.
  if (isOneDriveConfigured()) {
    try {
      const drive = await createEventDrive(name);
      await svc.from("events").update({
        onedrive_folder_id: drive.folderId,
        onedrive_bills_folder_id: drive.billsFolderId,
        onedrive_sheet_id: drive.sheetItemId,
        sheet_web_url: drive.sheetWebUrl,
      }).eq("id", event.id);
      const { data: updated } = await svc.from("events").select("*").eq("id", event.id).single();
      return Response.json({ event: updated ?? event });
    } catch (e) {
      console.error("OneDrive event setup failed:", e);
      return Response.json({ event, warning: "Event created, but OneDrive setup failed. Check Azure env vars." });
    }
  }

  return Response.json({ event });
}
