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
  { id: 'income',       labelVi: 'Thu nhập',             labelEn: 'Income',              icon: '💼', color: '#10B981', type: 'income'   },
  { id: 'food',         labelVi: 'Thức ăn & Ăn uống',      labelEn: 'Food',                icon: '🛒', color: '#F59E0B', type: 'expense'  },
  { id: 'transport',    labelVi: 'Di chuyển',              labelEn: 'Transport',           icon: '🚌', color: '#38BDF8', type: 'expense'  },
  { id: 'entertainment',labelVi: 'Giải trí',               labelEn: 'Entertainment',       icon: '🎬', color: '#A78BDA', type: 'expense'  },
  { id: 'shopping',     labelVi: 'Mua sắm',                labelEn: 'Shopping',            icon: '🛍️', color: '#22C55E', type: 'expense'  },
  { id: 'bills',        labelVi: 'Hóa đơn & Tiện ích',     labelEn: 'Bills',               icon: '⚡', color: '#F43F5E', type: 'expense'  },
  { id: 'health',       labelVi: 'Sức khỏe',               labelEn: 'Health',              icon: '💊', color: '#14B8A3', type: 'expense'  },
  { id: 'other',        labelVi: 'Khác',                   labelEn: 'Other',               icon: '📦', color: '#64748B', type: 'expense'  },
];

export const CATEGORY_SVGS = {
  income: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  food: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  transport: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  entertainment: '<polygon points="5 3 19 12 5 21 5 3"/>',
  shopping: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  bills: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  health: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  transfer: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  refund: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  other: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
};

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

/**
 * Get SVG icon path for a category id.
 * @param {string} id
 * @returns {string}
 */
export function getCategorySvg(id) {
  return CATEGORY_SVGS[id] || CATEGORY_SVGS.other;
}

/**
 * Get a refined tinted avatar badge HTML for a category.
 * @param {string} id
 * @param {'sm'|'md'} [size='sm']
 * @returns {string} HTML snippet
 */
export function getCategoryAvatarHtml(id, size = 'sm') {
  const color = getCategoryColor(id);
  const svg = getCategorySvg(id);
  const iconPx = size === 'md' ? '16' : '14';
  return `<span class="category-avatar-badge ${size === 'md' ? 'category-avatar-md' : 'category-avatar-sm'}" style="background:${color}18;color:${color};border:1px solid ${color}33;" aria-hidden="true"><svg width="${iconPx}" height="${iconPx}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg}</svg></span>`;
}