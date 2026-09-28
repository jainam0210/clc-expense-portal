import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import RefreshButton from "@/components/RefreshButton";
import { createClient } from "@/lib/supabase/server";
import MemberApprovalButtons from "@/components/MemberApprovalButtons";
import { isAdminEmail } from "@/lib/auth";
import { listApprovals } from "@/lib/members";
import { formatINR } from "@/lib/utils";

type Row = { paid_by: string; amount: number; status: string };
type Totals = { submitted: number; pending: number; approved: number; reimbursed: number; count: number };

export default async function AdminMembersPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  const { data: profiles } = await sb.from("profiles").select("id,email,display_name,role").order("display_name");
  const { data: expenses } = await sb.from("expenses").select("paid_by,amount,status");
  const approvals = await listApprovals();

  const byUser = new Map<string, Totals>();
  for (const e of (expenses ?? []) as Row[]) {
    const t = byUser.get(e.paid_by) ?? { submitted: 0, pending: 0, approved: 0, reimbursed: 0, count: 0 };
    const amt = Number(e.amount);
    t.count += 1;
    t.submitted += amt;
    if (e.status === "pending") t.pending += amt;
    if (e.status === "approved") t.approved += amt; // approved but not yet paid back = owed
    if (e.status === "reimbursed") t.reimbursed += amt;
    byUser.set(e.paid_by, t);
  }

  const members = ((profiles ?? []) as Array<{ id: string; email: string; display_name: string | null; role: string }>)
    .map((p) => ({ ...p, approval: approvals.get(p.id) ?? "pending", t: byUser.get(p.id) ?? { submitted: 0, pending: 0, approved: 0, reimbursed: 0, count: 0 } }))
    .sort((a, b) => b.t.approved - a.t.approved || b.t.submitted - a.t.submitted);
  const totalOwed = members.reduce((s, m) => s + m.t.approved, 0);
  const queue = members.filter((m) => m.approval === "pending" && m.role !== "admin");

  return (
    <>
      <Navbar role="admin" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Members</h1>
          <RefreshButton className="mt-1" />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Total owed{" "}
          <span className="font-mono tabular-nums text-zinc-100">{formatINR(totalOwed)}</span>
        </p>

        <section className="mt-6">
          <h2 className="text-base font-semibold tracking-tight">
            Approval queue <span className="font-normal text-zinc-500">({queue.length})</span>
          </h2>
          {queue.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-500">No one is waiting.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {queue.map((m) => (
                <li key={m.id} className="card flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{m.display_name ?? m.email}</p>
                    <p className="truncate text-xs text-zinc-500">{m.email}</p>
                  </div>
                  <MemberApprovalButtons userId={m.id} current="pending" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <h2 className="mt-10 text-base font-semibold tracking-tight">All members</h2>
        {members.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">No members yet.</p>
        ) : (
          <>
          {/* Phones: one card per member so owed amounts and access buttons stay visible */}
          <ul className="mt-3 flex flex-col gap-2 md:hidden">
            {members.map((m) => (
              <li key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">
                      {m.display_name ?? m.email}
                      {m.role === "admin" ? <span className="ml-2 text-xs font-normal text-zinc-500">admin</span> : null}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{m.email}</p>
                  </div>
                  {m.role === "admin" ? null : (
                    <span className={`shrink-0 text-xs capitalize ${m.approval === "approved" ? "text-emerald-300" : m.approval === "rejected" ? "text-red-300" : "text-amber-300"}`}>{m.approval}</span>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-zinc-500">Pending</dt><dd className="mt-0.5 font-mono tabular-nums text-zinc-300">{formatINR(m.t.pending)}</dd></div>
                  <div><dt className="text-zinc-500">Owed</dt><dd className={`mt-0.5 font-mono tabular-nums ${m.t.approved > 0 ? "text-amber-300" : "text-zinc-600"}`}>{formatINR(m.t.approved)}</dd></div>
                  <div><dt className="text-zinc-500">Reimbursed</dt><dd className="mt-0.5 font-mono tabular-nums text-zinc-300">{formatINR(m.t.reimbursed)}</dd></div>
                </dl>
                {m.role === "admin" ? null : (
                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <span className="text-xs text-zinc-500">{m.t.count} expense{m.t.count === 1 ? "" : "s"}</span>
                    <MemberApprovalButtons userId={m.id} current={m.approval} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="card mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 text-right font-medium">Expenses</th>
                  <th className="px-4 py-3 text-right font-medium">Pending</th>
                  <th className="px-4 py-3 text-right font-medium">Owed</th>
                  <th className="px-4 py-3 text-right font-medium">Reimbursed</th>
                  <th className="px-4 py-3 text-right font-medium">Access</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-100">
                        {m.display_name ?? m.email}
                        {m.role === "admin" ? <span className="ml-2 text-xs font-normal text-zinc-500">admin</span> : null}
                      </p>
                      <p className="text-xs text-zinc-500">{m.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-400">{m.t.count}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-400">{formatINR(m.t.pending)}</td>
                    <td className={`px-4 py-3 text-right font-mono tabular-nums ${m.t.approved > 0 ? "text-amber-300" : "text-zinc-600"}`}>{formatINR(m.t.approved)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-400">{formatINR(m.t.reimbursed)}</td>
                    <td className="px-4 py-3">
                      {m.role === "admin" ? (
                        <p className="text-right text-xs text-zinc-600">—</p>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <span className={`text-xs capitalize ${m.approval === "approved" ? "text-emerald-300" : m.approval === "rejected" ? "text-red-300" : "text-amber-300"}`}>{m.approval}</span>
                          <MemberApprovalButtons userId={m.id} current={m.approval} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </main>
    </>
  );
}
