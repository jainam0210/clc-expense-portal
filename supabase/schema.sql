-- Club event expense tracker schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  description text,
  created_by uuid references public.profiles(id),
  onedrive_folder_id text,
  onedrive_bills_folder_id text,
  onedrive_sheet_id text,
  sheet_web_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  item_desc text not null,
  vendor_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  invoice_date date not null,
  invoice_number text,
  bill_type text not null default 'digital' check (bill_type in ('digital','physical','unbilled_upi','unbilled_cash')),
  bill_path text,
  bill_link text,
  bill_onedrive_id text,
  paid_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','reimbursed')),
  reimbursed_at timestamptz,
  excel_row_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_expenses_updated on public.expenses;
create trigger trg_expenses_updated
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup. Single admin is recognised by email
-- (replace admin@example.com with your NEXT_PUBLIC_ADMIN_EMAIL before running).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = lower('admin@example.com') then 'admin' else 'member' end
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case when lower(excluded.email) = lower('admin@example.com') then 'admin' else public.profiles.role end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for bill fallback (used when OneDrive is not configured).
-- Public so bill links stay permanent in the sheet; paths contain unguessable UUIDs.
insert into storage.buckets (id, name, public)
values ('bills', 'bills', true)
on conflict (id) do update set public = true;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.expenses enable row level security;

-- Permissive authenticated policies; fine-grained rules (reimbursed immutability,
-- admin-only approval) are enforced in API routes with the service-role key.
drop policy if exists "authenticated read profiles" on public.profiles;
create policy "authenticated read profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

drop policy if exists "authenticated read events" on public.events;
create policy "authenticated read events" on public.events
  for select to authenticated using (true);

drop policy if exists "authenticated read expenses" on public.expenses;
create policy "authenticated read expenses" on public.expenses
  for select to authenticated using (true);

drop policy if exists "members insert own expenses" on public.expenses;
create policy "members insert own expenses" on public.expenses
  for insert to authenticated with check (auth.uid() = paid_by);

drop policy if exists "owner or admin update expenses" on public.expenses;
create policy "owner or admin update expenses" on public.expenses
  for update to authenticated using (auth.uid() = paid_by);

drop policy if exists "owner delete non-reimbursed" on public.expenses;
create policy "owner delete non-reimbursed" on public.expenses
  for delete to authenticated using (auth.uid() = paid_by and status <> 'reimbursed');

-- Helpful indexes
create index if not exists idx_expenses_event on public.expenses(event_id);
create index if not exists idx_expenses_paid_by on public.expenses(paid_by);
create index if not exists idx_expenses_status on public.expenses(status);
create index if not exists idx_events_created on public.events(created_at desc);
