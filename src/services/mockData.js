/**
 * @file Static mock data — dynamic default seed generator for localStorage.
 * Generates relative dates based on local time so charts and sparklines
 * always have fresh, rich data regardless of when the app is opened.
 *
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

import { daysAgoDateString, monthsAgoDateString, getLocalDateString } from '../utils/format.js';

export function getDefaultTransactions(baseDate = new Date()) {
  const dOffset = (days) => daysAgoDateString(days, baseDate);
  const mOffset = (months, day = 15) => monthsAgoDateString(months, day, baseDate);

  return [
    // Current Period — Income
    { id: 't01', merchant: 'Lương tháng',            category: 'income',        type: 'income',  date: dOffset(1), amount: 22000000, status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't02', merchant: 'Dự án freelance UI/UX',  category: 'income',        type: 'income',  date: dOffset(4), amount: 8500000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't02b', merchant: 'Tạm ứng phụ cấp dự án', category: 'income',        type: 'income',  date: dOffset(2), amount: 2000000,  status: 'pending',   payment_method: 'transfer', isSeed: true },

    // Recent Attention & State Variation Transactions (Pending / Failed / Cancelled)
    { id: 't_p1', merchant: 'Chuyển tiền tiết kiệm gửi góp', category: 'bills',   type: 'expense', date: dOffset(0), amount: 3000000, status: 'pending',   payment_method: 'transfer', isSeed: true },
    { id: 't_f1', merchant: 'Thanh toán thẻ POS Lotte Mart', category: 'food',    type: 'expense', date: dOffset(0), amount: 489000,  status: 'failed',    payment_method: 'card',     isSeed: true },
    { id: 't_c1', merchant: 'Hoàn huỷ vé xem concert âm nhạc', category: 'entertainment', type: 'expense', date: dOffset(0), amount: 1500000, status: 'cancelled', payment_method: 'card', isSeed: true },
    { id: 't_p2', merchant: 'Nạp ví ShopeePay thanh toán',   category: 'shopping',type: 'expense', date: dOffset(1), amount: 500000,  status: 'pending',   payment_method: 'ewallet',  isSeed: true },
    { id: 't_f2', merchant: 'Cước Internet VNPT (lỗi kết nối)', category: 'bills',type: 'expense', date: dOffset(3), amount: 280000,  status: 'failed',    payment_method: 'transfer', isSeed: true },

    // Last 7 Days (days 0..6) — Coverage across ALL budget categories
    // Food & Dining (7-day rich series)
    { id: 't03', merchant: 'Siêu thị Co.opmart',      category: 'food',          type: 'expense', date: dOffset(0), amount: 286000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't04', merchant: 'Cà phê Highlands',       category: 'food',          type: 'expense', date: dOffset(1), amount: 45000,   status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't05', merchant: 'Bánh mì & Ăn sáng',      category: 'food',          type: 'expense', date: dOffset(2), amount: 35000,   status: 'completed', payment_method: 'cash', isSeed: true },
    { id: 't06', merchant: 'Cơm trưa văn phòng',     category: 'food',          type: 'expense', date: dOffset(3), amount: 65000,   status: 'completed', payment_method: 'ewallet', isSeed: true },
    { id: 't07', merchant: 'Nhà hàng lẩu cuối tuần', category: 'food',          type: 'expense', date: dOffset(4), amount: 550000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't08', merchant: 'Trà sữa Koi Thé',        category: 'food',          type: 'expense', date: dOffset(5), amount: 65000,   status: 'completed', payment_method: 'ewallet', isSeed: true },
    { id: 't09', merchant: 'Chợ rau củ tươi',        category: 'food',          type: 'expense', date: dOffset(6), amount: 120000,  status: 'completed', payment_method: 'cash', isSeed: true },

    // Transport (7-day activity)
    { id: 't10', merchant: 'GrabBike đi làm',        category: 'transport',     type: 'expense', date: dOffset(0), amount: 38000,   status: 'completed', payment_method: 'ewallet', isSeed: true },
    { id: 't11', merchant: 'GrabCar gặp khách hàng', category: 'transport',     type: 'expense', date: dOffset(1), amount: 120000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't12', merchant: 'Xăng xe Petrolimex',     category: 'transport',     type: 'expense', date: dOffset(3), amount: 80000,   status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't13', merchant: 'Nạp thẻ thu phí ePass',  category: 'transport',     type: 'expense', date: dOffset(5), amount: 200000,  status: 'completed', payment_method: 'transfer', isSeed: true },

    // Entertainment (7-day activity)
    { id: 't14', merchant: 'Vé xem phim CGV',        category: 'entertainment', type: 'expense', date: dOffset(1), amount: 180000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't15', merchant: 'Steam Game Store',       category: 'entertainment', type: 'expense', date: dOffset(3), amount: 350000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't16', merchant: 'Netflix Premium',        category: 'entertainment', type: 'expense', date: dOffset(5), amount: 260000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't17', merchant: 'Spotify Family Plan',    category: 'entertainment', type: 'expense', date: dOffset(6), amount: 59000,   status: 'completed', payment_method: 'card', isSeed: true },

    // Shopping (7-day activity)
    { id: 't18', merchant: 'Shopee Đồ gia dụng',     category: 'shopping',      type: 'expense', date: dOffset(0), amount: 245000,  status: 'completed', payment_method: 'ewallet', isSeed: true },
    { id: 't19', merchant: 'Uniqlo Quần áo',         category: 'shopping',      type: 'expense', date: dOffset(2), amount: 650000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't20', merchant: 'Nhà sách Fahasa',        category: 'shopping',      type: 'expense', date: dOffset(4), amount: 180000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't21', merchant: 'Tiki Văn phòng phẩm',    category: 'shopping',      type: 'expense', date: dOffset(6), amount: 120000,  status: 'completed', payment_method: 'ewallet', isSeed: true },

    // Bills & Utilities (7-day activity)
    { id: 't22', merchant: 'Tiền điện EVN',          category: 'bills',         type: 'expense', date: dOffset(1), amount: 850000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't23', merchant: 'Tiền nước sinh hoạt',    category: 'bills',         type: 'expense', date: dOffset(3), amount: 120000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't24', merchant: 'Cước Internet Viettel',  category: 'bills',         type: 'expense', date: dOffset(5), amount: 250000,  status: 'completed', payment_method: 'transfer', isSeed: true },

    // Health & Medical (7-day activity)
    { id: 't25', merchant: 'Nhà thuốc Pharmacity',   category: 'health',        type: 'expense', date: dOffset(2), amount: 150000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't26', merchant: 'Khám răng định kỳ',      category: 'health',        type: 'expense', date: dOffset(4), amount: 500000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't27', merchant: 'Vitamin & Thực phẩm bổ sung', category: 'health',   type: 'expense', date: dOffset(6), amount: 350000,  status: 'completed', payment_method: 'card', isSeed: true },

    // Earlier in current month
    { id: 't28', merchant: 'Tiền thuê căn hộ',       category: 'bills',         type: 'expense', date: dOffset(12), amount: 7500000, status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't29', merchant: 'Apple Store Phụ kiện',   category: 'shopping',      type: 'expense', date: dOffset(8), amount: 1490000, status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't30', merchant: 'Bảo hiểm sức khỏe Liberty', category: 'health',     type: 'expense', date: dOffset(12), amount: 450000, status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't31', merchant: 'Bảo dưỡng xe máy Honda', category: 'transport',     type: 'expense', date: dOffset(9), amount: 350000,  status: 'completed', payment_method: 'card', isSeed: true },

    // Month 1 Ago
    { id: 't32', merchant: 'Lương tháng',            category: 'income',        type: 'income',  date: mOffset(1, 12), amount: 22000000, status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't33', merchant: 'Tư vấn giải pháp AI',    category: 'income',        type: 'income',  date: mOffset(1, 18), amount: 8000000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't34', merchant: 'Tiền thuê căn hộ',       category: 'bills',         type: 'expense', date: mOffset(1, 1),  amount: 7500000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't35', merchant: 'Siêu thị Mega Market',   category: 'food',          type: 'expense', date: mOffset(1, 10), amount: 1850000,  status: 'completed', payment_method: 'cash', isSeed: true },
    { id: 't36', merchant: 'Tiền điện sinh hoạt',    category: 'bills',         type: 'expense', date: mOffset(1, 8),  amount: 780000,   status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't37', merchant: 'Vé máy bay Vietjet',     category: 'shopping',      type: 'expense', date: mOffset(1, 20), amount: 2450000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't38', merchant: 'Xăng xe di chuyển',      category: 'transport',     type: 'expense', date: mOffset(1, 16), amount: 350000,   status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't39', merchant: 'Khám sức khỏe tổng quát', category: 'health',       type: 'expense', date: mOffset(1, 22), amount: 850000,   status: 'completed', payment_method: 'card', isSeed: true },

    // Month 2 Ago
    { id: 't40', merchant: 'Lương tháng',            category: 'income',        type: 'income',  date: mOffset(2, 12), amount: 22000000, status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't41', merchant: 'Thưởng dự án quý',       category: 'income',        type: 'income',  date: mOffset(2, 28), amount: 12000000, status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't42', merchant: 'Tiền thuê căn hộ',       category: 'bills',         type: 'expense', date: mOffset(2, 1),  amount: 7500000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't43', merchant: 'Nhà hàng & Ẩm thực',     category: 'food',          type: 'expense', date: mOffset(2, 14), amount: 1480000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't44', merchant: 'Xăng xe & Giao thông',   category: 'transport',     type: 'expense', date: mOffset(2, 18), amount: 420000,   status: 'completed', payment_method: 'cash', isSeed: true },
    { id: 't45', merchant: 'Thiết bị điện tử',       category: 'shopping',      type: 'expense', date: mOffset(2, 22), amount: 2390000,  status: 'completed', payment_method: 'card', isSeed: true },

    // Month 3 Ago
    { id: 't46', merchant: 'Lương tháng',            category: 'income',        type: 'income',  date: mOffset(3, 12), amount: 22000000, status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't47', merchant: 'Freelance Design',       category: 'income',        type: 'income',  date: mOffset(3, 19), amount: 6500000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't48', merchant: 'Tiền thuê căn hộ',       category: 'bills',         type: 'expense', date: mOffset(3, 1),  amount: 7500000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't49', merchant: 'Ăn uống & Chợ truyền thống', category: 'food',      type: 'expense', date: mOffset(3, 11), amount: 1530000,  status: 'completed', payment_method: 'cash', isSeed: true },
    { id: 't50', merchant: 'Tiền nước & tiện ích',   category: 'bills',         type: 'expense', date: mOffset(3, 5),  amount: 185000,   status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't51', merchant: 'Vé liveshow âm nhạc',    category: 'entertainment', type: 'expense', date: mOffset(3, 25), amount: 1260000,  status: 'completed', payment_method: 'card', isSeed: true },

    // Month 4 Ago
    { id: 't52', merchant: 'Lương tháng',            category: 'income',        type: 'income',  date: mOffset(4, 12), amount: 22000000, status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't53', merchant: 'Lợi nhuận đầu tư',       category: 'income',        type: 'income',  date: mOffset(4, 30), amount: 5500000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't54', merchant: 'Tiền thuê căn hộ',       category: 'bills',         type: 'expense', date: mOffset(4, 1),  amount: 7500000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't55', merchant: 'Ăn uống ngoài',          category: 'food',          type: 'expense', date: mOffset(4, 16), amount: 1410000,  status: 'completed', payment_method: 'card', isSeed: true },
    { id: 't56', merchant: 'Thuốc men y tế',         category: 'health',        type: 'expense', date: mOffset(4, 20), amount: 420000,   status: 'completed', payment_method: 'card', isSeed: true },

    // Month 5 Ago
    { id: 't57', merchant: 'Lương tháng',            category: 'income',        type: 'income',  date: mOffset(5, 12), amount: 22000000, status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't58', merchant: 'Dự án freelance lập trình', category: 'income',     type: 'income',  date: mOffset(5, 22), amount: 5000000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't59', merchant: 'Tiền thuê căn hộ',       category: 'bills',         type: 'expense', date: mOffset(5, 1),  amount: 7500000,  status: 'completed', payment_method: 'transfer', isSeed: true },
    { id: 't60', merchant: 'Chợ đầu mối & ăn uống',  category: 'food',          type: 'expense', date: mOffset(5, 14), amount: 1490000,  status: 'completed', payment_method: 'cash', isSeed: true },
    { id: 't61', merchant: 'Bảo trì sửa chữa xe',    category: 'transport',     type: 'expense', date: mOffset(5, 28), amount: 680000,   status: 'completed', payment_method: 'card', isSeed: true },
  ];
}

export function getDefaultBudgets() {
  return [
    { id: 'b01', category: 'food',          limit: 3500000, spent: 0, isSeed: true },
    { id: 'b02', category: 'transport',     limit: 1200000, spent: 0, isSeed: true },
    { id: 'b03', category: 'entertainment', limit: 1000000, spent: 0, isSeed: true },
    { id: 'b04', category: 'shopping',      limit: 2000000, spent: 0, isSeed: true },
    { id: 'b05', category: 'bills',         limit: 9000000, spent: 0, isSeed: true },
    { id: 'b06', category: 'health',        limit: 1000000, spent: 0, isSeed: true },
  ];
}

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

export function getDefaultAccounts() {
  return [
    { id: 'a01', name: 'Vietcombank – Thanh toán', type: 'checking', balance: 28500000, currency: 'VND', isSeed: true },
    { id: 'a02', name: 'Techcombank – Tiết kiệm',  type: 'savings',  balance: 18000000, currency: 'VND', isSeed: true },
    { id: 'a03', name: 'Tiền mặt',                type: 'checking', balance: 3500000,  currency: 'VND', isSeed: true },
  ];
}

export function getDefaultGoals(baseDate = new Date()) {
  const currentYear = baseDate.getFullYear();
  return [
    { id: 'g01', name: 'Quỹ dự phòng', target: 60000000, current: 35000000, deadline: `${currentYear}-12-31`, category: 'emergency', icon: '🛡️', isSeed: true },
    { id: 'g02', name: 'Du lịch Nhật Bản', target: 30000000, current: 12000000, deadline: `${currentYear + 1}-06-01`, category: 'travel', icon: '✈️', isSeed: true },
  ];
}

export function getDefaultRecurring(baseDate = new Date()) {
  const nextMonthDate = (day = 1) => {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, day);
    return getLocalDateString(d);
  };

  return [
    { id: 'r01', merchant: 'Netflix', category: 'entertainment', type: 'expense', amount: 260000, frequency: 'monthly', nextDate: nextMonthDate(1), status: 'active', icon: '🎬', isSeed: true },
    { id: 'r02', merchant: 'Phí bảo hiểm sức khỏe', category: 'health', type: 'expense', amount: 450000, frequency: 'monthly', nextDate: nextMonthDate(15), status: 'active', icon: '💊', isSeed: true },
    { id: 'r03', merchant: 'Spotify', category: 'entertainment', type: 'expense', amount: 59000, frequency: 'monthly', nextDate: nextMonthDate(1), status: 'active', icon: '🎵', isSeed: true },
  ];
}

export function getDefaultNotifications(baseDate = new Date()) {
  const now = baseDate.getTime();
  const minsAgo = (m) => new Date(now - m * 60 * 1000).toISOString();
  const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();
  const daysAgo = (d) => new Date(now - d * 86400 * 1000).toISOString();

  return [
    {
      id: 'notif_01',
      type: 'warning',
      category: 'budget',
      title: 'Cảnh báo hạn mức ngân sách',
      message: 'Ngân sách "Ăn uống & Nhà hàng" đã đạt 85% hạn mức cho phép trong tháng này.',
      is_read: false,
      action_label: 'Xem ngân sách',
      action_url: '#/budgets',
      created_at: minsAgo(25),
    },
    {
      id: 'notif_02',
      type: 'bill',
      category: 'bill',
      title: 'Nhắc hoá đơn định kỳ',
      message: 'Hoá đơn Cước Internet VNPT (280.000₫) sẽ đến hạn thanh toán trong 3 ngày tới.',
      is_read: false,
      action_label: 'Kiểm tra chi tiết',
      action_url: '#/budgets',
      created_at: hoursAgo(2),
    },
    {
      id: 'notif_03',
      type: 'insight',
      category: 'insight',
      title: 'Đề xuất tài chính thông minh',
      message: 'Tỷ lệ tiết kiệm tháng này của bạn đạt 32%, vượt mục tiêu đề ra 7%. Xem báo cáo phân tích!',
      is_read: false,
      action_label: 'Xem báo cáo',
      action_url: '#/reports',
      created_at: hoursAgo(5),
    },
    {
      id: 'notif_04',
      type: 'system',
      category: 'system',
      title: 'Cập nhật bảo mật & tính năng',
      message: 'Phiên bản Luxe 2.5 đã sẵn sàng với bộ lọc giao dịch nâng cao và giao diện thông báo trực quan.',
      is_read: true,
      action_label: 'Khám phá',
      action_url: '#/settings',
      created_at: daysAgo(1),
    },
    {
      id: 'notif_05',
      type: 'success',
      category: 'income',
      title: 'Khoản tiền gửi tiết kiệm đã cộng',
      message: 'Đã nhận lãi định kỳ 120.000₫ vào tài khoản Techcombank Tiết kiệm.',
      is_read: true,
      action_label: 'Xem giao dịch',
      action_url: '#/transactions',
      created_at: daysAgo(2),
    },
  ];
}

export const DEFAULT_TRANSACTIONS = getDefaultTransactions();
export const DEFAULT_BUDGETS = getDefaultBudgets();
export const DEFAULT_ACCOUNTS = getDefaultAccounts();
export const DEFAULT_GOALS = getDefaultGoals();
export const DEFAULT_RECURRING = getDefaultRecurring();
export const DEFAULT_NOTIFICATIONS = getDefaultNotifications();
