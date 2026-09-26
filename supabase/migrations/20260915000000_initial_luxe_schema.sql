-- =============================================================================
-- Migration: 20260915000000_initial_luxe_schema.sql
-- Description: Initial production-ready schema for Luxe personal finance app
--              Built for Supabase PostgreSQL + Supabase Auth + Row Level Security
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

-- Generic updated_at trigger (applied to all user-data tables)
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
-- 1. profiles  —  extends auth.users with Luxe-specific settings
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid  primary key
    references auth.users on delete cascade,
  full_name          text,
  avatar_url         text,
  currency           text          not null default 'VND',
  payday             text          not null default '1st',
  budget_period      text          not null default 'monthly',
  onboarding_complete boolean      not null default false,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. Enum types
-- -----------------------------------------------------------------------------
create type public.account_type as enum ('checking', 'savings', 'credit', 'investment');
create type public.transaction_type as enum ('income', 'expense');
create type public.transaction_status as enum ('completed', 'pending', 'cancelled');
create type public.recurrence_type as enum ('daily', 'weekly', 'monthly', 'yearly');
create type public.notification_type as enum ('info', 'warning', 'success', 'error');

-- -----------------------------------------------------------------------------
-- 3. categories  —  system defaults + per-user custom categories
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id           uuid          primary key default gen_random_uuid(),
  user_id      uuid          references auth.users on delete cascade,
  key          text          not null,
  name         text          not null,
  icon         text          not null default '',
  color        text          not null default '#94A3B8',
  type         text          not null check (type in ('income', 'expense')) default 'expense',
  is_default   boolean       not null default false,
  sort_order   integer       not null default 0,
  created_at   timestamptz   not null default now()
);

create index if not exists idx_categories_user on public.categories (user_id);

-- user_id IS NULL rows are system-wide defaults (read-only for everyone)
create unique index if not exists categories_default_key_idx
  on public.categories (key)
  where is_default = true;

-- user_id IS NOT NULL rows are user-defined (must be unique per user)
create unique index if not exists categories_user_key_idx
  on public.categories (user_id, key)
  where user_id is not null;

alter table public.categories enable row level security;

-- SELECT: users see system defaults (user_id IS NULL) + their own (user_id = auth.uid())
create policy "Users can view system defaults and their own categories"
  on public.categories for select
  using (user_id is null or auth.uid() = user_id);

-- INSERT: users can only create their own categories (user_id = auth.uid(), is_default = false)
create policy "Users can insert their own categories"
  on public.categories for insert
  with check (user_id is not null and auth.uid() = user_id and is_default = false);

-- UPDATE: users can only modify their own non-default categories
create policy "Users can update their own categories"
  on public.categories for update
  using (auth.uid() = user_id and is_default = false)
  with check (auth.uid() = user_id and is_default = false);

-- DELETE: users can only delete their own non-default categories
create policy "Users can delete their own categories"
  on public.categories for delete
  using (auth.uid() = user_id and is_default = false);

-- -----------------------------------------------------------------------------
-- 4. accounts
-- -----------------------------------------------------------------------------
create table if not exists public.accounts (
  id           uuid          primary key default gen_random_uuid(),
  user_id      uuid          not null references auth.users on delete cascade,
  name         text          not null check (char_length(trim(name)) > 0),
  type         public.account_type not null default 'checking',
  balance      numeric(15,2) not null default 0,
  currency     text          not null default 'VND',
  icon         text          default '',
  is_default   boolean       not null default false,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

create index if not exists idx_accounts_user on public.accounts (user_id);

alter table public.accounts enable row level security;

create policy "Users can view their own accounts"
  on public.accounts for select using (auth.uid() = user_id);

create policy "Users can insert their own accounts"
  on public.accounts for insert with check (auth.uid() = user_id);

create policy "Users can update their own accounts"
  on public.accounts for update using (auth.uid() = user_id);

create policy "Users can delete their own accounts"
  on public.accounts for delete using (auth.uid() = user_id);

create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 5. transactions
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users on delete cascade,
  account_id    uuid          references public.accounts on delete set null,
  category_id   uuid          references public.categories on delete set null,
  merchant      text          not null check (char_length(trim(merchant)) > 0),
  amount        numeric(15,2) not null check (amount > 0),
  type          public.transaction_type not null,
  status        public.transaction_status not null default 'completed',
  date          date          not null default current_date,
  notes         text,
  is_recurring  boolean       not null default false,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

-- Composite index for the most common query: user's transactions sorted by date
create index if not exists idx_transactions_user_date
  on public.transactions (user_id, date desc);

-- Index for budget spent calculations (filtered by category + month)
create index if not exists idx_transactions_budget_calc
  on public.transactions (user_id, category_id, type, date);

create index if not exists idx_transactions_account on public.transactions (account_id);

alter table public.transactions enable row level security;

create policy "Users can view their own transactions"
  on public.transactions for select using (auth.uid() = user_id);

create policy "Users can insert their own transactions"
  on public.transactions for insert with check (auth.uid() = user_id);

create policy "Users can update their own transactions"
  on public.transactions for update using (auth.uid() = user_id);

create policy "Users can delete their own transactions"
  on public.transactions for delete using (auth.uid() = user_id);

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 6. budgets
-- -----------------------------------------------------------------------------
create table if not exists public.budgets (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users on delete cascade,
  category_id   uuid          references public.categories on delete set null,
  name          text,
  limit_amount  numeric(15,2) not null check (limit_amount > 0),
  spent         numeric(15,2) not null default 0 check (spent >= 0),
  month         text          not null default to_char(current_date, 'YYYY-MM'),
  color         text          default '#64748B',
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  -- A user can have at most one budget per (category, month)
  -- category_id can be NULL for an "overall" budget — in that case (user_id, NULL, month) is unique
  unique (user_id, category_id, month)
);

create index if not exists idx_budgets_user_month
  on public.budgets (user_id, month desc);

create index if not exists idx_budgets_category
  on public.budgets (category_id);

alter table public.budgets enable row level security;

create policy "Users can view their own budgets"
  on public.budgets for select using (auth.uid() = user_id);

create policy "Users can insert their own budgets"
  on public.budgets for insert with check (auth.uid() = user_id);

create policy "Users can update their own budgets"
  on public.budgets for update using (auth.uid() = user_id);

create policy "Users can delete their own budgets"
  on public.budgets for delete using (auth.uid() = user_id);

create trigger budgets_updated_at
  before update on public.budgets
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 7. goals
-- -----------------------------------------------------------------------------
create table if not exists public.goals (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users on delete cascade,
  name          text          not null check (char_length(trim(name)) > 0),
  target_amount numeric(15,2) not null check (target_amount > 0),
  saved_amount  numeric(15,2) not null default 0 check (saved_amount >= 0),
  deadline      date,
  is_completed  boolean       not null default false,
  color         text          not null default '#22C55E',
  icon          text          not null default '🎯',
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index if not exists idx_goals_user on public.goals (user_id);

alter table public.goals enable row level security;

create policy "Users can view their own goals"
  on public.goals for select using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on public.goals for insert with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on public.goals for update using (auth.uid() = user_id);

create policy "Users can delete their own goals"
  on public.goals for delete using (auth.uid() = user_id);

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 8. recurring_transactions
-- -----------------------------------------------------------------------------
create table if not exists public.recurring_transactions (
  id             uuid          primary key default gen_random_uuid(),
  user_id        uuid          not null references auth.users on delete cascade,
  account_id     uuid          references public.accounts on delete set null,
  category_id    uuid          references public.categories on delete set null,
  merchant       text          not null check (char_length(trim(merchant)) > 0),
  amount         numeric(15,2) not null check (amount > 0),
  type           public.transaction_type not null,
  recurrence     public.recurrence_type not null,
  day_of_month   integer check (day_of_month >= 1 and day_of_month <= 31),
  day_of_week    integer check (day_of_week >= 0 and day_of_week <= 6),
  start_date     date          not null,
  end_date       date,
  is_active      boolean       not null default true,
  last_generated date,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

create index if not exists idx_recurring_user on public.recurring_transactions (user_id);
create index if not exists idx_recurring_active on public.recurring_transactions (is_active);

alter table public.recurring_transactions enable row level security;

create policy "Users can view their own recurring transactions"
  on public.recurring_transactions for select using (auth.uid() = user_id);

create policy "Users can insert their own recurring transactions"
  on public.recurring_transactions for insert with check (auth.uid() = user_id);

create policy "Users can update their own recurring transactions"
  on public.recurring_transactions for update using (auth.uid() = user_id);

create policy "Users can delete their own recurring transactions"
  on public.recurring_transactions for delete using (auth.uid() = user_id);

create trigger recurring_transactions_updated_at
  before update on public.recurring_transactions
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 9. notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users on delete cascade,
  type          public.notification_type not null default 'info',
  title         text          not null,
  message       text,
  is_read       boolean       not null default false,
  action_label  text,
  action_url    text,
  created_at    timestamptz   not null default now()
);

-- Cover the common query: user's unread notifications ordered by recency
create index if not exists idx_notifications_user
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select using (auth.uid() = user_id);

-- Only the user themselves can insert (system notifications should use a
-- security-definer function or the Supabase service role key)
create policy "Users can insert their own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications for update using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 10. Budget auto-refresh trigger
-- -----------------------------------------------------------------------------
-- Keeps the `spent` column on budgets in sync when transactions are
-- inserted, updated, or deleted. On UPDATE, both the old and new budget
-- states are refreshed so that changes to category, type, or date are
-- correctly reflected. Only expense transactions affect budgets.
create or replace function public.refresh_budget_spent_for(
  p_user_id     uuid,
  p_category_id uuid,
  p_month       text
)
returns void
language plpgsql
as $$
begin
  if p_user_id is null or p_category_id is null then
    return;
  end if;

  update public.budgets
  set spent = (
    select coalesce(sum(t.amount), 0)
    from public.transactions t
    where t.user_id = p_user_id
      and t.category_id = p_category_id
      and t.type = 'expense'
      and t.date >= (p_month || '-01')::date
      and t.date <  ((p_month || '-01')::date + interval '1 month')
  )
  where budgets.user_id = p_user_id
    and budgets.category_id = p_category_id
    and budgets.month = p_month;
end;
$$;

create or replace function public.refresh_budget_spent()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.type = 'expense' then
      perform public.refresh_budget_spent_for(
        NEW.user_id, NEW.category_id, to_char(NEW.date, 'YYYY-MM')
      );
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    -- Refresh the new state (category/type/date may have changed)
    if NEW.type = 'expense' then
      perform public.refresh_budget_spent_for(
        NEW.user_id, NEW.category_id, to_char(NEW.date, 'YYYY-MM')
      );
    end if;
    -- Refresh the old state if it was an expense (handles category/type changes)
    if OLD.type = 'expense' then
      perform public.refresh_budget_spent_for(
        OLD.user_id, OLD.category_id, to_char(OLD.date, 'YYYY-MM')
      );
    end if;
    return NEW;
  end if;

  -- TE_OP = 'DELETE'
  if OLD.type = 'expense' then
    perform public.refresh_budget_spent_for(
      OLD.user_id, OLD.category_id, to_char(OLD.date, 'YYYY-MM')
    );
  end if;

  return OLD;
end;
$$;

create trigger trg_refresh_budget_spent
  after insert or update or delete on public.transactions
  for each row execute function public.refresh_budget_spent();
