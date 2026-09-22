"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";
import { formatINR } from "@/lib/utils";

/** Marks everything a member is owed for one event as reimbursed. */
export default function SettleButton({ eventId, paidBy, name, amount }: { eventId: string; paidBy: string; name: string; amount: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [msg, setMsg] = useState<{ kind: "err" | "warn"; text: string } | null>(null);
  const busy = saving || refreshing;

  const settle = async () => {
    if (!confirm(`Mark ${formatINR(amount)} as reimbursed to ${name}? This locks those expenses.`)) return;
    setMsg(null);
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/reimburse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid_by: paidBy }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: data.error ?? "Couldn't mark as reimbursed" });
      return;
    }
    if (data.warning) setMsg({ kind: "warn", text: data.warning });
    startRefresh(() => router.refresh());
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button disabled={busy} onClick={settle} className="btn-primary btn-sm">
        {busy ? <><Spinner />Saving…</> : "Mark reimbursed"}
      </button>
      {msg ? <p className={`max-w-56 text-right text-xs ${msg.kind === "err" ? "text-red-300" : "text-amber-300"}`}>{msg.text}</p> : null}
    </div>
  );
}
