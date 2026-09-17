"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState, useTransition } from "react";
import Spinner from "@/components/Spinner";
import { createClient } from "@/lib/supabase/client";
import { isAdminEmail } from "@/lib/auth";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error: linkError, next } = use(searchParams);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(
    linkError === "link" ? "That link is invalid or has expired. Please try again." : null
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [navigating, startNav] = useTransition();
  const busy = loading || navigating;

  const forgot = async () => {
    setErr(null);
    setMsg(null);
    if (!email.trim()) {
      setErr("Enter your email above first, then tap “Forgot password”.");
      return;
    }
    setSendingReset(true);
    const sb = createClient();
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/account`,
    });
    setSendingReset(false);
    if (error) setErr(error.message);
    else setMsg("Check your inbox for a password reset link.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // Keep the wheel spinning until the next page has actually loaded.
    startNav(() => {
      router.push(next?.startsWith("/") ? next : isAdminEmail(email) ? "/admin" : "/dashboard");
      router.refresh();
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="mx-auto mb-8">
        <Image src="/clc-logo.png" alt="CLC" width={200} height={119} priority className="h-14 w-auto" />
      </Link>
      <div className="card p-6 sm:p-7">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <label className="field">
            Email
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span className="flex items-center justify-between">
              Password
              <button type="button" onClick={forgot} disabled={sendingReset} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200 disabled:opacity-60">
                {sendingReset ? <Spinner className="h-3 w-3" /> : null}
                Forgot password?
              </button>
            </span>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {err ? <p className="alert-error">{err}</p> : null}
          {msg ? <p className="alert-ok">{msg}</p> : null}
          <button
            disabled={busy}
            className="btn-primary mt-1 py-3"
          >
            {busy ? <><Spinner />Logging in…</> : "Login"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-zinc-500">
        New member? <Link className="link" href="/register">Register</Link>
      </p>
    </main>
  );
}
