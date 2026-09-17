import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AccountForms from "@/components/AccountForms";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";

export default async function AccountPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("display_name").eq("id", user.id).single();

  return (
    <>
      <Navbar role={isAdminEmail(user.email) ? "admin" : "member"} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 sm:py-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Account</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
        <AccountForms userId={user.id} displayName={profile?.display_name ?? ""} />
      </main>
    </>
  );
}
