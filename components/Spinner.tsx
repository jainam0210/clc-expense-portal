import { cn } from "@/lib/utils";

/** Small loading wheel; inherits the text colour, so it works on light and dark buttons. */
export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80", className)}
    />
  );
}
