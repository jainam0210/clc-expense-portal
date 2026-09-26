"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Re-fetches the page's server data in place (no full reload, keeps scroll and open forms). */
export default function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [refreshing, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={refreshing}
      aria-label="Refresh"
      title="Refresh"
      className={cn("btn-secondary btn-sm shrink-0", className)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
    </button>
  );
}
