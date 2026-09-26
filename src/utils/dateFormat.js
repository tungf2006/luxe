/**
 * @file Date formatting utilities.
 * Single source of truth for all date display formats across the app.
 */

/**
 * Parse an ISO date string (YYYY-MM-DD) or YYYY-MM into a Date at local midnight.
 * @param {string} dateStr
 * @returns {Date}
 */
function parseDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const iso = dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr
    : dateStr.length >= 10
      ? dateStr.slice(0, 10)
      : dateStr;
  return new Date(`${iso}T00:00:00`);
}

/**
 * @param {Date} date
 * @returns {boolean}
 */
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * @param {Date} date
 * @returns {boolean}
 */
function isYesterday(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

/**
 * Whole-day difference between target date and today (positive = past, negative = future).
 * @param {Date} date
 * @returns {number}
 */
function daysAgo(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((today - target) / (1000 * 60 * 60 * 24));
}

/**
 * Return the relative label for dates within the last 7 days, or null otherwise.
 * @param {string} dateStr — ISO date (YYYY-MM-DD)
 * @returns {string|null} "Hôm nay", "Hôm qua", "3 ngày trước", or null if older/future
 */
function relativeLabel(dateStr) {
  const date = parseDate(dateStr);
  if (isNaN(date)) return null;
  if (isToday(date)) return 'Hôm nay';
  if (isYesterday(date)) return 'Hôm qua';
  const days = daysAgo(date);
  if (days > 0 && days <= 7) return `${days} ngày trước`;
  return null;
}

/**
 * Format date as DD/MM/YYYY — used in tables and forms.
 * @param {string} dateStr — ISO date (YYYY-MM-DD)
 * @returns {string} e.g. "18/09/2026"
 */
export function formatDateShort(dateStr) {
  const date = parseDate(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date as "D tháng M, YYYY" — used for titles, dashboard headers,
 * and as the full-date tooltip for relative labels.
 * @param {string} dateStr — ISO date (YYYY-MM-DD)
 * @returns {string} e.g. "18 tháng 9, 2026"
 */
export function formatDateLong(dateStr) {
  const date = parseDate(dateStr);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day} tháng ${month}, ${year}`;
}

/**
 * Format month and year as "Tháng M, YYYY" — used for goals and filters.
 * @param {string} dateStr — ISO date (YYYY-MM-DD) or YYYY-MM
 * @returns {string} e.g. "Tháng 12, 2026"
 */
export function formatMonthYear(dateStr) {
  const date = parseDate(dateStr);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `Tháng ${month}, ${year}`;
}

/**
 * Format a date for recent transactions (within 7 days).
 * Returns "Hôm nay", "Hôm qua", "X ngày trước".
 * For older or future dates, falls back to the short format (which includes the year).
 * Pair with {@link formatDateLong} in a `title`/tooltip attribute to show the full date.
 * @param {string} dateStr — ISO date (YYYY-MM-DD)
 * @returns {string}
 */
export function formatRelative(dateStr) {
  return relativeLabel(dateStr) || formatDateShort(dateStr);
}

/**
 * Format a date for a sticky group header in the transactions table.
 * Recent dates render as "Hôm nay · 18/09/2026"; older dates render as the long form.
 * @param {string} dateStr — ISO date (YYYY-MM-DD)
 * @returns {string}
 */
export function formatDateGroupHeader(dateStr) {
  const rel = relativeLabel(dateStr);
  if (rel) return `${rel} · ${formatDateShort(dateStr)}`;
  return formatDateLong(dateStr);
}
