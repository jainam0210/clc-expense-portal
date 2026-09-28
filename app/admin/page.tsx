import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import RefreshButton from "@/components/RefreshButton";
import CreateEventForm from "@/components/CreateEventForm";
import Disclosure from "@/components/Disclosure";
import ExpenseForm from "@/components/ExpenseForm";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";
import { isOneDriveConfigured } from "@/lib/onedrive";
import { listApprovals } from "@/lib/members";
import { formatDate, formatINR } from "@/lib/utils";

export default async function AdminPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  const { data: events } = await sb.from("events").select("*").order("created_at", { ascending: false });
  const { data: pendingRaw } = await sb
    .from("expenses")
    .select("id,item_desc,amount,event_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  const pendingEventIds = [...new Set(((pendingRaw ?? []) as Array<{ event_id: string }>).map((e) => e.event_id))];
  const pendingEventName = new Map<string, string>();
  if (pendingEventIds.length > 0) {
    const { data: pev } = await sb.from("events").select("id,name").in("id", pendingEventIds);
    for (const ev of (pev ?? []) as Array<{ id: string; name: string }>) pendingEventName.set(ev.id, ev.name);
  }
  const pending = ((pendingRaw ?? []) as Array<{ id: string; item_desc: string; amount: number; event_id: string }>).map((e) => ({
    ...e,
    event_name: pendingEventName.get(e.event_id) ?? "",
  }));
  const { data: all } = await sb.from("expenses").select("amount,status");
  const pendingMembers = [...(await listApprovals()).values()].filter((a) => a === "pending").length;

  const totalApproved = (all ?? []).filter((e) => e.status === "approved" || e.status === "reimbursed").reduce((s, e) => s + Number(e.amount), 0);
  const totalReimbursed = (all ?? []).filter((e) => e.status === "reimbursed").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      <Navbar role="admin" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
          <RefreshButton className="mt-1" />
        </div>
        {pendingMembers > 0 ? (
          <Link href="/admin/members" className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-200 transition hover:bg-amber-500/[0.08]">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              {pendingMembers} new member{pendingMembers === 1 ? "" : "s"} waiting for approval
            </span>
            <span className="font-medium">Review →</span>
          </Link>
        ) : null}
        {!isOneDriveConfigured() ? (
          <p className="alert-warn mt-3">OneDrive isn&apos;t connected. Bills and sheets won&apos;t sync.</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="card p-3 sm:p-4">
            <p className="eyebrow truncate tracking-wider sm:tracking-[0.12em]">Events</p>
            <p className="mt-2 font-mono text-xl font-medium tabular-nums sm:text-2xl">{events?.length ?? 0}</p>
          </div>
          <div className="card p-3 sm:p-4">
            <p className="eyebrow truncate tracking-wider sm:tracking-[0.12em]">Approved</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-zinc-100 sm:text-2xl">{formatINR(totalApproved)}</p>
          </div>
          <div className="card p-3 sm:p-4">
            <p className="eyebrow truncate tracking-wider sm:tracking-[0.12em]">Reimbursed</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-zinc-100 sm:text-2xl">{formatINR(totalReimbursed)}</p>
          </div>
        </div>

      <div className="card mt-6 p-5">
          <h3 className="text-base font-semibold tracking-tight">Pending approvals ({pending.length})</h3>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Nothing pending.</p>
          ) : (
            <ul className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
              {pending.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-black px-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-zinc-300">{e.item_desc} · <span className="font-mono tabular-nums">₹{Number(e.amount).toFixed(2)}</span> · <span className="text-zinc-500">{e.event_name}</span></span>
                  <Link className="shrink-0 link" href={`/admin/events/${e.event_id}`}>Review</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <h2 className="mt-8 text-base font-semibold tracking-tight sm:text-lg">All events</h2>
        {(events ?? []).length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">No events yet — create one below.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {(events ?? []).map((ev) => (
              <li key={ev.id} className="flex flex-col card p-5">
                <p className="font-semibold text-zinc-100">{ev.name}</p>
                {ev.event_date ? <p className="mt-0.5 text-xs text-zinc-500">{formatDate(ev.event_date)}</p> : null}
                {ev.sheet_web_url ? (
                  <p className="mt-1.5 text-sm"><a className="link" href={ev.sheet_web_url} target="_blank" rel="noreferrer">Open sheet</a></p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <Link href={`/admin/events/${ev.id}`} className="btn-primary flex-1">Manage</Link>
                  <Link href={`/api/events/${ev.id}/export`} className="btn-secondary flex-1">Download</Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
          <Disclosure title="Create event" defaultOpen={(events ?? []).length === 0}>
            <CreateEventForm embedded />
          </Disclosure>
          {(events ?? []).length > 0 ? (
            <Disclosure title="Add expense">
              <ExpenseForm embedded eventId={events![0].id} events={events!.map((ev) => ({ id: ev.id, name: ev.name }))} />
            </Disclosure>
          ) : null}
        </div>
      </main>
    </>
  );
}
