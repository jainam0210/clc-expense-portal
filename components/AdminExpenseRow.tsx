"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ExpenseForm from "./ExpenseForm";
import ExpenseActionButtons from "./ExpenseActionButtons";
import StatusBadge from "./StatusBadge";
import { formatDate } from "@/lib/utils";
import { BILL_TYPE_LABELS, type Expense } from "@/lib/types";

function EditBlock({ expense, onDone }: { expense: Expense; onDone: () => void }) {
  const router = useRouter();
  return (
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
      onDone={() => { onDone(); router.refresh(); }}
    />
  );
}

/** Desktop table row (used inside <table>, visible md+). */
export function AdminExpenseRow({ expense }: { expense: Expense }) {
  const [editing, setEditing] = useState(false);
  return (
    <tr className="border-t border-white/[0.06] transition hover:bg-white/[0.015] align-top">
      <td className="px-3 py-3 text-sm">
        <p className="font-medium text-zinc-100">{expense.item_desc}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{expense.vendor_name}</p>
      </td>
      <td className="px-3 py-3 text-sm">
        <p className="font-mono tabular-nums text-zinc-100">₹{Number(expense.amount).toFixed(2)}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{BILL_TYPE_LABELS[expense.bill_type ?? "digital"]}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{formatDate(expense.invoice_date)}{expense.invoice_number ? ` · ${expense.invoice_number}` : ""}</p>
      </td>
      <td className="max-w-40 truncate px-3 py-3 text-xs text-zinc-400" title={expense.payer_email ?? expense.paid_by}>
        {expense.payer_email ?? expense.paid_by}
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={expense.status} />
        <span className="mt-1.5 block">
          {expense.bill_link ? <a className="text-xs link" href={expense.bill_link} target="_blank" rel="noreferrer">View bill</a> : null}
        </span>
      </td>
      <td className="min-w-56 px-3 py-3">
        <ExpenseActionButtons expense={expense} editing={editing} onToggleEdit={() => setEditing((v) => !v)} />
        {editing ? <div className="mt-3"><EditBlock expense={expense} onDone={() => setEditing(false)} /></div> : null}
      </td>
    </tr>
  );
}

/** Mobile card (visible below md). */
export function AdminExpenseCard({ expense }: { expense: Expense }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-zinc-100">{expense.item_desc}</p>
          <p className="mt-0.5 text-sm text-zinc-400">{expense.vendor_name} · <span className="text-zinc-500">{BILL_TYPE_LABELS[expense.bill_type ?? "digital"]}</span></p>
          <p className="mt-0.5 truncate text-xs text-zinc-500" title={expense.payer_email ?? expense.paid_by}>
            {expense.payer_name ?? expense.payer_email ?? expense.paid_by}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {formatDate(expense.invoice_date)}{expense.invoice_number ? ` · ${expense.invoice_number}` : ""}
          </p>
        </div>
        <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-zinc-100">
          ₹{Number(expense.amount).toFixed(2)}
        </p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <StatusBadge status={expense.status} />
        {expense.bill_link ? (
          <a className="text-xs link" href={expense.bill_link} target="_blank" rel="noreferrer">View bill</a>
        ) : null}
      </div>
      <div className="mt-3">
        <ExpenseActionButtons expense={expense} editing={editing} onToggleEdit={() => setEditing((v) => !v)} />
      </div>
      {editing ? <div className="mt-3"><EditBlock expense={expense} onDone={() => setEditing(false)} /></div> : null}
    </div>
  );
}
