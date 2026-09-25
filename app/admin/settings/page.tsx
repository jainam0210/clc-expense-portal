"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Spinner from "@/components/Spinner";

export default function AdminSettingsPage() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Failed to change password");
      return;
    }
    setMsg("Admin password updated.");
    setPw("");
    setPw2("");
  };

  return (
    <>
      <Navbar role="admin" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 sm:py-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4 card p-5 sm:p-6">
          <label className="field">
            New admin password
            <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="input" autoComplete="new-password" />
          </label>
          <label className="field">
            Confirm password
            <input type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} className="input" autoComplete="new-password" />
          </label>
          {err ? <p className="alert-error">{err}</p> : null}
          {msg ? <p className="alert-ok">{msg}</p> : null}
          <button disabled={loading} className="btn-primary py-3">
            {loading ? <><Spinner />Updating…</> : "Change password"}
          </button>
        </form>
      </main>
    </>
  );
}
