-- =============================================================================
-- Migration: 20261012000000_user_bootstrap_trigger.sql
-- Description: Task 1C — Clean New User Bootstrap Trigger for Supabase PostgreSQL
-- Author: Luxe Financial Engine
-- Note: Run this SQL manually in the Supabase Dashboard SQL Editor.
-- =============================================================================

-- 1. Upgrade handle_new_user() trigger function to create:
--    - Profile with VND defaults
--    - Exactly 1 Cash account ("Tiền mặt") with balance 0 VND (is_default = true)
--    - Suggested budgets for current month matching VND standardization
--    - ZERO transactions, ZERO goals, ZERO recurring items, ZERO fake balances

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text;
  v_cat_food uuid;
  v_cat_transport uuid;
  v_cat_shopping uuid;
  v_cat_bills uuid;
  v_cat_entertainment uuid;
  v_cat_health uuid;
begin
  -- 1. Auto-create Profile row
  insert into public.profiles (
    id,
    full_name,
    avatar_url,
    currency,
    payday,
    budget_period,
    onboarding_complete
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    'VND',
    '1st',
    'monthly',
    false
  )
  on conflict (id) do nothing;

  -- 2. Auto-create exactly ONE default Cash account with balance 0 VND (user data)
  insert into public.accounts (
    user_id,
    name,
    type,
    balance,
    currency,
    is_default
  )
  values (
    new.id,
    'Tiền mặt',
    'checking',
    0,
    'VND',
    true
  )
  on conflict do nothing;

  -- 3. Resolve default category UUIDs for suggested budgets
  select id into v_cat_food from public.categories where (key = 'food' or key = 'Food') and is_default = true limit 1;
  select id into v_cat_transport from public.categories where (key = 'transport' or key = 'Transport') and is_default = true limit 1;
  select id into v_cat_shopping from public.categories where (key = 'shopping' or key = 'Shopping') and is_default = true limit 1;
  select id into v_cat_bills from public.categories where (key = 'bills' or key = 'Bills') and is_default = true limit 1;
  select id into v_cat_entertainment from public.categories where (key = 'entertainment' or key = 'Entertainment') and is_default = true limit 1;
  select id into v_cat_health from public.categories where (key = 'health' or key = 'Health') and is_default = true limit 1;

  v_month := to_char(now(), 'YYYY-MM');

  -- 4. Auto-create suggested monthly budgets (editable/deletable by user)
  if v_cat_food is not null then
    insert into public.budgets (user_id, category_id, name, limit_amount, spent, month, color)
    values (new.id, v_cat_food, 'Thức ăn & Ăn uống', 5000000, 0, v_month, '#F59E0B')
    on conflict do nothing;
  end if;

  if v_cat_transport is not null then
    insert into public.budgets (user_id, category_id, name, limit_amount, spent, month, color)
    values (new.id, v_cat_transport, 'Di chuyển', 2000000, 0, v_month, '#38BDF8')
    on conflict do nothing;
  end if;

  if v_cat_shopping is not null then
    insert into public.budgets (user_id, category_id, name, limit_amount, spent, month, color)
    values (new.id, v_cat_shopping, 'Mua sắm', 3000000, 0, v_month, '#22C55E')
    on conflict do nothing;
  end if;

  if v_cat_bills is not null then
    insert into public.budgets (user_id, category_id, name, limit_amount, spent, month, color)
    values (new.id, v_cat_bills, 'Hóa đơn & Tiện ích', 4000000, 0, v_month, '#F43F5E')
    on conflict do nothing;
  end if;

  if v_cat_entertainment is not null then
    insert into public.budgets (user_id, category_id, name, limit_amount, spent, month, color)
    values (new.id, v_cat_entertainment, 'Giải trí', 1500000, 0, v_month, '#A78BDA')
    on conflict do nothing;
  end if;

  if v_cat_health is not null then
    insert into public.budgets (user_id, category_id, name, limit_amount, spent, month, color)
    values (new.id, v_cat_health, 'Sức khỏe', 1500000, 0, v_month, '#14B8A3')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- 2. Verify trigger existence on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Verification Query (Run to verify clean state for a user):
-- SELECT count(*) FROM public.transactions WHERE user_id = 'YOUR_USER_UUID'; -- Should be 0
-- SELECT * FROM public.accounts WHERE user_id = 'YOUR_USER_UUID'; -- Should have 1 Cash account with balance 0
-- =============================================================================
