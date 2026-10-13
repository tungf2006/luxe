/**
 * @file Add & Edit Recurring Transaction Modal Component.
 * Implements interactive creation, editing, smart recurrence scheduling,
 * live preview, and budget impact projections for recurring finances.
 */

import dataService from '../../services/dataAdapter.js';
import { CATEGORIES, EXPENSE_CATEGORIES, getCategoryAvatarHtml, getCategoryColor } from '../../constants/categories.js';
import {
  RECURRING_FREQUENCIES,
  RECURRING_FREQUENCY_MAP,
  RECURRING_PRESETS,
  calculateNextDueDate,
  calculateMonthlyEquivalent,
  calculateAnnualEquivalent,
} from '../../constants/recurring.js';
import { getBankAvatarInfo, getBankAvatarHtml } from '../../constants/banks.js';
import {
  formatCurrency,
  formatAmount,
  escapeHtml,
  parseNumber,
  parseVndInput,
  formatSpelledAmount,
  getActiveCurrency,
  getLocalDateString,
  formatDateShort,
} from '../../utils/format.js';
import { openModal, closeModal } from '../../components/ui/Modal.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';

const MODAL_ID = 'recurring-modal';

let _editingItem = null;
let _isSubmitting = false;
let _accounts = [];
let _lastAccountId = null;
let _hasEndDate = false;

/* --------------------------------------------------------------- *
 * Ensure Modal Shell in DOM
 * --------------------------------------------------------------- */
function ensureRecurringModal() {
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'recurring-modal-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-recurring">
        <div class="modal-grab-handle" aria-hidden="true"></div>
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="recurring-modal-title">Thêm giao dịch định kỳ</h2>
            <p class="modal-subtitle">Tự động hóa theo dõi các khoản chi tiêu hoặc thu nhập lặp lại</p>
          </div>
          <button class="modal-close-btn" id="close-recurring-modal-btn" type="button" aria-label="Đóng cửa sổ">✕</button>
        </div>
        <form class="modal-form recurring-modal-form" id="recurring-modal-form" novalidate>
          <div id="recurring-form-content"></div>
        </form>
        <div class="modal-footer recurring-modal-footer">
          <button class="btn-secondary" id="cancel-recurring-btn" type="button">Hủy</button>
          <button class="btn-secondary" id="save-and-add-another-recurring-btn" type="button">Lưu và thêm tiếp</button>
          <button class="btn-add-transaction" id="confirm-save-recurring-btn" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span id="confirm-save-recurring-text">Lưu giao dịch</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(MODAL_ID);
    });

    modal.querySelector('#close-recurring-modal-btn')?.addEventListener('click', () => closeModal(MODAL_ID));
    modal.querySelector('#cancel-recurring-btn')?.addEventListener('click', () => closeModal(MODAL_ID));
    modal.querySelector('#save-and-add-another-recurring-btn')?.addEventListener('click', () => handleSave(true));
    modal.querySelector('#confirm-save-recurring-btn')?.addEventListener('click', e => {
      e.preventDefault();
      handleSave(false);
    });

    const form = modal.querySelector('#recurring-modal-form');
    form?.addEventListener('submit', e => {
      e.preventDefault();
      handleSave(false);
    });
  }

  return modal;
}

/* --------------------------------------------------------------- *
 * Custom Account Dropdown Helpers
 * --------------------------------------------------------------- */
function accountOptionsHTML(selected = '') {
  if (!_accounts.length) return '<option value="">Không có tài khoản</option>';
  return _accounts.map(acc => {
    const bal = Number(acc.balance || 0).toLocaleString('vi-VN');
    return `<option value="${escapeHtml(acc.id)}" ${acc.id === selected ? 'selected' : ''}>${escapeHtml(acc.name)} · Số dư ${bal} ${escapeHtml(acc.currency || getActiveCurrency())}</option>`;
  }).join('');
}

function customAccountOptionsHTML(selected = '') {
  if (!_accounts.length) {
    return `<div class="account-select-empty" style="padding:0.75rem 1rem;color:var(--text-muted);font-size:0.85rem;">Chưa có tài khoản nào</div>`;
  }
  return _accounts.map(acc => {
    const bal = Number(acc.balance || 0).toLocaleString('vi-VN');
    const isSelected = acc.id === selected;
    return `
      <button type="button" class="account-select-option ${isSelected ? 'is-selected' : ''}" role="option" data-value="${escapeHtml(acc.id)}" aria-selected="${isSelected}">
        ${getBankAvatarHtml(acc.name, 'sm')}
        <span class="account-select-name">${escapeHtml(acc.name)}</span>
        <span class="account-select-balance">Số dư ${bal} ${escapeHtml(acc.currency || getActiveCurrency())}</span>
        ${isSelected ? '<svg class="account-select-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </button>
    `;
  }).join('');
}

function refreshAccountTrigger() {
  const select = document.getElementById('recurring-account');
  const triggerText = document.getElementById('recurring-account-text');
  const triggerAvatar = document.getElementById('recurring-account-avatar');
  const dropdown = document.getElementById('recurring-account-dropdown');
  if (!select || !triggerText || !triggerAvatar || !dropdown) return;

  let selectedId = select.value;
  let account = _accounts.find(a => a.id === selectedId);

  if (!account && _accounts.length > 0) {
    account = _accounts[0];
    selectedId = account.id;
    select.value = selectedId;
  }

  if (account) {
    const avatar = getBankAvatarInfo(account.name);
    triggerText.textContent = account.name;
    triggerAvatar.textContent = avatar.initial;
    triggerAvatar.style.background = avatar.bg;
    triggerAvatar.style.color = avatar.textColor;
  } else {
    triggerText.textContent = 'Chọn tài khoản';
    triggerAvatar.textContent = '?';
    triggerAvatar.style.background = '#475569';
    triggerAvatar.style.color = '#FFFFFF';
  }

  dropdown.querySelectorAll('.account-select-option').forEach(opt => {
    const isSelected = opt.dataset.value === selectedId;
    opt.classList.toggle('is-selected', isSelected);
    opt.setAttribute('aria-selected', String(isSelected));
    const checkEl = opt.querySelector('.account-select-check');
    if (isSelected && !checkEl) {
      const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      checkSvg.setAttribute('class', 'account-select-check');
      checkSvg.setAttribute('width', '16');
      checkSvg.setAttribute('height', '16');
      checkSvg.setAttribute('viewBox', '0 0 24 24');
      checkSvg.setAttribute('fill', 'none');
      checkSvg.setAttribute('stroke', 'currentColor');
      checkSvg.setAttribute('stroke-width', '2');
      checkSvg.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
      opt.appendChild(checkSvg);
    } else if (!isSelected && checkEl) {
      checkEl.remove();
    }
  });
}

function toggleAccountDropdown() {
  const trigger = document.getElementById('recurring-account-trigger');
  const dropdown = document.getElementById('recurring-account-dropdown');
  if (!trigger || !dropdown) return;
  const isOpen = dropdown.classList.contains('open');
  if (isOpen) {
    dropdown.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  } else {
    dropdown.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  }
}

function closeAccountDropdown() {
  const trigger = document.getElementById('recurring-account-trigger');
  const dropdown = document.getElementById('recurring-account-dropdown');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (dropdown) dropdown.classList.remove('open');
}

/* --------------------------------------------------------------- *
 * Category Chips Helpers
 * --------------------------------------------------------------- */
function categoryChipsHTML(type, selected = '') {
  const pool = type === 'income' ? CATEGORIES.filter(c => c.type === 'income') : EXPENSE_CATEGORIES;
  return pool.map(c => {
    const isSelected = c.id === selected;
    return `
      <button type="button" 
        class="recurring-cat-chip ${isSelected ? 'active' : ''}" 
        data-cat-id="${c.id}" 
        role="radio" 
        aria-checked="${isSelected ? 'true' : 'false'}"
        title="${escapeHtml(c.labelVi)}">
        ${getCategoryAvatarHtml(c.id, 'sm')}
        <span class="recurring-cat-label">${escapeHtml(c.labelVi)}</span>
      </button>
    `;
  }).join('');
}

function categorySelectOptionsHTML(type, selected = '') {
  const pool = type === 'income' ? CATEGORIES.filter(c => c.type === 'income') : EXPENSE_CATEGORIES;
  return '<option value="">Chọn danh mục</option>' +
    pool.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${escapeHtml(c.labelVi)}</option>`).join('');
}

/* --------------------------------------------------------------- *
 * Render Modal Form HTML
 * --------------------------------------------------------------- */
function renderRecurringFormHTML(item = null) {
  const isEdit = Boolean(item && item.id);
  const type = item?.type || 'expense';
  const frequency = item?.frequency || item?.recurrence || 'monthly';
  const activeCategory = item?.category || (type === 'income' ? 'income' : 'bills');
  const selectedAccount = item?.account_id || (_accounts.some(a => a.id === _lastAccountId) ? _lastAccountId : '') || _accounts[0]?.id || '';
  
  // Default next date: next month date or calculated
  const today = new Date();
  const defaultNextDate = item?.nextDate || item?.start_date || calculateNextDueDate('monthly', item?.day_of_month || 1, null, today);
  const endDate = item?.endDate || item?.end_date || '';
  _hasEndDate = Boolean(endDate);

  const presetsHTML = isEdit ? '' : `
    <div class="recurring-presets-section">
      <div class="recurring-presets-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Mẫu giao dịch định kỳ phổ biến:
      </div>
      <div class="recurring-presets-list" role="group" aria-label="Mẫu giao dịch định kỳ gợi ý">
        ${RECURRING_PRESETS.map((p, idx) => `
          <button type="button" class="recurring-preset-chip" data-preset-idx="${idx}">
            <span class="preset-name">${escapeHtml(p.name)}</span>
            <span class="preset-badge">${escapeHtml(p.badgeText)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  return `
    ${presetsHTML}

    <div class="recurring-modal-grid">
      <!-- Left Column: Form Controls -->
      <div class="recurring-modal-left">
        <!-- 1. Type Toggle -->
        <div class="form-group">
          <span class="form-label">Loại giao dịch <span class="required-mark">*</span></span>
          <div class="type-toggle-group" role="group" aria-label="Loại giao dịch">
            <button type="button" class="type-toggle-btn ${type === 'expense' ? 'active expense' : 'expense'}" data-recurring-type="expense" aria-pressed="${type === 'expense'}">↓ Chi phí</button>
            <button type="button" class="type-toggle-btn ${type === 'income' ? 'active income' : 'income'}" data-recurring-type="income" aria-pressed="${type === 'income'}">↑ Thu nhập</button>
          </div>
        </div>

        <!-- 2. Merchant / Payee / Name -->
        <div class="form-group">
          <label class="form-label" id="recurring-merchant-label" for="recurring-merchant">Tên dịch vụ / Người nhận <span class="required-mark">*</span></label>
          <input type="text" 
            class="form-input" 
            id="recurring-merchant" 
            placeholder="Ví dụ: Netflix, Internet VNPT, Tiền thuê nhà..." 
            value="${escapeHtml(item?.merchant || '')}"
            required 
            aria-required="true"
            autocomplete="off" />
          <span class="field-error" id="recurring-merchant-error" role="alert"></span>
        </div>

        <!-- 3. Amount -->
        <div class="form-group">
          <label class="form-label" for="recurring-amount">Số tiền <span class="required-mark">*</span></label>
          <div class="currency-input" id="recurring-amount-wrapper">
            <span class="currency-prefix" aria-hidden="true">${escapeHtml(getActiveCurrency())}</span>
            <input type="text" 
              class="form-input recurring-amount-input" 
              id="recurring-amount" 
              placeholder="0" 
              value="${item?.amount ? Number(item.amount).toLocaleString('vi-VN') : ''}"
              required 
              aria-required="true"
              inputmode="decimal" 
              autocomplete="off" />
          </div>
          <div class="tx-amount-spelled" id="recurring-amount-spelled" aria-live="polite"></div>
          <div class="recurring-quick-amounts" role="group" aria-label="Chọn nhanh số tiền">
            <button type="button" class="recurring-quick-chip" data-add-amount="50000">+50k</button>
            <button type="button" class="recurring-quick-chip" data-add-amount="100000">+100k</button>
            <button type="button" class="recurring-quick-chip" data-add-amount="500000">+500k</button>
            <button type="button" class="recurring-quick-chip" data-add-amount="1000000">+1 tr</button>
            <button type="button" class="recurring-quick-chip" data-add-amount="5000000">+5 tr</button>
            <button type="button" class="recurring-quick-chip chip-clear" data-clear-amount="true">Xóa</button>
          </div>
          <span class="field-error" id="recurring-amount-error" role="alert"></span>
        </div>

        <!-- 4. Recurrence Frequency -->
        <div class="form-group">
          <label class="form-label" id="recurring-freq-label">Tần suất lặp lại <span class="required-mark">*</span></label>
          <div class="recurring-freq-tabs" role="radiogroup" aria-labelledby="recurring-freq-label">
            ${RECURRING_FREQUENCIES.map(f => `
              <button type="button" 
                class="recurring-freq-btn ${f.id === frequency ? 'active' : ''}" 
                data-freq="${f.id}" 
                role="radio" 
                aria-checked="${f.id === frequency}">
                ${escapeHtml(f.labelVi)}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="recurring-frequency" value="${frequency}" />
        </div>

        <!-- 5. Schedule Details (Dynamic based on frequency) -->
        <div class="form-group" id="recurring-schedule-group">
          <div id="recurring-schedule-controls">
            <!-- Populated dynamically based on frequency -->
          </div>
        </div>

        <!-- 6. Next Payment Date -->
        <div class="form-group">
          <div class="form-label-row">
            <label class="form-label" for="recurring-next-date">Ngày đến hạn tiếp theo <span class="required-mark">*</span></label>
            <span class="form-label-hint" id="recurring-due-hint"></span>
          </div>
          <input type="date" 
            class="form-input" 
            id="recurring-next-date" 
            value="${defaultNextDate}"
            required 
            aria-required="true" />
          <div class="recurring-quick-amounts" role="group" aria-label="Gợi ý ngày đến hạn">
            <button type="button" class="recurring-quick-chip" data-set-date="today">Hôm nay</button>
            <button type="button" class="recurring-quick-chip" data-set-date="tomorrow">Ngày mai</button>
            <button type="button" class="recurring-quick-chip" data-set-date="next-month-1">Đầu tháng tới</button>
            <button type="button" class="recurring-quick-chip" data-set-date="next-month-15">15 tháng tới</button>
          </div>
          <span class="field-error" id="recurring-next-date-error" role="alert"></span>
        </div>

        <!-- 7. Account Selection -->
        <div class="form-group">
          <label class="form-label" for="recurring-account-trigger">Tài khoản trích tiền / nhận tiền <span class="required-mark">*</span></label>
          <div class="account-select" id="recurring-account-wrapper">
            <button class="account-select-trigger form-input" id="recurring-account-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
              <span class="account-avatar account-avatar-sm" id="recurring-account-avatar" aria-hidden="true"></span>
              <span class="account-select-text" id="recurring-account-text">Chọn tài khoản</span>
              <svg class="account-select-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="account-select-dropdown" id="recurring-account-dropdown" role="listbox" aria-label="Tài khoản">
              ${customAccountOptionsHTML(selectedAccount)}
            </div>
          </div>
          <select id="recurring-account" required aria-required="true" style="display:none;" tabindex="-1">
            ${accountOptionsHTML(selectedAccount)}
          </select>
          <span class="field-error" id="recurring-account-error" role="alert"></span>
        </div>

        <!-- 8. Category Selection -->
        <div class="form-group">
          <label class="form-label" id="recurring-category-label">Danh mục <span class="required-mark">*</span></label>
          <select class="form-input form-select" id="recurring-category" required aria-required="true" style="display:none;" tabindex="-1">
            ${categorySelectOptionsHTML(type, activeCategory)}
          </select>
          <div class="recurring-category-chips" id="recurring-category-chips" role="radiogroup" aria-labelledby="recurring-category-label">
            ${categoryChipsHTML(type, activeCategory)}
          </div>
          <span class="field-error" id="recurring-category-error" role="alert"></span>
        </div>

        <!-- 9. Optional End Date -->
        <div class="form-group">
          <label class="checkbox-row" for="recurring-has-end-date" style="cursor:pointer;user-select:none;">
            <input type="checkbox" id="recurring-has-end-date" ${_hasEndDate ? 'checked' : ''} />
            <span style="font-weight:500;color:var(--text-primary);font-size:0.875rem;">Có thời hạn kết thúc (Hợp đồng có kỳ hạn)</span>
          </label>
          <div id="recurring-end-date-wrapper" style="margin-top:0.75rem;${_hasEndDate ? '' : 'display:none;'}">
            <label class="form-label" for="recurring-end-date">Ngày kết thúc hợp đồng</label>
            <input type="date" class="form-input" id="recurring-end-date" value="${endDate}" />
            <span class="field-error" id="recurring-end-date-error" role="alert"></span>
          </div>
        </div>

        <!-- 10. Notes & Active Toggle -->
        <div class="form-group">
          <label class="form-label" for="recurring-notes">Ghi chú thêm (Tùy chọn)</label>
          <input type="text" 
            class="form-input" 
            id="recurring-notes" 
            placeholder="Mã khách hàng, số thẻ hoặc lưu ý..." 
            value="${escapeHtml(item?.notes || '')}"
            autocomplete="off" />
        </div>

        <div class="form-group">
          <label class="checkbox-row" for="recurring-is-active" style="cursor:pointer;user-select:none;">
            <input type="checkbox" id="recurring-is-active" ${item?.status === 'inactive' || item?.is_active === false ? '' : 'checked'} />
            <span style="font-weight:500;color:var(--text-primary);font-size:0.875rem;">Kích hoạt theo dõi ngay từ bây giờ</span>
          </label>
        </div>
      </div>

      <!-- Right Column: Live Card Preview & Budget Impact -->
      <div class="recurring-modal-right">
        <!-- Live Recurring Card Preview -->
        <div class="recurring-preview-container">
          <div class="recurring-preview-header">
            <span class="recurring-preview-badge">Xem trước giao dịch định kỳ</span>
          </div>
          <div class="recurring-card-preview-wrapper" id="recurring-card-preview-wrapper">
            <!-- Dynamic Live Preview -->
          </div>
        </div>

        <!-- Smart Monthly Budget Impact Card -->
        <div class="recurring-calc-card" id="recurring-calc-card">
          <div class="recurring-calc-header">
            <div class="recurring-calc-icon-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            </div>
            <div>
              <div class="recurring-calc-title">Tác động tài chính</div>
              <div class="recurring-calc-subtitle">Ước tính dòng tiền và ngân sách</div>
            </div>
          </div>
          <div class="recurring-calc-body" id="recurring-calc-body">
            <!-- Dynamic Calculation Stats -->
          </div>
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Dynamic Frequency Schedule Inputs
 * --------------------------------------------------------------- */
function renderScheduleControls(freq, currentDayOfMonth = 1, currentDayOfWeek = 1) {
  const container = document.getElementById('recurring-schedule-controls');
  if (!container) return;

  if (freq === 'monthly') {
    let dayOptions = '';
    for (let i = 1; i <= 31; i++) {
      dayOptions += `<option value="${i}" ${i === Number(currentDayOfMonth) ? 'selected' : ''}>Ngày ${i} hàng tháng</option>`;
    }
    container.innerHTML = `
      <label class="form-label" for="recurring-day-of-month">Ngày thanh toán cố định <span class="required-mark">*</span></label>
      <select class="form-input form-select" id="recurring-day-of-month">
        ${dayOptions}
      </select>
    `;
  } else if (freq === 'weekly') {
    const days = [
      { val: 1, label: 'Thứ Hai' },
      { val: 2, label: 'Thứ Ba' },
      { val: 3, label: 'Thứ Tư' },
      { val: 4, label: 'Thứ Năm' },
      { val: 5, label: 'Thứ Sáu' },
      { val: 6, label: 'Thứ Bảy' },
      { val: 0, label: 'Chủ Nhật' },
    ];
    container.innerHTML = `
      <label class="form-label" for="recurring-day-of-week">Thứ thanh toán trong tuần <span class="required-mark">*</span></label>
      <select class="form-input form-select" id="recurring-day-of-week">
        ${days.map(d => `<option value="${d.val}" ${d.val === Number(currentDayOfWeek) ? 'selected' : ''}>${d.label}</option>`).join('')}
      </select>
    `;
  } else if (freq === 'yearly') {
    container.innerHTML = `
      <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Lặp lại chính xác 1 năm một lần tính từ ngày đến hạn tiếp theo.</p>
    `;
  } else {
    // daily
    container.innerHTML = `
      <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Lặp lại đều đặn mỗi ngày.</p>
    `;
  }
}

/* --------------------------------------------------------------- *
 * Dynamic Live Preview & Budget Impact Updates
 * --------------------------------------------------------------- */
function updateLivePreviewAndStats() {
  const merchant = document.getElementById('recurring-merchant')?.value.trim() || 'Tên giao dịch định kỳ';
  const type = document.querySelector('[data-recurring-type].active')?.dataset.recurringType || 'expense';
  const amount = parseVndInput(document.getElementById('recurring-amount')?.value);
  const frequency = document.getElementById('recurring-frequency')?.value || 'monthly';
  const categoryId = document.getElementById('recurring-category')?.value || (type === 'income' ? 'income' : 'bills');
  const accountId = document.getElementById('recurring-account')?.value;
  const account = _accounts.find(a => a.id === accountId);
  const nextDateVal = document.getElementById('recurring-next-date')?.value;
  const isActive = document.getElementById('recurring-is-active')?.checked !== false;

  // 1. Spelled-out amount
  const spelledEl = document.getElementById('recurring-amount-spelled');
  if (spelledEl) {
    if (amount > 0) {
      const text = formatSpelledAmount(amount, getActiveCurrency());
      spelledEl.textContent = text;
      spelledEl.style.display = text ? 'block' : 'none';
    } else {
      spelledEl.textContent = '';
      spelledEl.style.display = 'none';
    }
  }

  // 2. Relative Due Hint
  const dueHint = document.getElementById('recurring-due-hint');
  let diffDays = null;
  if (nextDateVal) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(nextDateVal + 'T00:00:00');
    diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (dueHint) {
      if (diffDays === 0) {
        dueHint.textContent = 'Hôm nay đến hạn';
        dueHint.style.color = 'var(--warning)';
      } else if (diffDays === 1) {
        dueHint.textContent = 'Đến hạn vào ngày mai';
        dueHint.style.color = 'var(--accent-brand)';
      } else if (diffDays > 1) {
        dueHint.textContent = `Đến hạn sau ${diffDays} ngày`;
        dueHint.style.color = 'var(--text-muted)';
      } else {
        dueHint.textContent = `Đã qua ${Math.abs(diffDays)} ngày`;
        dueHint.style.color = 'var(--negative)';
      }
    }
  }

  // 3. Live Card Preview
  const previewWrapper = document.getElementById('recurring-card-preview-wrapper');
  if (previewWrapper) {
    const freqConfig = RECURRING_FREQUENCY_MAP[frequency] || RECURRING_FREQUENCIES[0];
    const sign = type === 'income' ? '+' : '-';
    const amountClass = type === 'income' ? 'highlight-positive' : 'highlight-negative';
    const daysBadge = diffDays !== null
      ? (diffDays === 0 ? 'Hôm nay' : diffDays > 0 ? `${diffDays}d nữa` : `Quá ${Math.abs(diffDays)}d`)
      : 'Chưa đặt';
    const catAvatar = getCategoryAvatarHtml(categoryId, 'md');
    const accName = account ? account.name : 'Chưa chọn tài khoản';

    previewWrapper.innerHTML = `
      <div class="tx-card recurring-preview-card ${isActive ? '' : 'is-inactive'}">
        <div class="tx-card-header">
          <div style="display:flex;align-items:center;gap:0.75rem;">
            ${catAvatar}
            <div style="display:flex;flex-direction:column;gap:2px;">
              <span class="tx-card-title" style="font-size:0.95rem;font-weight:600;">${escapeHtml(merchant)}</span>
              <span style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(accName)}</span>
            </div>
          </div>
          <div class="tx-card-amount ${amountClass}" style="font-size:1.05rem;font-weight:700;">
            ${sign}${formatCurrency(amount || 0)}
          </div>
        </div>
        <div class="tx-card-sub" style="margin-top:0.75rem;display:flex;align-items:center;gap:0.5rem;font-size:0.75rem;">
          <span class="recurring-freq-pill">${escapeHtml(freqConfig.labelVi)}</span>
          <span>•</span>
          <span>Đến hạn: ${nextDateVal ? formatDateShort(nextDateVal) : '---'}</span>
          <span class="recurring-days-pill">${escapeHtml(daysBadge)}</span>
        </div>
        <div class="tx-card-footer" style="margin-top:0.75rem;padding-top:0.6rem;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;color:${isActive ? 'var(--positive)' : 'var(--text-muted)'};">
            <span class="recurring-status-dot ${isActive ? 'dot-active' : 'dot-inactive'}"></span>
            ${isActive ? 'Đang bật theo dõi' : 'Tạm dừng'}
          </div>
          <span style="font-size:0.725rem;color:var(--text-muted);">${type === 'income' ? 'Khoản thu' : 'Khoản chi'}</span>
        </div>
      </div>
    `;
  }

  // 4. Monthly Budget Impact
  const calcBody = document.getElementById('recurring-calc-body');
  if (calcBody) {
    const monthlyAmt = calculateMonthlyEquivalent(amount, frequency);
    const annualAmt = calculateAnnualEquivalent(amount, frequency);

    calcBody.innerHTML = `
      <div class="recurring-calc-stat-row">
        <div class="calc-stat-item">
          <span class="calc-stat-lbl">Quy đổi hàng tháng</span>
          <span class="calc-stat-val ${type === 'income' ? 'highlight-positive' : 'highlight-negative'}">
            ${formatCurrency(monthlyAmt)}
          </span>
          <span class="calc-stat-sub">${type === 'income' ? 'Thu nhập dự phóng' : 'Chi phí hàng tháng'}</span>
        </div>
        <div class="calc-stat-item">
          <span class="calc-stat-lbl">Ước tính cả năm</span>
          <span class="calc-stat-val">
            ${formatCurrency(annualAmt)}
          </span>
          <span class="calc-stat-sub">12 tháng lặp lại</span>
        </div>
      </div>
      <div class="recurring-tip-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Luxe sẽ tự động theo dõi và đối soát khi tài khoản ghi nhận giao dịch vào ngày đến hạn.</span>
      </div>
    `;
  }
}

/* --------------------------------------------------------------- *
 * Validation
 * --------------------------------------------------------------- */
function setFieldError(fieldId, errorMsg) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (!errorEl) return;

  if (errorMsg) {
    errorEl.textContent = errorMsg;
    errorEl.style.display = 'block';
    input?.classList.add('is-invalid');
  } else {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
    input?.classList.remove('is-invalid');
  }
}

function validateRecurringForm() {
  const merchant = document.getElementById('recurring-merchant')?.value.trim() || '';
  const amount = parseVndInput(document.getElementById('recurring-amount')?.value);
  const account = document.getElementById('recurring-account')?.value || '';
  const category = document.getElementById('recurring-category')?.value || '';
  const nextDate = document.getElementById('recurring-next-date')?.value || '';
  const hasEndDate = document.getElementById('recurring-has-end-date')?.checked;
  const endDate = document.getElementById('recurring-end-date')?.value || '';

  setFieldError('recurring-merchant', merchant ? '' : 'Vui lòng nhập tên dịch vụ hoặc người nhận.');
  setFieldError('recurring-amount', amount > 0 ? '' : 'Số tiền phải lớn hơn 0.');
  setFieldError('recurring-account', account ? '' : 'Vui lòng chọn tài khoản liên kết.');
  setFieldError('recurring-category', category ? '' : 'Vui lòng chọn danh mục.');
  setFieldError('recurring-next-date', nextDate ? '' : 'Vui lòng chọn ngày đến hạn.');

  let endDateValid = true;
  if (hasEndDate && endDate) {
    if (endDate < nextDate) {
      endDateValid = false;
      setFieldError('recurring-end-date', 'Ngày kết thúc phải sau hoặc cùng ngày đến hạn tiếp theo.');
    } else {
      setFieldError('recurring-end-date', '');
    }
  } else if (hasEndDate && !endDate) {
    endDateValid = false;
    setFieldError('recurring-end-date', 'Vui lòng chọn ngày kết thúc nếu bạn bật tùy chọn này.');
  } else {
    setFieldError('recurring-end-date', '');
  }

  const isValid = Boolean(merchant && amount > 0 && account && category && nextDate && endDateValid);

  document.getElementById('confirm-save-recurring-btn')?.toggleAttribute('disabled', !isValid);
  document.getElementById('save-and-add-another-recurring-btn')?.toggleAttribute('disabled', !isValid || Boolean(_editingItem));

  updateLivePreviewAndStats();
  return isValid;
}

/* --------------------------------------------------------------- *
 * Save Handling
 * --------------------------------------------------------------- */
async function handleSave(keepOpen = false) {
  if (_isSubmitting) return;
  if (!validateRecurringForm()) {
    document.querySelector('.is-invalid')?.focus();
    return;
  }

  _isSubmitting = true;
  const saveBtn = document.getElementById('confirm-save-recurring-btn');
  const addAnotherBtn = document.getElementById('save-and-add-another-recurring-btn');
  if (saveBtn) saveBtn.disabled = true;
  if (addAnotherBtn) addAnotherBtn.disabled = true;

  try {
    const type = document.querySelector('[data-recurring-type].active')?.dataset.recurringType || 'expense';
    const merchant = document.getElementById('recurring-merchant').value.trim();
    const amount = parseVndInput(document.getElementById('recurring-amount').value);
    const frequency = document.getElementById('recurring-frequency').value || 'monthly';
    const dayOfMonth = document.getElementById('recurring-day-of-month')?.value ? Number(document.getElementById('recurring-day-of-month').value) : null;
    const dayOfWeek = document.getElementById('recurring-day-of-week')?.value ? Number(document.getElementById('recurring-day-of-week').value) : null;
    const nextDate = document.getElementById('recurring-next-date').value;
    const account_id = document.getElementById('recurring-account').value || null;
    const category = document.getElementById('recurring-category').value;
    const hasEndDate = document.getElementById('recurring-has-end-date').checked;
    const endDate = hasEndDate ? (document.getElementById('recurring-end-date').value || null) : null;
    const notes = document.getElementById('recurring-notes').value.trim();
    const isActive = document.getElementById('recurring-is-active').checked;
    const status = isActive ? 'active' : 'inactive';

    const recurringPayload = {
      merchant,
      amount,
      type,
      category,
      category_id: category,
      frequency,
      recurrence: frequency,
      day_of_month: dayOfMonth,
      day_of_week: dayOfWeek,
      nextDate,
      start_date: nextDate,
      end_date: endDate,
      endDate,
      account_id,
      notes,
      status,
      is_active: isActive,
    };

    if (_editingItem && _editingItem.id) {
      await dataService.updateRecurring(_editingItem.id, recurringPayload);
      showToast(`Đã cập nhật giao dịch định kỳ: ${merchant}`, 'success');
    } else {
      await dataService.addRecurring(recurringPayload);
      _lastAccountId = account_id;
      showToast(`Đã thêm giao dịch định kỳ: ${formatAmount(amount, type)} · ${merchant}`, 'success');
    }

    emit('data:changed');

    if (keepOpen) {
      resetFormForNext();
    } else {
      closeModal(MODAL_ID);
    }
  } catch (error) {
    showToast(error.message || 'Không thể lưu giao dịch định kỳ.', 'error');
  } finally {
    _isSubmitting = false;
    if (saveBtn) saveBtn.disabled = false;
    if (addAnotherBtn) addAnotherBtn.disabled = false;
  }
}

function resetFormForNext() {
  _editingItem = null;
  const form = document.getElementById('recurring-modal-form');
  form?.reset();

  const merchantInput = document.getElementById('recurring-merchant');
  if (merchantInput) {
    merchantInput.value = '';
    merchantInput.focus();
  }

  const amountInput = document.getElementById('recurring-amount');
  if (amountInput) amountInput.value = '';

  const notesInput = document.getElementById('recurring-notes');
  if (notesInput) notesInput.value = '';

  const hasEndCheck = document.getElementById('recurring-has-end-date');
  if (hasEndCheck) hasEndCheck.checked = false;
  const endWrapper = document.getElementById('recurring-end-date-wrapper');
  if (endWrapper) endWrapper.style.display = 'none';

  const today = new Date();
  const nextDateInput = document.getElementById('recurring-next-date');
  if (nextDateInput) nextDateInput.value = calculateNextDueDate('monthly', 1, null, today);

  document.getElementById('recurring-account').value = _lastAccountId || _accounts[0]?.id || '';
  refreshAccountTrigger();

  setRecurringType('expense');
  setRecurringFrequency('monthly');
  validateRecurringForm();
}

/* --------------------------------------------------------------- *
 * Form Interactive Behaviors
 * --------------------------------------------------------------- */
function setRecurringType(type) {
  document.querySelectorAll('[data-recurring-type]').forEach(btn => {
    const isAct = btn.dataset.recurringType === type;
    btn.classList.toggle('active', isAct);
    btn.setAttribute('aria-pressed', String(isAct));
  });

  const merchantLabel = document.getElementById('recurring-merchant-label');
  if (merchantLabel) {
    merchantLabel.innerHTML = `${type === 'income' ? 'Nguồn thu / Đơn vị chi trả' : 'Tên dịch vụ / Người nhận'} <span class="required-mark">*</span>`;
  }

  const categorySelect = document.getElementById('recurring-category');
  const chipsContainer = document.getElementById('recurring-category-chips');
  const currentCategory = categorySelect?.value;
  const pool = type === 'income' ? CATEGORIES.filter(c => c.type === 'income') : EXPENSE_CATEGORIES;
  const isValid = pool.some(c => c.id === currentCategory);
  const selectedCat = isValid ? currentCategory : (pool[0]?.id || '');

  if (categorySelect) {
    categorySelect.innerHTML = categorySelectOptionsHTML(type, selectedCat);
    categorySelect.value = selectedCat;
  }
  if (chipsContainer) {
    chipsContainer.innerHTML = categoryChipsHTML(type, selectedCat);
  }

  validateRecurringForm();
}

function setRecurringFrequency(freq) {
  const hiddenInput = document.getElementById('recurring-frequency');
  if (hiddenInput) hiddenInput.value = freq;

  document.querySelectorAll('.recurring-freq-btn').forEach(btn => {
    const isAct = btn.dataset.freq === freq;
    btn.classList.toggle('active', isAct);
    btn.setAttribute('aria-checked', String(isAct));
  });

  renderScheduleControls(freq);

  // Recalculate next due date if user hasn't explicitly locked it
  const dayOfMonth = document.getElementById('recurring-day-of-month')?.value;
  const dayOfWeek = document.getElementById('recurring-day-of-week')?.value;
  const nextDateInput = document.getElementById('recurring-next-date');
  if (nextDateInput) {
    nextDateInput.value = calculateNextDueDate(freq, dayOfMonth ? Number(dayOfMonth) : 1, dayOfWeek ? Number(dayOfWeek) : 1);
  }

  validateRecurringForm();
}

function applyPreset(preset) {
  setRecurringType(preset.type);
  setRecurringFrequency(preset.frequency);

  const merchantInput = document.getElementById('recurring-merchant');
  if (merchantInput) merchantInput.value = preset.name;

  const amountInput = document.getElementById('recurring-amount');
  if (amountInput) amountInput.value = Number(preset.amount).toLocaleString('vi-VN');

  const catSelect = document.getElementById('recurring-category');
  if (catSelect) {
    catSelect.value = preset.category;
    document.querySelectorAll('.recurring-cat-chip').forEach(ch => {
      const isMatch = ch.dataset.catId === preset.category;
      ch.classList.toggle('active', isMatch);
      ch.setAttribute('aria-checked', String(isMatch));
    });
  }

  if (preset.day_of_month) {
    const daySelect = document.getElementById('recurring-day-of-month');
    if (daySelect) daySelect.value = String(preset.day_of_month);
    const nextDateInput = document.getElementById('recurring-next-date');
    if (nextDateInput) {
      nextDateInput.value = calculateNextDueDate(preset.frequency, preset.day_of_month);
    }
  }

  validateRecurringForm();
  merchantInput?.focus();
}

function attachFormListeners(modal) {
  // 1. Preset chip clicks
  modal.querySelectorAll('.recurring-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const idx = Number(chip.dataset.presetIdx);
      const preset = RECURRING_PRESETS[idx];
      if (preset) applyPreset(preset);
    });
  });

  // 2. Type toggle clicks
  modal.querySelectorAll('[data-recurring-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      setRecurringType(btn.dataset.recurringType);
    });
  });

  // 3. Frequency button clicks
  modal.querySelectorAll('.recurring-freq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setRecurringFrequency(btn.dataset.freq);
    });
  });

  // 4. Schedule change listeners (delegated)
  modal.addEventListener('change', e => {
    if (e.target.id === 'recurring-day-of-month' || e.target.id === 'recurring-day-of-week') {
      const freq = document.getElementById('recurring-frequency')?.value || 'monthly';
      const dayOfMonth = document.getElementById('recurring-day-of-month')?.value;
      const dayOfWeek = document.getElementById('recurring-day-of-week')?.value;
      const nextDateInput = document.getElementById('recurring-next-date');
      if (nextDateInput) {
        nextDateInput.value = calculateNextDueDate(freq, dayOfMonth ? Number(dayOfMonth) : 1, dayOfWeek ? Number(dayOfWeek) : 1);
      }
      validateRecurringForm();
    }
  });

  // 5. Merchant input
  const merchantInput = modal.querySelector('#recurring-merchant');
  merchantInput?.addEventListener('input', () => validateRecurringForm());

  // 6. Amount input with thousand formatting
  // 6. Amount input with thousand formatting & shorthand support
  const amountInput = modal.querySelector('#recurring-amount');
  amountInput?.addEventListener('input', () => {
    const val = amountInput.value.trim();
    if (/[a-zA-Z]/i.test(val)) {
      validateRecurringForm();
      return;
    }
    const raw = amountInput.value.replace(/\D/g, '');
    if (raw) {
      amountInput.value = Number(raw).toLocaleString('vi-VN');
    } else {
      amountInput.value = '';
    }
    validateRecurringForm();
  });

  amountInput?.addEventListener('blur', () => {
    const parsed = parseVndInput(amountInput.value);
    if (parsed > 0) {
      amountInput.value = Number(parsed).toLocaleString('vi-VN');
    }
    validateRecurringForm();
  });

  // 7. Quick delta chips
  modal.querySelectorAll('[data-add-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.addAmount);
      const current = parseVndInput(amountInput?.value);
      const nextVal = current + delta;
      if (amountInput) amountInput.value = nextVal.toLocaleString('vi-VN');
      validateRecurringForm();
    });
  });

  modal.querySelector('[data-clear-amount]')?.addEventListener('click', () => {
    if (amountInput) amountInput.value = '';
    validateRecurringForm();
  });

  // 8. Quick date presets
  modal.querySelectorAll('[data-set-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.setDate;
      const nextDateInput = modal.querySelector('#recurring-next-date');
      if (!nextDateInput) return;
      const d = new Date();
      if (mode === 'today') {
        nextDateInput.value = getLocalDateString(d);
      } else if (mode === 'tomorrow') {
        d.setDate(d.getDate() + 1);
        nextDateInput.value = getLocalDateString(d);
      } else if (mode === 'next-month-1') {
        const nextM = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        nextDateInput.value = getLocalDateString(nextM);
      } else if (mode === 'next-month-15') {
        const nextM15 = new Date(d.getFullYear(), d.getMonth() + 1, 15);
        nextDateInput.value = getLocalDateString(nextM15);
      }
      validateRecurringForm();
    });
  });

  // 9. Next date change
  const nextDateInput = modal.querySelector('#recurring-next-date');
  nextDateInput?.addEventListener('input', () => validateRecurringForm());
  nextDateInput?.addEventListener('change', () => validateRecurringForm());

  // 10. Account custom dropdown
  const accountTrigger = modal.querySelector('#recurring-account-trigger');
  accountTrigger?.addEventListener('click', e => {
    e.stopPropagation();
    toggleAccountDropdown();
  });

  const accountDropdown = modal.querySelector('#recurring-account-dropdown');
  accountDropdown?.addEventListener('click', e => {
    const option = e.target.closest('.account-select-option');
    if (!option) return;
    const value = option.dataset.value;
    const select = modal.querySelector('#recurring-account');
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    refreshAccountTrigger();
    closeAccountDropdown();
    validateRecurringForm();
  });

  // Document click to close account dropdown
  document.addEventListener('click', e => {
    if (!e.target.closest('#recurring-account-wrapper')) {
      closeAccountDropdown();
    }
  });

  // 11. Category chips clicks
  modal.querySelector('#recurring-category-chips')?.addEventListener('click', e => {
    const chip = e.target.closest('.recurring-cat-chip');
    if (!chip) return;
    const catId = chip.dataset.catId;
    const select = modal.querySelector('#recurring-category');
    if (select) {
      select.value = catId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    modal.querySelectorAll('.recurring-cat-chip').forEach(c => {
      const isAct = c.dataset.catId === catId;
      c.classList.toggle('active', isAct);
      c.setAttribute('aria-checked', String(isAct));
    });
    validateRecurringForm();
  });

  // 12. End Date Checkbox toggle
  modal.querySelector('#recurring-has-end-date')?.addEventListener('change', e => {
    const isChecked = e.target.checked;
    const endWrapper = modal.querySelector('#recurring-end-date-wrapper');
    if (endWrapper) {
      endWrapper.style.display = isChecked ? 'block' : 'none';
      if (isChecked) {
        const nextDateVal = modal.querySelector('#recurring-next-date')?.value;
        const endDateInput = modal.querySelector('#recurring-end-date');
        if (endDateInput && !endDateInput.value && nextDateVal) {
          const d = new Date(nextDateVal);
          d.setFullYear(d.getFullYear() + 1);
          endDateInput.value = getLocalDateString(d);
        }
      }
    }
    validateRecurringForm();
  });

  modal.querySelector('#recurring-end-date')?.addEventListener('input', () => validateRecurringForm());

  // 13. Active status toggle
  modal.querySelector('#recurring-is-active')?.addEventListener('change', () => {
    updateLivePreviewAndStats();
  });
}

/* --------------------------------------------------------------- *
 * Public Modal API
 * --------------------------------------------------------------- */
export async function openRecurringModal(itemToEdit = null) {
  _editingItem = itemToEdit;
  const modal = ensureRecurringModal();

  // Load active accounts
  try {
    _accounts = await dataService.getAccounts();
  } catch (err) {
    _accounts = [];
  }

  if (!_accounts || _accounts.length === 0) {
    try {
      const { getDefaultAccounts } = await import('../../services/mockData.js');
      _accounts = getDefaultAccounts();
    } catch {
      _accounts = [];
    }
  }

  // Update title & button text
  const titleEl = modal.querySelector('#recurring-modal-title');
  const btnText = modal.querySelector('#confirm-save-recurring-text');
  const addAnotherBtn = modal.querySelector('#save-and-add-another-recurring-btn');

  if (_editingItem) {
    if (titleEl) titleEl.textContent = 'Chỉnh sửa giao dịch định kỳ';
    if (btnText) btnText.textContent = 'Lưu thay đổi';
    if (addAnotherBtn) addAnotherBtn.style.display = 'none';
  } else {
    if (titleEl) titleEl.textContent = 'Thêm giao dịch định kỳ';
    if (btnText) btnText.textContent = 'Lưu giao dịch';
    if (addAnotherBtn) addAnotherBtn.style.display = 'inline-flex';
  }

  const content = modal.querySelector('#recurring-form-content');
  if (content) {
    content.innerHTML = renderRecurringFormHTML(_editingItem);
  }

  refreshAccountTrigger();
  renderScheduleControls(_editingItem?.frequency || 'monthly', _editingItem?.day_of_month || 1, _editingItem?.day_of_week || 1);
  attachFormListeners(modal);
  validateRecurringForm();

  openModal(MODAL_ID);

  setTimeout(() => {
    const initialFocus = modal.querySelector('#recurring-merchant');
    initialFocus?.focus();
  }, 100);
}

export function closeRecurringModal() {
  closeModal(MODAL_ID);
}

export default {
  openRecurringModal,
  closeRecurringModal,
};
