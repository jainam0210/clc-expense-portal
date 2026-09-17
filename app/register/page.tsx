"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Spinner from "@/components/Spinner";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [navigating, startNav] = useTransition();
  const busy = loading || navigating;
  const [step, setStep] = useState<"details" | "code">("details");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (isAdminEmail(email)) {
      setErr(`New admins cannot register. ${ADMIN_EMAIL} is the only admin account.`);
      return;
    }
    setLoading(true);
    const sb = createClient();
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data.session) {
      startNav(() => {
        router.push("/dashboard");
        router.refresh();
      });
      return;
    }
    setStep("code");
    setCooldown(30);
    setMsg(`We sent a 6-digit code to ${email.trim()}. Enter it below to verify.`);
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const token = code.trim();
    if (token.length < 6) {
      setErr("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    const sb = createClient();
    const { data, error } = await sb.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "signup",
    });
    setLoading(false);
    if (error || !data.session) {
      setErr(error?.message ?? "Invalid code. Try again or resend.");
      return;
    }
    startNav(() => {
      router.push("/dashboard");
      router.refresh();
    });
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setErr(null);
    setMsg(null);
    setResending(true);
    const sb = createClient();
    const { error } = await sb.auth.resend({ type: "signup", email: email.trim() });
    setResending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setCooldown(60);
    setMsg(`New code sent to ${email.trim()}.`);
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="mx-auto mb-8">
        <Image src="/clc-logo.png" alt="CLC" width={200} height={119} priority className="h-14 w-auto" />
      </Link>
      <div className="card p-6 sm:p-7">
        {step === "details" ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
            <form onSubmit={submitDetails} className="mt-6 flex flex-col gap-4">
              <label className="field">
                Display name
                <input
                  className="input"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
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
                Password
                <input
                  className="input"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              {err ? <p className="alert-error">{err}</p> : null}
              {msg ? <p className="alert-ok">{msg}</p> : null}
              <button disabled={busy} className="btn-primary mt-1 py-3">
                {busy ? <><Spinner />Sending code…</> : "Send verification code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Enter the 6-digit code sent to {email.trim()}.
            </p>
            <form onSubmit={submitCode} className="mt-6 flex flex-col gap-4">
              <label className="field">
                Verification code
                <input
                  className="input text-center text-2xl font-mono tracking-[0.5em]"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="••••••"
                />
              </label>
              {err ? <p className="alert-error">{err}</p> : null}
              {msg ? <p className="alert-ok">{msg}</p> : null}
              <button disabled={busy} className="btn-primary mt-1 py-3">
                {busy ? <><Spinner />Verifying…</> : "Verify & create account"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep("details"); setErr(null); setMsg(null); }}
                  className="link"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={resend}
                  disabled={busy || resending || cooldown > 0}
                  className="link inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {resending ? <><Spinner className="h-3 w-3" />Sending…</> : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account? <Link className="link" href="/login">Login</Link>
      </p>
    </main>
  );
}
