import type { Approval } from "@/lib/auth";

/** Shown to members whose account the admin hasn't approved (or has declined). */
export default function PendingApproval({ approval, email }: { approval: Approval; email: string | null | undefined }) {
  const declined = approval === "rejected";
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 text-center">
      <div className="card p-7">
        <span className={`mx-auto mb-4 block h-2 w-2 rounded-full ${declined ? "bg-red-400" : "animate-pulse bg-amber-400"}`} />
        <h1 className="text-xl font-semibold tracking-tight">{declined ? "Registration declined" : "Waiting for approval"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {declined
            ? "This account wasn't approved. Contact the Campus Life Council if you think this is a mistake."
            : "An admin needs to approve your account before you can add expenses."}
        </p>
        <p className="mt-4 text-xs text-zinc-600">{email}</p>
      </div>
    </main>
  );
}
