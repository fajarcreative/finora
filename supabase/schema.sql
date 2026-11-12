-- ============================================================================
-- Finora PWA — Supabase Database Schema, Indexes, Functions, Triggers & RLS
-- ============================================================================
-- Jalankan script ini di Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Catatan: Semua data pengguna dilindungi Row Level Security (RLS) berbasis
-- auth.uid() sehingga setiap akun hanya dapat mengakses datanya sendiri.
-- ============================================================================

-- 1. Extensions
create extension if not exists pgcrypto;

-- 2. Tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  user_name text not null default 'Pengguna',
  hide_balance boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  name text not null,
  subtitle text not null default 'Dompet Aktif',
  icon text not null default 'account_balance_wallet',
  badge text not null default 'Aktif',
  balance bigint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_user_client_unique unique (user_id, client_id)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id text not null,
  monthly_limit bigint not null default 0 check (monthly_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_user_category_unique unique (user_id, category_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete set null,
  client_id text not null,
  wallet_client_id text not null,
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  category_id text not null,
  note text not null default '',
  tag text not null default '',
  tx_date date not null,
  tx_time text not null default '00:00',
  receipt_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_user_client_unique unique (user_id, client_id)
);

-- 3. Indexes (FK indexes + composite query indexes)
create index if not exists wallets_user_sort_idx
  on public.wallets (user_id, sort_order, created_at);

create index if not exists budgets_user_id_idx
  on public.budgets (user_id);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, tx_date desc, tx_time desc, created_at desc);

create index if not exists transactions_wallet_id_idx
  on public.transactions (wallet_id);

-- 4. Updated-at Trigger Helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_wallets_updated_at on public.wallets;
create trigger trg_wallets_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- 5. Row Level Security (RLS) & Privileges
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.budgets enable row level security;
alter table public.transactions enable row level security;

revoke all on public.profiles from anon;
revoke all on public.wallets from anon;
revoke all on public.budgets from anon;
revoke all on public.transactions from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.wallets to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

-- Profiles RLS
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = id);

-- Wallets RLS
drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists wallets_insert_own on public.wallets;
create policy wallets_insert_own on public.wallets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists wallets_update_own on public.wallets;
create policy wallets_update_own on public.wallets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists wallets_delete_own on public.wallets;
create policy wallets_delete_own on public.wallets
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Budgets RLS
drop policy if exists budgets_select_own on public.budgets;
create policy budgets_select_own on public.budgets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists budgets_insert_own on public.budgets;
create policy budgets_insert_own on public.budgets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists budgets_update_own on public.budgets;
create policy budgets_update_own on public.budgets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists budgets_delete_own on public.budgets;
create policy budgets_delete_own on public.budgets
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Transactions RLS
drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own on public.transactions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 6. Default Seeding on New Auth User Signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Pengguna'
  );

  insert into public.profiles (id, email, user_name, hide_balance)
  values (new.id, lower(coalesce(new.email, '')), v_name, false)
  on conflict (id) do nothing;

  insert into public.wallets (user_id, client_id, name, subtitle, icon, badge, balance, sort_order)
  values
    (new.id, 'tunai', 'Dompet Tunai', 'Uang fisik di saku', 'payments', 'Aktif', 0, 0),
    (new.id, 'bca', 'Rekening Bank', 'Gaji & Operasional', 'account_balance', 'Utama', 0, 1),
    (new.id, 'ewallet', 'E-Wallet', 'GoPay / OVO / DANA', 'wallet', 'Tersinkron', 0, 2)
  on conflict (user_id, client_id) do nothing;

  insert into public.budgets (user_id, category_id, monthly_limit)
  values
    (new.id, 'makan', 0),
    (new.id, 'dapur', 0),
    (new.id, 'transport', 0),
    (new.id, 'hiburan', 0),
    (new.id, 'tagihan', 0),
    (new.id, 'kesehatan', 0),
    (new.id, 'pendidikan', 0),
    (new.id, 'lainnya', 0)
  on conflict (user_id, category_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Atomic RPC Helpers (SECURITY INVOKER — tetap mematuhi RLS)
create or replace function public.record_transaction(
  p_client_id text,
  p_wallet_client_id text,
  p_type text,
  p_amount bigint,
  p_category_id text,
  p_note text,
  p_tag text,
  p_tx_date date,
  p_tx_time text,
  p_receipt_name text default ''
)
returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet_id uuid;
  v_row public.transactions;
  v_delta bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_type not in ('income', 'expense') then
    raise exception 'Invalid transaction type';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select w.id into v_wallet_id
  from public.wallets w
  where w.user_id = v_uid
    and w.client_id = p_wallet_client_id
  limit 1;

  insert into public.transactions (
    user_id,
    wallet_id,
    client_id,
    wallet_client_id,
    type,
    amount,
    category_id,
    note,
    tag,
    tx_date,
    tx_time,
    receipt_name
  )
  values (
    v_uid,
    v_wallet_id,
    p_client_id,
    p_wallet_client_id,
    p_type,
    p_amount,
    p_category_id,
    coalesce(p_note, ''),
    coalesce(p_tag, ''),
    p_tx_date,
    coalesce(nullif(p_tx_time, ''), '00:00'),
    coalesce(p_receipt_name, '')
  )
  on conflict (user_id, client_id) do nothing
  returning * into v_row;

  if v_row.id is not null and v_wallet_id is not null then
    v_delta := case when p_type = 'income' then p_amount else -p_amount end;
    update public.wallets
    set balance = balance + v_delta
    where id = v_wallet_id
      and user_id = v_uid;
  end if;

  if v_row.id is null then
    select * into v_row
    from public.transactions
    where user_id = v_uid and client_id = p_client_id
    limit 1;
  end if;

  return v_row;
end;
$$;

create or replace function public.delete_transaction(p_client_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tx public.transactions;
  v_delta bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.transactions
  where user_id = v_uid
    and client_id = p_client_id
  returning * into v_tx;

  if not found then
    return false;
  end if;

  if v_tx.wallet_id is not null then
    v_delta := case when v_tx.type = 'income' then -v_tx.amount else v_tx.amount end;
    update public.wallets
    set balance = balance + v_delta
    where id = v_tx.wallet_id
      and user_id = v_uid;
  end if;

  return true;
end;
$$;

create or replace function public.reset_user_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.transactions where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;
  delete from public.wallets where user_id = v_uid;

  insert into public.wallets (user_id, client_id, name, subtitle, icon, badge, balance, sort_order)
  values
    (v_uid, 'tunai', 'Dompet Tunai', 'Uang fisik di saku', 'payments', 'Aktif', 0, 0),
    (v_uid, 'bca', 'Rekening Bank', 'Gaji & Operasional', 'account_balance', 'Utama', 0, 1),
    (v_uid, 'ewallet', 'E-Wallet', 'GoPay / OVO / DANA', 'wallet', 'Tersinkron', 0, 2);

  insert into public.budgets (user_id, category_id, monthly_limit)
  values
    (v_uid, 'makan', 0),
    (v_uid, 'dapur', 0),
    (v_uid, 'transport', 0),
    (v_uid, 'hiburan', 0),
    (v_uid, 'tagihan', 0),
    (v_uid, 'kesehatan', 0),
    (v_uid, 'pendidikan', 0),
    (v_uid, 'lainnya', 0);
end;
$$;

revoke all on function public.record_transaction(text, text, text, bigint, text, text, text, date, text, text) from public, anon;
grant execute on function public.record_transaction(text, text, text, bigint, text, text, text, date, text, text) to authenticated;

revoke all on function public.delete_transaction(text) from public, anon;
grant execute on function public.delete_transaction(text) to authenticated;

revoke all on function public.reset_user_data() from public, anon;
grant execute on function public.reset_user_data() to authenticated;

-- 8. Realtime Publication (Sinkronisasi langsung antar perangkat)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallets'
    ) then
      alter publication supabase_realtime add table public.wallets;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budgets'
    ) then
      alter publication supabase_realtime add table public.budgets;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions'
    ) then
      alter publication supabase_realtime add table public.transactions;
    end if;
  end if;
end $$;
