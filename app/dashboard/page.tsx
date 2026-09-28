import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import RefreshButton from "@/components/RefreshButton";
import MemberExpenseItem from "@/components/MemberExpenseItem";
import { createClient } from "@/lib/supabase/server";
import PendingApproval from "@/components/PendingApproval";
import { approvalOf, isAdminEmail } from "@/lib/auth";
import { notifyAdminNewMember } from "@/lib/notify";
import { formatDate, formatINR } from "@/lib/utils";

export default async function DashboardPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if (isAdminEmail(user.email)) redirect("/admin");
  if (approvalOf(user) !== "approved") {
    if (approvalOf(user) === "pending") await notifyAdminNewMember(user);
    return (
      <>
        <Navbar role="member" />
        <PendingApproval approval={approvalOf(user)} email={user.email} />
      </>
    );
  }

  const { data: events } = await sb.from("events").select("*").order("created_at", { ascending: false });
  const { data: mine } = await sb
    .from("expenses")
    .select("*")
    .eq("paid_by", user.id)
    .order("created_at", { ascending: false });

  const myExpenses = mine ?? [];
  const sum = (list: typeof myExpenses) => list.reduce((s, e) => s + Number(e.amount), 0);
  const stats: Array<[string, number, string]> = [
    ["Submitted", sum(myExpenses), "text-zinc-100"],
    ["Approved", sum(myExpenses.filter((e) => e.status === "approved" || e.status === "reimbursed")), "text-zinc-400"],
    ["Reimbursed", sum(myExpenses.filter((e) => e.status === "reimbursed")), "text-zinc-400"],
    ["To be reimbursed", sum(myExpenses.filter((e) => e.status === "approved")), "text-zinc-400"],
  ];

  const byEvent = new Map<string, typeof myExpenses>();
  for (const e of myExpenses) {
    const arr = byEvent.get(e.event_id) ?? [];
    arr.push(e);
    byEvent.set(e.event_id, arr);
  }
  const eventName = (id: string) => events?.find((ev) => ev.id === id)?.name ?? "Event";

  return (
    <>
      <Navbar role="member" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My expenses</h1>
          <RefreshButton className="mt-1" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(([label, val, color]) => (
            <div key={label} className="card p-4">
              <p className="eyebrow">{label}</p>
              <p className={`mt-2 font-mono text-xl font-medium tabular-nums sm:text-2xl ${color}`}>{formatINR(val)}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-8 text-base font-semibold tracking-tight sm:text-lg">Events</h2>
        {(events ?? []).length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">No events yet.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {(events ?? []).map((ev) => (
              <li key={ev.id} className="flex flex-col card p-5">
                <p className="font-semibold text-zinc-100">{ev.name}</p>
                {ev.event_date ? <p className="mt-0.5 text-xs text-zinc-500">{formatDate(ev.event_date)}</p> : null}
                {ev.description ? <p className="mt-1.5 line-clamp-2 text-sm text-zinc-400">{ev.description}</p> : null}
                <Link href={`/dashboard/events/${ev.id}`} className="mt-4 btn-primary">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-8 text-base font-semibold tracking-tight sm:text-lg">History</h2>
        {myExpenses.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nothing added yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-6">
            {[...byEvent.entries()].map(([eventId, list]) => (
              <section key={eventId}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold text-zinc-200">{eventName(eventId)}</h3>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-400">{formatINR(sum(list))}</span>
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {list.map((e) => (
                    <MemberExpenseItem key={e.id} expense={e} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
