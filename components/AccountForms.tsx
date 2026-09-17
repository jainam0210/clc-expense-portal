"use client";

import { useState } from "react";
import Spinner from "@/components/Spinner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = { kind: "ok" | "err"; text: string } | null;

export default function AccountForms({ userId, displayName }: { userId: string; displayName: string }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [nameStatus, setNameStatus] = useState<Status>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwStatus, setPwStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<"name" | "pw" | null>(null);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameStatus(null);
    setBusy("name");
    const sb = createClient();
    const { error } = await sb.from("profiles").update({ display_name: name.trim() || null }).eq("id", userId);
    setBusy(null);
    setNameStatus(error ? { kind: "err", text: error.message } : { kind: "ok", text: "Name updated." });
    if (!error) router.refresh();
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);
    if (pw !== pw2) {
      setPwStatus({ kind: "err", text: "Passwords do not match." });
      return;
    }
    setBusy("pw");
    const sb = createClient();
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(null);
    if (error) {
      setPwStatus({ kind: "err", text: error.message });
      return;
    }
    setPw("");
    setPw2("");
    setPwStatus({ kind: "ok", text: "Password updated." });
  };

  const status = (s: Status) => (s ? <p className={s.kind === "ok" ? "alert-ok" : "alert-error"}>{s.text}</p> : null);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <form onSubmit={saveName} className="card flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="text-base font-semibold tracking-tight">Display name</h2>
        <label className="field">
          Name shown to the admin and on the sheet
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        {status(nameStatus)}
        <button disabled={busy !== null} className="btn-primary">{busy === "name" ? <><Spinner />Saving…</> : "Save name"}</button>
      </form>

      <form onSubmit={savePw} className="card flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="text-base font-semibold tracking-tight">Change password</h2>
        <label className="field">
          New password
          <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="input" autoComplete="new-password" />
        </label>
        <label className="field">
          Confirm password
          <input type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} className="input" autoComplete="new-password" />
        </label>
        {status(pwStatus)}
        <button disabled={busy !== null} className="btn-primary">{busy === "pw" ? <><Spinner />Updating…</> : "Change password"}</button>
      </form>
    </div>
  );
}
