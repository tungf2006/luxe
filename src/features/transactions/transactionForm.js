/**
 * @file Add/Edit Transaction modal form.
 * Generates the form markup from CATEGORIES constant, handles validation,
 * submission, and persists via dataService.
 */

import dataService from '../../services/dataService.js';
import { EXPENSE_CATEGORIES, CATEGORIES } from '../../constants/categories.js';
import { escapeHtml, formatAmount } from '../../utils/format.js';
import { openModal, closeModal } from '../../components/ui/Modal.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';

const MODAL_ID = 'add-tx-modal';
let _isEditing = false;

/* --------------------------------------------------------------- *
 * Form markup — generated from the categories constant so that
 * adding a category only requires editing categories.js.
 * --------------------------------------------------------------- */
function categoryOptionsHTML(selectedType = 'expense') {
  const pool = selectedType === 'income'
    ? CATEGORIES.filter(c => c.type === 'income')
    : EXPENSE_CATEGORIES;
  return '<option value="">Chọn danh mục</option>' +
    pool.map(c =>
      `<option value="${c.key}">${escapeHtml(c.name)}</option>`
    ).join('');
}

function renderFormHTML() {
  return `
    <div class="modal-header">
      <span class="modal-title" id="modal-title">${_isEditing ? 'Sửa giao dịch' : 'Thêm giao dịch'}</span>
      <button class="modal-close-btn" id="close-add-tx-modal" aria-label="Đóng cửa sổ">✕</button>
    </div>
    <form class="modal-form" id="add-tx-form" novalidate>
      <div class="form-group">
        <label class="form-label">Loại</label>
        <div class="type-toggle-group" role="group" aria-label="Loại giao dịch">
          <button type="button" class="type-toggle-btn active expense" data-tx-type="expense" aria-pressed="true">↓ Chi phí</button>
          <button type="button" class="type-toggle-btn income" data-tx-type="income" aria-pressed="false">↑ Thu nhập</button>
        </div>
        <input type="hidden" id="tx-type-value" value="expense"/>
      </div>

      <div class="form-group">
        <label class="form-label" for="tx-merchant">Người thu / Ghi chú</label>
        <input type="text" class="form-input" id="tx-merchant" placeholder="ví dụ: Starbucks" required aria-required="true" autocomplete="off"/>
      </div>

      <div class="form-group">
        <label class="form-label" for="tx-amount">Số tiền</label>
        <input type="number" class="form-input" id="tx-amount" placeholder="0.00" step="0.01" min="0.01" required aria-required="true" inputmode="decimal"/>
      </div>

      <div class="form-group">
        <label class="form-label" for="tx-category">Danh mục</label>
        <select class="form-input form-select" id="tx-category" required aria-required="true">
          ${categoryOptionsHTML('expense')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="tx-date">Ngày</label>
        <input type="date" class="form-input" id="tx-date" required aria-required="true"/>
      </div>
    </form>
    <div class="modal-footer">
      <button class="btn-secondary" id="cancel-add-tx" type="button">Hủy</button>
      <button class="btn-add-transaction" id="confirm-add-tx" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${_isEditing ? 'Lưu thay đổi' : 'Lưu giao dịch'}
      </button>
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Modal lifecycle
 * --------------------------------------------------------------- */
function refreshDialog() {
  const dialog = document.querySelector('#add-tx-modal .modal-dialog');
  if (!dialog) return;
  dialog.innerHTML = renderFormHTML();
  initDialogListeners(dialog);
  setTodayDate();
}

function setTodayDate() {
  const dateInput = document.getElementById('tx-date');
  if (dateInput) dateInput.valueAsDate = new Date();
}

function setFormSaving(state) {
  const btn = document.getElementById('confirm-add-tx');
  if (!btn) return;
  if (state === 'loading') {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';
    btn.querySelector('svg').insertAdjacentHTML('afterbegin', '');
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }
}

function resetTypeToggle() {
  const hidden = document.getElementById('tx-type-value');
  const expenseBtn = document.querySelector('[data-tx-type="expense"]');
  const incomeBtn = document.querySelector('[data-tx-type="income"]');
  if (hidden) hidden.value = 'expense';
  if (expenseBtn) {
    expenseBtn.classList.add('active', 'expense');
    expenseBtn.setAttribute('aria-pressed', 'true');
  }
  if (incomeBtn) {
    incomeBtn.classList.remove('active');
    incomeBtn.setAttribute('aria-pressed', 'false');
    incomeBtn.classList.remove('income');
  }
}

/* --------------------------------------------------------------- *
 * Dialog listeners (attached after content is generated)
 * --------------------------------------------------------------- */
function initDialogListeners(dialog) {
  // Close buttons
  dialog.addEventListener('click', e => {
    const closeBtn = e.target.closest('#close-add-tx-modal, #cancel-add-tx');
    if (closeBtn) {
      e.preventDefault();
      close();
    }
  });

  // Backdrop click
  const overlay = document.getElementById(MODAL_ID);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  // Type toggle
  const typeBtns = dialog.querySelectorAll('[data-tx-type]');
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.txType;
      document.getElementById('tx-type-value').value = type;
      typeBtns.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn);
      });
      // Update category options to match selected type
      const catSelect = document.getElementById('tx-category');
      if (catSelect) catSelect.innerHTML = categoryOptionsHTML(type);
    });
  });

  // Keyboard: Escape
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      close();
    }
  });

  // Form submission
  dialog.querySelector('#add-tx-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit();
  });

  // Confirm button (also catches non-submit clicks)
  dialog.querySelector('#confirm-add-tx')?.addEventListener('click', () => handleSubmit());
}

/* --------------------------------------------------------------- *
 * Form submission
 * --------------------------------------------------------------- */
function handleSubmit() {
  const merchant = document.getElementById('tx-merchant').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const category = document.getElementById('tx-category').value;
  const date = document.getElementById('tx-date').value;
  const type = document.getElementById('tx-type-value').value;

  // Validation
  if (!merchant) {
    showToast('Vui lòng nhập tên người thu.', 'warning');
    document.getElementById('tx-merchant').focus();
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showToast('Vui lòng nhập số tiền hợp lệ.', 'warning');
    document.getElementById('tx-amount').focus();
    return;
  }
  if (!category) {
    showToast('Vui lòng chọn danh mục.', 'warning');
    document.getElementById('tx-category').focus();
    return;
  }
  if (!date) {
    showToast('Vui lòng chọn ngày.', 'warning');
    document.getElementById('tx-date').focus();
    return;
  }

  setFormSaving('loading');

  const newTx = {
    merchant,
    category,
    type,
    date,
    amount: Math.abs(amount),
    status: 'completed',
  };

  // Update budget spent if expense
  if (type === 'expense' && !_isEditing) {
    const budgets = JSON.parse(localStorage.getItem('luxe_budgets') || '[]');
    const bud = budgets.find(b => b.category === category);
    if (bud) {
      bud.spent = Math.min(bud.spent + Math.abs(amount), bud.limit * 1.5);
      localStorage.setItem('luxe_budgets', JSON.stringify(budgets));
    }
  }

  dataService.addTransaction(newTx).then(() => {
    close();
    emit('data:changed');
    showToast(
      `Giao dịch đã thêm: ${formatAmount(newTx.amount, newTx.type)} · ${escapeHtml(newTx.merchant)}`,
      'success'
    );
    setFormSaving('idle');
  });
}

/* --------------------------------------------------------------- *
 * Public API
 * --------------------------------------------------------------- */
export function open() {
  _isEditing = false;
  refreshDialog();
  openModal(MODAL_ID);
}

export function close() {
  closeModal(MODAL_ID);
  _isEditing = false;
}

export function init() {
  // Listen for modal open requests via data attributes (header button, page buttons)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-open-modal]');
    if (btn) {
      e.preventDefault();
      open();
    }
  });
}
