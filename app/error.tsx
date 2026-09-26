"use client";

import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="text-xl font-semibold tracking-tight">We couldn’t load this page</h1>
      <p className="text-sm text-zinc-500">{error.digest ? `Reference: ${error.digest}` : "Please try again in a moment."}</p>
      <div className="flex gap-2">
        <button onClick={reset} className="btn-primary">Try again</button>
        <Link href="/" className="btn-secondary">Home</Link>
      </div>
    </main>
  );
}
