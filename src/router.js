/**
 * @file SPA router — maps routes to feature render functions.
 * Listens for 'navigate' and 'data:changed' events from the event bus.
 */

import { on } from './utils/eventBus.js';
import { DEFAULT_PAGE } from './constants/navigation.js';

import * as dashboardView     from './features/dashboard/dashboardView.js';
import * as transactionsView  from './features/transactions/transactionsView.js';
import * as budgetsView       from './features/budgets/budgetsView.js';
import * as reportsView       from './features/reports/reportsView.js';
import * as settingsView     from './features/settings/settingsView.js';

/**
 * Registry: page name → feature module with a `render(container)` export.
 */
const PAGE_RENDERERS = {
  dashboard:     dashboardView,
  transactions:  transactionsView,
  budgets:       budgetsView,
  reports:       reportsView,
  settings:      settingsView,
};

let currentPage = null;
let _pageContainer = null;

/**
 * Navigate to a page by name.
 * @param {string} page
 */
export function navigateTo(page) {
  if (!PAGE_RENDERERS[page]) return;
  currentPage = page;

  // Update nav link active state
  document.querySelectorAll('.nav-link').forEach(link => {
    const isActive = link.dataset.page === page;
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Close mobile nav
  const nav = document.getElementById('main-nav');
  if (nav) {
    nav.classList.remove('mobile-open');
    const toggle = document.getElementById('mobile-nav-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  // Render the page content
  const renderer = PAGE_RENDERERS[page];
  if (renderer.render && _pageContainer) {
    renderer.render(_pageContainer).catch(err => console.error(`[router] render error for "${page}":`, err));
  }

  // Update URL hash (does not trigger popstate)
  if (window.location.hash !== `#${page}`) {
    window.history.pushState({ page }, '', `#${page}`);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Re-render the current page (called when data changes).
 */
export function refreshCurrentPage() {
  if (currentPage && PAGE_RENDERERS[currentPage] && _pageContainer) {
    PAGE_RENDERERS[currentPage].render(_pageContainer).catch(console.error);
  }
}

/**
 * Initialise router event listeners.
 * Must be called after the DOM is ready and the page container exists.
 * @param {HTMLElement} pageContainer
 */
export function initRouter(pageContainer) {
  _pageContainer = pageContainer;

  // Listen for navigation requests from feature modules
  on('navigate', e => {
    if (e.detail?.page) navigateTo(e.detail.page);
  });

  // Re-render current page when data changes (add/delete transaction, etc.)
  on('data:changed', refreshCurrentPage);

  // Handle browser back/forward
  window.addEventListener('popstate', e => {
    const target = e.state?.page;
    if (target && PAGE_RENDERERS[target]) {
      navigateTo(target);
    }
  });
}

export function getCurrentPage() {
  return currentPage;
}
