import { cn } from "@/lib/utils";
import type { ExpenseStatus } from "@/lib/types";

const styles: Record<ExpenseStatus, string> = {
  pending: "text-amber-300 before:bg-amber-400",
  approved: "text-sky-300 before:bg-sky-400",
  rejected: "text-red-300 before:bg-red-400",
  reimbursed: "text-emerald-300 before:bg-emerald-400",
};

export default function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ring-white/10 before:h-1.5 before:w-1.5 before:rounded-full before:content-['']",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}
