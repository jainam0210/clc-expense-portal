"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";
import { BILL_ATTACHMENT, BILL_TYPE_LABELS, BILL_TYPES, type BillType } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ExpenseForm({
  eventId,
  events,
  initial,
  onDone,
  embedded = false,
}: {
  eventId: string;
  /** When given, shows an event picker (used on the admin portal). */
  events?: Array<{ id: string; name: string }>;
  initial?: {
    id: string;
    item_desc: string;
    vendor_name: string;
    amount: number;
    invoice_date: string;
    invoice_number: string | null;
    bill_type: BillType | null;
  };
  onDone?: () => void;
  /** Inside a Disclosure/other card: no own card chrome or heading. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Stay busy until the refreshed data is on screen, not just until the request returns.
  const [refreshing, startRefresh] = useTransition();
  const busy = loading || refreshing;
  const [err, setErr] = useState<string | null>(null);
  const [billType, setBillType] = useState<BillType>(initial?.bill_type ?? "digital");
  const unbilled = billType.startsWith("unbilled");
  const attachment = BILL_ATTACHMENT[billType];
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("bill");
    if (file instanceof File && file.size > 10 * 1024 * 1024) {
      setLoading(false);
      setErr("Bill file must be under 10 MB. Try a smaller photo or a PDF.");
      return;
    }
    if (!fd.get("event_id")) fd.set("event_id", eventId);

    const url = initial ? `/api/expenses/${initial.id}` : "/api/expenses";
    const method = initial ? "PATCH" : "POST";
    const res = await fetch(url, { method, body: fd });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Failed to save expense");
      return;
    }
    (e.target as HTMLFormElement).reset();
    if (!initial) setBillType("digital");
    setNotice(
      data.warning
        ? { kind: "warn", text: data.warning }
        : { kind: "ok", text: initial ? "Changes saved." : "Expense submitted — waiting for admin approval." }
    );
    onDone?.();
    startRefresh(() => router.refresh());
  };

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-4", !embedded && "card p-5")}>
      {embedded ? null : <h3 className="text-base font-semibold tracking-tight">{initial ? "Edit expense" : "Add expense"}</h3>}
      {events && events.length > 0 ? (
        <label className="field">
          Event *
          <select name="event_id" defaultValue={eventId} className="input">
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field">
        Item description *
        <input name="item_desc" required defaultValue={initial?.item_desc} className="input" placeholder="e.g. Prasad ingredients" />
      </label>
      <label className="field">
        Vendor name *
        <input name="vendor_name" required defaultValue={initial?.vendor_name} className="input" placeholder="e.g. Sharma General Store" />
      </label>
      <fieldset>
        <legend className="field">Bill type *</legend>
        <input type="hidden" name="bill_type" value={billType} />
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {BILL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setBillType(t)}
              aria-pressed={billType === t}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                billType === t ? "border-white/50 bg-white/[0.06] text-white" : "border-white/10 text-zinc-400 hover:border-white/20"
              )}
            >
              {BILL_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <label className="field">
          Amount (₹) *
          <input name="amount" required type="number" min="0.01" step="0.01" inputMode="decimal" defaultValue={initial?.amount} className="input" placeholder="0.00" />
        </label>
        <label className="field">
          {unbilled ? "Payment date *" : "Invoice date *"}
          <input name="invoice_date" required type="date" defaultValue={initial?.invoice_date} className="input" />
        </label>
      </div>
      {unbilled ? (
        <input type="hidden" name="invoice_number" value="" />
      ) : (
        <label className="field">
          Invoice number
          <input name="invoice_number" defaultValue={initial?.invoice_number ?? ""} className="input" placeholder="Optional" />
          <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500">
            Required if it&apos;s printed on the bill.
          </span>
        </label>
      )}
      <label className="field">
        {attachment.label} · max 10 MB {initial ? "(leave empty to keep existing)" : attachment.required ? "*" : ""}
        <input
          key={billType}
          name="bill"
          type="file"
          required={!initial && attachment.required}
          className="mt-1.5 w-full text-sm text-zinc-400"
        />
      </label>
      {err ? <p className="alert-error">{err}</p> : null}
      {notice ? (
        <p className={notice.kind === "ok" ? "alert-ok" : "alert-warn"}>
          {notice.text}
        </p>
      ) : null}
      <button disabled={busy} className="btn-primary py-3">
        {busy ? <><Spinner />{initial ? "Saving…" : "Submitting…"}</> : initial ? "Save changes" : "Submit expense"}
      </button>
    </form>
  );
}
