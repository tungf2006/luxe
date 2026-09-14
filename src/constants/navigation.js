/**
 * @file Navigation configuration for Luxe dashboard.
 * Defines all primary navigation items shown in the header.
 * @typedef {Object} NavItem
 * @property {string} id        DOM id for the nav link (kept stable for tests)
 * @property {string} page      Route/page identifier
 * @property {string} label     Display label
 * @property {string} icon      SVG icon name (resolved in render)
 */
export const NAVIGATION_ITEMS = [
  { id: 'nav-dashboard',    page: 'dashboard',    label: 'Bảng điều khiển',  icon: 'dashboard' },
  { id: 'nav-transactions', page: 'transactions', label: 'Giao dịch',        icon: 'transactions' },
  { id: 'nav-budgets',      page: 'budgets',      label: 'Ngân sách',        icon: 'budgets' },
  { id: 'nav-reports',      page: 'reports',      label: 'Báo cáo',          icon: 'reports' },
  { id: 'nav-settings',     page: 'settings',     label: 'Cài đặt',          icon: 'settings' },
];

export const DEFAULT_PAGE = 'dashboard';
