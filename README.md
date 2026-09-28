# CLC Expense Portal

An expense and reimbursement portal for a college club's events. Members upload bills
for what they spent on an event; the admin reviews them; approved bills are filed into a
shared OneDrive folder and a live Excel sheet; the admin tracks and settles who is owed what.

Built for the Campus Life Council and used for its real events.

**Stack:** Next.js 16 (App Router, Route Handlers, Proxy) · React 19 · TypeScript ·
Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Microsoft Graph (OneDrive + Excel API) ·
ExcelJS · Nodemailer · Vercel

## Features

**Members**
- Register with email + 6-digit code; accounts are approved by the admin before they can submit
- Add expenses per event with a bill type: digital bill, physical bill, unbilled (UPI), unbilled (cash)
- Attach any file up to 10 MB (cash may have no attachment)
- Dashboard with submitted / approved / reimbursed / to-be-reimbursed totals and history per event
- Edit or delete their own expenses until they're reimbursed

**Admin**
- Create, rename and delete events (deletion is blocked once money has been reimbursed)
- Review queue: approve, reject, edit or delete any expense; filter by status
- **Payouts** per event: what each member is owed, with one-click "mark reimbursed"
- Members directory with owed totals and an approval queue
- Live OneDrive sheet per event, plus `.xlsx` download

**Everyone:** email notifications, password reset, Indian date/time format (DD/MM/YYYY, IST),
mobile layout with a bottom tab bar.

## Engineering notes

- **Only verified bills reach the shared drive.** Uploads go to Supabase Storage first and are
  pushed to OneDrive at the moment of approval. If that push fails, the approval is refused, so
  "approved" always means "filed". Editing an approved expense pulls its bill back off OneDrive.
- **Sheet sync works while people have the sheet open.** Re-uploading the `.xlsx` fails with
  `423 Locked` when someone is viewing it in Excel Online, so rows are rewritten in place through
  the Microsoft Graph Excel API (workbook sessions), with a full upload only as a fallback.
  User text is escaped so it can't become a formula.
- **Dates are real Excel dates** (serials with an explicit `dd/mm/yyyy` format) so they render
  correctly whatever locale the viewer's Excel uses; timestamps are converted to IST.
- **Server-side authorization.** Every mutation runs in a Route Handler that checks the session,
  the role and member approval; approval status lives in Supabase `app_metadata`, which users
  can't write. A Next.js Proxy refreshes the session cookie and gates protected pages.
- **Side effects never block the user.** Emails are sent with Next's `after()` once the response
  is out; sheet-sync failures surface as a warning with a "Sync sheet" retry instead of failing silently.
- **Loading states that last until the UI is fresh:** buttons stay busy through `router.refresh()`
  using React transitions, not just until the request returns.

## Project layout

```
app/                 pages (member dashboard, admin, auth) and API route handlers (app/api)
components/          UI components (forms, expense rows, payouts, buttons)
lib/
  bills.ts           bill lifecycle: store → publish on approval → unpublish / purge
  onedrive.ts        Microsoft Graph: folders, uploads, in-place Excel sync
  excel.ts           shared sheet layout + downloadable workbook (ExcelJS)
  notify.ts          email notifications
  auth.ts, api-helpers.ts, members.ts, utils.ts
proxy.ts             session refresh + route protection
supabase/            schema.sql and migrations
scripts/             admin seeding, OneDrive token helper, one-off backfill
```

## Running it locally

1. `cp .env.example .env.local` and fill in your Supabase project keys and `NEXT_PUBLIC_ADMIN_EMAIL`.
2. In the Supabase SQL editor, run `supabase/schema.sql` (replace `admin@example.com` with your
   admin email first), then the files in `supabase/migrations/`.
3. Create the admin account:
   `node --env-file=.env.local scripts/seed-admin.mjs` with `ADMIN_PASSWORD` set.
4. `npm install && npm run dev`.

OneDrive and email are optional. With `MOCK_ONEDRIVE=true` bills stay in Supabase Storage and
sheets are generated on demand; with `SMTP_*` unset no emails are sent.

**To connect OneDrive:** register an Azure app with the delegated `Files.ReadWrite` and
`offline_access` permissions, add `http://localhost:53682/callback` as a Web redirect URI, then run
`node --env-file=.env.local scripts/onedrive-auth.mjs` and sign in as the account that owns the drive.

**For email:** set `SMTP_USER` / `SMTP_PASS` (Gmail address + app password) and optionally
`ADMIN_NOTIFY_EMAIL` for admin alerts.
