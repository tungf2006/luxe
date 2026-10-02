/**
 * @file Add Transaction modal form.
 * Keeps the form self-contained while delegating persistence to dataAdapter.
 */

import dataService from '../../services/dataAdapter.js';
import { EXPENSE_CATEGORIES, CATEGORIES } from '../../constants/categories.js';
import { escapeHtml, formatAmount, parseNumber, getActiveCurrency, formatSpelledAmount, getLocalDateString } from '../../utils/format.js';
import { openModal, closeModal } from '../../components/ui/Modal.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';
import { getBankAvatarInfo, getBankAvatarHtml } from '../../constants/banks.js';

const MODAL_ID = 'add-tx-modal';
let _isEditing = false;
let _accounts = [];
let _lastAccountId = null;
let _showAllCategories = false;

function categoryOptionsHTML(type, selected = '') {
  const pool = type === 'income' ? CATEGORIES.filter(c => c.type === 'income') : EXPENSE_CATEGORIES;
  return '<option value="">Chọn danh mục</option>' +
    pool.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${escapeHtml(c.labelVi)}</option>`).join('');
}

function accountOptionsHTML(selected = '') {
  if (!_accounts.length) return '<option value="">Không có tài khoản</option>';
  return _accounts.map(account => {
    const balance = Number(account.balance || 0).toLocaleString('vi-VN');
    return `<option value="${escapeHtml(account.id)}" ${account.id === selected ? 'selected' : ''}>${escapeHtml(account.name)} · Số dư ${balance} ${escapeHtml(account.currency || getActiveCurrency())}</option>`;
  }).join('');
}

function customOptionsHTML(selected = '') {
  if (!_accounts.length) {
    return `
      <div class="account-select-empty">Chưa có tài khoản nào</div>
    `;
  }
  return _accounts.map(account => {
    const balance = Number(account.balance || 0).toLocaleString('vi-VN');
    const isSelected = account.id === selected;
    return `
      <button type="button" class="account-select-option ${isSelected ? 'is-selected' : ''}" role="option" data-value="${escapeHtml(account.id)}" aria-selected="${isSelected}">
        ${getBankAvatarHtml(account.name, 'sm')}
        <span class="account-select-name">${escapeHtml(account.name)}</span>
        <span class="account-select-balance">Số dư ${balance} ${escapeHtml(account.currency || getActiveCurrency())}</span>
        ${isSelected ? '<svg class="account-select-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </button>
    `;
  }).join('');
}

function refreshAccountTrigger() {
  const select = document.getElementById('tx-account');
  const triggerText = document.getElementById('tx-account-text');
  const triggerAvatar = document.getElementById('tx-account-avatar');
  const dropdown = document.getElementById('tx-account-dropdown');
  if (!select || !triggerText || !triggerAvatar || !dropdown) return;

  let selectedId = select.value;
  let account = _accounts.find(a => a.id === selectedId);

  // If no account is currently selected but accounts exist, auto-select the first one
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

function closeAccountDropdown() {
  const trigger = document.getElementById('tx-account-trigger');
  const dropdown = document.getElementById('tx-account-dropdown');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (dropdown) dropdown.classList.remove('open');
}

function toggleAccountDropdown() {
  const trigger = document.getElementById('tx-account-trigger');
  const dropdown = document.getElementById('tx-account-dropdown');
  if (!trigger || !dropdown) return;

  const isOpen = dropdown.classList.contains('open');
  if (isOpen) {
    closeAccountDropdown();
  } else {
    trigger.setAttribute('aria-expanded', 'true');
    dropdown.classList.add('open');
  }
}

function selectAccountOption(accountId) {
  const select = document.getElementById('tx-account');
  if (!select) return;
  select.value = accountId;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  refreshAccountTrigger();
  closeAccountDropdown();
  validateForm();
}

function quickAmountsHTML() {
  const currency = getActiveCurrency();
  const presets = currency === 'USD'
    ? [
        { label: '+$10', value: 10 },
        { label: '+$50', value: 50 },
        { label: '+$100', value: 100 },
        { label: '+$500', value: 500 }
      ]
    : [
        { label: '+10.000', value: 10000 },
        { label: '+50.000', value: 50000 },
        { label: '+100.000', value: 100000 },
        { label: '+500.000', value: 500000 },
        { label: '+1.000.000', value: 1000000 }
      ];

  return presets.map(p => `
    <button type="button" class="tx-quick-amount-btn" data-quick-amount="${p.value}" aria-label="Thêm ${p.label}">
      ${escapeHtml(p.label)}
    </button>
  `).join('');
}

function categoryChipsHTML(type, selected = '') {
  const pool = type === 'income' ? CATEGORIES.filter(c => c.type === 'income') : EXPENSE_CATEGORIES;
  const maxInitial = 8;
  const shouldTruncate = pool.length > maxInitial && !_showAllCategories;
  const visibleCategories = shouldTruncate ? pool.slice(0, maxInitial) : pool;

  let html = visibleCategories.map(c => {
    const isSelected = c.id === selected;
    return `
      <button type="button" 
        class="tx-category-chip ${isSelected ? 'active' : ''}" 
        data-category-chip="${escapeHtml(c.id)}" 
        role="radio" 
        aria-checked="${isSelected}" 
        aria-pressed="${isSelected}">
        <span class="tx-chip-icon" aria-hidden="true">${c.icon}</span>
        <span class="tx-chip-label">${escapeHtml(c.labelVi)}</span>
      </button>
    `;
  }).join('');

  if (pool.length > maxInitial) {
    html += `
      <button type="button" class="tx-category-chip tx-category-chip-more" id="tx-category-toggle-more" aria-expanded="${_showAllCategories}">
        ${_showAllCategories ? 'Thu gọn ⌃' : '+ Thêm (' + (pool.length - maxInitial) + ') ⌄'}
      </button>
    `;
  }
  return html;
}

function refreshCategoryChips(selectedId = null) {
  const select = document.getElementById('tx-category');
  const activeType = document.querySelector('[data-tx-type].active')?.dataset.txType || 'expense';
  const currentVal = selectedId !== null ? selectedId : (select?.value || '');
  const container = document.getElementById('tx-category-chips');
  if (container) {
    container.innerHTML = categoryChipsHTML(activeType, currentVal);
  }
}

function selectCategoryOption(categoryId) {
  const select = document.getElementById('tx-category');
  if (!select) return;
  select.value = categoryId;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  refreshCategoryChips(categoryId);
  validateForm();
}

function renderFormHTML() {
  const type = 'expense';
  const selectedAccount = (_accounts.some(a => a.id === _lastAccountId) ? _lastAccountId : '') || _accounts[0]?.id || '';
  return `
    <div class="modal-grab-handle" aria-hidden="true"></div>
    <div class="modal-header">
      <h2 class="modal-title" id="modal-title">${_isEditing ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h2>
      <button class="modal-close-btn" id="close-add-tx-modal" type="button" aria-label="Đóng cửa sổ">✕</button>
    </div>
    <form class="modal-form" id="add-tx-form" novalidate>
      <div class="form-group">
        <span class="form-label">Loại <span class="required-mark">*</span></span>
        <div class="type-toggle-group" role="group" aria-label="Loại giao dịch">
          <button type="button" class="type-toggle-btn active expense" data-tx-type="expense" aria-pressed="true">↓ Chi phí</button>
          <button type="button" class="type-toggle-btn income" data-tx-type="income" aria-pressed="false">↑ Thu nhập</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" id="tx-merchant-label" for="tx-merchant">Người nhận / Ghi chú <span class="required-mark">*</span></label>
        <input type="text" class="form-input" id="tx-merchant" placeholder="Ví dụ: Starbucks" required aria-required="true" autocomplete="off" />
        <span class="field-error" id="tx-merchant-error" role="alert"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="tx-amount">Số tiền <span class="required-mark">*</span></label>
        <div class="currency-input" id="tx-amount-wrapper">
          <span class="currency-prefix" id="tx-currency-prefix" aria-hidden="true">${escapeHtml(getActiveCurrency())}</span>
          <input type="text" class="form-input tx-amount-input" id="tx-amount" placeholder="0" required aria-required="true" inputmode="decimal" autocomplete="off" />
        </div>
        <div class="tx-amount-spelled" id="tx-amount-spelled" aria-live="polite"></div>
        <div class="tx-quick-amounts" id="tx-quick-amounts" role="group" aria-label="Chọn nhanh số tiền">
          ${quickAmountsHTML()}
        </div>
        <span class="field-error" id="tx-amount-error" role="alert"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="tx-payment-method">Phương thức <span class="required-mark">*</span></label>
        <select class="form-input form-select" id="tx-payment-method" required aria-required="true">
          <option value="cash">Tiền mặt</option>
          <option value="card" selected>Thẻ</option>
          <option value="transfer">Chuyển khoản</option>
          <option value="ewallet">Ví điện tử</option>
        </select>
        <span class="field-error" id="tx-payment-method-error" role="alert"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="tx-account-trigger">Tài khoản <span class="required-mark">*</span></label>
        <div class="account-select" id="tx-account-wrapper">
          <button class="account-select-trigger form-input" id="tx-account-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span class="account-avatar account-avatar-sm" id="tx-account-avatar" aria-hidden="true"></span>
            <span class="account-select-text" id="tx-account-text">Chọn tài khoản</span>
            <svg class="account-select-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="account-select-dropdown" id="tx-account-dropdown" role="listbox" aria-label="Tài khoản">
            ${customOptionsHTML(selectedAccount)}
          </div>
        </div>
        <select id="tx-account" required aria-required="true" style="display:none;" tabindex="-1">
          ${accountOptionsHTML(selectedAccount)}
        </select>
        <span class="field-error" id="tx-account-error" role="alert"></span>
      </div>
      <div class="form-group">
        <label class="form-label" id="tx-category-label">Danh mục <span class="required-mark">*</span></label>
        <select class="form-input form-select" id="tx-category" required aria-required="true" style="display:none;" tabindex="-1">${categoryOptionsHTML(type)}</select>
        <div class="tx-category-chips" id="tx-category-chips" role="radiogroup" aria-labelledby="tx-category-label">${categoryChipsHTML(type)}</div>
        <span class="field-error" id="tx-category-error" role="alert"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="tx-date">Ngày <span class="required-mark">*</span></label>
        <input type="date" class="form-input" id="tx-date" required aria-required="true" />
        <span class="field-error" id="tx-date-error" role="alert"></span>
      </div>
      <div class="form-group tx-recurring-group">
        <label class="checkbox-row" for="tx-recurring">
          <input type="checkbox" id="tx-recurring" />
          <span>Đây là giao dịch định kỳ</span>
        </label>
        <div class="tx-recurring-options" id="tx-recurring-options" hidden>
          <label class="form-label" for="tx-frequency">Tần suất</label>
          <select class="form-input form-select" id="tx-frequency">
            <option value="monthly">Hàng tháng</option>
            <option value="weekly">Hàng tuần</option>
            <option value="yearly">Hàng năm</option>
          </select>
        </div>
      </div>
    </form>
    <div class="modal-footer">
      <button class="btn-secondary" id="cancel-add-tx" type="button">Hủy</button>
      <button class="btn-secondary" id="save-and-add-another" type="button" disabled>Lưu và thêm tiếp</button>
      <button class="btn-add-transaction" id="confirm-add-tx" type="submit" form="add-tx-form" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${_isEditing ? 'Lưu thay đổi' : 'Lưu giao dịch'}
      </button>
    </div>
  `;
}

function setTodayDate() {
  const input = document.getElementById('tx-date');
  if (input) input.value = getLocalDateString(new Date());
}

function formatAmountInput(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  const currency = getActiveCurrency();

  if (currency === 'USD') {
    const clean = str.replace(/[^\d.]/g, '');
    if (!clean) return '';
    const parts = clean.split('.');
    const integerPart = parts[0] ? Number(parts[0]).toLocaleString('en-US') : '0';
    if (parts.length > 1) {
      return `${integerPart}.${parts[1].slice(0, 2)}`;
    }
    return integerPart;
  }

  // VND and standard currencies
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

function updateSpelledAmount() {
  const spelledEl = document.getElementById('tx-amount-spelled');
  const amountInput = document.getElementById('tx-amount');
  if (!spelledEl || !amountInput) return;
  const num = parseNumber(amountInput.value);
  if (num > 0) {
    const text = formatSpelledAmount(num, getActiveCurrency());
    spelledEl.textContent = text;
    spelledEl.style.display = text ? 'block' : 'none';
  } else {
    spelledEl.textContent = '';
    spelledEl.style.display = 'none';
  }
}

function handleAmountInputEvent(e) {
  const input = e.target;
  const original = input.value;
  const cursor = input.selectionStart || 0;

  // Count digits before the cursor
  const digitsBefore = original.slice(0, cursor).replace(/\D/g, '').length;
  const formatted = formatAmountInput(original);
  input.value = formatted;

  // Restore cursor position based on digits count
  let newCursor = 0;
  let digitsCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      digitsCount++;
    }
    if (digitsCount === digitsBefore) {
      newCursor = i + 1;
      break;
    }
  }
  if (digitsBefore === 0) newCursor = 0;
  if (newCursor > formatted.length) newCursor = formatted.length;
  input.setSelectionRange(newCursor, newCursor);

  updateSpelledAmount();
  validateForm();
}

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
  if (error) error.textContent = message || '';
}

function validateForm() {
  const merchant = document.getElementById('tx-merchant')?.value.trim() || '';
  const amount = parseNumber(document.getElementById('tx-amount')?.value);
  const account = document.getElementById('tx-account')?.value || '';
  const category = document.getElementById('tx-category')?.value || '';
  const date = document.getElementById('tx-date')?.value || '';
  const paymentMethod = document.getElementById('tx-payment-method')?.value || '';
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateValue = maxDate.toISOString().slice(0, 10);

  setFieldError('tx-merchant', merchant ? '' : 'Vui lòng nhập người nhận hoặc nguồn thu.');
  setFieldError('tx-amount', amount > 0 ? '' : 'Số tiền phải lớn hơn 0.');
  setFieldError('tx-account', account ? '' : 'Vui lòng chọn tài khoản.');
  setFieldError('tx-category', category ? '' : 'Vui lòng chọn danh mục.');
  setFieldError('tx-date', !date ? 'Vui lòng chọn ngày.' : date > maxDateValue ? 'Ngày không được quá 1 năm trong tương lai.' : '');
  setFieldError('tx-payment-method', paymentMethod ? '' : 'Vui lòng chọn phương thức.');

  const valid = Boolean(merchant && amount > 0 && account && category && date && date <= maxDateValue && paymentMethod);
  document.getElementById('confirm-add-tx')?.toggleAttribute('disabled', !valid);
  document.getElementById('save-and-add-another')?.toggleAttribute('disabled', !valid);
  return valid;
}

function resetForNext() {
  const form = document.getElementById('add-tx-form');
  form?.reset();
  const dateInput = document.getElementById('tx-date');
  if (dateInput) dateInput.value = getLocalDateString(new Date());
  document.getElementById('tx-account').value = _lastAccountId || _accounts[0]?.id || '';
  refreshAccountTrigger();
  document.getElementById('tx-payment-method').value = 'card';
  _showAllCategories = false;
  updateTypeUI('expense');
  updateSpelledAmount();
  validateForm();
  document.getElementById('tx-merchant')?.focus();
}

function updateTypeUI(type) {
  const prevType = document.querySelector('[data-tx-type].active')?.dataset.txType;
  document.querySelectorAll('[data-tx-type]').forEach(btn => {
    const active = btn.dataset.txType === type;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  const label = document.getElementById('tx-merchant-label');
  if (label) label.innerHTML = `${type === 'income' ? 'Nguồn thu / Ghi chú' : 'Người nhận / Ghi chú'} <span class="required-mark">*</span>`;
  
  const categorySelect = document.getElementById('tx-category');
  const currentCategory = categorySelect?.value;
  const newPool = type === 'income' ? CATEGORIES.filter(c => c.type === 'income') : EXPENSE_CATEGORIES;
  const isValidInNewType = newPool.some(c => c.id === currentCategory);

  if (categorySelect) {
    categorySelect.innerHTML = categoryOptionsHTML(type, isValidInNewType ? currentCategory : '');
    if (isValidInNewType) {
      categorySelect.value = currentCategory;
    } else {
      categorySelect.value = '';
      if (currentCategory && prevType && prevType !== type) {
        showToast('Danh mục đã được đặt lại cho ' + (type === 'income' ? 'thu nhập' : 'chi phí'), 'info');
      }
    }
  }
  refreshCategoryChips(categorySelect?.value || '');
  validateForm();
}

async function handleSubmit(keepOpen = false) {
  if (!validateForm()) {
    document.querySelector('.is-invalid')?.focus();
    return;
  }
  const type = document.querySelector('[data-tx-type].active')?.dataset.txType || 'expense';
  const amount = parseNumber(document.getElementById('tx-amount').value);
  const recurring = document.getElementById('tx-recurring').checked;
  const paymentMethod = document.getElementById('tx-payment-method')?.value || 'card';
  const tx = {
    merchant: document.getElementById('tx-merchant').value.trim(),
    category: document.getElementById('tx-category').value,
    account_id: document.getElementById('tx-account').value || null,
    type,
    date: document.getElementById('tx-date').value,
    amount,
    status: 'completed',
    payment_method: paymentMethod,
    is_recurring: recurring,
  };
  const saveButtons = document.querySelectorAll('#confirm-add-tx, #save-and-add-another');
  saveButtons.forEach(btn => { btn.disabled = true; });
  try {
    await dataService.addTransaction(tx);
    _lastAccountId = tx.account_id;
    if (recurring) {
      await dataService.addRecurring({
        merchant: tx.merchant, category: tx.category, account_id: tx.account_id,
        type, amount, frequency: document.getElementById('tx-frequency').value,
        recurrence: document.getElementById('tx-frequency').value,
        nextDate: tx.date, start_date: tx.date, status: 'active', is_active: true,
      });
    }
    emit('data:changed');
    showToast(`Giao dịch đã thêm: ${formatAmount(amount, type)} · ${escapeHtml(tx.merchant)}`, 'success');
    if (keepOpen) resetForNext();
    else close();
  } catch (error) {
    showToast(error.message || 'Không thể lưu giao dịch.', 'error');
    validateForm();
  }
}

async function refreshDialog() {
  try {
    _accounts = await dataService.getAccounts();
  } catch (error) {
    _accounts = [];
    showToast(error.message || 'Không thể tải tài khoản.', 'error');
  }

  // Safety fallback: ensure _accounts is never empty so user is never blocked
  if (!_accounts || _accounts.length === 0) {
    try {
      const { getDefaultAccounts } = await import('../../services/mockData.js');
      _accounts = getDefaultAccounts();
    } catch {
      _accounts = [
        { id: 'a01', name: 'Vietcombank – Thanh toán', type: 'checking', balance: 15420, currency: getActiveCurrency() },
        { id: 'a02', name: 'Techcombank – Tiết kiệm', type: 'savings', balance: 9160, currency: getActiveCurrency() },
        { id: 'a03', name: 'Tiền mặt', type: 'checking', balance: 5000, currency: getActiveCurrency() },
      ];
    }
  }

  const dialog = document.querySelector('#add-tx-modal .modal-dialog');
  if (!dialog) return;
  dialog.innerHTML = renderFormHTML();
  dialog.setAttribute('role', 'document');
  setTodayDate();
  initDialogListeners(dialog);
  refreshAccountTrigger();
  validateForm();
}

function initDialogListeners(dialog) {
  const overlay = document.getElementById(MODAL_ID);
  const form = dialog.querySelector('#add-tx-form');
  if (!form) return;

  dialog.querySelector('#close-add-tx-modal')?.addEventListener('click', close);
  dialog.querySelector('#cancel-add-tx')?.addEventListener('click', close);
  dialog.querySelector('#save-and-add-another')?.addEventListener('click', () => handleSubmit(true));
  
  form.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit(false);
  });
  
  // Enter-to-submit: pressing Enter on text inputs triggers save
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      if (validateForm()) {
        handleSubmit(false);
      } else {
        const invalidInput = dialog.querySelector('.is-invalid, input:invalid');
        invalidInput?.focus();
      }
    }
  });

  dialog.querySelectorAll('[data-tx-type]').forEach(btn => btn.addEventListener('click', () => updateTypeUI(btn.dataset.txType)));
  dialog.querySelectorAll('#tx-merchant, #tx-amount, #tx-account, #tx-category, #tx-date, #tx-payment-method').forEach(input => input.addEventListener('input', validateForm));
  dialog.querySelectorAll('#tx-account, #tx-category, #tx-date, #tx-payment-method').forEach(input => input.addEventListener('change', validateForm));
  dialog.querySelector('#tx-account')?.addEventListener('change', refreshAccountTrigger);
  dialog.querySelector('#tx-payment-method')?.addEventListener('change', e => {
    const method = e.target.value;
    const currentAccId = document.getElementById('tx-account')?.value;
    const currentAcc = _accounts.find(a => a.id === currentAccId);

    if (method === 'cash') {
      const cashAcc = _accounts.find(a => /tiền mặt|cash/i.test(a.name));
      if (cashAcc) selectAccountOption(cashAcc.id);
    } else if (method === 'card' || method === 'transfer') {
      if (currentAcc && /tiền mặt|cash/i.test(currentAcc.name)) {
        const nonCashAcc = _accounts.find(a => !/tiền mặt|cash/i.test(a.name));
        if (nonCashAcc) selectAccountOption(nonCashAcc.id);
      }
    }
  });
  dialog.querySelector('#tx-category')?.addEventListener('change', e => {
    refreshCategoryChips(e.target.value);
    validateForm();
  });
  dialog.querySelector('#tx-amount')?.addEventListener('input', handleAmountInputEvent);
  dialog.querySelector('#tx-recurring')?.addEventListener('change', e => {
    document.getElementById('tx-recurring-options').hidden = !e.target.checked;
  });

  // Attach dialog-level delegated events only once to prevent duplicate triggers across refreshes
  if (!dialog.dataset.dialogBound) {
    dialog.dataset.dialogBound = 'true';

    dialog.addEventListener('click', e => {
      const trigger = e.target.closest('#tx-account-trigger');
      if (trigger) {
        e.stopPropagation();
        toggleAccountDropdown();
        return;
      }
      const accountOpt = e.target.closest('.account-select-option');
      if (accountOpt) {
        selectAccountOption(accountOpt.dataset.value);
        return;
      }
      const moreBtn = e.target.closest('#tx-category-toggle-more');
      if (moreBtn) {
        _showAllCategories = !_showAllCategories;
        refreshCategoryChips();
        return;
      }
      const chip = e.target.closest('[data-category-chip]');
      if (chip) {
        selectCategoryOption(chip.dataset.categoryChip);
        return;
      }
      const quickAmountBtn = e.target.closest('[data-quick-amount]');
      if (quickAmountBtn) {
        const delta = Number(quickAmountBtn.dataset.quickAmount);
        const amountInput = document.getElementById('tx-amount');
        if (amountInput) {
          const current = parseNumber(amountInput.value) || 0;
          const next = current + delta;
          amountInput.value = formatAmountInput(String(next));
          updateSpelledAmount();
          validateForm();
          amountInput.focus();
        }
        return;
      }
      if (!e.target.closest('#tx-account-wrapper')) {
        closeAccountDropdown();
      }
    });

    dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const dropdown = document.getElementById('tx-account-dropdown');
        if (dropdown && dropdown.classList.contains('open')) {
          closeAccountDropdown();
          e.stopPropagation();
        }
      }
    });
  }

  if (overlay) {
    overlay.setAttribute('aria-labelledby', 'modal-title');
    if (!overlay.dataset.backdropBound) {
      overlay.dataset.backdropBound = 'true';
      overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
      });
    }
  }
}

export async function open() {
  _isEditing = false;
  _showAllCategories = false;
  await refreshDialog();
  openModal(MODAL_ID);
  setTimeout(() => {
    document.getElementById('tx-merchant')?.focus();
  }, 100);
}

export async function edit(tx) {
  _isEditing = true;
  _showAllCategories = false;
  await refreshDialog();
  const modal = document.getElementById('add-tx-modal');
  if (modal) {
    if (tx.type) updateTypeUI(tx.type);
    const merchantInput = modal.querySelector('#tx-merchant');
    const amountInput = modal.querySelector('#tx-amount');
    const accountSelect = modal.querySelector('#tx-account');
    const categorySelect = modal.querySelector('#tx-category');
    const dateInput = modal.querySelector('#tx-date');
    const paymentSelect = modal.querySelector('#tx-payment-method');
    if (merchantInput) merchantInput.value = tx.merchant || '';
    if (amountInput) {
      amountInput.value = formatAmountInput(String(tx.amount || 0));
      updateSpelledAmount();
    }
    if (accountSelect && tx.account_id) accountSelect.value = tx.account_id;
    if (categorySelect && tx.category) {
      categorySelect.value = tx.category;
      refreshCategoryChips(tx.category);
    }
    if (dateInput && tx.date) dateInput.value = tx.date;
    if (paymentSelect && tx.payment_method) paymentSelect.value = tx.payment_method;
    refreshAccountTrigger();
    validateForm();
  }
  openModal(MODAL_ID);
  setTimeout(() => {
    document.getElementById('tx-merchant')?.focus();
  }, 100);
}

export function close() {
  closeModal(MODAL_ID);
  _isEditing = false;
}

export function init() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-open-modal]');
    if (btn) {
      e.preventDefault();
      open();
    }
  });
}
