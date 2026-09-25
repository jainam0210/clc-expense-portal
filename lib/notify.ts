import nodemailer from "nodemailer";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/auth";
import { formatDate, formatINR } from "@/lib/utils";

/**
 * Email notifications via the club Gmail (SMTP_USER + a Gmail app password in SMTP_PASS).
 * Sending happens after the response is returned, so it never slows down or breaks
 * the action that triggered it. With SMTP unset, notifications are simply skipped.
 */

const SITE = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
/** Where admin alerts go — a personal inbox, so the official club inbox isn't spammed. */
const ADMIN_INBOX = process.env.ADMIN_NOTIFY_EMAIL || ADMIN_EMAIL;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** RFC 2606 test domains can never receive mail; skipping them avoids bounces from test accounts. */
function isReserved(email: string | null | undefined): boolean {
  return /@(?:[^@]+\.)?(?:example\.(?:com|org|net)|[^@]+\.(?:test|invalid|localhost|example))$/i.test(email ?? "");
}

let transport: nodemailer.Transporter | null = null;
function mailer() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Mail = { to: string; subject: string; heading: string; lines: Array<[string, string]>; note?: string; cta: { label: string; path: string } };

function render(m: Mail): { html: string; text: string } {
  const rows = m.lines
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#71717a">${esc(k)}</td><td style="padding:4px 0;color:#18181b">${esc(v)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#71717a">CLC Finance</p>
  <h1 style="margin:0 0 16px;font-size:20px">${esc(m.heading)}</h1>
  <table style="border-collapse:collapse;font-size:14px">${rows}</table>
  ${m.note ? `<p style="margin:16px 0 0;font-size:14px;color:#3f3f46">${esc(m.note)}</p>` : ""}
  <p style="margin:24px 0 0"><a href="${SITE}${m.cta.path}" style="background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px">${esc(m.cta.label)}</a></p>
</div>`;
  const text = [m.heading, "", ...m.lines.map(([k, v]) => `${k}: ${v}`), ...(m.note ? ["", m.note] : []), "", `${m.cta.label}: ${SITE}${m.cta.path}`].join("\n");
  return { html, text };
}

function send(m: Mail) {
  if (!isEmailConfigured() || !m.to || isReserved(m.to)) return;
  after(async () => {
    try {
      const { html, text } = render(m);
      await mailer().sendMail({ from: `"CLC Finance" <${process.env.SMTP_USER}>`, to: m.to, subject: m.subject, html, text });
    } catch (e) {
      console.error("Notification email failed:", m.subject, e);
    }
  });
}

type ExpenseInfo = { id: string; event_id: string; paid_by: string; item_desc: string; vendor_name: string; amount: number | string; invoice_date?: string | null };

async function context(e: ExpenseInfo) {
  const svc = createServiceClient();
  const [{ data: ev }, { data: who }] = await Promise.all([
    svc.from("events").select("name").eq("id", e.event_id).single(),
    svc.from("profiles").select("email,display_name").eq("id", e.paid_by).single(),
  ]);
  return { event: ev?.name ?? "Event", email: who?.email ?? "", name: who?.display_name ?? who?.email ?? "A member" };
}

/** Admin: a member submitted (or re-submitted after editing) an expense. */
export async function notifyAdminSubmitted(e: ExpenseInfo, kind: "new" | "edited") {
  const c = await context(e);
  if (c.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || isReserved(c.email)) return; // admin's own / test account
  send({
    to: ADMIN_INBOX,
    subject: `${kind === "new" ? "New expense" : "Expense updated"}: ${formatINR(e.amount)} · ${c.event}`,
    heading: kind === "new" ? "New expense to review" : "An expense was edited and needs review again",
    lines: [["Member", c.name], ["Event", c.event], ["Item", e.item_desc], ["Vendor", e.vendor_name], ["Amount", formatINR(e.amount)], ...(e.invoice_date ? [["Date", formatDate(e.invoice_date)] as [string, string]] : [])],
    cta: { label: "Review", path: `/admin/events/${e.event_id}?status=pending` },
  });
}

/** Member: their expense was approved / rejected / reimbursed. */
export async function notifyMemberDecision(e: ExpenseInfo, decision: "approved" | "rejected" | "reimbursed") {
  const c = await context(e);
  if (c.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return;
  const copy = {
    approved: { subject: "Your expense was approved", heading: "Expense approved ✓", note: "It's now on the event sheet and will be reimbursed soon." },
    rejected: { subject: "Your expense was rejected", heading: "Expense rejected", note: "Check the details (invoice number, bill, amount), edit it and it will go back for review." },
    reimbursed: { subject: "You've been reimbursed", heading: "Expense reimbursed", note: "This expense is now settled." },
  }[decision];
  send({
    to: c.email,
    subject: `${copy.subject}: ${formatINR(e.amount)} · ${c.event}`,
    heading: copy.heading,
    lines: [["Event", c.event], ["Item", e.item_desc], ["Vendor", e.vendor_name], ["Amount", formatINR(e.amount)]],
    note: copy.note,
    cta: { label: "View my expenses", path: `/dashboard/events/${e.event_id}` },
  });
}

/** Member: several expenses in one event were settled at once. */
export async function notifyMemberSettled(eventId: string, paidBy: string, count: number, total: number) {
  const c = await context({ id: "", event_id: eventId, paid_by: paidBy, item_desc: "", vendor_name: "", amount: total });
  if (c.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return;
  send({
    to: c.email,
    subject: `You've been reimbursed ${formatINR(total)} · ${c.event}`,
    heading: "Reimbursement done",
    lines: [["Event", c.event], ["Expenses", String(count)], ["Total", formatINR(total)]],
    cta: { label: "View my expenses", path: `/dashboard/events/${eventId}` },
  });
}

/** Member: the admin approved (or declined) their account. */
export async function notifyMemberAccount(email: string, name: string | null, approved: boolean) {
  send({
    to: email,
    subject: approved ? "Your CLC Finance account is approved" : "Your CLC Finance registration",
    heading: approved ? "You're approved 🎉" : "Registration not approved",
    lines: [["Account", name ? `${name} (${email})` : email]],
    note: approved ? "You can now add expenses and upload bills." : "Contact the Campus Life Council if you think this is a mistake.",
    cta: approved ? { label: "Add an expense", path: "/dashboard" } : { label: "Open CLC Finance", path: "/" },
  });
}

/**
 * Admin: someone registered and is waiting for approval. Signup happens in the
 * browser, so this runs the first time they reach the dashboard; a flag in
 * app_metadata makes sure it's sent only once per account.
 */
export async function notifyAdminNewMember(user: { id: string; email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) {
  if (!isEmailConfigured() || user.app_metadata?.admin_notified || isReserved(user.email)) return;
  const svc = createServiceClient();
  await svc.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, admin_notified: true } });
  const name = (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "Someone";
  send({
    to: ADMIN_INBOX,
    subject: `New member waiting for approval: ${name}`,
    heading: "New member to approve",
    lines: [["Name", name], ["Email", user.email ?? ""]],
    cta: { label: "Review members", path: "/admin/members" },
  });
}
