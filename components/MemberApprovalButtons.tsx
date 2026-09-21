"use client";

import { useState, useTransition } from "react";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";
import type { Approval } from "@/lib/auth";

export default function MemberApprovalButtons({ userId, current }: { userId: string; current: Approval }) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [last, setLast] = useState<"approve" | "reject" | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const working = pending ?? (refreshing ? last : null);
  const busy = working !== null;
  const [err, setErr] = useState<string | null>(null);

  const act = async (action: "approve" | "reject") => {
    if (action === "reject" && !confirm("Decline this member? They won't be able to add expenses.")) return;
    setErr(null);
    setPending(action);
    setLast(action);
    const res = await fetch(`/api/admin/members/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(null);
    if (!res.ok) {
      setErr(data.error ?? "Action failed");
      return;
    }
    startRefresh(() => router.refresh());
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {current !== "approved" ? (
          <button disabled={busy} onClick={() => act("approve")} className="btn-primary btn-sm">{working === "approve" ? <><Spinner />Approving…</> : "Approve"}</button>
        ) : null}
        {current !== "rejected" ? (
          <button disabled={busy} onClick={() => act("reject")} className={current === "approved" ? "btn-danger btn-sm" : "btn-secondary btn-sm"}>
            {working === "reject" ? <><Spinner />Saving…</> : current === "approved" ? "Revoke" : "Decline"}
          </button>
        ) : null}
      </div>
      {err ? <p className="text-xs text-red-300">{err}</p> : null}
    </div>
  );
}
