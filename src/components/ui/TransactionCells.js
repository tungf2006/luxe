/**
 * @file Reusable transaction cell renderers.
 * Shared presentation helpers used by the dashboard recent-transactions table
 * and the full transactions page table.
 *
 * Keeping these in `components/ui/` avoids duplicating markup across features.
 */

import { CATEGORY_ICONS, CATEGORY_MAP, getCategoryIcon, getCategoryLabelVi, getCategoryColor } from '../../constants/categories.js';
import { formatAmount, escapeHtml } from '../../utils/format.js';



/**
 * Render a category tag pill.
 * @param {string} category
 * @returns {string}
 */
export function categoryTagHTML(category) {
  const cat = CATEGORY_MAP[category];
  const color = getCategoryColor(category);
  return `
    <span class="category-tag" style="border-color:rgba(${hexToRgb(color)},0.3);background:rgba(${hexToRgb(color)},0.08);" role="status">
      ${escapeHtml(cat ? cat.labelVi : category)}
    </span>
  `;
}

/**
 * Render a status badge (pending / failed / cancelled).
 * Returns empty string for 'completed' as it is the standard default status.
 * @param {'completed'|'pending'|'failed'|'cancelled'} status
 * @returns {string}
 */
export function statusBadgeHTML(status) {
  if (!status || status === 'completed') {
    return '';
  }

  if (status === 'pending') {
    return `
      <span class="status-badge status-badge-pending" role="status" aria-label="Đang chờ xử lý">
        <span class="status-pulse-dot" aria-hidden="true"></span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Đang chờ</span>
      </span>
    `;
  }

  if (status === 'failed') {
    return `
      <span class="status-badge status-badge-failed" role="status" aria-label="Thất bại">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>Thất bại</span>
      </span>
    `;
  }

  if (status === 'cancelled') {
    return `
      <span class="status-badge status-badge-cancelled" role="status" aria-label="Đã huỷ">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>
        <span>Đã huỷ</span>
      </span>
    `;
  }

  return '';
}

/**
 * Render the merchant cell (icon + name + status badge + optional subtitle).
 * @param {import('../../types/index.js').Transaction} tx
 * @param {boolean} [showSub=false]
 * @returns {string}
 */
export function merchantCellHTML(tx, showSub = false) {
  const icon = getCategoryIcon(tx.category) || CATEGORY_ICONS[tx.category] || '📦';
  const subLabel = showSub ? getCategoryLabelVi(tx.category) || tx.category : '';
  const statusBadge = statusBadgeHTML(tx.status);
  return `
    <div class="merchant-cell">
      <div class="merchant-icon" aria-hidden="true">${icon}</div>
      <div class="merchant-details">
        <div class="merchant-name-line">
          <span class="merchant-name">${escapeHtml(tx.merchant)}</span>
          ${statusBadge}
        </div>
        ${showSub ? `<span class="merchant-sub">${escapeHtml(subLabel)}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render a payment method label (cash / card / transfer / ewallet).
 * @param {'cash'|'card'|'transfer'|'ewallet'} method
 * @returns {string}
 */
export function paymentMethodHTML(method) {
  const map = {
    cash:     { label: 'Tiền mặt',     icon: '💵' },
    card:     { label: 'Thẻ',          icon: '💳' },
    transfer: { label: 'Chuyển khoản', icon: '🏦' },
    ewallet:  { label: 'Ví điện tử',   icon: '📱' },
  };
  const info = map[method] || { label: method || '—', icon: '💳' };
  return `
    <span style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.8rem;color:var(--text-secondary);">
      <span aria-hidden="true">${info.icon}</span>
      <span>${escapeHtml(info.label)}</span>
    </span>
  `;
}

/**
 * Render 3-dots action dropdown menu.
 * @param {string} id - Item ID
 * @param {string} [type='tx'] - 'tx' or 'recurring'
 * @param {string} [status='completed'] - Transaction status
 * @returns {string}
 */
export function actionDropdownHTML(id, type = 'tx', status = 'completed') {
  const retryBtn = status === 'failed' ? `
    <button type="button" class="action-menu-item action-retry" data-action="retry-${type}" data-id="${id}" role="menuitem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
      Thử lại
    </button>
  ` : '';

  const completeBtn = status === 'pending' ? `
    <button type="button" class="action-menu-item action-complete" data-action="complete-${type}" data-id="${id}" role="menuitem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      Xác nhận hoàn thành
    </button>
  ` : '';

  return `
    <div class="action-dropdown" data-id="${id}">
      <button type="button" class="btn-action-trigger" aria-label="Tùy chọn hành động" data-action="toggle-menu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </button>
      <div class="action-dropdown-menu" role="menu">
        ${retryBtn}
        ${completeBtn}
        <button type="button" class="action-menu-item" data-action="view-${type}" data-id="${id}" role="menuitem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          Xem chi tiết
        </button>
        <button type="button" class="action-menu-item" data-action="edit-${type}" data-id="${id}" role="menuitem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Sửa
        </button>
        <button type="button" class="action-menu-item" data-action="duplicate-${type}" data-id="${id}" role="menuitem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Nhân bản
        </button>
        <div class="action-menu-divider"></div>
        <button type="button" class="action-menu-item danger" data-action="delete-${type}" data-id="${id}" role="menuitem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Xoá
        </button>
      </div>
    </div>
  `;
}

/**
 * Render in-place status toggle switch for recurring transactions.
 * @param {string} id
 * @param {boolean} isActive
 * @returns {string}
 */
export function statusToggleHTML(id, isActive) {
  return `
    <label class="switch-toggle" title="${isActive ? 'Đang bật' : 'Đã tắt'}">
      <input type="checkbox" class="recurring-status-toggle" data-id="${id}" ${isActive ? 'checked' : ''} />
      <span class="switch-slider"></span>
    </label>
  `;
}

/**
 * Render a formatted monetary amount with semantic color class.
 * @param {import('../../types/index.js').Transaction} tx
 * @returns {string}
 */
export function amountHTML(tx) {
  const cls = tx.type === 'income' ? 'highlight-positive' : 'highlight-negative';
  return `<td class="table-amount ${cls}">${formatAmount(tx.amount, tx.type)}</td>`;
}

/* ---- internal helpers ---- */
function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}
