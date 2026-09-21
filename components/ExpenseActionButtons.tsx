"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Spinner from "@/components/Spinner";
import type { Expense } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ExpenseActionButtons({
  expense,
  editing,
  onToggleEdit,
}: {
  expense: Pick<Expense, "id" | "status">;
  editing: boolean;
  onToggleEdit: () => void;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  // The clicked button keeps spinning until the refreshed row is on screen.
  const busy = pendingAction ?? (refreshing ? lastAction : null);

  const call = async (action: "approve" | "reject" | "reimburse" | "delete") => {
    if (action === "delete" && !confirm("Delete this expense? Reimbursed expenses cannot be deleted.")) return;
    setErr(null);
    setWarning(null);
    setPendingAction(action);
    setLastAction(action);
    const url = action === "delete" ? `/api/expenses/${expense.id}` : `/api/expenses/${expense.id}/${action}`;
    const res = await fetch(url, { method: action === "delete" ? "DELETE" : "POST" });
    const data = await res.json().catch(() => ({}));
    setPendingAction(null);
    if (!res.ok) {
      setErr(data.error ?? "Action failed");
      return;
    }
    if (data.warning) setWarning(data.warning);
    startRefresh(() => router.refresh());
  };

  const btn = "btn-sm";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {expense.status === "pending" ? (
          <>
            <button disabled={!!busy} onClick={() => call("approve")} className={cn(btn, "btn-primary")}>{busy === "approve" ? <><Spinner />Approving…</> : "Approve"}</button>
            <button disabled={!!busy} onClick={() => call("reject")} className={cn(btn, "btn-secondary")}>{busy === "reject" ? <><Spinner />Rejecting…</> : "Reject"}</button>
          </>
        ) : null}
        {expense.status === "approved" ? (
          <button disabled={!!busy} onClick={() => call("reimburse")} className={cn(btn, "btn-primary")}>{busy === "reimburse" ? <><Spinner />Saving…</> : "Mark reimbursed"}</button>
        ) : null}
        {expense.status !== "reimbursed" ? (
          <>
            <button disabled={!!busy} onClick={onToggleEdit} className={cn(btn, "btn-secondary")}>{editing ? "Close" : "Edit"}</button>
            <button disabled={!!busy} onClick={() => call("delete")} className={cn(btn, "btn-danger")}>{busy === "delete" ? <><Spinner />Deleting…</> : "Delete"}</button>
          </>
        ) : null}
      </div>
      {err ? <p className="mt-1.5 text-xs text-red-300">{err}</p> : null}
      {warning ? <p className="mt-1.5 text-xs text-amber-300">{warning}</p> : null}
    </div>
  );
}
