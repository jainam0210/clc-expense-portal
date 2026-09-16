export function formatINR(n: number | string): string {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---- Indian date/time convention: DD/MM/YYYY, 12-hour clock, IST ----
const IST = "Asia/Kolkata";

/** "2026-09-25" (a plain date) or an ISO timestamp → "25/09/2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  // Plain dates have no time zone — format the digits directly so they never shift a day.
  if (plain) return `${plain[3]}/${plain[2]}/${plain[1]}`;
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

/** ISO timestamp → "25/09/2026, 2:34 pm" in IST. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST, day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value));
}

/** Excel serial date (days since 1899-12-30) for a plain date or an instant shown in IST. */
export function excelSerial(value: string): number {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const ms = plain ? Date.UTC(+plain[1], +plain[2] - 1, +plain[3]) : new Date(value).getTime() + 5.5 * 3600_000;
  return ms / 86_400_000 + 25569;
}
