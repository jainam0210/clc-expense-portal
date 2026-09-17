import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";

/** Landing route for Supabase email links (signup confirmation, password recovery). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  const sb = await createClient();
  let ok = false;
  if (code) {
    ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  } else if (token_hash && type) {
    ok = !(await sb.auth.verifyOtp({ type, token_hash })).error;
  }
  if (!ok) return NextResponse.redirect(new URL("/login?error=link", url.origin));

  const { data: { user } } = await sb.auth.getUser();
  const dest = type === "recovery" ? "/account" : next?.startsWith("/") ? next : isAdminEmail(user?.email) ? "/admin" : "/dashboard";
  return NextResponse.redirect(new URL(dest, url.origin));
}
