-- =============================================================================
-- Migration: schema_auth_rls.sql
-- Description: Production-ready Supabase Auth & RLS schema for Luxe
--              Handles user profile auto-creation from Email/Password & Google OAuth,
--              Row-Level Security (RLS) policies, and data isolation.
-- =============================================================================

-- 1. Enable required extensions
create extension if not exists "pgcrypto";

-- 2. Create updated_at trigger helper if not exists
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Table: public.profiles
--    Linked 1-1 with auth.users via primary key reference
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Ensure display_name column exists if table was previously created
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) then
    alter table public.profiles add column display_name text;
  end if;
end $$;

-- Trigger to maintain updated_at on profiles
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4. PostgreSQL Function & Trigger: handle_new_user()
--    Extracts metadata seamlessly for BOTH:
--      a) Email / Password signup: takes 'display_name' (or 'full_name')
--      b) Google OAuth signin: takes 'full_name' / 'name' and 'avatar_url' / 'picture'
--    Uses SECURITY DEFINER with locked search_path to prevent hijacking.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  extracted_display_name text;
  extracted_avatar_url   text;
begin
  -- Extract display name (priority: display_name -> full_name -> name -> email prefix)
  extracted_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'User'
  );

  -- Extract avatar URL (Google OAuth returns either 'avatar_url' or 'picture')
  extracted_avatar_url := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    null
  );

  -- Upsert into profiles (idempotent for re-authentications)
  insert into public.profiles (id, display_name, avatar_url, created_at, updated_at)
  values (
    new.id,
    extracted_display_name,
    extracted_avatar_url,
    now(),
    now()
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url   = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at   = now();

  return new;
end;
$$;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) for public.profiles
--    Rules:
--      - Users can only SELECT their own profile: auth.uid() = id
--      - Users can only UPDATE their own profile: auth.uid() = id
--    Performance best practice: wrap (select auth.uid()) in subquery
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Grant appropriate permissions to authenticated users
grant select, update on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Sample RLS Policies for Business Tables (e.g. transactions)
--    Strict multi-tenant data isolation: user_id = auth.uid()
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users(id) on delete cascade,
  merchant    text          not null,
  amount      numeric(15,2) not null check (amount > 0),
  type        text          not null check (type in ('income', 'expense')),
  status      text          not null default 'completed' check (status in ('completed', 'pending', 'cancelled', 'failed')),
  date        date          not null default current_date,
  notes       text,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

-- Index for high-performance user transaction filtering
create index if not exists idx_transactions_user_id_date
  on public.transactions (user_id, date desc);

alter table public.transactions enable row level security;

-- Policies ensuring a user can never access or tamper with another user's records
drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions"
  on public.transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant all on public.transactions to authenticated;
