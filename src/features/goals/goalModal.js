/**
 * @file Add & Edit Goal Modal Component.
 * Implements interactive creation, edition, and quick deposit workflows
 * for financial goals with smart savings projection and live card preview.
 */

import dataService from '../../services/dataAdapter.js';
import { GOAL_CATEGORIES, GOAL_CATEGORY_MAP, GOAL_PRESETS, getGoalCategory } from '../../constants/goals.js';
import {
  formatCurrency,
  formatCompactCurrency,
  escapeHtml,
  parseNumber,
  parseVndInput,
  formatSpelledAmount,
  getActiveCurrency,
  getLocalDateString,
  formatMonthYear,
} from '../../utils/format.js';
import { openModal, closeModal } from '../../components/ui/Modal.js';
import { showToast } from '../../components/ui/Toast.js';

const MODAL_ID = 'add-goal-modal';
const DEPOSIT_MODAL_ID = 'deposit-goal-modal';

let _editingGoal = null;
let _isSubmitting = false;

/* --------------------------------------------------------------- *
 * Ensure Modal Overlays in DOM
 * --------------------------------------------------------------- */
function ensureGoalModal() {
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'goal-modal-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-goal">
        <div class="modal-grab-handle" aria-hidden="true"></div>
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="goal-modal-title">Thêm mục tiêu tài chính</h2>
            <p class="modal-subtitle">Xây dựng lộ trình tích lũy thông minh và có kỷ luật</p>
          </div>
          <button class="modal-close-btn" id="close-goal-modal-btn" type="button" aria-label="Đóng cửa sổ">&times;</button>
        </div>
        <form class="modal-form goal-modal-form" id="goal-modal-form" novalidate>
          <div id="goal-form-content"></div>
        </form>
        <div class="modal-footer goal-modal-footer">
          <button class="btn-secondary" id="cancel-goal-btn" type="button">Hủy</button>
          <button class="btn-secondary" id="save-and-add-another-goal-btn" type="button">Lưu và thêm tiếp</button>
          <button class="btn-add-transaction" id="confirm-save-goal-btn" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span id="confirm-save-goal-text">Tạo mục tiêu</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(MODAL_ID);
    });

    modal.querySelector('#close-goal-modal-btn')?.addEventListener('click', () => closeModal(MODAL_ID));
    modal.querySelector('#cancel-goal-btn')?.addEventListener('click', () => closeModal(MODAL_ID));
    modal.querySelector('#save-and-add-another-goal-btn')?.addEventListener('click', () => handleSave(true));
    modal.querySelector('#confirm-save-goal-btn')?.addEventListener('click', e => {
      e.preventDefault();
      handleSave(false);
    });

    const form = modal.querySelector('#goal-modal-form');
    form?.addEventListener('submit', e => {
      e.preventDefault();
      handleSave(false);
    });
  }

  ensureDepositModal();
  return modal;
}

function ensureDepositModal() {
  let modal = document.getElementById(DEPOSIT_MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = DEPOSIT_MODAL_ID;
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'deposit-modal-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-sm modal-dialog-deposit">
        <div class="modal-grab-handle" aria-hidden="true"></div>
        <div class="modal-header">
          <div>
            <h3 class="modal-title" id="deposit-modal-title">Tích lũy thêm cho mục tiêu</h3>
            <p class="modal-subtitle" id="deposit-goal-name-sub">Cộng thêm khoản tiền bạn vừa dành dụm</p>
          </div>
          <button class="modal-close-btn" id="close-deposit-modal-btn" type="button" aria-label="Đóng cửa sổ">&times;</button>
        </div>
        <form class="modal-form" id="deposit-modal-form" novalidate>
          <div class="deposit-target-summary" id="deposit-target-summary"></div>
          
          <div class="form-group">
            <label class="form-label" for="deposit-amount">Số tiền nạp thêm <span class="required-mark">*</span></label>
            <div class="currency-input" id="deposit-amount-wrapper">
              <span class="currency-prefix" aria-hidden="true">${escapeHtml(getActiveCurrency())}</span>
              <input type="text" class="form-input goal-amount-input" id="deposit-amount" placeholder="0" required inputmode="decimal" autocomplete="off" />
            </div>
            <div class="tx-amount-spelled" id="deposit-amount-spelled" aria-live="polite"></div>
            <div class="goal-quick-amounts" id="deposit-quick-amounts" role="group" aria-label="Chọn nhanh số tiền nạp">
              <button type="button" class="goal-quick-chip" data-deposit-add="500000">+500k</button>
              <button type="button" class="goal-quick-chip" data-deposit-add="1000000">+1 tr</button>
              <button type="button" class="goal-quick-chip" data-deposit-add="2000000">+2 tr</button>
              <button type="button" class="goal-quick-chip" data-deposit-add="5000000">+5 tr</button>
            </div>
            <span class="field-error" id="deposit-amount-error" role="alert"></span>
          </div>

          <div class="deposit-preview-projection" id="deposit-preview-projection"></div>
        </form>
        <div class="modal-footer">
          <button class="btn-secondary" id="cancel-deposit-btn" type="button">Hủy</button>
          <button class="btn-add-transaction" id="confirm-deposit-btn" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Xác nhận nạp tiền
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(DEPOSIT_MODAL_ID);
    });

    modal.querySelector('#close-deposit-modal-btn')?.addEventListener('click', () => closeModal(DEPOSIT_MODAL_ID));
    modal.querySelector('#cancel-deposit-btn')?.addEventListener('click', () => closeModal(DEPOSIT_MODAL_ID));
    modal.querySelector('#confirm-deposit-btn')?.addEventListener('click', e => {
      e.preventDefault();
      const form = modal.querySelector('#deposit-modal-form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  }
  return modal;
}

/* --------------------------------------------------------------- *
 * Form HTML Rendering
 * --------------------------------------------------------------- */
function renderGoalFormHTML(goal = null) {
  const isEdit = Boolean(goal && goal.id);
  const activeCategory = goal?.category || 'savings';

  // Default target date: 6 months from today if not set
  let defaultDate = goal?.deadline || '';
  if (!defaultDate) {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    defaultDate = getLocalDateString(d);
  }

  // Min date is tomorrow
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = getLocalDateString(minDate);

  const presetsHTML = isEdit ? '' : `
    <div class="goal-presets-section">
      <div class="goal-presets-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Mục tiêu phổ biến gợi ý:
      </div>
      <div class="goal-presets-list" role="group" aria-label="Mục tiêu gợi ý">
        ${GOAL_PRESETS.map((p, idx) => `
          <button type="button" class="goal-preset-chip" data-preset-idx="${idx}">
            <span class="preset-name">${escapeHtml(p.name)}</span>
            <span class="preset-badge">${formatCompactCurrency(p.target)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  const categoryChipsHTML = GOAL_CATEGORIES.map(cat => {
    const isSelected = cat.id === activeCategory;
    return `
      <button type="button" 
        class="goal-cat-chip ${isSelected ? 'is-active' : ''}" 
        data-category-id="${cat.id}"
        role="radio"
        aria-checked="${isSelected ? 'true' : 'false'}"
        style="--cat-color:${cat.color}; --cat-bg:${cat.bg}; --cat-border:${cat.border}">
        <span class="goal-cat-icon" aria-hidden="true">${cat.iconSvg}</span>
        <span class="goal-cat-label">${escapeHtml(cat.labelVi)}</span>
      </button>
    `;
  }).join('');

  return `
    ${presetsHTML}

    <div class="goal-modal-grid">
      <!-- Left Column: Form Fields -->
      <div class="goal-modal-left">
        <!-- 1. Name -->
        <div class="form-group">
          <label class="form-label" for="goal-name">Tên mục tiêu <span class="required-mark">*</span></label>
          <input type="text" 
            class="form-input" 
            id="goal-name" 
            placeholder="Ví dụ: Quỹ dự phòng 6 tháng, Mua laptop..." 
            value="${escapeHtml(goal?.name || '')}"
            required 
            aria-required="true"
            autocomplete="off" />
          <span class="field-error" id="goal-name-error" role="alert"></span>
        </div>

        <!-- 2. Category selection -->
        <div class="form-group">
          <label class="form-label" id="goal-category-label">Danh mục mục tiêu <span class="required-mark">*</span></label>
          <input type="hidden" id="goal-category" value="${activeCategory}" />
          <div class="goal-category-chips" id="goal-category-chips" role="radiogroup" aria-labelledby="goal-category-label">
            ${categoryChipsHTML}
          </div>
          <span class="field-error" id="goal-category-error" role="alert"></span>
        </div>

        <!-- 3. Target amount -->
        <div class="form-group">
          <label class="form-label" for="goal-target">Số tiền mục tiêu <span class="required-mark">*</span></label>
          <div class="currency-input" id="goal-target-wrapper">
            <span class="currency-prefix" aria-hidden="true">${escapeHtml(getActiveCurrency())}</span>
            <input type="text" 
              class="form-input goal-amount-input" 
              id="goal-target" 
              placeholder="0" 
              value="${goal?.target ? Number(goal.target).toLocaleString('vi-VN') : ''}"
              required 
              aria-required="true"
              inputmode="decimal" 
              autocomplete="off" />
          </div>
          <div class="tx-amount-spelled" id="goal-target-spelled" aria-live="polite"></div>
          <div class="goal-quick-amounts" role="group" aria-label="Cộng nhanh số tiền">
            <button type="button" class="goal-quick-chip" data-add-target="5000000">+5 tr</button>
            <button type="button" class="goal-quick-chip" data-add-target="10000000">+10 tr</button>
            <button type="button" class="goal-quick-chip" data-add-target="20000000">+20 tr</button>
            <button type="button" class="goal-quick-chip" data-add-target="50000000">+50 tr</button>
            <button type="button" class="goal-quick-chip" data-add-target="100000000">+100 tr</button>
          </div>
          <span class="field-error" id="goal-target-error" role="alert"></span>
        </div>

        <!-- 4. Initial saved amount -->
        <div class="form-group">
          <div class="form-label-row">
            <label class="form-label" for="goal-current">Đã có sẵn (Khởi điểm)</label>
            <span class="form-label-hint">Tùy chọn, mặc định 0₫</span>
          </div>
          <div class="currency-input" id="goal-current-wrapper">
            <span class="currency-prefix" aria-hidden="true">${escapeHtml(getActiveCurrency())}</span>
            <input type="text" 
              class="form-input goal-amount-input" 
              id="goal-current" 
              placeholder="0" 
              value="${goal?.current ? Number(goal.current).toLocaleString('vi-VN') : '0'}"
              inputmode="decimal" 
              autocomplete="off" />
          </div>
          <div class="tx-amount-spelled" id="goal-current-spelled" aria-live="polite"></div>
          <div class="goal-quick-amounts" role="group" aria-label="Tỷ lệ khởi điểm theo mục tiêu">
            <button type="button" class="goal-quick-chip" data-pct-target="0">0%</button>
            <button type="button" class="goal-quick-chip" data-pct-target="10">10%</button>
            <button type="button" class="goal-quick-chip" data-pct-target="25">25%</button>
            <button type="button" class="goal-quick-chip" data-pct-target="50">50%</button>
          </div>
          <span class="field-error" id="goal-current-error" role="alert"></span>
        </div>

        <!-- 5. Deadline -->
        <div class="form-group">
          <label class="form-label" for="goal-deadline">Ngày hoàn thành dự kiến <span class="required-mark">*</span></label>
          <input type="date" 
            class="form-input" 
            id="goal-deadline" 
            value="${defaultDate}"
            min="${minDateStr}"
            required 
            aria-required="true" />
          <div class="goal-quick-amounts" role="group" aria-label="Khoảng thời gian tích lũy">
            <button type="button" class="goal-quick-chip" data-add-months="3">+3 tháng</button>
            <button type="button" class="goal-quick-chip" data-add-months="6">+6 tháng</button>
            <button type="button" class="goal-quick-chip" data-add-months="12">+1 năm</button>
            <button type="button" class="goal-quick-chip" data-add-months="24">+2 năm</button>
          </div>
          <span class="field-error" id="goal-deadline-error" role="alert"></span>
        </div>
      </div>

      <!-- Right Column: Smart Calculations & Live Preview -->
      <div class="goal-modal-right">
        <!-- Smart Financial Projection Card -->
        <div class="goal-calc-card" id="goal-calc-card">
          <div class="goal-calc-header">
            <div class="goal-calc-icon-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            </div>
            <div>
              <div class="goal-calc-title">Kế hoạch tích lũy thông minh</div>
              <div class="goal-calc-subtitle">Tính toán tự động theo thời hạn</div>
            </div>
          </div>
          <div class="goal-calc-body" id="goal-calc-body"></div>
        </div>

        <!-- Live Goal Card Preview -->
        <div class="goal-preview-container">
          <div class="goal-preview-header">
            <span class="goal-preview-badge">Xem trước thẻ mục tiêu</span>
          </div>
          <div class="goal-card-preview-wrapper" id="goal-card-preview-wrapper"></div>
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Dynamic Calculations & Live Preview
 * --------------------------------------------------------------- */
function formatAmountInput(val) {
  const digits = String(val || '').replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

function handleAmountInputWithCursor(input) {
  const original = input.value;
  if (/[a-zA-Z]/i.test(original)) {
    return;
  }
  const cursor = input.selectionStart || 0;
  const digitsBefore = original.slice(0, cursor).replace(/\D/g, '').length;
  const formatted = formatAmountInput(original);
  input.value = formatted;

  let newCursor = 0;
  let digitsCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) digitsCount++;
    if (digitsCount === digitsBefore) {
      newCursor = i + 1;
      break;
    }
  }
  if (digitsBefore === 0) newCursor = 0;
  if (newCursor > formatted.length) newCursor = formatted.length;
  input.setSelectionRange(newCursor, newCursor);
}

function calculateSavingsPlan(target, current, deadlineStr) {
  const remaining = Math.max(0, target - current);
  if (!deadlineStr || target <= 0) {
    return { months: 0, days: 0, perMonth: 0, perDay: 0, isPast: false };
  }

  const now = new Date();
  const deadline = new Date(deadlineStr);
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const diffMonths = Math.max(1, Math.round(diffDays / 30.4));

  const perMonth = Math.round(remaining / diffMonths);
  const perDay = Math.round(remaining / diffDays);

  return {
    months: diffMonths,
    days: diffDays,
    perMonth,
    perDay,
    remaining,
    isPast: diffMs < 0,
  };
}

function updateLivePreviewAndCalculations() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;

  const nameInput = modal.querySelector('#goal-name');
  const categoryInput = modal.querySelector('#goal-category');
  const targetInput = modal.querySelector('#goal-target');
  const currentInput = modal.querySelector('#goal-current');
  const deadlineInput = modal.querySelector('#goal-deadline');

  const name = nameInput?.value.trim() || 'Mục tiêu tài chính';
  const categoryId = categoryInput?.value || 'savings';
  const target = parseNumber(targetInput?.value);
  const current = parseNumber(currentInput?.value);
  const deadline = deadlineInput?.value || '';

  const cat = getGoalCategory(categoryId);

  // 1. Spelled amounts
  const targetSpelled = modal.querySelector('#goal-target-spelled');
  if (targetSpelled) {
    const text = target > 0 ? formatSpelledAmount(target, getActiveCurrency()) : '';
    targetSpelled.textContent = text;
    targetSpelled.style.display = text ? 'block' : 'none';
  }

  const currentSpelled = modal.querySelector('#goal-current-spelled');
  if (currentSpelled) {
    const text = current > 0 ? formatSpelledAmount(current, getActiveCurrency()) : '';
    currentSpelled.textContent = text;
    currentSpelled.style.display = text ? 'block' : 'none';
  }

  // 2. Calculation Box
  const calcBody = modal.querySelector('#goal-calc-body');
  if (calcBody) {
    if (target <= 0) {
      calcBody.innerHTML = `
        <div class="goal-calc-empty">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <span>Nhập số tiền mục tiêu và thời hạn để xem phân tích tích lũy.</span>
        </div>
      `;
    } else {
      const plan = calculateSavingsPlan(target, current, deadline);
      const remainingFormatted = formatCurrency(plan.remaining);
      const perMonthFormatted = formatCurrency(plan.perMonth);
      const perDayFormatted = formatCurrency(plan.perDay);

      calcBody.innerHTML = `
        <div class="goal-calc-stat-row">
          <div class="calc-stat-item">
            <span class="calc-stat-lbl">Số tiền còn thiếu</span>
            <span class="calc-stat-val highlight-amber">${remainingFormatted}</span>
          </div>
          <div class="calc-stat-item">
            <span class="calc-stat-lbl">Thời gian dự kiến</span>
            <span class="calc-stat-val">${plan.months} tháng <span class="calc-stat-sub">(${plan.days} ngày)</span></span>
          </div>
        </div>

        <div class="goal-calc-recommendation">
          <div class="recommendation-badge">Khuyến nghị tích lũy</div>
          <div class="recommendation-amount">
            <strong>${perMonthFormatted}</strong> <span class="unit">/ tháng</span>
          </div>
          <div class="recommendation-sub">
            Hoặc khoảng <strong>${perDayFormatted}</strong> mỗi ngày để hoàn thành đúng hạn.
          </div>
        </div>
      `;
    }
  }

  // 3. Live Card Preview
  const previewWrapper = modal.querySelector('#goal-card-preview-wrapper');
  if (previewWrapper) {
    const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
    const remaining = Math.max(0, target - current);
    const deadlineFormatted = deadline ? formatMonthYear(deadline) : 'Chưa đặt';
    const isCompleted = pct >= 100;
    const pctColor = pct >= 80 ? 'var(--positive)' : pct >= 50 ? 'var(--emerald-accent-light)' : 'var(--text-secondary)';

    previewWrapper.innerHTML = `
      <div class="goal-card goal-card-live" style="--accent-goal:${cat.color}">
        <div class="goal-card-header">
          <span class="goal-icon" aria-hidden="true" style="background:${cat.bg}; color:${cat.color}; border:1px solid ${cat.border}">
            ${cat.iconSvg}
          </span>
          <div style="flex:1; min-width:0;">
            <div class="goal-name text-truncate">${escapeHtml(name)}</div>
            <div class="goal-deadline">Dự kiến hoàn thành: ${deadlineFormatted}</div>
          </div>
        </div>

        <div class="goal-progress-section">
          <div class="goal-progress-header">
            <span class="goal-percent" style="color:${pctColor}">${pct}%</span>
            <span class="goal-status ${isCompleted ? 'completed' : ''}">${isCompleted ? 'Hoàn thành' : 'Đang thực hiện'}</span>
          </div>
          <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill progress-fill--goal" style="width:${pct}%; background:${cat.color}"></div>
          </div>
        </div>

        <div class="goal-amounts">
          <div class="goal-amount-current">
            <span class="amount-label">Đã tích lũy</span>
            <span class="amount-value">${formatCurrency(current)}</span>
          </div>
          <div class="goal-amount-target">
            <span class="amount-label">Mục tiêu</span>
            <span class="amount-value">${formatCurrency(target)}</span>
          </div>
          <div class="goal-amount-remaining">
            <span class="amount-label">Còn thiếu</span>
            <span class="amount-value">${formatCurrency(remaining)}</span>
          </div>
        </div>
      </div>
    `;
  }
}

/* --------------------------------------------------------------- *
 * Validation
 * --------------------------------------------------------------- */
function setFieldError(id, message) {
  const input = document.getElementById(id);
  const wrapper = document.getElementById(`${id}-wrapper`);
  const error = document.getElementById(`${id}-error`);
  if (input) {
    input.classList.toggle('is-invalid', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
  if (wrapper) {
    wrapper.classList.toggle('is-invalid', Boolean(message));
  }
  if (error) {
    error.textContent = message || '';
  }
}

function validateGoalForm() {
  const name = document.getElementById('goal-name')?.value.trim() || '';
  const target = parseVndInput(document.getElementById('goal-target')?.value);
  const current = parseVndInput(document.getElementById('goal-current')?.value);
  const deadline = document.getElementById('goal-deadline')?.value || '';
  const category = document.getElementById('goal-category')?.value || '';

  let isValid = true;

  if (!name) {
    setFieldError('goal-name', 'Vui lòng nhập tên mục tiêu tài chính.');
    isValid = false;
  } else if (name.length < 2) {
    setFieldError('goal-name', 'Tên mục tiêu cần ít nhất 2 ký tự.');
    isValid = false;
  } else {
    setFieldError('goal-name', '');
  }

  if (!category) {
    setFieldError('goal-category', 'Vui lòng chọn danh mục cho mục tiêu.');
    isValid = false;
  } else {
    setFieldError('goal-category', '');
  }

  if (target <= 0) {
    setFieldError('goal-target', 'Số tiền mục tiêu phải lớn hơn 0.');
    isValid = false;
  } else {
    setFieldError('goal-target', '');
  }

  if (current < 0) {
    setFieldError('goal-current', 'Số tiền đã có không được âm.');
    isValid = false;
  } else {
    setFieldError('goal-current', '');
  }

  if (!deadline) {
    setFieldError('goal-deadline', 'Vui lòng chọn ngày hoàn thành dự kiến.');
    isValid = false;
  } else {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) {
      setFieldError('goal-deadline', 'Ngày không hợp lệ.');
      isValid = false;
    } else {
      setFieldError('goal-deadline', '');
    }
  }

  const submitBtn = document.getElementById('confirm-save-goal-btn');
  if (submitBtn) {
    submitBtn.toggleAttribute('disabled', !isValid);
  }

  return isValid;
}

/* --------------------------------------------------------------- *
 * Save / Submit Handler
 * --------------------------------------------------------------- */
async function handleSave(keepOpen = false) {
  if (_isSubmitting) return;
  if (!validateGoalForm()) {
    document.querySelector('.is-invalid')?.focus();
    return;
  }

  _isSubmitting = true;
  const submitBtn = document.getElementById('confirm-save-goal-btn');
  const originalText = submitBtn?.innerHTML || '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
      Đang lưu...
    `;
  }

  try {
    const name = document.getElementById('goal-name').value.trim();
    const category = document.getElementById('goal-category').value;
    const target = parseVndInput(document.getElementById('goal-target').value);
    const current = parseVndInput(document.getElementById('goal-current').value);
    const deadline = document.getElementById('goal-deadline').value;
    const cat = getGoalCategory(category);

    const goalData = {
      name,
      category,
      target,
      current,
      deadline,
      color: cat.color,
      is_completed: current >= target,
    };

    if (_editingGoal?.id) {
      await dataService.updateGoal(_editingGoal.id, goalData);
      showToast(`Đã cập nhật mục tiêu "${name}" thành công!`, 'success');
      closeModal(MODAL_ID);
    } else {
      await dataService.addGoal(goalData);
      showToast(`Đã tạo mục tiêu "${name}" thành công!`, 'success');

      if (keepOpen) {
        // Reset form for next goal
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-target').value = '';
        document.getElementById('goal-current').value = '0';
        selectCategory('savings');
        
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        document.getElementById('goal-deadline').value = getLocalDateString(d);

        updateLivePreviewAndCalculations();
        document.getElementById('goal-name')?.focus();
      } else {
        closeModal(MODAL_ID);
      }
    }
  } catch (err) {
    console.error('[goalModal] Error saving goal:', err);
    showToast(`Không thể lưu mục tiêu: ${err.message}`, 'error');
  } finally {
    _isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

/* --------------------------------------------------------------- *
 * Category Selection
 * --------------------------------------------------------------- */
function selectCategory(categoryId) {
  const hiddenInput = document.getElementById('goal-category');
  if (hiddenInput) hiddenInput.value = categoryId;

  document.querySelectorAll('.goal-cat-chip').forEach(chip => {
    const isSelected = chip.dataset.categoryId === categoryId;
    chip.classList.toggle('is-active', isSelected);
    chip.setAttribute('aria-checked', String(isSelected));
  });

  validateGoalForm();
  updateLivePreviewAndCalculations();
}

/* --------------------------------------------------------------- *
 * Attach Modal Event Listeners
 * --------------------------------------------------------------- */
function bindGoalModalListeners(modal) {
  // 1. Text input real-time sync
  modal.querySelector('#goal-name')?.addEventListener('input', () => {
    validateGoalForm();
    updateLivePreviewAndCalculations();
  });

  // 2. Category chips
  modal.querySelectorAll('.goal-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectCategory(chip.dataset.categoryId);
    });
  });

  // 3. Target amount
  const targetInput = modal.querySelector('#goal-target');
  targetInput?.addEventListener('input', () => {
    handleAmountInputWithCursor(targetInput);
    validateGoalForm();
    updateLivePreviewAndCalculations();
  });
  targetInput?.addEventListener('blur', () => {
    const parsed = parseVndInput(targetInput.value);
    if (parsed > 0) {
      targetInput.value = Number(parsed).toLocaleString('vi-VN');
    }
    validateGoalForm();
    updateLivePreviewAndCalculations();
  });

  // 4. Quick target addition chips (+5tr, +10tr, ...)
  modal.querySelectorAll('[data-add-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const add = Number(btn.dataset.addTarget);
      const curr = parseVndInput(targetInput?.value);
      const newTarget = curr + add;
      if (targetInput) {
        targetInput.value = Number(newTarget).toLocaleString('vi-VN');
      }
      validateGoalForm();
      updateLivePreviewAndCalculations();
    });
  });

  // 5. Current amount
  const currentInput = modal.querySelector('#goal-current');
  currentInput?.addEventListener('input', () => {
    handleAmountInputWithCursor(currentInput);
    validateGoalForm();
    updateLivePreviewAndCalculations();
  });
  currentInput?.addEventListener('blur', () => {
    const parsed = parseVndInput(currentInput.value);
    if (parsed >= 0 && currentInput.value.trim() !== '') {
      currentInput.value = Number(parsed).toLocaleString('vi-VN');
    }
    validateGoalForm();
    updateLivePreviewAndCalculations();
  });

  // 6. Quick percentage shortcuts (0%, 10%, 25%, 50%)
  modal.querySelectorAll('[data-pct-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = Number(btn.dataset.pctTarget);
      const targetVal = parseVndInput(targetInput?.value);
      const newCurrent = Math.round((targetVal * pct) / 100);
      if (currentInput) {
        currentInput.value = Number(newCurrent).toLocaleString('vi-VN');
      }
      validateGoalForm();
      updateLivePreviewAndCalculations();
    });
  });

  // 7. Deadline input
  const deadlineInput = modal.querySelector('#goal-deadline');
  deadlineInput?.addEventListener('input', () => {
    validateGoalForm();
    updateLivePreviewAndCalculations();
  });

  // 8. Quick months shortcut (+3 tháng, +6 tháng, +1 năm, ...)
  modal.querySelectorAll('[data-add-months]').forEach(btn => {
    btn.addEventListener('click', () => {
      const months = Number(btn.dataset.addMonths);
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      if (deadlineInput) {
        deadlineInput.value = getLocalDateString(d);
      }
      validateGoalForm();
      updateLivePreviewAndCalculations();
    });
  });

  // 9. Presets / Templates autofill
  modal.querySelectorAll('.goal-preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.presetIdx);
      const preset = GOAL_PRESETS[idx];
      if (!preset) return;

      const nameEl = modal.querySelector('#goal-name');
      const targetEl = modal.querySelector('#goal-target');
      const currentEl = modal.querySelector('#goal-current');
      const deadlineEl = modal.querySelector('#goal-deadline');

      if (nameEl) nameEl.value = preset.name;
      if (targetEl) targetEl.value = Number(preset.target).toLocaleString('vi-VN');
      if (currentEl) currentEl.value = Number(preset.current || 0).toLocaleString('vi-VN');

      if (deadlineEl && preset.months) {
        const d = new Date();
        d.setMonth(d.getMonth() + preset.months);
        deadlineEl.value = getLocalDateString(d);
      }

      selectCategory(preset.category);
      showToast(`Đã áp dụng mẫu: "${preset.name}"`, 'info');
    });
  });
}

/* --------------------------------------------------------------- *
 * Quick Deposit Modal Workflows
 * --------------------------------------------------------------- */
export function openDepositGoalModal(goal) {
  if (!goal) return;
  const modal = ensureDepositModal();
  const cat = getGoalCategory(goal.category);

  const titleSub = modal.querySelector('#deposit-goal-name-sub');
  if (titleSub) {
    titleSub.innerHTML = `Cộng dồn vào mục tiêu: <strong>${escapeHtml(goal.name)}</strong>`;
  }

  const summary = modal.querySelector('#deposit-target-summary');
  const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
  if (summary) {
    summary.innerHTML = `
      <div class="deposit-summary-card" style="--accent-goal:${cat.color}">
        <div class="deposit-summary-row">
          <span class="deposit-summary-lbl">Đã tích lũy hiện tại:</span>
          <span class="deposit-summary-val">${formatCurrency(goal.current)} (${pct}%)</span>
        </div>
        <div class="deposit-summary-row">
          <span class="deposit-summary-lbl">Số tiền mục tiêu:</span>
          <span class="deposit-summary-val">${formatCurrency(goal.target)}</span>
        </div>
        <div class="progress-track" style="margin-top:8px;">
          <div class="progress-fill" style="width:${pct}%; background:${cat.color}"></div>
        </div>
      </div>
    `;
  }

  const amountInput = modal.querySelector('#deposit-amount');
  if (amountInput) amountInput.value = '';

  const spelledEl = modal.querySelector('#deposit-amount-spelled');
  if (spelledEl) spelledEl.style.display = 'none';

  const projectionEl = modal.querySelector('#deposit-preview-projection');
  if (projectionEl) projectionEl.innerHTML = '';

  const updateDepositProjection = () => {
    const depositVal = parseVndInput(amountInput?.value);
    const newCurrent = goal.current + depositVal;
    const newPct = Math.min(Math.round((newCurrent / goal.target) * 100), 100);
    const remaining = Math.max(0, goal.target - newCurrent);

    if (depositVal > 0 && projectionEl) {
      projectionEl.innerHTML = `
        <div class="deposit-projection-box">
          <div class="projection-title">Tiến độ sau khi tích lũy:</div>
          <div class="projection-vals">
            <span class="new-pct highlight-positive">${newPct}%</span>
            <span class="new-amount">${formatCurrency(newCurrent)} / ${formatCurrency(goal.target)}</span>
          </div>
          <div class="projection-sub">
            ${newPct >= 100 ? 'Chúc mừng! Bạn sẽ hoàn thành 100% mục tiêu này!' : `Còn thiếu: ${formatCurrency(remaining)}`}
          </div>
        </div>
      `;
    } else if (projectionEl) {
      projectionEl.innerHTML = '';
    }

    if (spelledEl) {
      const text = depositVal > 0 ? formatSpelledAmount(depositVal, getActiveCurrency()) : '';
      spelledEl.textContent = text;
      spelledEl.style.display = text ? 'block' : 'none';
    }
  };

  // Listeners
  amountInput?.addEventListener('input', () => {
    handleAmountInputWithCursor(amountInput);
    updateDepositProjection();
  });

  amountInput?.addEventListener('blur', () => {
    const parsed = parseVndInput(amountInput.value);
    if (parsed > 0) {
      amountInput.value = Number(parsed).toLocaleString('vi-VN');
    }
    updateDepositProjection();
  });

  modal.querySelectorAll('[data-deposit-add]').forEach(btn => {
    btn.onclick = () => {
      const add = Number(btn.dataset.depositAdd);
      const curr = parseVndInput(amountInput?.value);
      if (amountInput) amountInput.value = Number(curr + add).toLocaleString('vi-VN');
      updateDepositProjection();
    };
  });

  const form = modal.querySelector('#deposit-modal-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const depositVal = parseVndInput(amountInput?.value);
    if (depositVal <= 0) {
      showToast('Vui lòng nhập số tiền nạp lớn hơn 0.', 'warning');
      amountInput?.focus();
      return;
    }

    try {
      const updatedCurrent = goal.current + depositVal;
      await dataService.updateGoal(goal.id, {
        current: updatedCurrent,
        is_completed: updatedCurrent >= goal.target,
      });

      showToast(`Đã nạp ${formatCurrency(depositVal)} vào "${goal.name}"!`, 'success');
      closeModal(DEPOSIT_MODAL_ID);
    } catch (err) {
      console.error('[depositModal] Error adding deposit:', err);
      showToast(`Không thể nạp tiền: ${err.message}`, 'error');
    }
  };

  openModal(DEPOSIT_MODAL_ID);
  setTimeout(() => amountInput?.focus(), 80);
}

/* --------------------------------------------------------------- *
 * Public Modal Triggers
 * --------------------------------------------------------------- */

/**
 * Open the Add Goal modal.
 */
export function openAddGoalModal() {
  _editingGoal = null;
  const modal = ensureGoalModal();

  const titleEl = modal.querySelector('#goal-modal-title');
  if (titleEl) titleEl.textContent = 'Thêm mục tiêu tài chính';

  const confirmTextEl = modal.querySelector('#confirm-save-goal-text');
  if (confirmTextEl) confirmTextEl.textContent = 'Tạo mục tiêu';

  const addAnotherBtn = modal.querySelector('#save-and-add-another-goal-btn');
  if (addAnotherBtn) addAnotherBtn.style.display = 'inline-flex';

  const content = modal.querySelector('#goal-form-content');
  if (content) {
    content.innerHTML = renderGoalFormHTML(null);
  }

  bindGoalModalListeners(modal);
  updateLivePreviewAndCalculations();

  openModal(MODAL_ID);
  setTimeout(() => modal.querySelector('#goal-name')?.focus(), 80);
}

/**
 * Open the Edit Goal modal.
 * @param {object} goal
 */
export function openEditGoalModal(goal) {
  if (!goal) return;
  _editingGoal = goal;
  const modal = ensureGoalModal();

  const titleEl = modal.querySelector('#goal-modal-title');
  if (titleEl) titleEl.textContent = 'Chỉnh sửa mục tiêu';

  const confirmTextEl = modal.querySelector('#confirm-save-goal-text');
  if (confirmTextEl) confirmTextEl.textContent = 'Lưu thay đổi';

  const addAnotherBtn = modal.querySelector('#save-and-add-another-goal-btn');
  if (addAnotherBtn) addAnotherBtn.style.display = 'none';

  const content = modal.querySelector('#goal-form-content');
  if (content) {
    content.innerHTML = renderGoalFormHTML(goal);
  }

  bindGoalModalListeners(modal);
  updateLivePreviewAndCalculations();

  openModal(MODAL_ID);
  setTimeout(() => modal.querySelector('#goal-name')?.focus(), 80);
}

export default {
  openAddGoalModal,
  openEditGoalModal,
  openDepositGoalModal,
};
