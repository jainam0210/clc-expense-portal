import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, requireAdmin, resyncSheet } from "@/lib/api-helpers";
import { ensureBillsFolder } from "@/lib/bills";
import { isOneDriveConfigured } from "@/lib/onedrive";

/** Admin "Sync sheet": (re)creates the event's OneDrive folder if missing, then rewrites the sheet. */
export async function POST(_req: Request, ctx: RouteContext<"/api/events/[id]/sync">) {
  const { id } = await ctx.params;
  const { error } = await requireAdmin();
  if (error) return jsonError(error, 401);
  if (!isOneDriveConfigured()) return jsonError("OneDrive is not connected");

  try {
    await ensureBillsFolder(createServiceClient(), id);
  } catch (e) {
    return jsonError(`Couldn't set up the OneDrive folder: ${(e as Error).message}`, 502);
  }
  const warning = await resyncSheet(id);
  if (warning) return jsonError("Sheet sync failed. Try again in a minute.", 502);
  return Response.json({ ok: true });
}
