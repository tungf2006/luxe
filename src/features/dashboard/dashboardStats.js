/**
 * @file Unified dashboard statistics selector.
 * Provides a single source of truth for all dashboard widgets:
 * KPI cards, spending chart, recent transactions, budget progress, and insights.
 */

import dataService from '../../services/dataService.js';
import { getLocalDateString, getLocalMonthString, parseNumber, getTransactionType } from '../../utils/format.js';
import { CATEGORIES, EXPENSE_CATEGORIES } from '../../constants/categories.js';

/**
 * Normalize any date input (ISO string, YYYY-MM-DD, Date object) to YYYY-MM-DD in Vietnam timezone (UTC+7).
 * Ensures transactions with times like 23:30 VN remain safely on the local date.
 * @param {string|Date} dateInput
 * @returns {string} e.g. '2026-10-06'
 */
export function normalizeDate(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return getLocalDateString(d);
  }
}

/**
 * Calculate the previous comparison date range matching the number of elapsed days.
 * E.g., for thisMonth (01–06/10/2026), compare against 01–06/09/2026 (same 6 days elapsed).
 *
 * @param {Object} params
 * @param {string} params.from - Current period start date (YYYY-MM-DD)
 * @param {string} params.to - Current period end date (YYYY-MM-DD)
 * @param {string} [params.period='thisMonth'] - 'thisMonth' | 'last7' | 'lastMonth' | 'custom'
 * @returns {{ from: string, to: string, days: number, label: string }}
 */
export function getComparisonRange({ from, to, period = 'thisMonth' } = {}) {
  const pad = (n) => String(n).padStart(2, '0');
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const startMs = new Date(y1, m1 - 1, d1).getTime();
  const endMs = new Date(y2, m2 - 1, d2).getTime();
  const days = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

  let prevFrom = '';
  let prevTo = '';

  if (period === 'thisMonth') {
    // Same elapsed days in previous month: 01–06/10 -> 01–06/09
    const prevYear = m1 === 1 ? y1 - 1 : y1;
    const prevMonth = m1 === 1 ? 12 : m1 - 1;
    const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

    prevFrom = `${prevYear}-${pad(prevMonth)}-01`;
    const targetDay = Math.min(d2, lastDayOfPrevMonth);
    prevTo = `${prevYear}-${pad(prevMonth)}-${pad(targetDay)}`;
  } else if (period === 'lastMonth') {
    // Entire prior month
    const prevYear = m1 === 1 ? y1 - 1 : y1;
    const prevMonth = m1 === 1 ? 12 : m1 - 1;
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    prevFrom = `${prevYear}-${pad(prevMonth)}-01`;
    prevTo = `${prevYear}-${pad(prevMonth)}-${pad(lastDay)}`;
  } else {
    // 'last7' or 'custom' -> contiguous preceding block of equal duration
    const pEndDate = new Date(y1, m1 - 1, d1);
    pEndDate.setDate(pEndDate.getDate() - 1);
    const pStartDate = new Date(pEndDate);
    pStartDate.setDate(pStartDate.getDate() - (days - 1));

    prevTo = getLocalDateString(pEndDate);
    prevFrom = getLocalDateString(pStartDate);
  }

  const [py1, pm1, pd1] = prevFrom.split('-').map(Number);
  const [py2, pm2, pd2] = prevTo.split('-').map(Number);
  const pStartMs = new Date(py1, pm1 - 1, pd1).getTime();
  const pEndMs = new Date(py2, pm2 - 1, pd2).getTime();
  const prevDays = Math.max(1, Math.round((pEndMs - pStartMs) / 86400000) + 1);

  let label = '';
  if (py1 === py2 && pm1 === pm2) {
    label = `${pad(pd1)}–${pad(pd2)}/${pad(pm1)}/${py1}`;
  } else if (py1 === py2) {
    label = `${pad(pd1)}/${pad(pm1)} – ${pad(pd2)}/${pad(pm2)}/${py1}`;
  } else {
    label = `${pad(pd1)}/${pad(pm1)}/${py1} – ${pad(pd2)}/${pad(pm2)}/${py2}`;
  }

  return {
    from: prevFrom,
    to: prevTo,
    days: prevDays,
    label: `${label} · ${prevDays} ngày`,
  };
}

/**
 * Calculate delta between current and previous period.
 * Returns null if prev === 0 or elapsed days < 7 to prevent meaningless numbers (e.g. -106.7% or -100pp).
 *
 * @param {number} cur - Current period metric value
 * @param {number} prev - Previous period metric value
 * @param {Object} [options]
 * @param {number} [options.days=0] - Number of days in current period
 * @param {boolean} [options.isPercentagePoint=false] - If true, returns difference in percentage points (pp)
 * @returns {{ change: number, direction: 'up'|'down'|'flat', value: number }|null}
 */
export function getDelta(cur, prev, { days = 0, isPercentagePoint = false } = {}) {
  if (days < 7 || prev == null || prev === 0 || cur == null || isNaN(cur) || isNaN(prev)) {
    return null;
  }

  let change = 0;
  if (isPercentagePoint) {
    change = Number((cur - prev).toFixed(1));
  } else {
    change = Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(1));
  }

  let direction = 'flat';
  if (change > 0) direction = 'up';
  else if (change < 0) direction = 'down';

  return {
    change,
    direction,
    value: change,
  };
}

/**
 * Internal computation of financial metrics for a specific date range [fromStr, toStr].
 */
function computeStatsForDateRange(rawTx, fromStr, toStr, rawAccounts, rawBudgets) {
  let totalIncome = 0;
  let totalExpense = 0;
  let pendingIncome = 0;
  let pendingExpense = 0;

  const counts = {
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    cancelled: 0,
    income: 0,
    expense: 0,
  };

  const categorySpending = new Map();
  const dailyMap = new Map();

  for (const tx of rawTx || []) {
    if (!tx) continue;

    const txDate = normalizeDate(tx.date);
    if (!txDate) continue;

    if (fromStr && txDate < fromStr) continue;
    if (toStr && txDate > toStr) continue;

    counts.total++;

    const status = tx.status || 'completed';
    if (status === 'failed') {
      counts.failed++;
      continue;
    }
    if (status === 'cancelled') {
      counts.cancelled++;
      continue;
    }

    if (status === 'pending') {
      counts.pending++;
    } else {
      counts.completed++;
    }

    const semType = getTransactionType(tx);

    // Rule: transfer is excluded from income / expense and byCategory
    if (semType === 'transfer') {
      continue;
    }

    const amt = parseNumber(tx.amount);
    if (amt <= 0) continue;

    // Rule: refund reduces expense
    if (semType === 'refund') {
      totalExpense = Math.max(0, totalExpense - amt);
      const cat = tx.category || 'other';
      const cur = categorySpending.get(cat) || { spent: 0, pending: 0 };
      cur.spent = Math.max(0, cur.spent - amt);
      categorySpending.set(cat, cur);

      const dayData = dailyMap.get(txDate) || { income: 0, expense: 0 };
      dayData.expense = Math.max(0, dayData.expense - amt);
      dailyMap.set(txDate, dayData);
      continue;
    }

    if (semType === 'income') {
      counts.income++;
      totalIncome += amt;
      if (status === 'pending') pendingIncome += amt;

      const dayData = dailyMap.get(txDate) || { income: 0, expense: 0 };
      dayData.income += amt;
      dailyMap.set(txDate, dayData);
    } else {
      counts.expense++;
      totalExpense += amt;
      if (status === 'pending') pendingExpense += amt;

      const cat = tx.category || 'other';
      const cur = categorySpending.get(cat) || { spent: 0, pending: 0 };
      cur.spent += amt;
      if (status === 'pending') {
        cur.pending += amt;
      }
      categorySpending.set(cat, cur);

      const dayData = dailyMap.get(txDate) || { income: 0, expense: 0 };
      dayData.expense += amt;
      dailyMap.set(txDate, dayData);
    }
  }

  const net = totalIncome - totalExpense;
  const balance = (rawAccounts || []).reduce((sum, a) => sum + parseNumber(a.balance), 0);
  const savingsRate = totalIncome > 0
    ? Number(((totalIncome - totalExpense) / totalIncome * 100).toFixed(1))
    : 0;

  const budgetMap = new Map((rawBudgets || []).map(b => [b.category, parseNumber(b.limit)]));
  const categoryIds = new Set(EXPENSE_CATEGORIES.map(c => c.id));
  for (const b of (rawBudgets || [])) {
    if (b.category) categoryIds.add(b.category);
  }
  for (const catId of categorySpending.keys()) {
    categoryIds.add(catId);
  }

  const byCategory = Array.from(categoryIds).map(categoryId => {
    const data = categorySpending.get(categoryId) || { spent: 0, pending: 0 };
    return {
      categoryId,
      spent: data.spent,
      pending: data.pending,
      budget: budgetMap.get(categoryId) || 0,
    };
  }).sort((a, b) => {
    const ai = CATEGORIES.findIndex(c => c.id === a.categoryId);
    const bi = CATEGORIES.findIndex(c => c.id === b.categoryId);
    if (ai === -1 && bi === -1) return b.spent - a.spent;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const daily = [];
  if (fromStr && toStr && fromStr <= toStr) {
    const start = new Date(`${fromStr}T00:00:00`);
    const end = new Date(`${toStr}T00:00:00`);
    const daySpan = Math.min(365, Math.max(1, Math.round((end - start) / 86400000) + 1));

    for (let i = 0; i < daySpan; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const curKey = getLocalDateString(cur);
      if (curKey > toStr) break;
      const entry = dailyMap.get(curKey) || { income: 0, expense: 0 };
      daily.push({
        date: curKey,
        income: entry.income,
        expense: entry.expense,
      });
    }
  }

  return {
    income: totalIncome,
    expense: totalExpense,
    pendingIncome,
    pendingExpense,
    net,
    balance,
    savingsRate,
    byCategory,
    daily,
    counts,
  };
}

/**
 * Calculate unified financial statistics for the dashboard within a date range [from, to],
 * with comparative metrics (prev period with equal elapsed days and meaningful deltas).
 *
 * @param {Object} [params]
 * @param {string} [params.from] - Start date (YYYY-MM-DD), defaults to start of current month
 * @param {string} [params.to] - End date (YYYY-MM-DD), defaults to today
 * @param {'thisMonth'|'last7'|'lastMonth'|'custom'} [params.period='thisMonth']
 * @param {Array<Object>} [params.transactions] - Optional pre-loaded transactions
 * @param {Array<Object>} [params.budgets] - Optional pre-loaded budgets
 * @param {Array<Object>} [params.accounts] - Optional pre-loaded accounts
 * @returns {Promise<{
 *   income: number,
 *   expense: number,
 *   net: number,
 *   balance: number,
 *   savingsRate: number,
 *   byCategory: Array<{ categoryId: string, spent: number, pending: number, budget: number }>,
 *   daily: Array<{ date: string, income: number, expense: number }>,
 *   counts: Object,
 *   range: { from: string, to: string, days: number, period: string },
 *   prev: { from: string, to: string, days: number, label: string, income: number, expense: number, net: number, balance: number, savingsRate: number },
 *   deltas: { income: Object|null, expense: Object|null, net: Object|null, savingsRate: Object|null }
 * }>}
 */
export async function getDashboardStats({
  from,
  to,
  period = 'thisMonth',
  transactions,
  budgets,
  accounts,
} = {}) {
  const [rawTx, rawBudgets, rawAccounts] = await Promise.all([
    transactions ? Promise.resolve(transactions) : dataService.getTransactions(),
    budgets ? Promise.resolve(budgets) : dataService.getBudgets(),
    accounts ? Promise.resolve(accounts) : dataService.getAccounts(),
  ]);

  const now = new Date();
  const currentMonthStr = getLocalMonthString(now);
  const defaultFrom = `${currentMonthStr}-01`;
  const defaultTo = getLocalDateString(now);

  const fromDateStr = from ? normalizeDate(from) : defaultFrom;
  const toDateStr = to ? normalizeDate(to) : defaultTo;

  const [y1, m1, d1] = fromDateStr.split('-').map(Number);
  const [y2, m2, d2] = toDateStr.split('-').map(Number);
  const startMs = new Date(y1, m1 - 1, d1).getTime();
  const endMs = new Date(y2, m2 - 1, d2).getTime();
  const days = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

  // 1. Current stats
  const curStats = computeStatsForDateRange(rawTx, fromDateStr, toDateStr, rawAccounts, rawBudgets);

  // 2. Previous range & stats
  const prevRange = getComparisonRange({ from: fromDateStr, to: toDateStr, period });
  const prevStats = computeStatsForDateRange(rawTx, prevRange.from, prevRange.to, rawAccounts, rawBudgets);

  // 3. Meaningful deltas
  const deltas = {
    income: getDelta(curStats.income, prevStats.income, { days }),
    expense: getDelta(curStats.expense, prevStats.expense, { days }),
    net: getDelta(curStats.net, prevStats.net, { days }),
    savingsRate: getDelta(curStats.savingsRate, prevStats.savingsRate, { days, isPercentagePoint: true }),
  };

  const hasTransactions = Array.isArray(rawTx) && rawTx.length > 0;
  const isEmpty = !hasTransactions;

  return {
    ...curStats,
    hasTransactions,
    isEmpty,
    range: {
      from: fromDateStr,
      to: toDateStr,
      days,
      period,
    },
    prev: {
      from: prevRange.from,
      to: prevRange.to,
      days: prevRange.days,
      label: prevRange.label,
      income: prevStats.income,
      expense: prevStats.expense,
      net: prevStats.net,
      balance: prevStats.balance,
      savingsRate: prevStats.savingsRate,
    },
    deltas,
  };
}

export default {
  getDashboardStats,
  normalizeDate,
  getComparisonRange,
  getDelta,
};
