/** Collapsible card (native <details>, no JS). Keeps long forms out of the way on phones. */
export default function Disclosure({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 select-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-semibold tracking-tight">{title}</span>
          {hint ? <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span> : null}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="border-t border-white/[0.06] p-5">{children}</div>
    </details>
  );
}
