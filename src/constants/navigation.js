/**
 * @file Navigation configuration — re-exports the single source of truth
 * from src/config/routes.js so existing import paths keep working.
 *
 * @typedef {Object} NavItem
 * @property {string} id        DOM id for the nav link (kept stable for tests)
 * @property {string} page      Route/page identifier (alias of `path`)
 * @property {string} label     Display label (sidebar nav)
 * @property {string} title     Page-header / document.title label
 * @property {string} description  Page-header subtitle
 * @property {string} icon      Inline SVG path data
 */

import { ROUTES, DEFAULT_PAGE, getRoute, getPageDocumentTitle } from '../config/routes.js';

/**
 * Build the legacy NAVIGATION_ITEMS array from the canonical route config,
 * adding the `id` field used by the HTML / tests.
 */
export const NAVIGATION_ITEMS = ROUTES.map(route => ({
  id: `nav-${route.path}`,
  page: route.path,
  label: route.label,
  title: route.title,
  description: route.description,
  icon: route.icon,
}));

export { DEFAULT_PAGE, ROUTES, getRoute, getPageDocumentTitle };

/**
 * Find nav item by page name.
 * @param {string} page
 * @returns {{id:string,page:string,label:string,title:string,description:string,icon:string}|null}
 */
export function getNavItem(page) {
  const route = getRoute(page);
  if (!route) return null;
  return { id: `nav-${route.path}`, page: route.path, ...route };
}
