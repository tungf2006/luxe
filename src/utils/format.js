/**
 * @file Formatting and parsing utilities.
 * Zero-dependency helpers shared across all features.
 */

import {
  formatDateShort,
  formatDateLong,
  formatMonthYear,
  formatRelative,
  formatDateGroupHeader,
  getRecentDateGroupLabel,
  getLocalDateString,
  getLocalMonthString,
  getDayNameVi,
  daysAgoDateString,
  monthsAgoDateString,
} from './dateFormat.js';

/**
 * Remove Vietnamese accents and convert to lowercase for robust fuzzy search and matching.
 * @param {string} str
 * @returns {string}
 */
export function removeDiacritics(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

let _currencyCode = 'VND';

function buildCurrencyFormatter(code) {
  if (code === 'VND') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  if (code === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function setActiveCurrency(code) {
  if (typeof code === 'string' && code) _currencyCode = code;
}

export function getActiveCurrency() {
  return _currencyCode;
}

/**
 * Safely parse a numeric value from numbers, strings (including those with thousand separators),
 * null, or undefined.
 * @param {any} val
 * @returns {number}
 */
export function parseNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? 0 : val;
  }
  if (typeof val === 'string') {
    let cleaned = val.trim();
    if (!cleaned) return 0;

    cleaned = cleaned.replace(/[^\d.,\-]/g, '');
    if (!cleaned) return 0;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasComma) {
      const parts = cleaned.split(',');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        cleaned = cleaned.replace(/,/g, '');
      } else {
        cleaned = cleaned.replace(',', '.');
      }
    } else if (hasDot) {
      const parts = cleaned.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)) {
        cleaned = cleaned.replace(/\./g, '');
      }
    }

    const num = parseFloat(cleaned);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  }
  return 0;
}

/**
 * Parse monetary inputs in various Vietnamese shorthands and formats.
 * Supports:
 * - Direct numbers or standard formatted strings: 50000, 50.000, 50,000
 * - Thousand shorthands: 50k, 50K, 50n, 50 nghìn
 * - Million shorthands: 1,5tr, 1.5tr, 1,5m, 1.5 triệu, 2tr5, 2m5
 * - Billion shorthands: 1,25 tỷ, 1.25 tỷ, 1,25ty, 1.25b, 2tỷ5
 * - Signed values: -50k, +1,5tr
 * Always returns an integer (rounded), never decimal fractions for VND.
 *
 * @param {any} val
 * @returns {number} Integer VND
 */
export function parseVndInput(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? 0 : Math.round(val);
  }
  let str = String(val).trim().toLowerCase();
  if (!str) return 0;

  let isNegative = false;
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.startsWith('+')) {
    str = str.slice(1).trim();
  }

  // Remove currency symbols and normalize spaces
  str = str.replace(/[₫đvnd]/g, '').replace(/\s+/g, '');
  if (!str) return 0;

  // 1. Composite formats like '2tr5', '2m5', '2tỷ5', '2ty5'
  const compositeTr = str.match(/^(\d+)(?:tr|m|trieu)(\d+)$/);
  if (compositeTr) {
    const whole = parseInt(compositeTr[1], 10);
    const frac = compositeTr[2];
    const decimal = whole + parseFloat(`0.${frac}`);
    const res = Math.round(decimal * 1000000);
    return isNegative ? -res : res;
  }

  const compositeTy = str.match(/^(\d+)(?:ty|tỷ|b)(\d+)$/);
  if (compositeTy) {
    const whole = parseInt(compositeTy[1], 10);
    const frac = compositeTy[2];
    const decimal = whole + parseFloat(`0.${frac}`);
    const res = Math.round(decimal * 1000000000);
    return isNegative ? -res : res;
  }

  // 2. Multiplier suffixes
  if (/(?:ty|tỷ|b)$/.test(str)) {
    const numPart = str.replace(/(?:ty|tỷ|b)$/, '').replace(/,/g, '.');
    const num = parseFloat(numPart);
    if (!isNaN(num) && isFinite(num)) {
      const res = Math.round(num * 1000000000);
      return isNegative ? -res : res;
    }
  }

  if (/(?:tr|m|trieu)$/.test(str)) {
    const numPart = str.replace(/(?:tr|m|trieu)$/, '').replace(/,/g, '.');
    const num = parseFloat(numPart);
    if (!isNaN(num) && isFinite(num)) {
      const res = Math.round(num * 1000000);
      return isNegative ? -res : res;
    }
  }

  if (/(?:k|n|nghin)$/.test(str)) {
    const numPart = str.replace(/(?:k|n|nghin)$/, '').replace(/,/g, '.');
    const num = parseFloat(numPart);
    if (!isNaN(num) && isFinite(num)) {
      const res = Math.round(num * 1000);
      return isNegative ? -res : res;
    }
  }

  // 3. Fallback to standard parseNumber
  const parsed = parseNumber(isNegative ? `-${str}` : str);
  return Math.round(parsed);
}

/**
 * Format a monetary amount with a sign prefix.
 * @param {number|string} amount
 * @param {'income'|'expense'|'transfer'|'refund'} type
 * @param {string} [currency]
 * @returns {string} e.g. "+24.580 đ" or "24.580 đ"
 */
export function formatAmount(amount, type, currency, options = {}) {
  let curr = currency;
  let opts = options;
  if (typeof currency === 'object' && currency !== null) {
    opts = currency;
    curr = opts.currency || _currencyCode;
  }
  const cleanAmount = parseNumber(amount);
  let prefix = '-';
  if (type === 'income' || type === 'refund') {
    prefix = '+';
  } else if (type === 'transfer') {
    prefix = '';
  }
  const formatted = formatCurrency(Math.abs(cleanAmount), curr, opts);
  return prefix + formatted;
}

/**
 * Check if a transaction is void (failed or cancelled).
 * @param {Object} tx
 * @returns {boolean}
 */
export function isVoidTransaction(tx) {
  if (!tx) return false;
  return tx.isVoid === true || tx.status === 'failed' || tx.status === 'cancelled';
}

/**
 * Resolve semantic transaction type: 'income' | 'expense' | 'transfer' | 'refund'.
 * Incorporates approved heuristic detection for legacy transactions without type='transfer':
 * e.g., payment_method='transfer' with keywords like 'tiết kiệm', 'chuyển khoản', 'gửi góp', 'nạp tiền'.
 * @param {Object} tx
 * @returns {'income'|'expense'|'transfer'|'refund'}
 */
export function getTransactionType(tx) {
  if (!tx) return 'expense';
  if (tx.type === 'transfer' || tx.category === 'transfer' || tx.isTransfer) return 'transfer';
  if (tx.type === 'refund' || tx.category === 'refund') return 'refund';
  if (tx.type === 'income' || tx.category === 'income') return 'income';

  // Approved heuristic detection for legacy data
  const merchant = (tx.merchant || '').toLowerCase();
  const isTransferKeyword = /tiết kiệm|gửi góp|chuyển khoản|chuyển tiền|nạp tiền|rút tiền/i.test(merchant);
  if (tx.payment_method === 'transfer' && isTransferKeyword) {
    return 'transfer';
  }

  return 'expense';
}

/**
 * Return friendly localized label for transaction type.
 * @param {'income'|'expense'|'transfer'|'refund'} type
 * @returns {string}
 */
export function getTransactionTypeLabel(type) {
  switch (type) {
    case 'income': return 'Thu nhập';
    case 'expense': return 'Chi phí';
    case 'transfer': return 'Chuyển khoản';
    case 'refund': return 'Hoàn tiền';
    default: return 'Chi phí';
  }
}

/**
 * Return semantic CSS class for transaction amount:
 * 'amount-void' (gray with strikethrough), 'highlight-positive' (green), 'highlight-neutral', 'highlight-negative' (red).
 * @param {Object} tx
 * @returns {string}
 */
export function getTransactionAmountClass(tx) {
  if (isVoidTransaction(tx)) {
    return 'amount-void';
  }
  const type = getTransactionType(tx);
  if (type === 'income' || type === 'refund') {
    return 'highlight-positive';
  }
  if (type === 'transfer') {
    return 'highlight-neutral';
  }
  return 'highlight-negative';
}

/**
 * Format a monetary amount with currency symbol using Intl.NumberFormat.
 * VND: vi-VN locale, no decimals, dot thousand separator, non-breaking space + "đ" suffix
 * USD: en-US locale, 2 decimals, comma thousand separator, "$" prefix
 * @param {number|string} amount
 * @param {string|Object} [currency] - Currency code (VND, USD, etc.) or options object
 * @param {Object} [options]
 * @param {boolean} [options.asHtml=false] - When true, wraps currency symbol in <span class="currency-symbol">
 * @returns {string} e.g. "1.500 đ" or "$1,500.00"
 */
export function formatCurrency(amount, currency, options = {}) {
  let curr = currency;
  let opts = options;
  if (typeof currency === 'object' && currency !== null) {
    opts = currency;
    curr = opts.currency || _currencyCode;
  }
  const cleanAmount = parseNumber(amount);
  const code = curr || _currencyCode;
  const isNegative = cleanAmount < 0;
  const absAmount = Math.abs(cleanAmount);

  if (code === 'VND') {
    const formatted = new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(Math.round(absAmount));
    const sign = isNegative ? '-' : '';
    if (opts.asHtml) {
      return `${sign}${formatted}\u00A0<span class="currency-symbol">đ</span>`;
    }
    return `${sign}${formatted}\u00A0đ`;
  }
  if (code === 'USD') {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formatted = formatter.format(absAmount);
    const sign = isNegative ? '-' : '';
    if (opts.asHtml) {
      return `${sign}<span class="currency-symbol">$</span>${formatted.replace('$', '')}`;
    }
    return `${sign}${formatted}`;
  }
  const formatter = buildCurrencyFormatter(code);
  const formatted = formatter.format(absAmount);
  const sign = isNegative ? '-' : '';
  return `${sign}${formatted.replace(/₫/g, 'đ')}`;
}

/**
 * Format a large number in compact notation (K, M, B) for display in summary cards and chart axes.
 * Supports title tooltip with full formatted value when used in UI.
 * @param {number|string} amount
 * @param {string|Object} [currency]
 * @param {Object} [options]
 * @param {boolean} [options.asHtml=false]
 * @returns {string} e.g. "24,6K đ" or `<span class="compact-amount" title="24.600 đ">24,6K <span class="currency-symbol">đ</span></span>`
 */
export function formatCompact(amount, currency = _currencyCode, options = {}) {
  let curr = currency;
  let opts = options;
  if (typeof currency === 'object' && currency !== null) {
    opts = currency;
    curr = opts.currency || _currencyCode;
  }
  const cleanAmount = parseNumber(amount);
  const code = curr || _currencyCode;
  const compactStr = formatCompactNumber(cleanAmount);

  if (code === 'VND') {
    if (opts.asHtml) {
      const full = formatCurrency(cleanAmount, 'VND');
      return `<span class="compact-amount" title="${full}">${compactStr}\u00A0<span class="currency-symbol">đ</span></span>`;
    }
    return `${compactStr}\u00A0đ`;
  }
  if (code === 'USD') {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      compactDisplay: 'short',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const formatted = formatter.format(cleanAmount);
    if (opts.asHtml) {
      const full = formatCurrency(cleanAmount, 'USD');
      return `<span class="compact-amount" title="${full}">${formatted}</span>`;
    }
    return formatted;
  }
  if (opts.asHtml) {
    const full = formatCurrency(cleanAmount, code);
    return `<span class="compact-amount" title="${full}">${compactStr}\u00A0${code}</span>`;
  }
  return `${compactStr}\u00A0${code}`;
}

/**
 * Backward compatibility alias for formatCompact.
 */
export function formatCompactCurrency(amount, currency, options) {
  return formatCompact(amount, currency, options);
}

/**
 * Format a large number in compact notation without currency symbol.
 * Formats according to Vietnamese conventions:
 * - < 1.000: integer
 * - 1.000 - < 1.000.000: 499K
 * - 1.000.000 - < 1.000.000.000: 24,6 tr
 * - >= 1.000.000.000: 1,25 tỷ
 *
 * @param {number|string} amount
 * @returns {string} e.g. "24,6 tr" or "499K" or "1,25 tỷ"
 */
export function formatCompactNumber(amount) {
  const cleanAmount = parseNumber(amount);
  if (cleanAmount === 0 || !isFinite(cleanAmount)) return '0';
  const abs = Math.abs(cleanAmount);
  const sign = cleanAmount < 0 ? '-' : '';

  if (abs >= 1000000000) {
    const val = abs / 1000000000;
    const fixed = parseFloat(val.toFixed(2)).toString().replace('.', ',');
    return `${sign}${fixed} tỷ`;
  }
  if (abs >= 1000000) {
    const val = abs / 1000000;
    const fixed = parseFloat(val.toFixed(2)).toString().replace('.', ',');
    return `${sign}${fixed} tr`;
  }
  if (abs >= 1000) {
    const val = abs / 1000;
    const fixed = parseFloat(val.toFixed(1)).toString().replace('.', ',');
    return `${sign}${fixed}K`;
  }
  return sign + Math.round(abs).toString();
}

/**
 * Format a large number in compact spelled-out text (e.g. "1,25 triệu VND" or "1.25 million USD").
 * @param {number|string} amount
 * @param {string} [currency]
 * @returns {string}
 */
export function formatSpelledAmount(amount, currency) {
  const cleanAmount = parseNumber(amount);
  if (!cleanAmount || cleanAmount < 1000) return '';
  const code = currency || _currencyCode;
  const abs = Math.abs(cleanAmount);

  if (code === 'VND') {
    if (abs >= 1000000000) {
      const val = abs / 1000000000;
      const formatted = Number(val.toFixed(2)).toLocaleString('vi-VN');
      return `≈ ${formatted} tỷ VND`;
    }
    if (abs >= 1000000) {
      const val = abs / 1000000;
      const formatted = Number(val.toFixed(2)).toLocaleString('vi-VN');
      return `≈ ${formatted} triệu VND`;
    }
    if (abs >= 1000) {
      const val = abs / 1000;
      const formatted = Number(val.toFixed(2)).toLocaleString('vi-VN');
      return `≈ ${formatted} nghìn VND`;
    }
  }

  // USD and other currencies
  if (abs >= 1000000000) {
    const val = abs / 1000000000;
    const formatted = Number(val.toFixed(2)).toLocaleString('en-US');
    return `≈ ${formatted} billion ${code}`;
  }
  if (abs >= 1000000) {
    const val = abs / 1000000;
    const formatted = Number(val.toFixed(2)).toLocaleString('en-US');
    return `≈ ${formatted} million ${code}`;
  }
  if (abs >= 1000) {
    const val = abs / 1000;
    const formatted = Number(val.toFixed(2)).toLocaleString('en-US');
    return `≈ ${formatted} thousand ${code}`;
  }
  return '';
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
  // Return null when there is no prior data to compare against.
  // This covers both a missing value (null/undefined) and a zero baseline —
  // a zero prior makes percentage change undefined (division by zero), which
  // previously leaked a misleading "+100%" marker. Callers should render a
  // "no comparison data" fallback instead.
  if (previous == null || previous === 0 || isNaN(previous)) {
    return null;
  }
  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return { direction, change: Number(change.toFixed(1)) };
}

/**
 * Format a date string to a human-readable relative or absolute label.
 * @param {string} dateStr  ISO date string (YYYY-MM-DD)
 * @returns {string}
 * @deprecated Use formatRelative, formatDateShort, formatDateLong, or formatMonthYear from dateFormat.js
 */
export function formatDate(dateStr) {
  return formatRelative(dateStr);
}

/**
 * Re-exports from dateFormat.js for backward compatibility and convenience.
 */
export {
  formatDateShort,
  formatDateLong,
  formatMonthYear,
  formatRelative,
  formatDateGroupHeader,
  getRecentDateGroupLabel,
  getLocalDateString,
  getLocalMonthString,
  getDayNameVi,
  daysAgoDateString,
  monthsAgoDateString,
};