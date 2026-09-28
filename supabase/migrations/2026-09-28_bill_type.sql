-- How an expense was paid/billed. Existing rows are real bills → 'digital'.
alter table public.expenses
  add column if not exists bill_type text not null default 'digital'
  check (bill_type in ('digital', 'physical', 'unbilled_upi', 'unbilled_cash'));
