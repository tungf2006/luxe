-- =============================================================================
-- Migration: manual_vnd_unit_migration.sql (DRY-RUN ONLY)
-- Description: Script chẩn đoán / kiểm tra DRY-RUN (chỉ SELECT, KHÔNG có UPDATE tự động).
--              Liệt kê danh sách và đếm số lượng các bản ghi có số tiền nhỏ (< 10.000 hoặc < 100.000)
--              để người quản trị/người dùng tự quyết định thủ công, tránh sửa nhầm dữ liệu người dùng thật.
-- An toàn: 100% READ-ONLY. Tuyệt đối không thay đổi hay cập nhật bất kỳ bản ghi nào trong database.
-- =============================================================================

-- =============================================================================
-- 1. BẢNG TỔNG HỢP: Đếm số lượng bản ghi nghi vấn cần rà soát trên từng bảng
-- =============================================================================
SELECT
  'transactions' AS table_name,
  COUNT(*) AS candidate_count,
  'Giao dịch có số tiền < 10.000 đ' AS criteria
FROM public.transactions
WHERE amount > 0 AND amount < 10000

UNION ALL

SELECT
  'accounts' AS table_name,
  COUNT(*) AS candidate_count,
  'Tài khoản có |số dư| > 0 và < 100.000 đ' AS criteria
FROM public.accounts
WHERE ABS(balance) > 0 AND ABS(balance) < 100000

UNION ALL

SELECT
  'budgets' AS table_name,
  COUNT(*) AS candidate_count,
  'Ngân sách có hạn mức > 0 và < 100.000 đ' AS criteria
FROM public.budgets
WHERE limit_amount > 0 AND limit_amount < 100000

UNION ALL

SELECT
  'goals' AS table_name,
  COUNT(*) AS candidate_count,
  'Mục tiêu có số tiền đích > 0 và < 100.000 đ' AS criteria
FROM public.goals
WHERE target_amount > 0 AND target_amount < 100000

UNION ALL

SELECT
  'recurring_transactions' AS table_name,
  COUNT(*) AS candidate_count,
  'Giao dịch định kỳ có số tiền > 0 và < 100.000 đ' AS criteria
FROM public.recurring_transactions
WHERE amount > 0 AND amount < 100000;


-- =============================================================================
-- 2. CHI TIẾT: Danh sách giao dịch (transactions) nghi vấn (Dry-run inspection)
-- =============================================================================
SELECT
  id,
  user_id,
  merchant,
  amount,
  type,
  status,
  date,
  created_at
FROM public.transactions
WHERE amount > 0 AND amount < 10000
ORDER BY date DESC, created_at DESC;


-- =============================================================================
-- 3. CHI TIẾT: Danh sách tài khoản (accounts) nghi vấn (Dry-run inspection)
-- =============================================================================
SELECT
  id,
  user_id,
  name,
  type,
  balance,
  currency,
  updated_at
FROM public.accounts
WHERE ABS(balance) > 0 AND ABS(balance) < 100000
ORDER BY name ASC;


-- =============================================================================
-- 4. CHI TIẾT: Danh sách ngân sách (budgets) nghi vấn (Dry-run inspection)
-- =============================================================================
SELECT
  id,
  user_id,
  category_id,
  name,
  limit_amount,
  spent,
  month,
  updated_at
FROM public.budgets
WHERE (limit_amount > 0 AND limit_amount < 100000)
   OR (spent > 0 AND spent < 100000)
ORDER BY month DESC;


-- =============================================================================
-- 5. CHI TIẾT: Danh sách mục tiêu tài chính (goals) nghi vấn (Dry-run inspection)
-- =============================================================================
SELECT
  id,
  user_id,
  name,
  target_amount,
  saved_amount,
  deadline,
  updated_at
FROM public.goals
WHERE (target_amount > 0 AND target_amount < 100000)
   OR (saved_amount > 0 AND saved_amount < 100000)
ORDER BY deadline ASC;


-- =============================================================================
-- 6. CHI TIẾT: Danh sách giao dịch định kỳ (recurring_transactions) nghi vấn
-- =============================================================================
SELECT
  id,
  user_id,
  merchant,
  amount,
  type,
  recurrence,
  is_active,
  created_at
FROM public.recurring_transactions
WHERE amount > 0 AND amount < 100000
ORDER BY created_at DESC;
