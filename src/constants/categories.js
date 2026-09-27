/**
 * @file Category definitions for transactions and budgets.
 * Categories are the single source of truth — used by forms, tables,
 * budgets, reports, and charts. New categories can be added here.
 * @typedef {Object} Category
 * @property {string} id          URL-safe slug (e.g. 'food') - canonical identifier
 * @property {string} labelVi     Vietnamese display label
 * @property {string} labelEn     English display label
 * @property {string} icon        Emoji identifier
 * @property {string} color       Hex color
 * @property {'income'|'expense'} type  Financial direction
 */
export const CATEGORIES = [
  { id: 'income',       labelVi: 'Thu nhập',             labelEn: 'Income',              icon: '💼', color: '#6366F1', type: 'income'   },
  { id: 'food',         labelVi: 'Thức ăn & Ăn uống',      labelEn: 'Food',                icon: '🛒', color: '#F59E0B', type: 'expense'  },
  { id: 'transport',    labelVi: 'Di chuyển',              labelEn: 'Transport',           icon: '🚌', color: '#38BDF8', type: 'expense'  },
  { id: 'entertainment',labelVi: 'Giải trí',               labelEn: 'Entertainment',       icon: '🎬', color: '#A78BDA', type: 'expense'  },
  { id: 'shopping',     labelVi: 'Mua sắm',                labelEn: 'Shopping',            icon: '🛍️', color: '#22C55E', type: 'expense'  },
  { id: 'bills',        labelVi: 'Hóa đơn & Tiện ích',     labelEn: 'Bills',               icon: '⚡', color: '#F43F5E', type: 'expense'  },
  { id: 'health',       labelVi: 'Sức khỏe',               labelEn: 'Health',              icon: '💊', color: '#14B8A3', type: 'expense'  },
  { id: 'other',        labelVi: 'Khác',                   labelEn: 'Other',               icon: '📦', color: '#64748B', type: 'expense'  },
];

/** Quick lookup map: id → Category */
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

/** Quick lookup map: id → emoji icon */
export const CATEGORY_ICONS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.icon]));

/** Categories for expense-type transactions (excludes Income), in display order */
export const EXPENSE_CATEGORIES = CATEGORIES.filter(c => c.type === 'expense');

/**
 * Get a category by its canonical id.
 * @param {string} id
 * @returns {Category|undefined}
 */
export function getCategory(id) {
  return CATEGORY_MAP[id];
}

/**
 * Get Vietnamese label for a category id.
 * @param {string} id
 * @returns {string}
 */
export function getCategoryLabelVi(id) {
  return CATEGORY_MAP[id]?.labelVi || id;
}

/**
 * Get English label for a category id.
 * @param {string} id
 * @returns {string}
 */
export function getCategoryLabelEn(id) {
  return CATEGORY_MAP[id]?.labelEn || id;
}

/**
 * Get color for a category id.
 * @param {string} id
 * @returns {string}
 */
export function getCategoryColor(id) {
  return CATEGORY_MAP[id]?.color || '#64748B';
}

/**
 * Get icon for a category id.
 * @param {string} id
 * @returns {string}
 */
export function getCategoryIcon(id) {
  return CATEGORY_MAP[id]?.icon || '📦';
}