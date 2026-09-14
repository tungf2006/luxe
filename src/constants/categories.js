/**
 * @file Category definitions for transactions and budgets.
 * Categories are the single source of truth — used by forms, tables,
 * budgets, and reports. New categories can be added here.
 * @typedef {Object} Category
 * @property {string} id          URL-safe slug (e.g. 'food')
 * @property {string} key         Identifier used in Transaction.category & Budget.category
 * @property {string} name        Display label shown in UI
 * @property {string} icon        Emoji identifier
 * @property {string} color       Hex color
 * @property {'income'|'expense'} type  Financial direction
 */
export const CATEGORIES = [
  { id: 'income',          key: 'Income',         name: 'Thu nhập',               icon: '💼', color: '#6366F1', type: 'income'   },
  { id: 'food',            key: 'Food',           name: 'Thức ăn & Ăn uống',       icon: '🛒', color: '#F59E0B', type: 'expense'  },
  { id: 'transport',       key: 'Transport',      name: 'Giao thông',             icon: '🚌', color: '#38BDF8', type: 'expense'  },
  { id: 'entertainment',   key: 'Entertainment',  name: 'Giải trí',               icon: '🎬', color: '#A78BDA', type: 'expense'  },
  { id: 'shopping',        key: 'Shopping',       name: 'Mua sắm',                icon: '🛍️', color: '#22C55E', type: 'expense'  },
  { id: 'bills',           key: 'Bills',          name: 'Hóa đơn & Tiện ích',     icon: '⚡', color: '#F43F5E', type: 'expense'  },
  { id: 'health',          key: 'Health',         name: 'Sức khỏe',               icon: '💊', color: '#14B8A3', type: 'expense'  },
  { id: 'other',           key: 'Other',          name: 'Khác',                   icon: '📦', color: '#64748B', type: 'expense'  },
];

/** Quick lookup map: key → Category */
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

/** Quick lookup map: category key → emoji icon (backward-compatible with original CATEGORY_ICONS) */
export const CATEGORY_ICONS = Object.fromEntries(CATEGORIES.map(c => [c.key, c.icon]));

/** Categories for expense-type transactions (excludes Income) */
export const EXPENSE_CATEGORIES = CATEGORIES.filter(c => c.type === 'expense');
