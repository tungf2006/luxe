/**
 * @file Reusable transaction cell renderers.
 * Shared presentation helpers used by the dashboard recent-transactions table
 * and the full transactions page table.
 *
 * Keeping these in `components/ui/` avoids duplicating markup across features.
 */

import { CATEGORY_ICONS, CATEGORY_MAP } from '../../constants/categories.js';
import { formatAmount, escapeHtml } from '../../utils/format.js';

/**
 * Render the merchant cell (icon + name + optional subtitle).
 * @param {import('../../types/index.js').Transaction} tx
 * @param {boolean} [showSub=false]
 * @returns {string}
 */
export function merchantCellHTML(tx, showSub = false) {
  const icon = CATEGORY_ICONS[tx.category] || '📦';
  return `
    <div class="merchant-cell">
      <div class="merchant-icon" aria-hidden="true">${icon}</div>
      <div class="merchant-details">
        <span class="merchant-name">${escapeHtml(tx.merchant)}</span>
        ${showSub ? `<span class="merchant-sub">${escapeHtml(tx.category)}</span>` : ''}
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
  const color = cat?.color || '#64748B';
  return `
    <span class="category-tag" style="border-color:rgba(${hexToRgb(color)},0.3);background:rgba(${hexToRgb(color)},0.08);">
      ${escapeHtml(category)}
    </span>
  `;
}

/**
 * Render a status badge (completed / pending).
 * @param {'completed'|'pending'} status
 * @returns {string}
 */
export function statusBadgeHTML(status) {
  const cls = status === 'completed' ? 'var(--positive-bg)' : 'var(--warning-bg)';
  const color = status === 'completed' ? 'var(--positive)' : 'var(--warning)';
  const icon = status === 'completed' ? '✓' : '⏳';
  const label = status === 'completed' ? 'Hoàn thành' : 'Đang xử lý';
  return `
    <span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;font-weight:500;padding:0.2rem 0.6rem;border-radius:var(--radius-full);background:${cls};color:${color};">
      ${icon} ${escapeHtml(label)}
    </span>
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
