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
 * Render the merchant cell (icon + name + optional subtitle).
 * @param {import('../../types/index.js').Transaction} tx
 * @param {boolean} [showSub=false]
 * @returns {string}
 */
export function merchantCellHTML(tx, showSub = false) {
  const icon = getCategoryIcon(tx.category) || CATEGORY_ICONS[tx.category] || '📦';
  const subLabel = showSub ? getCategoryLabelVi(tx.category) || tx.category : '';
  return `
    <div class="merchant-cell">
      <div class="merchant-icon" aria-hidden="true">${icon}</div>
      <div class="merchant-details">
        <span class="merchant-name">${escapeHtml(tx.merchant)}</span>
        ${showSub ? `<span class="merchant-sub">${escapeHtml(subLabel)}</span>` : ''}
      </div>
    </div>
  `;
}

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
 * Render a status badge (completed / pending / failed / cancelled).
 * @param {'completed'|'pending'|'failed'|'cancelled'} status
 * @returns {string}
 */
export function statusBadgeHTML(status) {
  let bg = 'var(--positive-bg)';
  let color = 'var(--positive)';
  let icon = '✓';
  let label = 'Hoàn thành';

  if (status === 'pending') {
    bg = 'var(--warning-bg)';
    color = 'var(--warning)';
    icon = '⏳';
    label = 'Đang chờ';
  } else if (status === 'failed') {
    bg = 'var(--negative-bg)';
    color = 'var(--negative)';
    icon = '✕';
    label = 'Thất bại';
  } else if (status === 'cancelled') {
    bg = 'rgba(255, 255, 255, 0.08)';
    color = 'var(--text-muted)';
    icon = '🚫';
    label = 'Đã huỷ';
  }

  return `
    <span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;font-weight:500;padding:0.2rem 0.65rem;border-radius:var(--radius-full);background:${bg};color:${color};" role="status" aria-label="${label}">
      <span aria-hidden="true">${icon}</span>
      ${escapeHtml(label)}
    </span>
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
 * @returns {string}
 */
export function actionDropdownHTML(id, type = 'tx') {
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
