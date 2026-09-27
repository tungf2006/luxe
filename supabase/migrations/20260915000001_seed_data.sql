-- =============================================================================
-- Seed: 20260915000001_seed_data.sql
-- Description: Sample seed data for Luxe — Vietnamese personal finance (VND)
--              Works in both psql and Supabase SQL Editor.
--              Run AFTER the schema migration (00_initial_luxe_schema.sql).
-- =============================================================================

-- Demo user UUID — replace with the actual user UID from your Supabase project
-- Must exist in auth.users before running this script.
-- Tip: create a test user in Authentication → Users first, then paste its ID.
\set demo_user '6ee7d1f0-3b2a-4c1d-9e8f-7a6b5c4d3e2f'

-- -----------------------------------------------------------------------------
-- 1. System-level default categories (visible to ALL users via RLS)
-- -----------------------------------------------------------------------------
insert into public.categories (id, key, name, icon, color, type, is_default, sort_order) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Income',       'Thu nhập',           '💼', '#22C55E', 'income',  true, 0),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Food',         'Ăn uống',            '🍽️', '#F59E0B', 'expense', true, 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Transport',    'Giao thông',         '🚌', '#38BDF8', 'expense', true, 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Entertainment','Giải trí',           '🎬', '#A78BDA', 'expense', true, 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Shopping',     'Mua sắm',            '🛍️', '#EC4899', 'expense', true, 4),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Bills',        'Hóa đơn & Tiện ích', '⚡', '#EF4444', 'expense', true, 5),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Health',       'Sức khỏe',           '💊', '#14B8A3', 'expense', true, 6),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'Other',        'Khác',               '📦', '#94A3B8', 'expense', true, 7)
on conflict (key) do update
  set name = excluded.name, icon = excluded.icon, color = excluded.color;

-- -----------------------------------------------------------------------------
-- 2. Demo accounts (linked to the demo user)
-- -----------------------------------------------------------------------------
insert into public.accounts (id, user_id, name, type, balance, currency, icon, is_default) values
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', :demo_user, 'Ví điện tử Momo',           'checking',  15420000, 'VND', '💳',  true),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', :demo_user, 'Tài khoản tiết kiệm ACB',    'savings',   9160000,  'VND', '🏦', false),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', :demo_user, 'Thẻ tín dụng techcombank',  'credit',    -5300000, 'VND', '💸', false)
on conflict (id) do update
  set name = excluded.name, balance = excluded.balance;

-- -----------------------------------------------------------------------------
-- 3. Demo transactions (September 2026)
-- -----------------------------------------------------------------------------
insert into public.transactions (id, user_id, account_id, category_id, merchant, amount, type, status, date) values
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Lương công ty TNHH Công Nghệ Luxe', 25000000, 'income',  'completed', '2026-09-02'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dự án freelance — Thiết kế UI',      8500000,  'income',  'completed', '2026-09-10'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Siêu thị Co.opmart',                 860000,   'expense', 'completed', '2026-09-14'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Quán cà phê Highlands',             42000,    'expense', 'completed', '2026-09-14'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'GrabAuto — Đi làm',                 58000,    'expense', 'completed', '2026-09-13'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Netflix Tháng 9',                 150000,   'expense', 'completed', '2026-09-05'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Tiền điện nước',                    950000,   'expense', 'completed', '2026-09-09'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Shopee — Đồ điện tử',              640000,   'expense', 'completed', '2026-09-08'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Phòng khám đa khoa',                1200000,  'expense', 'completed', '2026-09-07'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Chợ hải sản Hàm Rồng',              340000,   'expense', 'completed', '2026-09-06'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Tiền thuê nhà',                     4500000,  'expense', 'completed', '2026-09-01'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Hội viên phòng gym',                750000,   'expense', 'completed', '2026-09-01'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Apple Store — iPhone',             24900000, 'expense', 'pending',   '2026-09-05'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Spotify Premium',                  110000,   'expense', 'completed', '2026-09-01'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Xăng xe máy',                       150000,   'expense', 'completed', '2026-09-04'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Cà phê sáng',                        25000,   'expense', 'completed', '2026-09-14'),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Steam — Game',                     350000,   'expense', 'completed', '2026-09-10');

-- -----------------------------------------------------------------------------
-- 4. Demo budgets (September 2026)
-- -----------------------------------------------------------------------------
insert into public.budgets (id, user_id, category_id, name, limit_amount, spent, month, color) values
  (gen_random_uuid(), :demo_user, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Ăn uống',            8000000,  1645000, '2026-09', '#F59E0B'),
  (gen_random_uuid(), :demo_user, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Giao thông',         3000000,  208000,  '2026-09', '#38BDF8'),
  (gen_random_uuid(), :demo_user, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Giải trí',           500000,   510000,  '2026-09', '#A78BDA'),
  (gen_random_uuid(), :demo_user, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Mua sắm',            5000000,  25300000, '2026-09', '#EC4899'),
  (gen_random_uuid(), :demo_user, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Hóa đơn & Tiện ích', 8000000,  5450000, '2026-09', '#EF4444'),
  (gen_random_uuid(), :demo_user, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Sức khỏe',           3000000,  1950000, '2026-09', '#14B8A3');

-- -----------------------------------------------------------------------------
-- 5. Demo financial goals
-- -----------------------------------------------------------------------------
insert into public.goals (id, user_id, name, target_amount, saved_amount, deadline, color, icon) values
  (gen_random_uuid(), :demo_user, 'Quỹ khẩn cấp',       100000000, 72000000, '2026-12-31', '#22C55E', '🛡️'),
  (gen_random_uuid(), :demo_user, 'Du lịch Nhật Bản',    35000000, 12000000, '2027-06-01', '#38BDF8', '✈️');

-- -----------------------------------------------------------------------------
-- 6. Demo recurring transactions
-- -----------------------------------------------------------------------------
insert into public.recurring_transactions (id, user_id, account_id, category_id, merchant, amount, type, recurrence, day_of_month, start_date, is_active) values
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Tiền thuê nhà',       4500000,  'expense', 'monthly', 1,  '2026-09-01', true),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Spotify Premium',      110000,  'expense', 'monthly', 5,  '2026-09-01', true),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Phí bảo hiểm y tế',    150000,  'expense', 'monthly', 10, '2026-09-01', true),
  (gen_random_uuid(), :demo_user, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Lương công ty',        25000000, 'income',  'monthly', 15, '2026-09-01', true);

-- -----------------------------------------------------------------------------
-- 7. Demo welcome notification
-- -----------------------------------------------------------------------------
insert into public.notifications (id, user_id, type, title, message, is_read) values
  (gen_random_uuid(), :demo_user, 'info', 'Chào mừng đến với Luxe!', 'Cảm ơn bạn đã đăng ký. Hãy bắt đầu theo dõi tài chính ngay hôm nay.', false);
