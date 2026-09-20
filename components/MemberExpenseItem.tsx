"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Spinner from "./Spinner";
import ExpenseForm from "./ExpenseForm";
import StatusBadge from "./StatusBadge";
import { formatDate } from "@/lib/utils";
import { BILL_TYPE_LABELS, type Expense } from "@/lib/types";

export default function MemberExpenseItem({ expense }: { expense: Expense }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = deleting || refreshing;

  const del = async () => {
    if (!confirm("Delete this expense?")) return;
    setErr(null);
    setDeleting(true);
    const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setErr(data.error ?? "Delete failed");
      return;
    }
    startRefresh(() => router.refresh());
  };

  return (
    <li className="card p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-100">{expense.item_desc}</p>
            <p className="mt-0.5 text-sm text-zinc-400">
              {expense.vendor_name} · {formatDate(expense.invoice_date)} · {BILL_TYPE_LABELS[expense.bill_type ?? "digital"]}
            </p>
          </div>
          <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-zinc-100">
            ₹{Number(expense.amount).toFixed(2)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={expense.status} />
          {expense.bill_link ? (
            <a className="text-xs link" href={expense.bill_link} target="_blank" rel="noreferrer">View bill</a>
          ) : null}
        </div>
        {err ? <p className="text-xs text-red-300">{err}</p> : null}
        {expense.status !== "reimbursed" ? (
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => setEditing((v) => !v)} className="btn-secondary btn-sm flex-1">
              {editing ? "Cancel" : "Edit"}
            </button>
            <button disabled={busy} onClick={del} className="btn-danger btn-sm flex-1">
              {busy ? <><Spinner />Deleting…</> : "Delete"}
            </button>
          </div>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-3">
          <ExpenseForm
            eventId={expense.event_id}
            initial={{
              id: expense.id,
              item_desc: expense.item_desc,
              vendor_name: expense.vendor_name,
              amount: Number(expense.amount),
              invoice_date: expense.invoice_date,
              invoice_number: expense.invoice_number,
              bill_type: expense.bill_type ?? "digital",
            }}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : null}
    </li>
  );
}
