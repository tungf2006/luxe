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
  getLocalDateString,
  getLocalMonthString,
  getDayNameVi,
  daysAgoDateString,
  monthsAgoDateString,
} from './dateFormat.js';

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
 * Format a monetary amount with a sign prefix.
 * @param {number|string} amount
 * @param {'income'|'expense'} type
 * @param {string} [currency]
 * @returns {string} e.g. "+$24,580.00" or "-₫24,580"
 */
export function formatAmount(amount, type, currency) {
  const cleanAmount = parseNumber(amount);
  const prefix = type === 'income' ? '+' : '-';
  const formatted = formatCurrency(Math.abs(cleanAmount), currency);
  return prefix + formatted;
}

/**
 * Format a monetary amount with currency symbol using Intl.NumberFormat.
 * VND: vi-VN locale, no decimals, dot thousand separator, "₫" suffix
 * USD: en-US locale, 2 decimals, comma thousand separator, "$" prefix
 * @param {number|string} amount
 * @param {string} [currency] - Currency code (VND, USD, etc.)
 * @returns {string} e.g. "₫24,580" or "$24,580.00"
 */
export function formatCurrency(amount, currency) {
  const cleanAmount = parseNumber(amount);
  const formatter = buildCurrencyFormatter(currency || _currencyCode);
  return formatter.format(Math.abs(cleanAmount));
}

/**
 * Format a large number in compact notation (K, M, B) for display in summary cards and chart axes.
 * Uses Intl.NumberFormat with compact notation.
 * @param {number|string} amount
 * @param {string} [currency] - Currency code for symbol
 * @returns {string} e.g. "₫24.6K" or "$24.6K"
 */
export function formatCompactCurrency(amount, currency) {
  const cleanAmount = parseNumber(amount);
  const code = currency || _currencyCode;

  if (code === 'VND') {
    return formatCompactNumber(cleanAmount) + '₫';
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
    return formatter.format(cleanAmount);
  }
  return formatCompactNumber(cleanAmount) + ' ' + code;
}

/**
 * Format a large number in compact notation without currency symbol.
 * @param {number|string} amount
 * @returns {string} e.g. "24.6K" or "1.2M"
 */
export function formatCompactNumber(amount) {
  const cleanAmount = parseNumber(amount);
  if (cleanAmount === 0 || !isFinite(cleanAmount)) return '0';
  const abs = Math.abs(cleanAmount);
  const sign = cleanAmount < 0 ? '-' : '';
  if (abs >= 1000000) {
    const val = (abs / 1000000);
    const fixed = val.toFixed(1).replace(/.0$/, '');
    return sign + fixed.replace('.', ',') + 'Tr';
  }
  if (abs >= 1000) {
    const val = (abs / 1000);
    const fixed = val.toFixed(1).replace(/.0$/, '');
    return sign + fixed.replace('.', ',') + 'K';
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
  getLocalDateString,
  getLocalMonthString,
  getDayNameVi,
  daysAgoDateString,
  monthsAgoDateString,
};