/**
 * @file Navigation renderer — builds sidebar, mobile bottom nav, and
 * mobile "more" sheet markup from the central route configuration.
 *
 * This ensures every nav surface reads its labels and icons from
 * src/config/routes.js rather than duplicating them in static HTML.
 */

import { ROUTES, MOBILE_PRIMARY_PATHS } from '../../config/routes.js';

/**
 * Wrap icon path data in the standard nav SVG element.
 * @param {string} pathData
 * @returns {string}
 */
function navIconSVG(pathData) {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathData}</svg>`;
}

/**
 * Render the desktop sidebar navigation list.
 * @returns {string} HTML string of <li> items
 */
export function renderSidebarNav() {
  return ROUTES.map(route => `
    <li><button type="button" class="nav-link" id="nav-${route.path}" data-page="${route.path}" data-tooltip="${route.label}" title="${route.label}" role="menuitem">
      <span class="nav-icon" aria-hidden="true">${navIconSVG(route.icon)}</span>
      <span class="nav-label" data-i18n="nav.${route.path}">${route.label}</span>
    </button></li>`).join('');
}

/**
 * Render the mobile bottom navigation list.
 * Renders 5 main navigation items (4 primary routes + 1 "More" button).
 * @returns {string} HTML string of <li> items
 */
export function renderMobileBottomNav() {
  const primary = ROUTES.filter(r => MOBILE_PRIMARY_PATHS.has(r.path));

  let html = '';
  primary.forEach(route => {
    html += `
    <li><button type="button" class="nav-link mobile-nav-item" id="mnav-${route.path}" data-page="${route.path}" role="menuitem" aria-label="${route.label}" data-i18n-aria="nav.${route.path}">
      <span class="mobile-nav-icon" aria-hidden="true">${navIconSVG(route.icon)}</span>
      <span class="mobile-nav-label" data-i18n="nav.${route.path}">${route.label}</span>
    </button></li>`;
  });

  html += `
    <li>
      <button type="button" class="nav-link mobile-nav-item" id="mobile-nav-more" aria-label="Xem thêm" data-i18n-aria="app.aria.viewMore" aria-haspopup="menu" aria-expanded="false">
        <span class="mobile-nav-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></span>
        <span class="mobile-nav-label" data-i18n="app.aria.viewMore">Thêm</span>
      </button>
    </li>`;

  return html;
}

/**
 * Render the mobile "more" sheet list (non-primary routes).
 * @returns {string} HTML string of <li> items
 */
export function renderMobileMoreSheet() {
  const more = ROUTES.filter(r => !MOBILE_PRIMARY_PATHS.has(r.path));
  return more.map(route => `
    <li><button type="button" class="mobile-more-link" id="mnav-${route.path}" data-page="${route.path}">
      <span class="mobile-nav-icon" aria-hidden="true">${navIconSVG(route.icon)}</span>
      <span data-i18n="nav.mobileMore.${route.path}">${route.label}</span>
    </button></li>`).join('');
}

/**
 * Inject all nav markup into the DOM. Call once during app bootstrap,
 * before event-listener attachment.
 */
export function injectNavMarkup() {
  const sidebarList = document.getElementById('sidebar-nav-list');
  if (sidebarList) sidebarList.innerHTML = renderSidebarNav();

  const mobileNavList = document.getElementById('mobile-nav-list');
  if (mobileNavList) mobileNavList.innerHTML = renderMobileBottomNav();

  const moreList = document.getElementById('mobile-more-list');
  if (moreList) moreList.innerHTML = renderMobileMoreSheet();
}
