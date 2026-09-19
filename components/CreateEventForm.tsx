"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";

export default function CreateEventForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Stay busy until the refreshed data is on screen, not just until the request returns.
  const [refreshing, startRefresh] = useTransition();
  const busy = loading || refreshing;
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setWarning(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        event_date: fd.get("event_date") || null,
        description: fd.get("description") || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Failed to create event");
      return;
    }
    if (data.warning) setWarning(data.warning);
    (e.target as HTMLFormElement).reset();
    startRefresh(() => router.refresh());
  };

  return (
    <form onSubmit={submit} className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 card p-5"}>
      {embedded ? null : <h3 className="text-base font-semibold tracking-tight">Create event</h3>}
      <label className="field">
        Event name *
        <input name="name" required className="input" placeholder="e.g. Ganesh Utsav Bhandara" />
      </label>
      <label className="field">
        Event date
        <input name="event_date" type="date" className="input" />
      </label>
      <label className="field">
        Description
        <textarea name="description" className="input" rows={2} placeholder="Optional note" />
      </label>
      {err ? <p className="alert-error">{err}</p> : null}
      {warning ? <p className="alert-warn">{warning}</p> : null}
      <button disabled={busy} className="btn-primary py-3">
        {busy ? <><Spinner />Creating…</> : "Create event"}
      </button>
    </form>
  );
}
