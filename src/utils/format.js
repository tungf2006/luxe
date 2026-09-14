/**
 * @file Formatting and parsing utilities.
 * Zero-dependency helpers shared across all features.
 */

const CURRENCY_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a monetary amount with a sign prefix.
 * @param {number} amount
 * @param {'income'|'expense'} type
 * @returns {string} e.g. "+$6,420" or "-$3,280"
 */
export function formatAmount(amount, type) {
  const prefix = type === 'income' ? '+' : '-';
  return prefix + CURRENCY_FORMATTER.format(Math.abs(amount));
}

/**
 * Format a monetary amount without currency symbol.
 * @param {number} amount
 * @returns {string} e.g. "$24,580.00"
 */
export function formatCurrency(amount) {
  const f = new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', minimumFractionDigits: 0,
  });
  return f.format(Math.abs(amount));
}

/**
 * Format a date string to a human-readable relative or absolute label.
 * @param {string} dateStr  ISO date string (YYYY-MM-DD)
 * @returns {string}
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hôm nay';
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
}

/**
 * Format a percentage value.
 * @param {number} value  e.g. 48.9
 * @param {boolean} [addPp=false]  Append 'pp' for percentage-point deltas
 * @returns {string} e.g. "48.9%" or "+3.2pp"
 */
export function formatPercent(value, addPp = false) {
  const suffix = addPp ? 'pp' : '%';
  return `${value >= 0 ? '+' : ''}${value}${suffix}`;
}

/**
 * Escape HTML special characters to prevent XSS in template strings.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a simple unique id.
 * @returns {string}
 */
export function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
}

/**
 * Capitalise the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get the trend direction label based on current vs previous value.
 * @param {number} current
 * @param {number} previous
 * @returns {{direction:'up'|'down'|'flat', change:number}}
 */
export function getTrend(current, previous) {
  if (previous === 0) {
    return current > 0 ? { direction: 'up', change: 100 } : { direction: 'down', change: 0 };
  }
  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return { direction, change: Number(change.toFixed(1)) };
}
