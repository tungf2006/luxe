/**
 * @file Onboarding flow - 4-step setup guide for new users.
 *
 * Steps:
  *   1. Thông tin cơ bản (name, avatar)
  *   2. Đơn vị tiền tệ (VND, USD, EUR, etc.)
  *   3. Thiết lập tài khoản tài chính (initial account + balance)
  *   4. Mục tiêu sử dụng Luxe (what they want to achieve)
 *
 * Users can skip optional steps.
 */

import { emit } from '../../utils/eventBus.js';
import { getSupabase } from '../../services/supabaseClient.js';
import { CATEGORY_MAP } from '../../constants/categories.js';
import { MOCK_MODE } from '../../config/env.js';

const STEPS = [
  { id: 'basic-info',  label: 'Thông tin cơ bản' },
  { id: 'currency',    label: 'Đơn vị tiền tệ' },
  { id: 'accounts',    label: 'Tài khoản tài chính' },
  { id: 'goals',       label: 'Mục tiêu sử dụng Luxe' },
];

const CURRENCIES = [
  { value: 'VND', label: 'Đồng Việt Nam (VND)' },
  { value: 'USD', label: 'Đô la Mỹ (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'Bảng Anh (GBP)' },
  { value: 'JPY', label: 'Yên Nhật (JPY)' },
  { value: 'SGD', label: 'Đồng Singapore (SGD)' },
  { value: 'CNY', label: 'Nhân dân tệ (CNY)' },
  { value: 'KRW', label: 'Won Hàn Quốc (KRW)' },
];

const USE_GOALS = [
  { value: 'save',     label: 'Chiết kiệm tiền nhiều hơn',       icon: '💰' },
  { value: 'track',    label: 'Theo dõi chi tiêu hàng tháng',    icon: '📊' },
  { value: 'budget',   label: 'Ngân sách hợp lý',                icon: '🎯' },
  { value: 'debt',     label: 'Tránh nợ thái nhiều',             icon: '💳' },
  { value: 'invest',   label: 'Lập kế hoạch đầu tư',             icon: '📈' },
  { value: 'other',    label: 'Tổng quan tài chính cá nhân',     icon: '💼' },
];

/* ---------------------------------------------------------------- *
 * Step 1: Basic Info
 * ---------------------------------------------------------------- */

function renderBasicInfoStep(state) {
  return `
    <div class="onboarding-step">
      <h2 class="onboarding-step-title">Thông tin cơ bản</h2>
      <p class="onboarding-step-desc">Cho chúng tôi biết bạn là ai để cá nhân hóa trải nghiệm.</p>
      <div class="form-group">
        <label class="form-label" for="onboarding-name">Họ và tên</label>
        <input type="text" id="onboarding-name" class="form-input" placeholder="Nguyễn Văn A" value="${state.fullName || ''}" />
      </div>
      <div class="form-row">
        <input type="checkbox" id="onboarding-onboarding-complete" class="checkbox" ${state.onboardingComplete ? 'checked' : ''} />
        <label class="checkbox-label" for="onboarding-onboarding-complete">Đánh dấu hoàn thành sau bước này</label>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- *
 * Step 2: Currency
 * ---------------------------------------------------------------- */

function renderCurrencyStep(state) {
  const options = CURRENCIES.map(c =>
    `<option value="${c.value}" ${state.currency === c.value ? 'selected' : ''}>${c.label}</option>`
  ).join('');

  return `
    <div class="onboarding-step">
      <h2 class="onboarding-step-title">Đơn vị tiền tệ</h2>
      <p class="onboarding-step-desc">Chọn đơn vị tiền tệ bạn muốn sử dụng.</p>
      <div class="form-group">
        <label class="form-label" for="onboarding-currency">Đơn vị tiền tệ</label>
        <select id="onboarding-currency" class="select-dropdown">${options}</select>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- *
 * Step 3: Accounts
 * ---------------------------------------------------------------- */

function renderAccountsStep(state) {
  const accountTypes = [
    { value: 'checking', label: 'Tài khoản thanh toán' },
    { value: 'savings',  label: 'Tài khoản tiết kiệm' },
    { value: 'credit',   label: 'Thẻ tín dụng' },
    { value: 'investment', label: 'Đầu tư' },
  ];

  const typeOptions = accountTypes.map(t =>
    `<option value="${t.value}" ${state.initialAccountType === t.value ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  return `
    <div class="onboarding-step">
      <h2 class="onboarding-step-title">Tài khoản tài chính</h2>
      <p class="onboarding-step-desc">Thêm tài khoản tài chính chính của bạn (tùy chọn).</p>

      <div class="form-group">
        <label class="form-label" for="onboarding-account-name">Tên tài khoản</label>
        <input type="text" id="onboarding-account-name" class="form-input" placeholder="Ví dụ: Ví Momo, Thẻ Vietcombank..." value="${state.accountName || ''}" />
      </div>

      <div class="form-group">
        <label class="form-label" for="onboarding-account-type">Loại tài khoản</label>
        <select id="onboarding-account-type" class="select-dropdown">${typeOptions}</select>
      </div>

      <div class="form-group">
        <label class="form-label" for="onboarding-account-balance">Số dư ban đầu</label>
        <input type="number" id="onboarding-account-balance" class="form-input" placeholder="0" value="${state.initialBalance || ''}" />
      </div>

      <div class="onboarding-skip-row">
        <input type="checkbox" id="onboarding-skip-account" class="checkbox" />
        <label class="checkbox-label" for="onboarding-skip-account">Bỏ qua bước này, tôi sẽ thêm sau</label>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- *
 * Step 4: Usage Goals
 * ---------------------------------------------------------------- */

function renderGoalsStep(state) {
  const goalOptions = USE_GOALS.map(g => `
    <div class="goal-option" data-goal="${g.value}">
      <div class="goal-option-icon">${g.icon}</div>
      <span class="goal-option-label">${g.label}</span>
    </div>
  `).join('');

  const selectedClass = state.useGoal ? 'has-selection' : '';

  return `
    <div class="onboarding-step">
      <h2 class="onboarding-step-title">Mục tiêu sử dụng Luxe</h2>
      <p class="onboarding-step-desc">Bạn muốn đạt được gì với Luxe?</p>
      <div class="goal-options ${selectedClass}" id="onboarding-goals">
        ${goalOptions}
        <input type="hidden" id="onboarding-selected-goal" value="${state.useGoal || ''}" />
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- *
 * Main render
 * ---------------------------------------------------------------- */

export function onboardingHTML(state = {}) {
  const currentStep = state._step || 0;
  const step = STEPS[currentStep];
  const stepHtml = currentStep === 0
    ? renderBasicInfoStep(state)
    : currentStep === 1
    ? renderCurrencyStep(state)
    : currentStep === 2
    ? renderAccountsStep(state)
    : renderGoalsStep(state);

  const isLastStep = currentStep === STEPS.length - 1;
  const progressPct = ((currentStep + 1) / STEPS.length) * 100;

  return `
    <div class="onboarding-page">
      <div class="onboarding-container">
        <div class="onboarding-progress">
          <div class="onboarding-progress-bar">
            <div class="onboarding-progress-fill" style="width: ${progressPct}%"></div>
          </div>
          <span class="onboarding-progress-text">Bước ${currentStep + 1} / ${STEPS.length}</span>
        </div>

        <div class="onboarding-card">
          <div class="onboarding-steps-indicator">
            ${STEPS.map((s, i) => `
              <div class="step-dot ${i === currentStep ? 'active' : i < currentStep ? 'complete' : ''}">
                <span class="step-number">${i + 1}</span>
              </div>
            `).join('')}
          </div>

          ${stepHtml}

          <div class="onboarding-actions">
            ${currentStep > 0 ? `<button type="button" class="btn-secondary" id="onboarding-back">Quay lại</button>` : ''}
            <button type="submit" class="btn-auth-submit" id="onboarding-next">
              <span class="btn-text">${isLastStep ? 'Hoàn thành' : 'Tiếp theo'}</span>
            </button>
          </div>

          ${currentStep === STEPS.length - 1
            ? '<div class="onboarding-skip-wrapper"><button type="button" class="auth-link" id="onboarding-skip">Bỏ qua tất cả</button></div>'
            : '<div class="onboarding-skip-wrapper"><button type="button" class="auth-link" id="onboarding-skip">Bỏ qua</button></div>'
          }
        </div>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- *
 * Save onboarding state to profile
 * ---------------------------------------------------------------- */

export async function saveOnboardingStep(userId, state) {
  const supabase = getSupabase();
  if (!supabase) {
    localStorage.setItem('luxe-onboarding', JSON.stringify(state));
    return { error: null };
  }

  const payload = {};
  if (state.fullName) payload.full_name = state.fullName;
  if (state.currency) payload.currency = state.currency;
  if (state.payDay) payload.payday = state.payDay;
  if (state.budgetPeriod) payload.budget_period = state.budget_period;
  if (state.onboardingComplete !== undefined) payload.onboarding_complete = state.onboardingComplete;

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...payload })
    .eq('id', userId);

  return { error };
}

/* ---------------------------------------------------------------- *
 * Complete onboarding - saves everything and marks complete
 * ---------------------------------------------------------------- */

export async function completeOnboarding(userId, state) {
  const supabase = getSupabase();
  const errors = [];

  if (!supabase) {
    const fullState = { ...state, onboardingComplete: true };
    localStorage.setItem('luxe-onboarding', JSON.stringify(fullState));
    return { errors: [] };
  }

  const profilePayload = {
    id: userId,
    full_name: state.fullName || '',
    currency: state.currency || 'VND',
    payday: state.payDay || '1st',
    budget_period: state.budgetPeriod || 'monthly',
    onboarding_complete: true,
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profilePayload)
    .eq('id', userId);
  if (profileError) errors.push(profileError.message);

  if (state.accountName && state.initialBalance !== '' && state.initialBalance !== undefined) {
    const { error: accountError } = await supabase.from('accounts').insert({
      user_id: userId,
      name: state.accountName,
      type: state.initialAccountType || 'checking',
      balance: Number(state.initialBalance),
      currency: state.currency || 'VND',
      is_default: true,
    });
    if (accountError) errors.push(accountError.message);
  }

  if (state.useGoal) {
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: userId,
      type: 'info',
       title: 'Chào mừng đến với Luxe!',
       message: `Chúc mừng bạn đã hoàn thành hướng dẫn. Mục tiêu: ${state.useGoal}`,
      is_read: false,
    });
    if (notifError) console.warn('[onboarding] Notification insert failed:', notifError.message);
  }

  return { errors };
}

