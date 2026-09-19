import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, requireAdmin, resyncSheet } from "@/lib/api-helpers";
import { deleteDriveItem, isOneDriveConfigured } from "@/lib/onedrive";

export async function PATCH(req: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);

  const body = await req.json().catch(() => null);
  const patch: Record<string, string | null> = {};
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return jsonError("Event name cannot be empty");
    patch.name = name;
  }
  if (body?.event_date !== undefined) patch.event_date = body.event_date || null;
  if (body?.description !== undefined) patch.description = String(body.description ?? "").trim() || null;
  if (Object.keys(patch).length === 0) return jsonError("Nothing to update");

  const svc = await createServiceClient();
  const { data, error: dbErr } = await svc.from("events").update(patch).eq("id", id).select("*").single();
  if (dbErr || !data) return jsonError(dbErr?.message ?? "Event not found", dbErr ? 500 : 404);

  // The sheet doesn't embed the event name in rows, but keep it fresh anyway.
  const warning = patch.name ? await resyncSheet(id) : null;
  return Response.json({ event: data, warning });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);

  const svc = await createServiceClient();
  const { data: event } = await svc.from("events").select("id,onedrive_folder_id").eq("id", id).single();
  if (!event) return jsonError("Event not found", 404);

  // Reimbursed money is final — refuse to wipe an event that has any.
  const { count } = await svc
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id)
    .eq("status", "reimbursed");
  if ((count ?? 0) > 0) return jsonError("This event has reimbursed expenses and cannot be deleted", 403);

  const { data: bills } = await svc.from("expenses").select("bill_path").eq("event_id", id).not("bill_path", "is", null);
  const { error: dbErr } = await svc.from("events").delete().eq("id", id);
  if (dbErr) return jsonError(dbErr.message, 500);

  // Best-effort cleanup of stored bills and the OneDrive folder.
  const paths = (bills ?? []).map((b) => b.bill_path as string);
  if (paths.length > 0) await svc.storage.from("bills").remove(paths).catch(() => null);
  if (isOneDriveConfigured() && event.onedrive_folder_id) await deleteDriveItem(event.onedrive_folder_id);

  return Response.json({ ok: true });
}
