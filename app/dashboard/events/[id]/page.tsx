import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import RefreshButton from "@/components/RefreshButton";
import ExpenseForm from "@/components/ExpenseForm";
import MemberExpenseItem from "@/components/MemberExpenseItem";
import { createClient } from "@/lib/supabase/server";
import PendingApproval from "@/components/PendingApproval";
import { approvalOf, isAdminEmail } from "@/lib/auth";

export default async function MemberEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if (isAdminEmail(user.email)) redirect(`/admin/events/${id}`);
  if (approvalOf(user) !== "approved") {
    return (
      <>
        <Navbar role="member" />
        <PendingApproval approval={approvalOf(user)} email={user.email} />
      </>
    );
  }

  const { data: event } = await sb.from("events").select("*").eq("id", id).single();
  if (!event) redirect("/dashboard");

  const { data: mine } = await sb
    .from("expenses")
    .select("*")
    .eq("event_id", id)
    .eq("paid_by", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Navbar role="member" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">
        <Link href="/dashboard" className="text-sm text-zinc-500 transition hover:text-zinc-200">← All events</Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{event.name}</h1>
          <RefreshButton className="mt-1" />
        </div>
        {event.sheet_web_url ? (
          <p className="mt-1 text-sm">
            <a className="link" href={event.sheet_web_url} target="_blank" rel="noreferrer">Open sheet</a>
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-6">
          <ExpenseForm eventId={id} />
          <div>
            <h2 className="eyebrow">My expenses</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {(mine ?? []).map((e) => (
                <MemberExpenseItem key={e.id} expense={e} />
              ))}
            </ul>
            {(mine ?? []).length === 0 ? <p className="mt-2 text-sm text-zinc-500">None yet.</p> : null}
          </div>
        </div>
      </main>
    </>
  );
}
