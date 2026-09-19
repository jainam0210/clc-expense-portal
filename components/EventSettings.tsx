"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";
import type { Event } from "@/lib/types";

/** Admin-only: rename/redate an event, or delete it (blocked if anything was reimbursed). */
export default function EventSettings({ event, canSync = false }: { event: Pick<Event, "id" | "name" | "event_date" | "description">; canSync?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"save" | "sync" | "delete" | null>(null);
  const [refreshing, startRefresh] = useTransition();
  // Which button is working — stays set until the refreshed page is on screen.
  const [last, setLast] = useState<"save" | "sync" | "delete" | null>(null);
  const working = action ?? (refreshing ? last : null);
  const busy = working !== null;
  const [err, setErr] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setAction("save");
    setLast("save");
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        event_date: fd.get("event_date") || null,
        description: fd.get("description") || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setAction(null);
    if (!res.ok) {
      setErr(data.error ?? "Failed to update event");
      return;
    }
    startRefresh(() => {
      router.refresh();
      setOpen(false);
    });
  };

  const sync = async () => {
    setErr(null);
    setSynced(false);
    setAction("sync");
    setLast("sync");
    const res = await fetch(`/api/events/${event.id}/sync`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setAction(null);
    if (!res.ok) {
      setErr(data.error ?? "Sheet sync failed");
      return;
    }
    setSynced(true);
    startRefresh(() => router.refresh());
  };

  const remove = async () => {
    if (!confirm(`Delete “${event.name}” and all its expenses? This cannot be undone.`)) return;
    setErr(null);
    setAction("delete");
    setLast("delete");
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setAction(null);
    if (!res.ok) {
      setErr(data.error ?? "Failed to delete event");
      return;
    }
    startRefresh(() => {
      router.push("/admin");
      router.refresh();
    });
  };

  if (!open) {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {canSync ? (
            <button disabled={busy} onClick={sync} className="btn-secondary btn-sm">{working === "sync" ? <><Spinner />Syncing…</> : "Sync sheet"}</button>
          ) : null}
          <button disabled={busy} onClick={() => setOpen(true)} className="btn-secondary btn-sm">Edit event</button>
          <button disabled={busy} onClick={remove} className="btn-danger btn-sm">{working === "delete" ? <><Spinner />Deleting…</> : "Delete event"}</button>
        </div>
        {err ? <p className="mt-2 text-xs text-red-300">{err}</p> : null}
        {synced ? <p className="mt-2 text-xs text-emerald-300">Sheet is up to date.</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="card flex max-w-xl flex-col gap-4 p-5">
      <h3 className="text-base font-semibold tracking-tight">Edit event</h3>
      <label className="field">
        Event name *
        <input name="name" required defaultValue={event.name} className="input" />
      </label>
      <label className="field">
        Event date
        <input name="event_date" type="date" defaultValue={event.event_date ?? ""} className="input" />
      </label>
      <label className="field">
        Description
        <textarea name="description" rows={2} defaultValue={event.description ?? ""} className="input" />
      </label>
      {err ? <p className="alert-error">{err}</p> : null}
      <div className="flex gap-2">
        <button disabled={busy} className="btn-primary flex-1">{working === "save" ? <><Spinner />Saving…</> : "Save changes"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}
