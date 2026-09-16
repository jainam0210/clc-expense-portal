import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      {/* soft glow behind the logo */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-white/[0.04] blur-3xl" />

      <section className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-7 px-4 py-20 text-center">
        <Image src="/clc-logo.png" alt="CLC" width={200} height={119} priority className="h-20 w-auto sm:h-24" />
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Log expenses.
          <br />
          <span className="text-zinc-500">Approve. Reimburse.</span>
        </h1>
        <p className="text-base text-zinc-400">Campus Life Council expense portal</p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/login" className="btn-primary px-7 py-3">Login</Link>
          <Link href="/register" className="btn-secondary px-7 py-3">Register</Link>
        </div>
      </section>
    </main>
  );
}
