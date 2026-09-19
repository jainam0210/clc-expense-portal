import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, requireApprovedUser } from "@/lib/api-helpers";
import { buildExpenseWorkbook } from "@/lib/excel";

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/export">) {
  const { id } = await ctx.params;
  const { user, error, status } = await requireApprovedUser();
  if (error || !user) return jsonError(error ?? "Not authenticated", status);

  const svc = await createServiceClient();
  const { data: event } = await svc.from("events").select("id,name").eq("id", id).single();
  if (!event) return jsonError("Event not found", 404);

  const { data: rows } = await svc
    .from("expenses")
    .select("*")
    .eq("event_id", id)
    .in("status", ["approved", "reimbursed"])
    .order("created_at", { ascending: true });

  const list = (rows ?? []) as Array<Record<string, unknown>>;
  const payerIds = [...new Set(list.map((r) => String((r as { paid_by: string }).paid_by)))];
  const emailById = new Map<string, string>();
  if (payerIds.length > 0) {
    const { data: profiles } = await svc.from("profiles").select("id,email").in("id", payerIds);
    for (const p of (profiles ?? []) as Array<{ id: string; email: string }>) emailById.set(p.id, p.email);
  }
  const expenses = list.map((r) => ({
    ...(r as object),
    payer_email: emailById.get(String((r as { paid_by: string }).paid_by)) ?? String((r as { paid_by: string }).paid_by),
  }));

  const buf = await buildExpenseWorkbook(event.name, expenses as never);
  const bytes = new Uint8Array(buf);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${event.name.replace(/[^a-z0-9-_]+/gi, "-")}-expenses.xlsx"`,
    },
  });
}
