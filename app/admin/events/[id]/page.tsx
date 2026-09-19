import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { AdminExpenseCard, AdminExpenseRow } from "@/components/AdminExpenseRow";
import EventSettings from "@/components/EventSettings";
import Disclosure from "@/components/Disclosure";
import ExpenseForm from "@/components/ExpenseForm";
import RefreshButton from "@/components/RefreshButton";
import SettleButton from "@/components/SettleButton";
import { createClient } from "@/lib/supabase/server";
import { isOneDriveConfigured } from "@/lib/onedrive";
import { isAdminEmail } from "@/lib/auth";
import { cn, formatDate, formatINR } from "@/lib/utils";
import type { ExpenseStatus } from "@/lib/types";

const FILTERS: Array<ExpenseStatus | "all"> = ["all", "pending", "approved", "rejected", "reimbursed"];

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status: rawStatus } = await searchParams;
  const filter = FILTERS.includes(rawStatus as ExpenseStatus) ? (rawStatus as ExpenseStatus) : "all";
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  const { data: event } = await sb.from("events").select("*").eq("id", id).single();
  if (!event) redirect("/admin");

  const { data: expensesRaw } = await sb
    .from("expenses")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  const rawList = (expensesRaw ?? []) as Array<Record<string, unknown> & { paid_by: string }>;
  const payerIds = [...new Set(rawList.map((e) => e.paid_by))];
  const emailById = new Map<string, string>();
  const nameById = new Map<string, string | null>();
  if (payerIds.length > 0) {
    const { data: profiles } = await sb.from("profiles").select("id,email,display_name").in("id", payerIds);
    for (const p of (profiles ?? []) as Array<{ id: string; email: string; display_name: string | null }>) {
      emailById.set(p.id, p.email);
      nameById.set(p.id, p.display_name);
    }
  }

  const allRows = rawList.map((e) => ({
    ...(e as object),
    payer_email: emailById.get(e.paid_by) ?? e.paid_by,
    payer_name: nameById.get(e.paid_by) ?? null,
  })) as Parameters<typeof AdminExpenseRow>[0]["expense"][];

  const rows = filter === "all" ? allRows : allRows.filter((e) => e.status === filter);
  // Per-member payouts for this event: owed = approved but not yet reimbursed.
  type Payout = { id: string; name: string; email: string; owed: number; reimbursed: number; pending: number; lastPaid: string | null };
  const payoutMap = new Map<string, Payout>();
  for (const e of allRows) {
    const p = payoutMap.get(e.paid_by) ?? { id: e.paid_by, name: e.payer_name ?? e.payer_email ?? "Member", email: e.payer_email ?? "", owed: 0, reimbursed: 0, pending: 0, lastPaid: null };
    const amt = Number(e.amount);
    if (e.status === "approved") p.owed += amt;
    if (e.status === "pending") p.pending += amt;
    if (e.status === "reimbursed") {
      p.reimbursed += amt;
      if (e.reimbursed_at && (!p.lastPaid || e.reimbursed_at > p.lastPaid)) p.lastPaid = e.reimbursed_at;
    }
    payoutMap.set(e.paid_by, p);
  }
  const payouts = [...payoutMap.values()].filter((p) => p.owed + p.reimbursed > 0).sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name));
  const totalOwed = payouts.reduce((s, p) => s + p.owed, 0);

  const approvedTotal = allRows.filter((e) => e.status === "approved" || e.status === "reimbursed").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      <Navbar role="admin" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Link href="/admin" className="text-sm text-zinc-500 transition hover:text-zinc-200">← All events</Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{event.name}</h1>
          <RefreshButton className="mt-1" />
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Approved total: <span className="font-mono font-semibold tabular-nums text-zinc-100">{formatINR(approvedTotal)}</span> · {allRows.length} expense(s)
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {event.sheet_web_url ? (
            <><a className="link" href={event.sheet_web_url} target="_blank" rel="noreferrer">Open sheet</a> · </>
          ) : null}
          <a className="link" href={`/api/events/${event.id}/export`}>Download</a>
        </p>
        <div className="mt-4">
          <EventSettings event={event} canSync={isOneDriveConfigured()} />
        </div>

        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">Payouts</h2>
            <p className="text-sm text-zinc-500">
              Owed <span className="font-mono tabular-nums text-zinc-100">{formatINR(totalOwed)}</span>
            </p>
          </div>
          {payouts.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-500">No approved expenses yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {payouts.map((p) => (
                <li key={p.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{p.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Reimbursed <span className="font-mono tabular-nums text-zinc-300">{formatINR(p.reimbursed)}</span>
                      {p.lastPaid ? ` · last on ${formatDate(p.lastPaid)}` : ""}
                      {p.pending > 0 ? <> · <span className="text-amber-300/80">{formatINR(p.pending)} pending</span></> : null}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="sm:text-right">
                      <p className="text-xs text-zinc-500">Owed</p>
                      <p className={`font-mono text-sm tabular-nums ${p.owed > 0 ? "text-amber-300" : "text-zinc-600"}`}>{formatINR(p.owed)}</p>
                    </div>
                    {p.owed > 0 ? (
                      <SettleButton eventId={event.id} paidBy={p.id} name={p.name} amount={p.owed} />
                    ) : (
                      <span className="text-xs text-emerald-300">Settled</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <h2 className="mt-10 text-base font-semibold tracking-tight sm:text-lg">Expenses</h2>
        <div className="mt-3 flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const n = f === "all" ? allRows.length : allRows.filter((e) => e.status === f).length;
            return (
              <Link
                key={f}
                href={f === "all" ? `/admin/events/${id}` : `/admin/events/${id}?status=${f}`}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                  filter === f ? "bg-white text-black" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {f} <span className={filter === f ? "text-zinc-500" : "text-zinc-600"}>{n}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile: cards */}
        <div className="mt-5 flex flex-col gap-2.5 md:hidden">
          {rows.map((e) => (
            <AdminExpenseCard key={e.id} expense={e} />
          ))}
          {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">{filter === "all" ? "No expenses yet." : `No ${filter} expenses.`}</p> : null}
        </div>

        {/* Desktop: table */}
        <div className="mt-5 hidden overflow-x-auto card md:block">
          <table className="w-full min-w-3xl">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-3 font-medium">Item / Vendor</th>
                <th className="px-3 py-3 font-medium">Amount / Invoice</th>
                <th className="px-3 py-3 font-medium">Paid by</th>
                <th className="px-3 py-3 font-medium">Status / Bill</th>
                <th className="px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <AdminExpenseRow key={e.id} expense={e} />
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="p-6 text-center text-sm text-zinc-500">{filter === "all" ? "No expenses yet." : `No ${filter} expenses.`}</p> : null}
        </div>
        <div className="mt-6 max-w-xl">
          <Disclosure title="Add expense">
            <ExpenseForm embedded eventId={id} />
          </Disclosure>
        </div>
      </main>
    </>
  );
}
