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

import { load, save, remove, STORAGE_KEYS, getStorageScope } from './storage.js';
import {
  getDefaultTransactions,
  getDefaultBudgets,
  getDefaultAccounts,
  getDefaultGoals,
  getDefaultRecurring,
  getDefaultNotifications,
  DEFAULT_SETTINGS,
} from './mockData.js';
import { emit } from '../utils/eventBus.js';
import {
  generateId,
  formatCurrency,
  parseNumber,
  formatMonthYear,
  getLocalDateString,
  getLocalMonthString,
} from '../utils/format.js';
import { CATEGORIES, getCategoryLabelVi, getCategoryColor } from '../constants/categories.js';

export const SEED_VERSION = 'v2026.6';

// Exact sets of legacy seed IDs across all previous versions (before isSeed flag was established).
// Rule: NEVER identify seed items by name or value heuristics, ONLY by isSeed === true or exact seed IDs.
const LEGACY_SEED_TX_IDS = new Set([
  't01', 't02', 't02b', 't03', 't04', 't05', 't06', 't07', 't08', 't09',
  't10', 't11', 't12', 't13', 't14', 't15', 't16', 't17', 't18', 't18a',
  't19', 't19a', 't20', 't20a', 't21', 't21a', 't22', 't22a', 't23', 't24',
  't25', 't26', 't27', 't28', 't29', 't30', 't31', 't32', 't33', 't34',
  't35', 't36', 't37', 't38', 't39', 't40', 't41', 't42', 't43', 't44',
  't45', 't46', 't47', 't48', 't49', 't50', 't51', 't52', 't53', 't54',
  't55', 't56', 't57', 't58', 't59', 't60', 't61', 't62', 't63', 't64',
  't65', 't66', 't67', 't68', 't_p1', 't_p2', 't_f1', 't_f2', 't_c1',
]);

const LEGACY_SEED_ACCOUNT_IDS = new Set(['a01', 'a02', 'a03', 'acc-1', 'acc-2', 'acc-3']);
const LEGACY_SEED_GOAL_IDS = new Set(['g01', 'g02', 'g-1', 'g-2']);
const LEGACY_SEED_RECURRING_IDS = new Set(['r01', 'r02', 'r03', 'rec-1', 'rec-2', 'rec-3']);
const LEGACY_SEED_BUDGET_IDS = new Set(['b01', 'b02', 'b03', 'b04', 'b05', 'b06']);

// Legacy seed budget limits prior to VND standardization (from v2026.5 and earlier)
const LEGACY_SEED_BUDGET_LIMITS = {
  food: 800,
  transport: 300,
  entertainment: 300,
  shopping: 500,
  bills: 1500,
  health: 300,
};

/**
 * Clean data bootstrap for new authenticated user.
 * Idempotent: runs once per user scope, creates 1 Cash account with 0 VND,
 * suggested budgets (isSuggested: true, isSeed: false), clean settings,
 * and ZERO transactions, goals, or recurring items.
 *
 * @param {string} [scope]
 * @param {boolean} [forceReset=false]
 * @returns {object}
 */
export function ensureUserBootstrap(scope = getStorageScope(), forceReset = false) {
  const isBootstrapped = load(STORAGE_KEYS.USER_BOOTSTRAPPED, false, scope);
  if (isBootstrapped && !forceReset) {
    return {
      transactions: load(STORAGE_KEYS.TRANSACTIONS, [], scope),
      budgets: load(STORAGE_KEYS.BUDGETS, [], scope),
      settings: load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS, scope),
      accounts: load(STORAGE_KEYS.ACCOUNTS, [], scope),
      goals: load(STORAGE_KEYS.GOALS, [], scope),
      recurring: load(STORAGE_KEYS.RECURRING, [], scope),
      notifications: load(STORAGE_KEYS.NOTIFICATIONS, [], scope),
    };
  }

  // 1. Exactly 1 default Cash account (balance 0, isSeed: false, editable & deletable)
  const defaultAccounts = [
    {
      id: `acc_${generateId()}`,
      name: 'Tiền mặt',
      type: 'checking',
      balance: 0,
      currency: 'VND',
      is_default: true,
      isSeed: false,
    },
  ];

  // 2. Suggested budgets based on Task 1B VND standard, marked with isSuggested: true, isSeed: false
  const suggestedBudgets = [
    { id: `b_${generateId()}`, category: 'food', limit: 5000000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'transport', limit: 2000000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'shopping', limit: 3000000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'bills', limit: 4000000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'entertainment', limit: 1500000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'health', limit: 1500000, spent: 0, isSuggested: true, isSeed: false },
  ];

  // 3. Clean settings with VND currency, monthStartDay = 1, payday null
  const cleanSettings = {
    ...DEFAULT_SETTINGS,
    currency: 'VND',
    monthStartDay: 1,
    payday: null,
    isSeed: false,
  };

  // 4. ZERO transactions, ZERO goals, ZERO recurring, ZERO notifications
  const emptyTx = [];
  const emptyGoals = [];
  const emptyRecurring = [];
  const emptyNotifications = [];

  save(STORAGE_KEYS.ACCOUNTS, defaultAccounts, scope);
  save(STORAGE_KEYS.BUDGETS, suggestedBudgets, scope);
  save(STORAGE_KEYS.SETTINGS, cleanSettings, scope);
  save(STORAGE_KEYS.TRANSACTIONS, emptyTx, scope);
  save(STORAGE_KEYS.GOALS, emptyGoals, scope);
  save(STORAGE_KEYS.RECURRING, emptyRecurring, scope);
  save(STORAGE_KEYS.NOTIFICATIONS, emptyNotifications, scope);
  save(STORAGE_KEYS.USER_BOOTSTRAPPED, true, scope);

  return {
    transactions: emptyTx,
    budgets: suggestedBudgets,
    settings: cleanSettings,
    accounts: defaultAccounts,
    goals: emptyGoals,
    recurring: emptyRecurring,
    notifications: emptyNotifications,
  };
}

/**
 * Clear guest seed data on demand ("Xoá dữ liệu mẫu" button).
 * Puts guest mode into a clean state like a newly created account.
 */
export function clearGuestSeedData() {
  const scope = 'guest';
  const defaultAccounts = [
    {
      id: `acc_${generateId()}`,
      name: 'Tiền mặt',
      type: 'checking',
      balance: 0,
      currency: 'VND',
      is_default: true,
      isSeed: false,
    },
  ];
  const suggestedBudgets = [
    { id: `b_${generateId()}`, category: 'food', limit: 5000000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'transport', limit: 2000000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'shopping', limit: 3000000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'bills', limit: 4000000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'entertainment', limit: 1500000, spent: 0, isSuggested: true, isSeed: false },
    { id: `b_${generateId()}`, category: 'health', limit: 1500000, spent: 0, isSuggested: true, isSeed: false },
  ];
  save(STORAGE_KEYS.ACCOUNTS, defaultAccounts, scope);
  save(STORAGE_KEYS.BUDGETS, suggestedBudgets, scope);
  save(STORAGE_KEYS.TRANSACTIONS, [], scope);
  save(STORAGE_KEYS.GOALS, [], scope);
  save(STORAGE_KEYS.RECURRING, [], scope);
  save(STORAGE_KEYS.NOTIFICATIONS, [], scope);
  reinitData();
  emit('data:changed');
}

/* ------------------------------------------------------------------ *
 * Initialization with SEED_VERSION & AMOUNT_UNIT migration
 * ------------------------------------------------------------------ */
export function initData() {
  const scope = getStorageScope();

  // If not guest (user scope): strictly DO NOT seed! Bootstrap or load user data
  if (scope !== 'guest') {
    return ensureUserBootstrap(scope);
  }

  // --- GUEST SCOPE ONLY: SEED_VERSION & AMOUNT_UNIT migration ---
  const storedVersion = load(STORAGE_KEYS.SEED_VERSION, null, 'guest');
  const rawTx = load(STORAGE_KEYS.TRANSACTIONS, null, 'guest');
  const rawBudgets = load(STORAGE_KEYS.BUDGETS, null, 'guest');
  const rawSettings = load(STORAGE_KEYS.SETTINGS, null, 'guest');
  const rawAccounts = load(STORAGE_KEYS.ACCOUNTS, null, 'guest');
  const rawGoals = load(STORAGE_KEYS.GOALS, null, 'guest');
  const rawRecurring = load(STORAGE_KEYS.RECURRING, null, 'guest');
  const rawNotifications = load(STORAGE_KEYS.NOTIFICATIONS, null, 'guest');
  const unitMigrated = load(STORAGE_KEYS.AMOUNT_UNIT_MIGRATED, null, 'guest');

  // 1. One-time idempotent unit migration with backup strictly on guest scope
  if (!unitMigrated) {
    const backupSnapshot = {
      timestamp: new Date().toISOString(),
      transactions: rawTx,
      budgets: rawBudgets,
      settings: rawSettings,
      accounts: rawAccounts,
      goals: rawGoals,
      recurring: rawRecurring,
      notifications: rawNotifications,
      seedVersion: storedVersion,
    };
    save(STORAGE_KEYS.BACKUP_BEFORE_UNIT_MIGRATION, backupSnapshot, 'guest');
    save(STORAGE_KEYS.AMOUNT_UNIT_MIGRATED, 'vnd_v1', 'guest');
  }

  // 2. Transactions initialization / seed refresh (strictly isSeed or exact legacy IDs, NO regex, NO merchant name)
  let initialTx;
  if (!rawTx || storedVersion !== SEED_VERSION) {
    const freshSeed = getDefaultTransactions();
    const defaultTxIds = new Set(freshSeed.map(t => t.id));
    const isSeedTx = (tx) => Boolean(
      tx && (tx.isSeed === true || defaultTxIds.has(tx.id) || LEGACY_SEED_TX_IDS.has(tx.id))
    );
    const userCreatedTx = Array.isArray(rawTx)
      ? rawTx.filter(tx => !isSeedTx(tx))
      : [];

    initialTx = [...userCreatedTx, ...freshSeed];
    save(STORAGE_KEYS.TRANSACTIONS, initialTx, 'guest');
    save(STORAGE_KEYS.SEED_VERSION, SEED_VERSION, 'guest');
  } else {
    initialTx = rawTx;
  }

  // 3. Budgets initialization / seed refresh (preserving user-modified limits upon SEED_VERSION upgrade)
  let initialBudgets;
  if (!rawBudgets || storedVersion !== SEED_VERSION) {
    const defaultBudgets = getDefaultBudgets();
    if (Array.isArray(rawBudgets) && rawBudgets.length > 0) {
      const mergedDefaults = defaultBudgets.map(defaultB => {
        const existing = rawBudgets.find(b => b && b.category === defaultB.category);
        if (!existing) return defaultB;

        // User-modified check:
        // 1. Explicit userModified flag
        // 2. Or limit differed from both legacy seed limit and fresh seed limit
        const isUserModified = existing.userModified === true ||
          (existing.limit !== undefined &&
           existing.limit !== LEGACY_SEED_BUDGET_LIMITS[existing.category] &&
           existing.limit !== defaultB.limit);

        if (isUserModified) {
          return {
            ...existing,
            userModified: true,
          };
        }

        // Unmodified seed budget: update to fresh seed VND limit
        return {
          ...defaultB,
          id: existing.id || defaultB.id,
          spent: existing.spent ?? 0,
        };
      });

      const defaultCategories = new Set(defaultBudgets.map(b => b.category));
      const userCustomBudgets = rawBudgets.filter(b => b && b.category && !defaultCategories.has(b.category));
      initialBudgets = [...mergedDefaults, ...userCustomBudgets];
    } else {
      initialBudgets = defaultBudgets;
    }
    save(STORAGE_KEYS.BUDGETS, initialBudgets, 'guest');
  } else {
    initialBudgets = rawBudgets;
  }

  // 4. Accounts initialization / seed refresh (strictly isSeed or exact legacy IDs, NO name matching)
  let initialAccounts;
  if (!rawAccounts || storedVersion !== SEED_VERSION) {
    const defaultAccounts = getDefaultAccounts();
    const defaultAccountIds = new Set(defaultAccounts.map(a => a.id));
    const isSeedAccount = (a) => Boolean(
      a && (a.isSeed === true || defaultAccountIds.has(a.id) || LEGACY_SEED_ACCOUNT_IDS.has(a.id))
    );
    const userAccounts = Array.isArray(rawAccounts)
      ? rawAccounts.filter(a => !isSeedAccount(a))
      : [];
    initialAccounts = [...defaultAccounts, ...userAccounts];
    save(STORAGE_KEYS.ACCOUNTS, initialAccounts, 'guest');
  } else {
    initialAccounts = rawAccounts;
  }

  // 5. Goals initialization / seed refresh (strictly isSeed or exact legacy IDs, NO name matching)
  let initialGoals;
  if (!rawGoals || storedVersion !== SEED_VERSION) {
    const defaultGoals = getDefaultGoals();
    const defaultGoalIds = new Set(defaultGoals.map(g => g.id));
    const isSeedGoal = (g) => Boolean(
      g && (g.isSeed === true || defaultGoalIds.has(g.id) || LEGACY_SEED_GOAL_IDS.has(g.id))
    );
    const userGoals = Array.isArray(rawGoals)
      ? rawGoals.filter(g => !isSeedGoal(g))
      : [];
    initialGoals = [...defaultGoals, ...userGoals];
    save(STORAGE_KEYS.GOALS, initialGoals, 'guest');
  } else {
    initialGoals = rawGoals;
  }

  // 6. Recurring initialization / seed refresh (strictly isSeed or exact legacy IDs, NO merchant name)
  let initialRecurring;
  if (!rawRecurring || storedVersion !== SEED_VERSION) {
    const defaultRecurring = getDefaultRecurring();
    const defaultRecIds = new Set(defaultRecurring.map(r => r.id));
    const isSeedRec = (r) => Boolean(
      r && (r.isSeed === true || defaultRecIds.has(r.id) || LEGACY_SEED_RECURRING_IDS.has(r.id))
    );
    const userRecurring = Array.isArray(rawRecurring)
      ? rawRecurring.filter(r => !isSeedRec(r))
      : [];
    initialRecurring = [...defaultRecurring, ...userRecurring];
    save(STORAGE_KEYS.RECURRING, initialRecurring, 'guest');
  } else {
    initialRecurring = rawRecurring;
  }

  // 7. Notifications initialization / seed refresh
  let initialNotifications;
  if (!rawNotifications || storedVersion !== SEED_VERSION) {
    initialNotifications = getDefaultNotifications();
    save(STORAGE_KEYS.NOTIFICATIONS, initialNotifications, 'guest');
  } else {
    initialNotifications = rawNotifications;
  }

  return {
    transactions: initialTx,
    budgets: initialBudgets,
    settings: rawSettings || DEFAULT_SETTINGS,
    accounts: initialAccounts,
    goals: initialGoals,
    recurring: initialRecurring,
    notifications: initialNotifications,
  };
}

const _initialState = initData();
let transactions = _initialState.transactions;
let budgets = _initialState.budgets;
let settings = _initialState.settings;
let accounts = _initialState.accounts;
let goals = _initialState.goals;
let recurring = _initialState.recurring;
let notifications = _initialState.notifications;

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
  save(STORAGE_KEYS.NOTIFICATIONS, notifications);
}

/**
 * Re-run initialization and reload state from storage (useful for SEED_VERSION tests and hot migrations).
 */
export function reinitData() {
  const state = initData();
  transactions = state.transactions;
  budgets = state.budgets;
  settings = state.settings;
  accounts = state.accounts;
  goals = state.goals;
  recurring = state.recurring;
  notifications = state.notifications;
  persist();
  return state;
}

export function resetDataServiceState() {
  return reinitData();
}

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

import { generateRuleBasedInsight } from '../features/dashboard/periodInsights.js';

/**
 * Generate a financial insight based on current data (rule-based).
 * @param {Transaction[]} txList
 * @param {Budget[]} budgetList
 * @returns {{text:string, detail:string, type:'positive'|'warning'|'info'}}
 */
export function generateInsight(txList, budgetList) {
  return generateRuleBasedInsight(txList, budgetList);
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

  getBudgetDefaults() {
    return getDefaultBudgets();
  },

  async addBudget(budget) {
    const newBudget = { id: generateId(), userModified: true, ...budget };
    budgets.push(newBudget);
    persist();
    emit('data:changed');
    return newBudget;
  },

  async updateBudget(id, updates) {
    const b = budgets.find(b => b.id === id);
    if (!b) return null;
    Object.assign(b, updates, { userModified: true });
    persist();
    emit('data:changed');
    return b;
  },

  async deleteBudget(id) {
    const idx = budgets.findIndex(b => b.id === id);
    if (idx === -1) return false;
    budgets.splice(idx, 1);
    persist();
    emit('data:changed');
    return true;
  },

  async resetBudgets(options = {}) {
    const mode = options?.mode || 'default';
    if (mode === '50_30_20') {
      const currentMonth = getLocalMonthString(new Date());
      const monthIncome = (transactions || [])
        .filter(t => t && t.type === 'income' && typeof t.date === 'string' && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + parseNumber(t.amount), 0);

      const income = Number(options?.totalIncome) > 0 ? Number(options.totalIncome) : (monthIncome > 0 ? monthIncome : 20000000);

      budgets = [
        { id: generateId(), category: 'bills',         limit: Math.round(income * 0.20), spent: 0 },
        { id: generateId(), category: 'food',          limit: Math.round(income * 0.20), spent: 0 },
        { id: generateId(), category: 'transport',     limit: Math.round(income * 0.10), spent: 0 },
        { id: generateId(), category: 'shopping',      limit: Math.round(income * 0.15), spent: 0 },
        { id: generateId(), category: 'entertainment',  limit: Math.round(income * 0.15), spent: 0 },
        { id: generateId(), category: 'health',         limit: Math.round(income * 0.10), spent: 0 },
      ];
    } else if (mode === 'zero') {
      const defaults = getDefaultBudgets();
      budgets = defaults.map(d => ({ ...d, id: generateId(), limit: 0, spent: 0 }));
    } else {
      budgets = getDefaultBudgets();
    }
    persist();
    emit('data:changed');
    return [...budgets];
  },

  async resetSingleBudget(id) {
    const b = budgets.find(item => item.id === id);
    if (!b) return null;
    const defaults = getDefaultBudgets();
    const match = defaults.find(d => d.category === b.category);
    if (match) {
      b.limit = match.limit;
    } else {
      b.limit = 500000;
    }
    persist();
    emit('data:changed');
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
    if (!Array.isArray(accounts) || accounts.length === 0) {
      if (getStorageScope() === 'guest') {
        accounts = getDefaultAccounts();
        persist();
      } else {
        const state = ensureUserBootstrap(getStorageScope());
        accounts = state.accounts;
        persist();
      }
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
    emit('data:changed');
    return newGoal;
  },

  async updateGoal(id, updates) {
    const g = goals.find(g => g.id === id);
    if (!g) return null;
    Object.assign(g, updates);
    persist();
    emit('data:changed');
    return { ...g };
  },

  async deleteGoal(id) {
    const idx = goals.findIndex(g => g.id === id);
    if (idx === -1) return false;
    goals.splice(idx, 1);
    persist();
    emit('data:changed');
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
    emit('data:changed');
    return newItem;
  },

  async updateRecurring(id, updates) {
    const r = recurring.find(r => r.id === id);
    if (!r) return null;
    Object.assign(r, updates);
    persist();
    emit('data:changed');
    return r;
  },

  async deleteRecurring(id) {
    const idx = recurring.findIndex(r => r.id === id);
    if (idx === -1) return false;
    recurring.splice(idx, 1);
    persist();
    emit('data:changed');
    return true;
  },

  /* ---- Categories (mock: read from constants) ---- */
  async getCategories() {
    return CATEGORIES.map(c => ({ ...c }));
  },

  /* ---- Notifications ---- */
  async getNotifications(options = {}) {
    let list = [...notifications];
    if (options.filter === 'unread') {
      list = list.filter(n => !n.is_read);
    } else if (options.filter === 'finance') {
      list = list.filter(n => ['warning', 'bill', 'budget', 'income', 'expense'].includes(n.type) || ['budget', 'bill', 'finance'].includes(n.category));
    }
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (options.limit && options.limit > 0) {
      list = list.slice(0, options.limit);
    }
    return list;
  },

  async markNotificationRead(id) {
    const item = notifications.find(n => n.id === id);
    if (!item) return false;
    item.is_read = true;
    persist();
    emit('notifications:changed', { unreadCount: notifications.filter(n => !n.is_read).length });
    return true;
  },

  async markAllNotificationsRead() {
    notifications.forEach(n => {
      n.is_read = true;
    });
    persist();
    emit('notifications:changed', { unreadCount: 0 });
    return true;
  },

  async deleteNotification(id) {
    const idx = notifications.findIndex(n => n.id === id);
    if (idx === -1) return false;
    notifications.splice(idx, 1);
    persist();
    emit('notifications:changed', { unreadCount: notifications.filter(n => !n.is_read).length });
    return true;
  },

  async clearAllNotifications() {
    notifications = [];
    persist();
    emit('notifications:changed', { unreadCount: 0 });
    return true;
  },

  async addNotification(notif) {
    const newNotif = {
      id: notif.id || generateId('notif'),
      type: notif.type || 'info',
      category: notif.category || 'system',
      title: notif.title || '',
      message: notif.message || '',
      is_read: false,
      action_label: notif.action_label || null,
      action_url: notif.action_url || null,
      created_at: notif.created_at || new Date().toISOString(),
    };
    notifications.unshift(newNotif);
    persist();
    emit('notifications:changed', { unreadCount: notifications.filter(n => !n.is_read).length });
    return newNotif;
  },

  async getUnreadNotificationCount() {
    return notifications.filter(n => !n.is_read).length;
  },

  async getProfile() { return { id: 'mock-user', full_name: 'Luxe User', currency: 'VND' }; },
  async updateProfile(updates) { return { id: 'mock-user', full_name: 'Luxe User', currency: 'VND', ...updates }; },

  /* ---- Persistence ---- */
  async resetToDefaults() {
    if (getStorageScope() === 'guest') {
      transactions = getDefaultTransactions();
      budgets = getDefaultBudgets();
      settings = { ...DEFAULT_SETTINGS };
      accounts = getDefaultAccounts();
      goals = getDefaultGoals();
      recurring = getDefaultRecurring();
      notifications = getDefaultNotifications();
      save(STORAGE_KEYS.SEED_VERSION, SEED_VERSION, 'guest');
    } else {
      const state = ensureUserBootstrap(getStorageScope(), true);
      transactions = state.transactions;
      budgets = state.budgets;
      settings = state.settings;
      accounts = state.accounts;
      goals = state.goals;
      recurring = state.recurring;
      notifications = state.notifications;
    }
    persist();
    emit('notifications:changed', { unreadCount: notifications.filter(n => !n.is_read).length });
    emit('data:changed');
  },

  reinitData() {
    return reinitData();
  },

  resetDataServiceState() {
    return resetDataServiceState();
  },

  ensureUserBootstrap(scope, forceReset) {
    return ensureUserBootstrap(scope, forceReset);
  },

  clearGuestSeedData() {
    return clearGuestSeedData();
  },
};

export default dataService;
