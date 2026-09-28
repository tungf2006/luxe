/**
 * @file Static mock data — the default seed for localStorage.
 * When Supabase is integrated, this file can be deprecated entirely;
 * the DataService layer is the only thing that needs to change.
 * @typedef {Object} Transaction
 * @property {string} id        Unique id
 * @property {string} merchant  Merchant/payee name
 * @property {string} category  Category id (matches CATEGORIES[].id)
 * @property {'income'|'expense'} type
 * @property {string} date      ISO date (YYYY-MM-DD)
 * @property {number} amount    Positive number
 * @property {'completed'|'pending'|'failed'|'cancelled'} status
 * @property {'cash'|'card'|'transfer'|'ewallet'} [payment_method]
 *
 * @typedef {Object} Budget
 * @property {string} id
 * @property {string} category  Category id (matches CATEGORIES[].id)
 * @property {number} limit    Monthly budget limit
 * @property {number} spent    Amount spent this period
 */

const _now = new Date();
const dOffset = (daysAgo) => {
  const d = new Date(_now);
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const DEFAULT_TRANSACTIONS = [
  { id: 't01', merchant: 'Lương',            category: 'income',        type: 'income',  date: dOffset(1), amount: 4200, status: 'completed', payment_method: 'transfer' },
  { id: 't02', merchant: 'Dự án freelance',  category: 'income',        type: 'income',  date: dOffset(2), amount: 2220, status: 'completed', payment_method: 'transfer' },
  { id: 't03', merchant: 'Siêu thị Co.opmart', category: 'food',        type: 'expense', date: dOffset(0), amount: 86,   status: 'completed', payment_method: 'card' },
  { id: 't04', merchant: 'Cà phê Highlands',  category: 'food',        type: 'expense', date: dOffset(0), amount: 12,   status: 'pending',   payment_method: 'card' },
  { id: 't05', merchant: 'Grab',             category: 'transport',     type: 'expense', date: dOffset(1), amount: 18,   status: 'completed', payment_method: 'ewallet' },
  { id: 't06', merchant: 'Netflix',          category: 'entertainment', type: 'expense', date: dOffset(3), amount: 15,   status: 'cancelled', payment_method: 'card' },
  { id: 't07', merchant: 'Tiền điện',        category: 'bills',         type: 'expense', date: dOffset(4), amount: 95,   status: 'completed', payment_method: 'transfer' },
  { id: 't08', merchant: 'Shopee',           category: 'shopping',      type: 'expense', date: dOffset(5), amount: 64,   status: 'failed',    payment_method: 'ewallet' },
  { id: 't09', merchant: 'Phòng khám',       category: 'health',        type: 'expense', date: dOffset(6), amount: 120,  status: 'completed', payment_method: 'card' },
  { id: 't10', merchant: 'Chợ dầu xanh',      category: 'food',        type: 'expense', date: dOffset(6), amount: 73,   status: 'completed', payment_method: 'cash' },
  { id: 't11', merchant: 'Tiền thuê nhà',    category: 'bills',         type: 'expense', date: dOffset(12), amount: 1250, status: 'completed', payment_method: 'transfer' },
  { id: 't12', merchant: 'Phí bảo hiểm sức khỏe', category: 'health',   type: 'expense', date: dOffset(12), amount: 45,   status: 'completed', payment_method: 'card' },
  { id: 't13', merchant: 'Apple Store',       category: 'shopping',      type: 'expense', date: dOffset(8), amount: 249,  status: 'pending',   payment_method: 'card' },
  { id: 't14', merchant: 'Spotify',          category: 'entertainment', type: 'expense', date: dOffset(12), amount: 10,   status: 'completed', payment_method: 'card' },
  { id: 't15', merchant: 'Xăng xe',          category: 'transport',     type: 'expense', date: dOffset(9), amount: 55,   status: 'completed', payment_method: 'card' },
  { id: 't16', merchant: 'Cà phê phin',       category: 'food',        type: 'expense', date: dOffset(0), amount: 6,    status: 'cancelled', payment_method: 'cash' },
  { id: 't17', merchant: 'Steam',            category: 'entertainment', type: 'expense', date: dOffset(3), amount: 30,   status: 'completed', payment_method: 'card' },
  { id: 't18a', merchant: 'Shopee',           category: 'shopping',      type: 'expense', date: dOffset(2), amount: 45,   status: 'failed',    payment_method: 'ewallet' },
  { id: 't19a', merchant: 'Pharmacy',          category: 'health',         type: 'expense', date: dOffset(4), amount: 50,   status: 'pending',   payment_method: 'card' },
  { id: 't20a', merchant: 'Vietcombank',       category: 'bills',         type: 'expense', date: dOffset(1), amount: 3200, status: 'pending',   payment_method: 'transfer' },
  { id: 't21a', merchant: 'MB Bank',            category: 'bills',         type: 'expense', date: dOffset(2), amount: 1500, status: 'pending',   payment_method: 'transfer' },
  { id: 't22a', merchant: 'ZaloPay',            category: 'shopping',      type: 'expense', date: dOffset(1), amount: 280,  status: 'failed',    payment_method: 'ewallet' },

  // August 2026
  { id: 't18', merchant: 'Lương',            category: 'income',        type: 'income',  date: '2026-08-12', amount: 4200, status: 'completed', payment_method: 'transfer' },
  { id: 't19', merchant: 'Tư vấn',           category: 'income',        type: 'income',  date: '2026-08-15', amount: 1800, status: 'completed', payment_method: 'transfer' },
  { id: 't20', merchant: 'Tiền thuê nhà',     category: 'bills',       type: 'expense', date: '2026-08-01', amount: 1250, status: 'completed', payment_method: 'transfer' },
  { id: 't21', merchant: 'Chợ hẻo',           category: 'food',        type: 'expense', date: '2026-08-10', amount: 620,  status: 'completed', payment_method: 'cash' },
  { id: 't22', merchant: 'Tiền điện',         category: 'bills',        type: 'expense', date: '2026-08-08', amount: 110,  status: 'completed', payment_method: 'transfer' },
  { id: 't23', merchant: 'Vé máy bay',       category: 'shopping',      type: 'expense', date: '2026-08-20', amount: 450,  status: 'completed', payment_method: 'card' },

  // July 2026
  { id: 't24', merchant: 'Lương',            category: 'income',        type: 'income',  date: '2026-07-12', amount: 4200, status: 'completed', payment_method: 'transfer' },
  { id: 't25', merchant: 'Thưởng',           category: 'income',        type: 'income',  date: '2026-07-28', amount: 1500, status: 'completed', payment_method: 'transfer' },
  { id: 't26', merchant: 'Tiền thuê nhà',     category: 'bills',       type: 'expense', date: '2026-07-01', amount: 1250, status: 'completed', payment_method: 'transfer' },
  { id: 't27', merchant: 'Nhà hàng',          category: 'food',        type: 'expense', date: '2026-07-14', amount: 480,  status: 'completed', payment_method: 'card' },
  { id: 't28', merchant: 'Xăng & xe bus',     category: 'transport',     type: 'expense', date: '2026-07-18', amount: 210,  status: 'completed', payment_method: 'cash' },
  { id: 't29', merchant: 'Điện tử',           category: 'shopping',      type: 'expense', date: '2026-07-22', amount: 390,  status: 'completed', payment_method: 'card' },

  // June 2026
  { id: 't30', merchant: 'Lương',            category: 'income',        type: 'income',  date: '2026-06-12', amount: 4200, status: 'completed', payment_method: 'transfer' },
  { id: 't31', merchant: 'Freelance',        category: 'income',        type: 'income',  date: '2026-06-19', amount: 950,  status: 'completed', payment_method: 'transfer' },
  { id: 't32', merchant: 'Tiền thuê nhà',     category: 'bills',        type: 'expense', date: '2026-06-01', amount: 1250, status: 'completed', payment_method: 'transfer' },
  { id: 't33', merchant: 'Chợ hẻo',           category: 'food',        type: 'expense', date: '2026-06-11', amount: 530,  status: 'completed', payment_method: 'cash' },
  { id: 't34', merchant: 'Tiền nước',         category: 'bills',        type: 'expense', date: '2026-06-05', amount: 85,   status: 'completed', payment_method: 'transfer' },
  { id: 't35', merchant: 'Vé concert',         category: 'entertainment', type: 'expense', date: '2026-06-25', amount: 260,  status: 'completed', payment_method: 'card' },

  // May 2026
  { id: 't36', merchant: 'Lương',            category: 'income',        type: 'income',  date: '2026-05-12', amount: 4200, status: 'completed', payment_method: 'transfer' },
  { id: 't37', merchant: 'Lợi nhuận đầu tư',  category: 'income',        type: 'income',  date: '2026-05-30', amount: 1100, status: 'completed', payment_method: 'transfer' },
  { id: 't38', merchant: 'Tiền thuê nhà',     category: 'bills',        type: 'expense', date: '2026-05-01', amount: 1250, status: 'completed', payment_method: 'transfer' },
  { id: 't39', merchant: 'Ăn uống',           category: 'food',        type: 'expense', date: '2026-05-16', amount: 410,  status: 'completed', payment_method: 'card' },
  { id: 't40', merchant: 'Khám sức khỏe',      category: 'health',        type: 'expense', date: '2026-05-20', amount: 320,  status: 'completed', payment_method: 'card' },

  // April 2026
  { id: 't41', merchant: 'Lương',            category: 'income',        type: 'income',  date: '2026-04-12', amount: 4200, status: 'completed', payment_method: 'transfer' },
  { id: 't42', merchant: 'Dự án freelance',   category: 'income',        type: 'income',  date: '2026-04-22', amount: 800,  status: 'completed', payment_method: 'transfer' },
  { id: 't43', merchant: 'Tiền thuê nhà',     category: 'bills',        type: 'expense', date: '2026-04-01', amount: 1250, status: 'completed', payment_method: 'transfer' },
  { id: 't44', merchant: 'Chợ hẻo',           category: 'food',        type: 'expense', date: '2026-04-14', amount: 490,  status: 'completed', payment_method: 'cash' },
  { id: 't45', merchant: 'Bảo trì xe',        category: 'transport',     type: 'expense', date: '2026-04-28', amount: 380,  status: 'completed', payment_method: 'card' },
];

export const DEFAULT_BUDGETS = [
  { id: 'b01', category: 'food',          limit: 800,  spent: 576  },
  { id: 'b02', category: 'transport',      limit: 300,  spent: 135  },
  { id: 'b03', category: 'entertainment',  limit: 300,  spent: 246  },
  { id: 'b04', category: 'shopping',       limit: 500,  spent: 155  },
  { id: 'b05', category: 'bills',         limit: 1500, spent: 1345  },
  { id: 'b06', category: 'health',         limit: 300,  spent: 165  },
];

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  currency: 'VND',
  payDay: '1st',
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
  { id: 'a01', name: 'Vietcombank – Thanh toán', type: 'checking', balance: 15420, currency: 'VND' },
  { id: 'a02', name: 'Techcombank – Tiết kiệm',  type: 'savings',   balance: 9160,  currency: 'VND' },
];

export const DEFAULT_GOALS = [
  { id: 'g01', name: 'Quỹ dự phòng', target: 10000, current: 6420, deadline: '2026-12-31', category: 'emergency', icon: '🛡️' },
  { id: 'g02', name: 'Du lịch Nhật Bản', target: 3500,  current: 1200, deadline: '2027-06-01', category: 'travel', icon: '✈️' },
];

export const DEFAULT_RECURRING = [
  { id: 'r01', merchant: 'Netflix', category: 'entertainment', type: 'expense', amount: 15, frequency: 'monthly', nextDate: '2026-10-01', status: 'active', icon: '🎬' },
  { id: 'r02', merchant: 'Phí bảo hiểm sức khỏe', category: 'health', type: 'expense', amount: 45, frequency: 'monthly', nextDate: '2026-10-15', status: 'active', icon: '💊' },
  { id: 'r03', merchant: 'Spotify', category: 'entertainment', type: 'expense', amount: 10, frequency: 'monthly', nextDate: '2026-10-01', status: 'active', icon: '🎵' },
];
