/**
 * @file DataService — the single data-access interface for the entire app.
 *
 * This module abstracts localStorage behind a clean async interface.
 * Every feature module imports ONLY this service, never localStorage directly.
 *
 * When Supabase is integrated, a new `supabaseService.js` implementing the
 * same method signatures can replace this module with zero changes to
 * feature or component code.
 *
 * @typedef {import('../types/index.js').Transaction} Transaction
 * @typedef {import('../types/index.js').Budget} Budget
 * @typedef {import('../types/index.js').Settings} Settings
 */

import { load, save, STORAGE_KEYS } from './storage.js';
import { DEFAULT_TRANSACTIONS, DEFAULT_BUDGETS, DEFAULT_SETTINGS, DEFAULT_ACCOUNTS, DEFAULT_GOALS } from './mockData.js';
import { generateId, formatCurrency } from '../utils/format.js';

/* ------------------------------------------------------------------ *
 * In-memory state (mirrors localStorage for the session)
 * ------------------------------------------------------------------ */
let transactions = load(STORAGE_KEYS.TRANSACTIONS, DEFAULT_TRANSACTIONS);
let budgets = load(STORAGE_KEYS.BUDGETS, DEFAULT_BUDGETS);
let settings = load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
let accounts = load('luxe_accounts', DEFAULT_ACCOUNTS);
let goals = load('luxe_goals', DEFAULT_GOALS);

/* ------------------------------------------------------------------ *
 * Persistence helper — saves all mutable state to localStorage
 * ------------------------------------------------------------------ */
function persist() {
  save(STORAGE_KEYS.TRANSACTIONS, transactions);
  save(STORAGE_KEYS.BUDGETS, budgets);
  save(STORAGE_KEYS.SETTINGS, settings);
  save('luxe_accounts', accounts);
  save('luxe_goals', goals);
}

/* ------------------------------------------------------------------ *
 * Analytics / derived data
 * ------------------------------------------------------------------ */

/**
 * Compute monthly totals from transactions.
 * @param {Transaction[]} txList
 * @returns {{income:number, expenses:number, net:number}}
 */
export function computeTotals(txList) {
  let income = 0, expenses = 0;
  for (const tx of txList) {
    if (tx.type === 'income') income += tx.amount;
    else expenses += tx.amount;
  }
  return { income, expenses, net: income - expenses };
}

/**
 * Total balance across all accounts.
 * @returns {number}
 */
export function getTotalBalance() {
  return accounts.reduce((sum, a) => sum + a.balance, 0);
}

/**
 * Compute savings rate (%).
 * @param {Transaction[]} txList
 * @returns {number}
 */
export function computeSavingsRate(txList) {
  const { income, expenses } = computeTotals(txList);
  if (income === 0) return 0;
  return Number(((income - expenses) / income * 100).toFixed(1));
}

/**
 * Spending by category for the current period.
 * @param {Transaction[]} txList
 * @returns {{category:string, amount:number, color:string}[]}
 */
export function getSpendingByCategory(txList) {
  const map = {};
  for (const tx of txList) {
    if (tx.type !== 'expense') continue;
    map[tx.category] = (map[tx.category] || 0) + tx.amount;
  }
  return Object.entries(map)
    .map(([category, amount]) => ({
      category,
      amount,
      color: budgets.find(b => b.category === category)?.color || CATEGORY_FALLBACK(category),
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** @param {string} cat */
function CATEGORY_FALLBACK(cat) {
  const fallback = { Food: '#F59E0B', Transport: '#38BDF8', Entertainment: '#A78BDA', Shopping: '#22C55E', Bills: '#F43F5E', Health: '#14B8A3' };
  return fallback[cat] || '#64748B';
}

/**
 * Monthly cash-flow series for the last N months.
 * @param {Transaction[]} txList
 * @param {number} [months=6]
 * @returns {Array<{label:string, income:number, expenses:number}>}
 */
export function getMonthlyCashFlow(txList, months = 6) {
  const now = new Date();
  const series = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
    const label = d.toLocaleDateString('vi-VN', { month: 'short' });
    const monthTx = txList.filter(tx => tx.date.startsWith(monthKey));
    const totals = computeTotals(monthTx);
    series.push({ label, income: totals.income, expenses: totals.expenses });
  }
  return series;
}

/**
 * Weekly spending series (last 7 days) for the area chart.
 * @param {Transaction[]} txList
 * @returns {Array<{label:string, income:number, expenses:number}>}
 */
export function getWeeklySeries(txList) {
  const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const now = new Date();
  const series = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayTx = txList.filter(tx => tx.date === dateStr);
    const totals = computeTotals(dayTx);
    series.push({ label: labels[(d.getDay() + 6) % 7], income: totals.income, expenses: totals.expenses });
  }
  return series;
}

/**
 * Generate a financial insight based on current data.
 * @param {Transaction[]} txList
 * @param {Budget[]} budgetList
 * @returns {{text:string, detail:string, type:'positive'|'warning'|'info'}}
 */
export function generateInsight(txList, budgetList) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTx = txList.filter(tx => tx.date.startsWith(currentMonth));
  const totals = computeTotals(monthTx);

  // Check if any budget is near/over limit
  const nearLimit = budgetList.filter(b => (b.spent / b.limit) * 100 >= 80);
  if (nearLimit.length > 0) {
    const worst = nearLimit[0];
    return {
      text: `Ngân sách ${worst.category} đã dùng ${Math.round((worst.spent / worst.limit) * 100)}%`,
      detail: `Bạn còn ${formatCurrency(worst.limit - worst.spent)} cho ${worst.category} trong tháng này.`,
      type: 'warning',
    };
  }

  // Check if savings rate improved
  if (totals.income > 0) {
    const rate = ((totals.income - totals.expenses) / totals.income) * 100;
    return {
      text: `Tỷ lệ tiết kiệm của bạn là ${rate.toFixed(1)}% trong tháng này`,
      detail: `Tiết kiệm ${formatCurrency(totals.income - totals.expenses)} từ thu nhập ${formatCurrency(totals.income)}.`,
      type: 'positive',
    };
  }

  return {
    text: 'Theo dõi giao dịch đầu tiên để xem nhận định',
    detail: 'Thêm thu nhập hoặc chi phí để bắt đầu.',
    type: 'info',
  };
}

/* ------------------------------------------------------------------ *
 * Public DataService API (async, Supabase-ready)
 * ------------------------------------------------------------------ */
export const dataService = {
  /* ---- Transactions ---- */
  async getTransactions() {
    return [...transactions];
  },

  async addTransaction(tx) {
    const newTx = { id: generateId(), status: 'completed', ...tx };
    transactions.unshift(newTx);
    persist();
    return newTx;
  },

  async deleteTransaction(id) {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return false;
    transactions.splice(idx, 1);
    persist();
    return true;
  },

  async updateTransaction(id, updates) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return null;
    Object.assign(tx, updates);
    persist();
    return tx;
  },

  /* ---- Budgets ---- */
  async getBudgets() {
    return [...budgets];
  },

  async addBudget(budget) {
    const newBudget = { id: generateId(), ...budget };
    budgets.push(newBudget);
    persist();
    return newBudget;
  },

  async updateBudget(id, updates) {
    const b = budgets.find(b => b.id === id);
    if (!b) return null;
    Object.assign(b, updates);
    persist();
    return b;
  },

  /* ---- Settings ---- */
  async getSettings() {
    return { ...settings };
  },

  async updateSettings(updates) {
    Object.assign(settings, updates);
    persist();
    return { ...settings };
  },

  /* ---- Accounts ---- */
  async getAccounts() {
    return [...accounts];
  },

  /* ---- Goals ---- */
  async getGoals() {
    return [...goals];
  },

  async addGoal(goal) {
    const newGoal = { id: generateId(), ...goal };
    goals.push(newGoal);
    persist();
    return newGoal;
  },

  /* ---- Persistence ---- */
  async resetToDefaults() {
    transactions = [...DEFAULT_TRANSACTIONS];
    budgets = [...DEFAULT_BUDGETS];
    settings = { ...DEFAULT_SETTINGS };
    accounts = [...DEFAULT_ACCOUNTS];
    goals = [...DEFAULT_GOALS];
    persist();
  },
};

export default dataService;
