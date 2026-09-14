/**
 * @file Static mock data — the default seed for localStorage.
 * When Supabase is integrated, this file can be deprecated entirely;
 * the DataService layer is the only thing that needs to change.
 * @typedef {Object} Transaction
 * @property {string} id        Unique id
 * @property {string} merchant  Merchant/payee name
 * @property {string} category  Category name (matches Budget.category)
 * @property {'income'|'expense'} type
 * @property {string} date      ISO date (YYYY-MM-DD)
 * @property {number} amount    Positive number
 * @property {'completed'|'pending'} status
 *
 * @typedef {Object} Budget
 * @property {string} id
 * @property {string} category
 * @property {number} limit    Monthly budget limit
 * @property {number} spent    Amount spent this period
 * @property {string} icon
 * @property {string} color
 */

export const DEFAULT_TRANSACTIONS = [
  { id: 't01', merchant: 'Salary',             category: 'Income',            type: 'income',  date: '2026-09-12', amount: 4200, status: 'completed' },
  { id: 't02', merchant: 'Freelance Project',  category: 'Income',            type: 'income',  date: '2026-09-11', amount: 2220, status: 'completed' },
  { id: 't03', merchant: 'Grocery Store',      category: 'Food',              type: 'expense', date: '2026-09-13', amount: 86,   status: 'completed' },
  { id: 't04', merchant: 'Starbucks',          category: 'Food',              type: 'expense', date: '2026-09-13', amount: 12,   status: 'completed' },
  { id: 't05', merchant: 'Uber',               category: 'Transport',         type: 'expense', date: '2026-09-12', amount: 18,   status: 'completed' },
  { id: 't06', merchant: 'Netflix',            category: 'Entertainment',     type: 'expense', date: '2026-09-10', amount: 15,   status: 'completed' },
  { id: 't07', merchant: 'Electric Utility',   category: 'Bills',             type: 'expense', date: '2026-09-09', amount: 95,   status: 'completed' },
  { id: 't08', merchant: 'Amazon',             category: 'Shopping',          type: 'expense', date: '2026-09-08', amount: 64,   status: 'completed' },
  { id: 't09', merchant: 'Dr. Smith Clinic',   category: 'Health',            type: 'expense', date: '2026-09-07', amount: 120,  status: 'completed' },
  { id: 't10', merchant: 'Whole Foods',         category: 'Food',              type: 'expense', date: '2026-09-06', amount: 73,   status: 'completed' },
  { id: 't11', merchant: 'Rent',               category: 'Bills',             type: 'expense', date: '2026-09-01', amount: 1250, status: 'completed' },
  { id: 't12', merchant: 'Gym Membership',     category: 'Health',            type: 'expense', date: '2026-09-01', amount: 45,   status: 'completed' },
  { id: 't13', merchant: 'Apple Store',        category: 'Shopping',          type: 'expense', date: '2026-09-05', amount: 249,  status: 'pending'   },
  { id: 't14', merchant: 'Spotify',            category: 'Entertainment',     type: 'expense', date: '2026-09-01', amount: 10,   status: 'completed' },
  { id: 't15', merchant: 'Shell Gas',          category: 'Transport',         type: 'expense', date: '2026-09-04', amount: 55,   status: 'completed' },
  { id: 't16', merchant: 'Coffee Bean',        category: 'Food',              type: 'expense', date: '2026-09-13', amount: 6,    status: 'completed' },
  { id: 't17', merchant: 'Steam',              category: 'Entertainment',     type: 'expense', date: '2026-09-10', amount: 30,   status: 'completed' },
];

export const DEFAULT_BUDGETS = [
  { id: 'b01', category: 'Food',          limit: 800,  spent: 576,  icon: '🛒', color: '#6366F1' },
  { id: 'b02', category: 'Transport',      limit: 300,  spent: 135,  icon: '🚌', color: '#38BDF8' },
  { id: 'b03', category: 'Entertainment',  limit: 300,  spent: 246,  icon: '🎬', color: '#F59E0B' },
  { id: 'b04', category: 'Shopping',       limit: 500,  spent: 155,  icon: '🛍️', color: '#22C55E' },
  { id: 'b05', category: 'Bills',          limit: 1500, spent: 1345, icon: '⚡', color: '#F43F5E' },
  { id: 'b06', category: 'Health',         limit: 300,  spent: 165,  icon: '💊', color: '#A78BFA' },
];

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  currency: 'USD',
  payDay: '15th',
  budgetPeriod: 'monthly',
  compactMode: false,
  animations: true,
  notifications: {
    budgetWarning: true,
    weeklySummary: true,
    largeTransaction: false,
    aiInsights: true,
  },
};

export const DEFAULT_ACCOUNTS = [
  { id: 'a01', name: 'Chase Checking', type: 'checking', balance: 15420, currency: 'USD' },
  { id: 'a02', name: 'Ally Savings',   type: 'savings',   balance: 9160,  currency: 'USD' },
];

export const DEFAULT_GOALS = [
  { id: 'g01', name: 'Emergency Fund', target: 10000, current: 6420, deadline: '2026-12-31' },
  { id: 'g02', name: 'Vacation Japan', target: 3500,  current: 1200, deadline: '2027-06-01' },
];
