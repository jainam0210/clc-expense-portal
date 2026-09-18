"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Spinner from "@/components/Spinner";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_EMAIL } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function Navbar({ role }: { role?: "admin" | "member" | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const [signingOut, setSigningOut] = useState(false);
  const [leaving, startLeave] = useTransition();
  const logout = async () => {
    setSigningOut(true);
    const sb = createClient();
    await sb.auth.signOut();
    startLeave(() => {
      router.push("/login");
      router.refresh();
    });
  };

  const navLink = "rounded-lg px-3 py-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white";
  const links: Array<{ href: string; label: string; active: boolean }> =
    role === "admin"
      ? [
          { href: "/admin", label: "Events", active: pathname === "/admin" || pathname.startsWith("/admin/events") },
          { href: "/admin/members", label: "Members", active: pathname.startsWith("/admin/members") },
          { href: "/admin/settings", label: "Settings", active: pathname.startsWith("/admin/settings") },
        ]
      : role === "member"
        ? [
            { href: "/dashboard", label: "Dashboard", active: pathname.startsWith("/dashboard") },
            { href: "/account", label: "Account", active: pathname.startsWith("/account") },
          ]
        : [];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/clc-logo.png" alt="CLC" width={200} height={119} priority className="h-7 w-auto" />
            <span className="h-4 w-px bg-white/15" />
            <span className="text-sm font-medium tracking-tight text-zinc-300">Finance</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            {links.map((l) => (
              <Link key={l.href} className={cn(navLink, "hidden sm:block", l.active && "bg-white/[0.06] text-white")} href={l.href}>
                {l.label}
              </Link>
            ))}
            {role ? null : (
              <>
                <Link className={navLink} href="/login">Login</Link>
                <Link className="btn-primary btn-sm" href="/register">Register</Link>
              </>
            )}
            {email ? (
              <>
                <span className="ml-2 hidden max-w-44 truncate text-xs text-zinc-500 md:inline" title={email}>
                  {email === ADMIN_EMAIL ? "Admin" : email}
                </span>
                <button onClick={logout} disabled={signingOut || leaving} className="btn-secondary btn-sm ml-1">
                  {signingOut || leaving ? <Spinner className="h-3.5 w-3.5" /> : null}
                  Logout
                </button>
              </>
            ) : null}
          </nav>
        </div>
      </header>

      {/* Phones: primary navigation as a bottom tab bar (thumb-reachable, never crowds the header). */}
      {links.length > 0 ? (
        <nav
          data-tabbar
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-black/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={l.active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 py-3 text-xs font-medium transition", l.active ? "text-white" : "text-zinc-500")}
              >
                <span className={cn("h-1 w-5 rounded-full", l.active ? "bg-white" : "bg-transparent")} />
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </>
  );
}
