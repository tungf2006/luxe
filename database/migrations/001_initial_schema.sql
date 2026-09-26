-- ==========================================================================
-- Luxe — Database Schema
-- ==========================================================================
-- This file defines the complete PostgreSQL schema for the Luxe personal
-- finance application. It is designed to be executed via the Supabase SQL
-- Editor or a migration tool.
--
-- Tables:
--   profiles, accounts, categories, categories_seed
--   transactions, budgets, goals
--   recurring_transactions, notifications
--
-- Security: Row Level Security (RLS) is enabled on every user-owned table.
-- Every query is scoped to the authenticated user via auth.uid().
-- ==========================================================================

-- Enable UUID extension for primary keys
create extension if not exists "uuid-ossp";

-- ==========================================================================
-- profiles
-- ==========================================================================
create table public.profiles (
  id            uuid         primary key
    references auth.users on delete cascade,
  full_name     text         not null check (char_length(trim(full_name)) >= 2),
  avatar_url    text,
  currency      text         not null default 'VND',
  payday        text         not null default '1st',
  budget_period text         not null default 'monthly',
  created_at    timestamp    not null default now(),
  updated_at    timestamp    not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Keep updated_at in sync
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ==========================================================================
-- accounts
-- ==========================================================================
create type public.account_type as enum ('checking', 'savings', 'credit', 'investment');

create table public.accounts (
  id            uuid          primary key default uuid_generate_v4(),
  user_id       uuid          not null
    references public.profiles on delete cascade,
  name          text          not null check (char_length(trim(name)) > 0),
  type          public.account_type not null default 'checking',
  balance       numeric(15,2) not null default 0,
  currency      text          not null default 'VND',
  icon          text,
  is_default    boolean       not null default false,
  created_at    timestamp     not null default now(),
  updated_at    timestamp     not null default now()
);

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

-- ==========================================================================
-- categories
-- ==========================================================================
-- System categories (read-only, used as defaults for every user).
-- These are seeded and never deleted. Users can create custom categories.
create table public.categories (
  id            uuid          primary key default uuid_generate_v4(),
  user_id       uuid
    references public.profiles on delete cascade,
  key           text          not null,
  name          text          not null,
  icon          text,
  color         text          not null,
  type          text          not null check (type in ('income', 'expense')),
  is_default    boolean       not null default false,
  sort_order    integer       not null default 0,
  created_at    timestamp     not null default now()
);

alter table public.categories enable row level security;

create policy "Users can view default and own categories"
  on public.categories for select
  using (is_default = true or auth.uid() = user_id);

create policy "Users can create their own categories"
  on public.categories for insert with check (auth.uid() = user_id);

create policy "Users can update their own categories"
  on public.categories for update
  using (auth.uid() = user_id and is_default = false);

create policy "Users can delete their own categories"
  on public.categories for delete using (auth.uid() = user_id and is_default = false);

-- A composite unique constraint so that each user has unique keys,
-- while default categories (user_id IS NULL) are globally unique.
create unique index categories_user_key_idx
  on public.categories (user_id, key)
  where user_id is not null;

create unique index categories_default_key_idx
  on public.categories (key)
  where is_default = true;

-- ==========================================================================
-- transactions
-- ==========================================================================
create type public.transaction_type as enum ('income', 'expense');
create type public.transaction_status as enum ('completed', 'pending');

create table public.transactions (
  id               uuid          primary key default uuid_generate_v4(),
  user_id          uuid          not null
    references public.profiles on delete cascade,
  account_id       uuid
    references public.accounts on delete set null,
  category_id      uuid
    references public.categories on delete set null,
  merchant         text          not null,
  amount           numeric(15,2) not null check (amount > 0),
  type             public.transaction_type not null,
  status           public.transaction_status not null default 'completed',
  date             date          not null default current_date,
  notes            text,
  is_recurring     boolean       not null default false,
  created_at       timestamp     not null default now(),
  updated_at       timestamp     not null default now()
);

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

create index idx_transactions_user_date on public.transactions (user_id, date desc);
create index idx_transactions_user_category on public.transactions (user_id, category_id);

-- ==========================================================================
-- budgets
-- ==========================================================================
create table public.budgets (
  id            uuid          primary key default uuid_generate_v4(),
  user_id       uuid          not null
    references public.profiles on delete cascade,
  category_id   uuid
    references public.categories on delete set null,
  name          text          not null,
  limit_amount  numeric(15,2) not null check (limit_amount > 0),
  spent         numeric(15,2) not null default 0 check (spent >= 0),
  month         date          not null default date_trunc('month', current_date),
  color         text,
  created_at    timestamp     not null default now(),
  updated_at    timestamp     not null default now()
);

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

create unique index budgets_user_category_month_idx
  on public.budgets (user_id, category_id, month);

-- ==========================================================================
-- goals
-- ==========================================================================
create table public.goals (
  id              uuid          primary key default uuid_generate_v4(),
  user_id         uuid          not null
    references public.profiles on delete cascade,
  name          text          not null check (char_length(trim(name)) > 0),
  target_amount numeric(15,2) not null check (target_amount > 0),
  saved_amount  numeric(15,2) not null default 0 check (saved_amount >= 0),
  deadline      date,
  is_completed  boolean       not null default false,
  color         text,
  created_at    timestamp     not null default now(),
  updated_at    timestamp     not null default now()
);

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

-- ==========================================================================
-- recurring_transactions
-- ==========================================================================
create type public.recurrence_type as enum ('daily', 'weekly', 'monthly', 'yearly');

create table public.recurring_transactions (
  id              uuid          primary key default uuid_generate_v4(),
  user_id         uuid          not null
    references public.profiles on delete cascade,
  account_id      uuid
    references public.accounts on delete set null,
  category_id     uuid
    references public.categories on delete set null,
  merchant        text          not null,
  amount          numeric(15,2) not null check (amount > 0),
  type            public.transaction_type not null,
  recurrence      public.recurrence_type not null,
  day_of_month    integer check (day_of_month >= 1 and day_of_month <= 31),
  day_of_week     integer check (day_of_week >= 0 and day_of_week <= 6),
  start_date      date          not null,
  end_date        date,
  is_active       boolean       not null default true,
  last_generated  date,
  created_at      timestamp     not null default now(),
  updated_at      timestamp     not null default now()
);

alter table public.recurring_transactions enable row level security;

create policy "Users can view their own recurring transactions"
  on public.recurring_transactions for select using (auth.uid() = user_id);

create policy "Users can insert their own recurring transactions"
  on public.recurring_transactions for insert with check (auth.uid() = user_id);

create policy "Users can update their own recurring transactions"
  on public.recurring_transactions for update using (auth.uid() = user_id);

create policy "Users can delete their own recurring transactions"
  on public.recurring_transactions for delete using (auth.uid() = user_id);

create policy "Users can insert their own recurring transactions"
  on public.recurring_transactions for insert with check (auth.uid() = user_id);

create policy "Users can update their own recurring transactions"
  on public.recurring_transactions for update using (auth.uid() = user_id);

create policy "Users can delete their own recurring transactions"
  on public.recurring_transactions for delete using (auth.uid() = user_id);

create trigger recurring_transactions_updated_at
  before update on public.recurring_transactions
  for each row execute function public.handle_updated_at();

-- ==========================================================================
-- notifications
-- ==========================================================================
create type public.notification_type as enum ('info', 'warning', 'success', 'error');

create table public.notifications (
  id              uuid          primary key default uuid_generate_v4(),
  user_id         uuid          not null
    references public.profiles on delete cascade,
  type            public.notification_type not null default 'info',
  title           text          not null,
  message         text          not null,
  is_read         boolean       not null default false,
  action_label    text,
  action_url      text,
  created_at      timestamp     not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users can create their own notifications"
  on public.notifications for insert with check (auth.uid() = user_id);

create policy "Users can mark their own notifications as read"
  on public.notifications for update using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete using (auth.uid() = user_id);

create index idx_notifications_user on public.notifications (user_id, is_read, created_at desc);

-- ==========================================================================
-- Default Categories Seed Data
-- ==========================================================================
insert into public.categories (key, name, icon, color, type, is_default, sort_order) values
  ('Income',         'Thu nhập',             '💼', '#6366F1', 'income',  true, 0),
  ('Food',           'Thức ăn & Ăn uống',     '🛒', '#F59E0B', 'expense', true, 1),
  ('Transport',      'Giao thông',           '🚌', '#38BDF8', 'expense', true, 2),
  ('Entertainment',  'Giải trí',             '🎬', '#A78BDA', 'expense', true, 3),
  ('Shopping',       'Mua sắm',              '🛍️', '#22C55E', 'expense', true, 4),
  ('Bills',          'Hóa đơn & Tiện ích',   '⚡', '#F43F5E', 'expense', true, 5),
  ('Health',         'Sức khỏe',             '💊', '#14B8A3', 'expense', true, 6),
  ('Other',          'Khác',                 '📦', '#64748B', 'expense', true, 7);

-- ==========================================================================
-- Helper: Auto-create profile on signup
-- ==========================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, currency, payday, budget_period)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'VND',
    '1st',
    'monthly'
  );

  -- Seed default categories for the new user
  insert into public.categories (user_id, key, name, icon, color, type, is_default, sort_order)
  select
    new.id, key, name, icon, color, type, false, sort_order
  from public.categories
  where is_default = true;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
