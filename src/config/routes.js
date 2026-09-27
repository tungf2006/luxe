/**
 * @file Route configuration — single source of truth for all route metadata.
 *
 * Every piece of UI that displays a page name (sidebar, topbar title,
 * page header, breadcrumb, document.title) reads from this file.
 *
 * @typedef {Object} Route
 * @property {string} path          Hash route segment (e.g. 'dashboard')
 * @property {string} label         Sidebar / nav label
 * @property {string} title         Page-header title, breadcrumb, document.title base
 * @property {string} description   Page-header description
 * @property {string} icon          Inline SVG path data
 */

export const APP_NAME = 'Luxe';

export const ROUTES = [
  {
    path: 'dashboard',
    label: 'Tổng quan',
    title: 'Tổng quan',
    description: 'Tổng quan tài chính của bạn hôm nay',
    icon: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  },
  {
    path: 'transactions',
    label: 'Giao dịch',
    title: 'Giao dịch',
    description: 'Lịch sử đầy đủ hoạt động tài chính của bạn',
    icon: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  },
  {
    path: 'budgets',
    label: 'Ngân sách',
    title: 'Ngân sách',
    description: 'Theo dõi và kiểm soát giới hạn chi tiêu của bạn',
    icon: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  },
  {
    path: 'reports',
    label: 'Báo cáo',
    title: 'Báo cáo',
    description: 'Những hiểu biết sâu về sức khỏe tài chính của bạn',
    icon: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  },
  {
    path: 'goals',
    label: 'Mục tiêu',
    title: 'Mục tiêu',
    description: 'Theo dõi tiến độ và đạt được mục tiêu của bạn',
    icon: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  },
  {
    path: 'recurring',
    label: 'Giao dịch định kỳ',
    title: 'Giao dịch định kỳ',
    description: 'Quản lý các khoản thu chi lặp lại hàng tháng',
    icon: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  },
  {
    path: 'accounts',
    label: 'Tài khoản',
    title: 'Tài khoản',
    description: 'Quản lý tất cả tài khoản và ví của bạn',
    icon: '<path d="M10 18v-7"/><path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
  },
  {
    path: 'settings',
    label: 'Cài đặt',
    title: 'Cài đặt',
    description: 'Quản lý tài khoản và tuỳ chọn ứng dụng',
    icon: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
  },
];

/**
 * Routes shown as icon-only items in the mobile bottom nav.
 * All other routes appear in the mobile "more" sheet.
 */
export const MOBILE_PRIMARY_PATHS = new Set(['dashboard', 'transactions', 'budgets', 'reports']);

export const DEFAULT_PAGE = 'dashboard';

/**
 * Find a route by path/page name.
 * @param {string} path
 * @returns {Route | undefined}
 */
export function getRoute(path) {
  return ROUTES.find(r => r.path === path);
}

/**
 * Find a route by page name (backward-compatible alias).
 * @param {string} page
 * @returns {Route | null}
 */
export function getNavItem(page) {
  return getRoute(page) || null;
}

/**
 * Build the document.title value for a given page.
 * Pattern: "<title> · <appName>", e.g. "Tổng quan · Luxe".
 * Returns just the app name for pages not in the route config
 * (login, onboarding, loading, etc.).
 * @param {string} path
 * @returns {string}
 */
export function getPageDocumentTitle(path) {
  const route = getRoute(path);
  return route ? `${route.title} · ${APP_NAME}` : APP_NAME;
}
