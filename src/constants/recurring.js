/**
 * @file Recurring transaction constants, presets, and calculation utilities.
 * Single source of truth for recurring transactions across Luxe.
 */

import { getLocalDateString } from '../utils/format.js';

export const RECURRING_FREQUENCIES = [
  {
    id: 'monthly',
    labelVi: 'Hàng tháng',
    labelEn: 'Monthly',
    factor: 1,
    descVi: 'Lặp lại mỗi tháng vào ngày cố định',
  },
  {
    id: 'weekly',
    labelVi: 'Hàng tuần',
    labelEn: 'Weekly',
    factor: 4.345, // ~52 weeks / 12 months
    descVi: 'Lặp lại mỗi tuần vào thứ đã chọn',
  },
  {
    id: 'yearly',
    labelVi: 'Hàng năm',
    labelEn: 'Yearly',
    factor: 1 / 12,
    descVi: 'Lặp lại mỗi năm một lần',
  },
  {
    id: 'daily',
    labelVi: 'Hàng ngày',
    labelEn: 'Daily',
    factor: 30.4375, // average days per month
    descVi: 'Lặp lại mỗi ngày',
  },
];

export const RECURRING_FREQUENCY_MAP = Object.fromEntries(
  RECURRING_FREQUENCIES.map(f => [f.id, f])
);

/**
 * Curated subscription & recurring expense presets popular in Vietnam.
 */
export const RECURRING_PRESETS = [
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'entertainment',
    type: 'expense',
    amount: 260000,
    frequency: 'monthly',
    day_of_month: 1,
    badgeText: '260k / tháng',
  },
  {
    id: 'spotify',
    name: 'Spotify Premium',
    category: 'entertainment',
    type: 'expense',
    amount: 59000,
    frequency: 'monthly',
    day_of_month: 1,
    badgeText: '59k / tháng',
  },
  {
    id: 'icloud',
    name: 'Apple iCloud+ / Google One',
    category: 'entertainment',
    type: 'expense',
    amount: 59000,
    frequency: 'monthly',
    day_of_month: 15,
    badgeText: '59k / tháng',
  },
  {
    id: 'internet',
    name: 'Internet Cáp quang (FPT / VNPT / Viettel)',
    category: 'bills',
    type: 'expense',
    amount: 250000,
    frequency: 'monthly',
    day_of_month: 10,
    badgeText: '250k / tháng',
  },
  {
    id: 'electricity',
    name: 'Tiền điện EVN',
    category: 'bills',
    type: 'expense',
    amount: 750000,
    frequency: 'monthly',
    day_of_month: 15,
    badgeText: '~750k / tháng',
  },
  {
    id: 'water',
    name: 'Tiền nước sinh hoạt',
    category: 'bills',
    type: 'expense',
    amount: 150000,
    frequency: 'monthly',
    day_of_month: 20,
    badgeText: '~150k / tháng',
  },
  {
    id: 'rent',
    name: 'Tiền thuê căn hộ / nhà ở',
    category: 'bills',
    type: 'expense',
    amount: 5000000,
    frequency: 'monthly',
    day_of_month: 5,
    badgeText: '5 tr / tháng',
  },
  {
    id: 'gym',
    name: 'Gói tập Gym / Yoga',
    category: 'health',
    type: 'expense',
    amount: 500000,
    frequency: 'monthly',
    day_of_month: 1,
    badgeText: '500k / tháng',
  },
  {
    id: 'salary',
    name: 'Lương cố định hàng tháng',
    category: 'income',
    type: 'income',
    amount: 25000000,
    frequency: 'monthly',
    day_of_month: 5,
    badgeText: '+25 tr / tháng',
  },
];

/**
 * Calculate the next due date based on frequency and schedule parameters.
 * @param {string} frequency - 'monthly' | 'weekly' | 'yearly' | 'daily'
 * @param {number|null} [dayOfMonth=null] - 1 to 31
 * @param {number|null} [dayOfWeek=null] - 0 (Sun) to 6 (Sat)
 * @param {Date} [baseDate=new Date()]
 * @returns {string} ISO Date (YYYY-MM-DD)
 */
export function calculateNextDueDate(frequency, dayOfMonth = null, dayOfWeek = null, baseDate = new Date()) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);

  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  }

  if (frequency === 'weekly') {
    const targetDay = Number.isInteger(dayOfWeek) ? dayOfWeek : d.getDay();
    let diff = (targetDay - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // schedule for next week
    d.setDate(d.getDate() + diff);
    return getLocalDateString(d);
  }

  if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
    return getLocalDateString(d);
  }

  // Monthly
  const currentDay = d.getDate();
  const targetDay = dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31 ? dayOfMonth : currentDay;

  // Days in current month
  const daysInCurrentMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const clampedDayThisMonth = Math.min(targetDay, daysInCurrentMonth);

  if (clampedDayThisMonth > currentDay) {
    d.setDate(clampedDayThisMonth);
  } else {
    // Move to next month
    d.setMonth(d.getMonth() + 1);
    const daysInNextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(targetDay, daysInNextMonth));
  }

  return getLocalDateString(d);
}

/**
 * Calculate normalized monthly equivalent amount.
 * @param {number} amount
 * @param {string} frequency
 * @returns {number}
 */
export function calculateMonthlyEquivalent(amount, frequency) {
  const num = Number(amount) || 0;
  const config = RECURRING_FREQUENCY_MAP[frequency];
  if (!config) return num;
  return Math.round(num * config.factor);
}

/**
 * Calculate annual equivalent amount.
 * @param {number} amount
 * @param {string} frequency
 * @returns {number}
 */
export function calculateAnnualEquivalent(amount, frequency) {
  return calculateMonthlyEquivalent(amount, frequency) * 12;
}
