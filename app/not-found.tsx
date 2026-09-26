import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <Image src="/clc-logo.png" alt="CLC" width={200} height={119} className="h-12 w-auto opacity-80" />
      <p className="eyebrow mt-4">404</p>
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <Link href="/" className="btn-secondary mt-2">Back home</Link>
    </main>
  );
}
