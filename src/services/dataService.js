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
import {
  getDefaultTransactions,
  getDefaultBudgets,
  getDefaultAccounts,
  getDefaultGoals,
  getDefaultRecurring,
  DEFAULT_SETTINGS,
} from './mockData.js';
import {
  generateId,
  formatCurrency,
  parseNumber,
  formatMonthYear,
  getLocalDateString,
  getLocalMonthString,
} from '../utils/format.js';
import { CATEGORIES, getCategoryLabelVi, getCategoryColor } from '../constants/categories.js';

export const SEED_VERSION = 'v2026.5';

/* ------------------------------------------------------------------ *
 * Initialization with SEED_VERSION migration
 * ------------------------------------------------------------------ */
function initData() {
  const storedVersion = load(STORAGE_KEYS.SEED_VERSION, null);
  const rawTx = load(STORAGE_KEYS.TRANSACTIONS, null);
  const rawBudgets = load(STORAGE_KEYS.BUDGETS, null);
  const rawSettings = load(STORAGE_KEYS.SETTINGS, null);
  const rawAccounts = load(STORAGE_KEYS.ACCOUNTS, null);
  const rawGoals = load(STORAGE_KEYS.GOALS, null);
  const rawRecurring = load(STORAGE_KEYS.RECURRING, null);

  let initialTx;
  if (!rawTx || storedVersion !== SEED_VERSION) {
    // Preserve custom user-added transactions (not part of the default seed IDs)
    const freshSeed = getDefaultTransactions();
    const seedIds = new Set(freshSeed.map(t => t.id));
    const userCreatedTx = Array.isArray(rawTx)
      ? rawTx.filter(tx => tx && tx.id && !seedIds.has(tx.id) && !tx.isSeed && !/^t\d+[a-z]?$/i.test(tx.id))
      : [];

    initialTx = [...userCreatedTx, ...freshSeed];
    save(STORAGE_KEYS.TRANSACTIONS, initialTx);
    save(STORAGE_KEYS.SEED_VERSION, SEED_VERSION);
  } else {
    initialTx = rawTx;
  }

  let initialBudgets;
  if (!rawBudgets || storedVersion !== SEED_VERSION) {
    const defaultBudgets = getDefaultBudgets();
    if (Array.isArray(rawBudgets) && rawBudgets.length > 0) {
      const budgetMap = new Map(rawBudgets.map(b => [b.category, b]));
      initialBudgets = defaultBudgets.map(b => {
        const existing = budgetMap.get(b.category);
        return existing ? { ...b, limit: existing.limit } : b;
      });
      // Add custom categories that user created
      for (const b of rawBudgets) {
        if (!initialBudgets.some(db => db.category === b.category)) {
          initialBudgets.push(b);
        }
      }
    } else {
      initialBudgets = defaultBudgets;
    }
    save(STORAGE_KEYS.BUDGETS, initialBudgets);
  } else {
    initialBudgets = rawBudgets;
  }

  return {
    transactions: initialTx,
    budgets: initialBudgets,
    settings: rawSettings || DEFAULT_SETTINGS,
    accounts: (Array.isArray(rawAccounts) && rawAccounts.length > 0) ? rawAccounts : getDefaultAccounts(),
    goals: rawGoals || getDefaultGoals(),
    recurring: rawRecurring || getDefaultRecurring(),
  };
}

const _initialState = initData();
let transactions = _initialState.transactions;
let budgets = _initialState.budgets;
let settings = _initialState.settings;
let accounts = _initialState.accounts;
let goals = _initialState.goals;
let recurring = _initialState.recurring;

/* ------------------------------------------------------------------ *
 * Persistence helper — saves all mutable state to storage
 * ------------------------------------------------------------------ */
function persist() {
  save(STORAGE_KEYS.TRANSACTIONS, transactions);
  save(STORAGE_KEYS.BUDGETS, budgets);
  save(STORAGE_KEYS.SETTINGS, settings);
  save(STORAGE_KEYS.ACCOUNTS, accounts);
  save(STORAGE_KEYS.GOALS, goals);
  save(STORAGE_KEYS.RECURRING, recurring);
}

// Ensure all defaults are persisted on first load so IndexedDB migration
// can pick them up (previously, settings/accounts/goals/recurring were
// only written to storage on first user edit, not on init)
persist();

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
  if (Array.isArray(txList)) {
    for (const tx of txList) {
      if (!tx || tx.status === 'cancelled' || tx.status === 'failed') continue;
      const amt = parseNumber(tx.amount);
      if (tx.type === 'income') income += amt;
      else expenses += amt;
    }
  }
  return { income, expenses, net: income - expenses };
}

/**
 * Total balance across all accounts.
 * @returns {number}
 */
export function getTotalBalance() {
  return accounts.reduce((sum, a) => sum + parseNumber(a.balance), 0);
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
  if (!Array.isArray(txList)) return [];
  const map = {};
  for (const tx of txList) {
    if (!tx || tx.type !== 'expense' || tx.status === 'cancelled' || tx.status === 'failed') continue;
    const amt = parseNumber(tx.amount);
    map[tx.category] = (map[tx.category] || 0) + amt;
  }
  return Object.entries(map)
    .map(([category, amount]) => ({
      category,
      amount,
      color: getCategoryColor(category),
    }))
    .sort((a, b) => {
      const ai = CATEGORIES.findIndex(c => c.id === a.category);
      const bi = CATEGORIES.findIndex(c => c.id === b.category);
      if (ai === -1 && bi === -1) return b.amount - a.amount;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

/**
 * Compute budget progress from actual transactions for the current month.
 * Overrides the stored `spent` with a value derived from real transactions.
 * @param {Budget[]} budgetList
 * @param {Transaction[]} txList
 * @returns {Budget[]}
 */
export function getBudgetProgress(budgetList, txList) {
  const currentMonth = getLocalMonthString(new Date());
  const monthExpenses = (txList || []).filter(tx =>
    tx &&
    tx.type === 'expense' &&
    tx.status !== 'cancelled' &&
    tx.status !== 'failed' &&
    typeof tx.date === 'string' &&
    tx.date.startsWith(currentMonth)
  );

  return (budgetList || [])
    .map(b => {
      const spent = monthExpenses
        .filter(tx => tx.category === b.category)
        .reduce((s, tx) => s + parseNumber(tx.amount), 0);
      return { ...b, spent };
    })
    .sort((a, b) => {
      const ai = CATEGORIES.findIndex(c => c.id === a.category);
      const bi = CATEGORIES.findIndex(c => c.id === b.category);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

/**
 * Monthly cash-flow series for the last N months.
 * @param {Transaction[]} txList
 * @param {number} [months=6]
 * @returns {Array<{label:string, fullLabel:string, monthKey:string, income:number, expenses:number}>}
 */
export function getMonthlyCashFlow(txList, months = 6) {
  const now = new Date();
  const series = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = getLocalMonthString(d); // YYYY-MM
    const monthNum = d.getMonth() + 1;
    const label = `T${monthNum}`;
    const fullLabel = formatMonthYear(getLocalDateString(d));
    const monthTx = (txList || []).filter(tx => tx && typeof tx.date === 'string' && tx.date.startsWith(monthKey));
    const totals = computeTotals(monthTx);
    series.push({ label, fullLabel, monthKey, income: totals.income, expenses: totals.expenses });
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
    const dateStr = getLocalDateString(d);
    const dayTx = (txList || []).filter(tx => tx && tx.date === dateStr);
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
  const currentMonth = getLocalMonthString(new Date());
  const monthTx = (txList || []).filter(tx => tx && typeof tx.date === 'string' && tx.date.startsWith(currentMonth));
  const totals = computeTotals(monthTx);

  // Check if any budget is near/over limit
  const progress = getBudgetProgress(budgetList, txList);
  const nearLimit = progress.filter(b => b.limit > 0 && (b.spent / b.limit) * 100 >= 80);
  if (nearLimit.length > 0) {
    const worst = nearLimit[0];
    const pct = Math.round((worst.spent / worst.limit) * 100);
    const catName = getCategoryLabelVi(worst.category) || worst.category;
    const remaining = worst.limit - worst.spent;
    return {
      text: `${catName} đã dùng ${pct}% ngân sách`,
      detail: `Chỉ còn ${formatCurrency(remaining)} cho ${catName} trong tháng này. Cắt giảm chi tiêu để tránh vượt ngân sách.`,
      type: 'warning',
      action: `Xem ngân sách ${catName.toLowerCase()}`,
      actionPage: 'budgets',
    };
  }

  // Check if savings rate improved
  if (totals.income > 0) {
    const rate = computeSavingsRate(monthTx);
    const net = totals.income - totals.expenses;
    if (net > 0) {
      return {
        text: `Bạn đang tiết kiệm ${rate.toFixed(1)}% thu nhập`,
        detail: `Tiết kiệm được ${formatCurrency(net)} từ thu nhập ${formatCurrency(totals.income)} trong tháng này.`,
        type: 'positive',
        action: 'Xem báo cáo chi tiêu',
        actionPage: 'reports',
      };
    }
    return {
      text: `Chi tiêu (${formatCurrency(totals.expenses)}) đã vượt thu nhập (${formatCurrency(totals.income)})`,
      detail: 'Bạn đang chi tiêu nhiều hơn thu nhập. Hãy xem xét cắt giảm chi phí không cần thiết.',
      type: 'warning',
      action: 'Xem báo cáo',
      actionPage: 'reports',
    };
  }

  return {
    text: 'Theo dõi giao dịch đầu tiên để xem phân tích',
    detail: 'Thêm thu nhập hoặc chi phí để bắt đầu.',
    type: 'info',
    action: 'Thêm giao dịch',
    actionPage: 'transactions',
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
    const newTx = { id: generateId(), status: 'completed', payment_method: 'card', ...tx };
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

  async deleteBudget(id) {
    const idx = budgets.findIndex(b => b.id === id);
    if (idx === -1) return false;
    budgets.splice(idx, 1);
    persist();
    return true;
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
    if (!Array.isArray(accounts) || accounts.length === 0) {
      accounts = getDefaultAccounts();
      persist();
    }
    return [...accounts];
  },

  async addAccount(account) {
    const newAccount = { id: account.id || generateId(), ...account };
    accounts.push(newAccount);
    persist();
    return newAccount;
  },

  async updateAccount(id, updates) {
    const a = accounts.find(a => a.id === id);
    if (!a) return null;
    Object.assign(a, updates);
    persist();
    return { ...a };
  },

  async deleteAccount(id) {
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) return false;
    accounts.splice(idx, 1);
    persist();
    return true;
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

  async updateGoal(id, updates) {
    const g = goals.find(g => g.id === id);
    if (!g) return null;
    Object.assign(g, updates);
    persist();
    return { ...g };
  },

  async deleteGoal(id) {
    const idx = goals.findIndex(g => g.id === id);
    if (idx === -1) return false;
    goals.splice(idx, 1);
    persist();
    return true;
  },

  /* ---- Recurring ---- */
  async getRecurring() {
    return [...recurring];
  },

  async addRecurring(item) {
    const newItem = { id: generateId(), ...item };
    recurring.push(newItem);
    persist();
    return newItem;
  },

  async updateRecurring(id, updates) {
    const r = recurring.find(r => r.id === id);
    if (!r) return null;
    Object.assign(r, updates);
    persist();
    return r;
  },

  async deleteRecurring(id) {
    const idx = recurring.findIndex(r => r.id === id);
    if (idx === -1) return false;
    recurring.splice(idx, 1);
    persist();
    return true;
  },

  /* ---- Categories (mock: read from constants) ---- */
  async getCategories() {
    return CATEGORIES.map(c => ({ ...c }));
  },

  async getNotifications() { return []; },
  async markNotificationRead() { return false; },

  async getProfile() { return { id: 'mock-user', full_name: 'Luxe User', currency: 'VND' }; },
  async updateProfile(updates) { return { id: 'mock-user', full_name: 'Luxe User', currency: 'VND', ...updates }; },

  /* ---- Persistence ---- */
  async resetToDefaults() {
    transactions = getDefaultTransactions();
    budgets = getDefaultBudgets();
    settings = { ...DEFAULT_SETTINGS };
    accounts = getDefaultAccounts();
    goals = getDefaultGoals();
    recurring = getDefaultRecurring();
    save(STORAGE_KEYS.SEED_VERSION, SEED_VERSION);
    persist();
  },
};

export default dataService;
