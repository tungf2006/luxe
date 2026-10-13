/**
 * @file Goal categories and metadata definitions.
 * Single source of truth for financial goals across Luxe.
 */

export const GOAL_CATEGORIES = [
  {
    id: 'savings',
    labelVi: 'Tiết kiệm',
    labelEn: 'Savings',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.16)',
    border: 'rgba(16, 185, 129, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
  },
  {
    id: 'emergency',
    labelVi: 'Quỹ dự phòng',
    labelEn: 'Emergency Fund',
    color: '#F43F5E',
    bg: 'rgba(244, 63, 94, 0.16)',
    border: 'rgba(244, 63, 94, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  },
  {
    id: 'investment',
    labelVi: 'Đầu tư',
    labelEn: 'Investment',
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.16)',
    border: 'rgba(99, 102, 241, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  },
  {
    id: 'travel',
    labelVi: 'Du lịch',
    labelEn: 'Travel',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.16)',
    border: 'rgba(245, 158, 11, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
  },
  {
    id: 'education',
    labelVi: 'Học tập & Kỹ năng',
    labelEn: 'Education',
    color: '#A855F7',
    bg: 'rgba(168, 85, 247, 0.16)',
    border: 'rgba(168, 85, 247, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  },
  {
    id: 'vehicle',
    labelVi: 'Mua xe',
    labelEn: 'Vehicle',
    color: '#EC4899',
    bg: 'rgba(236, 72, 153, 0.16)',
    border: 'rgba(236, 72, 153, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  },
  {
    id: 'house',
    labelVi: 'Mua nhà',
    labelEn: 'Real Estate',
    color: '#14B8A6',
    bg: 'rgba(20, 184, 166, 0.16)',
    border: 'rgba(20, 184, 166, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  },
  {
    id: 'retirement',
    labelVi: 'Hưu trí',
    labelEn: 'Retirement',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.16)',
    border: 'rgba(56, 189, 248, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  },
  {
    id: 'other',
    labelVi: 'Khác',
    labelEn: 'Other',
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.16)',
    border: 'rgba(148, 163, 184, 0.3)',
    iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  },
];

export const GOAL_CATEGORY_MAP = new Map(GOAL_CATEGORIES.map(c => [c.id, c]));

/**
 * Get category metadata by ID with robust fallback.
 * @param {string} id
 * @returns {typeof GOAL_CATEGORIES[0]}
 */
export function getGoalCategory(id) {
  return GOAL_CATEGORY_MAP.get(id) || GOAL_CATEGORY_MAP.get('other');
}

/**
 * Quick Goal Presets / Templates for instant autofill.
 */
export const GOAL_PRESETS = [
  {
    name: 'Quỹ dự phòng 6 tháng',
    category: 'emergency',
    target: 30000000,
    current: 0,
    months: 6,
  },
  {
    name: 'Du lịch Nhật Bản',
    category: 'travel',
    target: 25000000,
    current: 0,
    months: 8,
  },
  {
    name: 'Mua MacBook Pro M3',
    category: 'savings',
    target: 40000000,
    current: 5000000,
    months: 6,
  },
  {
    name: 'Đầu tư tích lũy ETF',
    category: 'investment',
    target: 50000000,
    current: 0,
    months: 12,
  },
  {
    name: 'Mua xe máy mới',
    category: 'vehicle',
    target: 35000000,
    current: 0,
    months: 10,
  },
  {
    name: 'Khóa học chứng chỉ quốc tế',
    category: 'education',
    target: 15000000,
    current: 0,
    months: 4,
  },
];
