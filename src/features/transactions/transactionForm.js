/**
 * @file Add Transaction modal form.
 * Keeps the form self-contained while delegating persistence to dataAdapter.
 */

import dataService from '../../services/dataAdapter.js';
import { EXPENSE_CATEGORIES, CATEGORIES } from '../../constants/categories.js';
import { escapeHtml, formatAmount, parseNumber, getActiveCurrency } from '../../utils/format.js';
import { openModal, closeModal } from '../../components/ui/Modal.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';
import { getBankAvatarInfo } from '../../constants/banks.js';

const MODAL_ID = 'add-tx-modal';
let _isEditing = false;
let _accounts = [];
let _lastAccountId = null;

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
  if (!_accounts.length) return '';
  return _accounts.map(account => {
    const avatar = getBankAvatarInfo(account.name);
    const balance = Number(account.balance || 0).toLocaleString('vi-VN');
    return `
      <button class="account-select-option" role="option" data-value="${escapeHtml(account.id)}" ${account.id === selected ? 'aria-selected="true"' : ''}>
        <span class="account-avatar account-avatar-sm" style="background:${avatar.bg};color:${avatar.textColor};" aria-hidden="true">${avatar.initial}</span>
        <span class="account-select-name">${escapeHtml(account.name)}</span>
        <span class="account-select-balance">Số dư ${balance} ${escapeHtml(account.currency || getActiveCurrency())}</span>
        ${account.id === selected ? '<svg class="account-select-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
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

  const selectedId = select.value;
  const account = _accounts.find(a => a.id === selectedId);
  if (account) {
    const avatar = getBankAvatarInfo(account.name);
    triggerText.textContent = account.name;
    triggerAvatar.textContent = avatar.initial;
    triggerAvatar.style.background = avatar.bg;
    triggerAvatar.style.color = avatar.textColor;
  } else {
    triggerText.textContent = 'Chọn tài khoản';
    triggerAvatar.textContent = '?';
    triggerAvatar.style.background = '#64748b';
    triggerAvatar.style.color = '#fff';
  }

  dropdown.querySelectorAll('.account-select-option').forEach(opt => {
    const isSelected = opt.dataset.value === selectedId;
    opt.classList.toggle('is-selected', isSelected);
    opt.setAttribute('aria-selected', String(isSelected));
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

function quickChipsHTML(type) {
  const categories = type === 'income' ? CATEGORIES.filter(c => c.type === 'income') : EXPENSE_CATEGORIES.slice(0, 6);
  return categories.map(c => `<button type="button" class="tx-category-chip" data-category-chip="${c.id}">${c.icon} ${escapeHtml(c.labelVi)}</button>`).join('');
}

function renderFormHTML() {
  const type = 'expense';
  const selectedAccount = _lastAccountId || _accounts[0]?.id || '';
  return `
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
        <span class="field-error" id="tx-merchant-error"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="tx-amount">Số tiền <span class="required-mark">*</span></label>
        <div class="currency-input">
          <span class="currency-prefix" aria-hidden="true">${escapeHtml(getActiveCurrency())}</span>
          <input type="text" class="form-input tx-amount-input" id="tx-amount" placeholder="0" required aria-required="true" inputmode="decimal" autocomplete="off" />
        </div>
        <span class="field-error" id="tx-amount-error"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="tx-payment-method">Phương thức <span class="required-mark">*</span></label>
        <select class="form-input form-select" id="tx-payment-method" required aria-required="true">
          <option value="cash">Tiền mặt</option>
          <option value="card" selected>Thẻ</option>
          <option value="transfer">Chuyển khoản</option>
          <option value="ewallet">Ví điện tử</option>
        </select>
        <span class="field-error" id="tx-payment-method-error"></span>
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
        <select id="tx-account" required aria-required="true" hidden>
          ${accountOptionsHTML(selectedAccount)}
        </select>
        <span class="field-error" id="tx-account-error"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="tx-category">Danh mục <span class="required-mark">*</span></label>
        <select class="form-input form-select" id="tx-category" required aria-required="true">${categoryOptionsHTML(type)}</select>
        <div class="tx-category-chips" id="tx-category-chips">${quickChipsHTML(type)}</div>
        <span class="field-error" id="tx-category-error"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="tx-date">Ngày <span class="required-mark">*</span></label>
        <input type="date" class="form-input" id="tx-date" required aria-required="true" />
        <span class="field-error" id="tx-date-error"></span>
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
  if (input) input.valueAsDate = new Date();
}

function formatAmountInput(value) {
  const raw = String(value).replace(/[^\d.,]/g, '').replace(',', '.');
  if (!raw) return '';
  const [integer, decimal] = raw.split('.');
  const grouped = Number(integer || 0).toLocaleString('vi-VN');
  return decimal !== undefined ? `${grouped}.${decimal.slice(0, 2)}` : grouped;
}

function setFieldError(id, message) {
  const input = document.getElementById(id);
  const error = document.getElementById(`${id}-error`);
  if (input) {
    input.classList.toggle('is-invalid', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
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
  document.getElementById('tx-date').valueAsDate = new Date();
  document.getElementById('tx-account').value = _lastAccountId || _accounts[0]?.id || '';
  refreshAccountTrigger();
  document.getElementById('tx-category').innerHTML = categoryOptionsHTML('expense');
  document.getElementById('tx-category-chips').innerHTML = quickChipsHTML('expense');
  document.getElementById('tx-payment-method').value = 'card';
  document.getElementById('tx-type-value')?.setAttribute('value', 'expense');
  updateTypeUI('expense');
  validateForm();
  document.getElementById('tx-merchant')?.focus();
}

function updateTypeUI(type) {
  document.querySelectorAll('[data-tx-type]').forEach(btn => {
    const active = btn.dataset.txType === type;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  const label = document.getElementById('tx-merchant-label');
  if (label) label.innerHTML = `${type === 'income' ? 'Nguồn thu / Ghi chú' : 'Người nhận / Ghi chú'} <span class="required-mark">*</span>`;
  const category = document.getElementById('tx-category');
  const current = category?.value;
  if (category) category.innerHTML = categoryOptionsHTML(type, current);
  const chips = document.getElementById('tx-category-chips');
  if (chips) chips.innerHTML = quickChipsHTML(type);
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
  dialog.querySelector('#close-add-tx-modal')?.addEventListener('click', close);
  dialog.querySelector('#cancel-add-tx')?.addEventListener('click', close);
  dialog.querySelector('#save-and-add-another')?.addEventListener('click', () => handleSubmit(true));
  dialog.querySelector('#add-tx-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit(false);
  });
  // Enter-to-submit: pressing Enter on any input (except textarea/select) triggers save
  dialog.querySelector('#add-tx-form')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      if (validateForm()) handleSubmit(false);
    }
  });
  dialog.querySelectorAll('[data-tx-type]').forEach(btn => btn.addEventListener('click', () => updateTypeUI(btn.dataset.txType)));
  dialog.querySelectorAll('#tx-merchant, #tx-amount, #tx-account, #tx-category, #tx-date, #tx-payment-method').forEach(input => input.addEventListener('input', validateForm));
  dialog.querySelectorAll('#tx-account, #tx-category, #tx-date, #tx-payment-method').forEach(input => input.addEventListener('change', validateForm));
  dialog.querySelector('#tx-account')?.addEventListener('change', refreshAccountTrigger);
  dialog.querySelector('#tx-amount')?.addEventListener('input', e => { e.target.value = formatAmountInput(e.target.value); });
  dialog.querySelector('#tx-recurring')?.addEventListener('change', e => {
    document.getElementById('tx-recurring-options').hidden = !e.target.checked;
  });

  // Custom account select
  dialog.querySelector('#tx-account-trigger')?.addEventListener('click', e => {
    e.stopPropagation();
    toggleAccountDropdown();
  });
  dialog.querySelectorAll('.account-select-option').forEach(opt => {
    opt.addEventListener('click', () => {
      selectAccountOption(opt.dataset.value);
    });
  });
  dialog.querySelector('#tx-account-dropdown')?.addEventListener('click', e => {
    e.stopPropagation();
  });

  dialog.addEventListener('click', e => {
    const chip = e.target.closest('[data-category-chip]');
    if (chip) {
      document.getElementById('tx-category').value = chip.dataset.categoryChip;
      validateForm();
    }
    if (!e.target.closest('#tx-account-wrapper')) {
      closeAccountDropdown();
    }
  });

  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAccountDropdown();
    }
  });
  if (overlay) {
    overlay.setAttribute('aria-labelledby', 'modal-title');
    if (!overlay.dataset.backdropBound) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
      });
      overlay.dataset.backdropBound = 'true';
    }
  }
}

export async function open() {
  _isEditing = false;
  await refreshDialog();
  openModal(MODAL_ID);
}

export async function edit(tx) {
  _isEditing = true;
  await refreshDialog();
  const modal = document.getElementById('add-tx-modal');
  if (modal) {
    const merchantInput = modal.querySelector('#tx-merchant');
    const amountInput = modal.querySelector('#tx-amount');
    const accountSelect = modal.querySelector('#tx-account');
    const categorySelect = modal.querySelector('#tx-category');
    const dateInput = modal.querySelector('#tx-date');
    const paymentSelect = modal.querySelector('#tx-payment-method');
    if (merchantInput) merchantInput.value = tx.merchant || '';
    if (amountInput) amountInput.value = formatAmountInput(String(tx.amount || 0));
    if (accountSelect && tx.account_id) accountSelect.value = tx.account_id;
    if (categorySelect && tx.category) categorySelect.value = tx.category;
    if (dateInput && tx.date) dateInput.value = tx.date;
    if (paymentSelect && tx.payment_method) paymentSelect.value = tx.payment_method;
    refreshAccountTrigger();
    validateForm();
  }
  openModal(MODAL_ID);
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
