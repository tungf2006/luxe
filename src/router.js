/**
 * @file SPA router — maps routes to feature render functions.
 * Listens for 'navigate' and 'data:changed' events from the event bus.
 *
 * Routes are split into:
 *   - App routes (dashboard, transactions, etc.) — require authentication
 *   - Auth routes (login, register, etc.) — public, shown when unauthenticated
 *   - Onboarding — shown once after first registration
 *
 * When on auth/onboarding/loading pages, the main app layout (sidebar + header)
 * is hidden. When on app pages, they are shown.
 */

import { on } from './utils/eventBus.js';
import { DEFAULT_PAGE, getNavItem, getPageDocumentTitle } from './constants/navigation.js';

import * as dashboardView    from './features/dashboard/dashboardView.js';
import * as transactionsView from './features/transactions/transactionsView.js';
import * as budgetsView      from './features/budgets/budgetsView.js';
import * as reportsView      from './features/reports/reportsView.js';
import * as goalsView        from './features/goals/goalsView.js';
import * as recurringView    from './features/recurring/recurringView.js';
import * as accountsView     from './features/accounts/accountsView.js';
import * as settingsView     from './features/settings/settingsView.js';
import * as authPageView     from './features/auth/authPageView.js';
import * as onboardingView   from './features/onboarding/onboardingPageView.js';

/** Pages that should hide the main app layout (sidebar + header). */
const FULLSCREEN_PAGES = new Set([
  'login',
  'register',
  'forgot-password',
  'verify-email',
  'reset-password',
  'onboarding',
  'loading',
]);

/** Registry: page name → feature module with a `render(container)` export. */
const PAGE_RENDERERS = {
  dashboard:     dashboardView,
  transactions:  transactionsView,
  budgets:       budgetsView,
  reports:       reportsView,
  goals:         goalsView,
  recurring:     recurringView,
  accounts:      accountsView,
  settings:      settingsView,
  login:         authPageView,
  register:      authPageView,
  'forgot-password': authPageView,
  'verify-email': authPageView,
  'reset-password': authPageView,
  onboarding:    onboardingView,
  loading:       authPageView,
};

let currentPage = null;
let _pageContainer = null;
let _appLayout = null;

/* ---------------------------------------------------------------- *
 * Loading skeleton & error boundary markup
 * ---------------------------------------------------------------- */

function skeletonHTML() {
  return `
    <div class="page-skeleton" role="status" aria-label="Đang tải nội dung">
      <div class="skeleton-panel">
        <div class="skeleton-line w-40"></div>
        <div class="skeleton-line w-70"></div>
      </div>
      <div class="skeleton-grid">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    </div>
  `;
}

function escapeText(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function renderErrorHTML(page, err) {
  return `
    <div class="page-error" role="alert">
      <span class="page-error-icon" aria-hidden="true">⚠️</span>
      <h3>Không thể tải trang</h3>
      <p>${escapeText(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.')}</p>
      <button type="button" class="btn-secondary" data-retry-page="${escapeText(page)}">Thử lại</button>
    </div>
  `;
}

function wrapPageContent(container) {
  if (!container) return;
  const first = container.firstElementChild;
  if (first && first.classList.contains('container') && container.children.length === 1) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'container';
  while (container.firstChild) {
    wrapper.appendChild(container.firstChild);
  }
  container.appendChild(wrapper);
}

/**
 * Toggle the app layout (sidebar + header) visibility based on the current page.
 * @param {string} page
 */
function updateLayoutVisibility(page) {
  const isFullscreen = FULLSCREEN_PAGES.has(page);
  if (_appLayout) {
    _appLayout.style.display = isFullscreen ? 'none' : 'flex';
  }

  const toggleAuth = document.getElementById('auth-container');
  if (toggleAuth) {
    toggleAuth.style.display = isFullscreen ? 'block' : 'none';
  }

  if (isFullscreen) {
    document.body.classList.remove('with-sidebar');
  } else {
    document.body.classList.add('with-sidebar');
  }
}

/**
 * Update the active state of all nav links across sidebar, bottom nav,
 * and the more sheet. Also updates the page title header, document.title,
 * and the breadcrumb crumb from the central route configuration.
 * @param {string} page
 */
function updateNavActiveState(page) {
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    const isActive = link.dataset.page === page;
    link.classList.toggle('active', isActive);
    if (link.getAttribute('role') === 'menuitem') {
      link.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
  });

  const titleEl = document.getElementById('page-title-header');
  const navItem = getNavItem(page);
  if (titleEl && navItem) {
    titleEl.textContent = navItem.title;
  }

  document.title = getPageDocumentTitle(page);

  const breadcrumbEl = document.getElementById('breadcrumb-current');
  if (breadcrumbEl && navItem) {
    breadcrumbEl.textContent = navItem.label;
    breadcrumbEl.setAttribute('aria-current', 'page');
  }
}

/**
 * Close mobile navigation overlays when changing page.
 */
function closeMobileOverlays() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
  const toggle = document.getElementById('mobile-nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');

  const sheet = document.getElementById('mobile-more-sheet');
  if (sheet) {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  }
  const moreBtn = document.getElementById('mobile-nav-more');
  if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
}

/**
 * Navigate to a page by name.
 * @param {string} page
 */
export function navigateTo(page) {
  if (!PAGE_RENDERERS[page]) return;
  currentPage = page;

  updateLayoutVisibility(page);
  closeMobileOverlays();
  updateNavActiveState(page);

  const renderer = PAGE_RENDERERS[page];
  if (renderer.render && _pageContainer) {
    const isAppPage = !FULLSCREEN_PAGES.has(page);
    if (isAppPage && _pageContainer.innerHTML.trim() === '') {
      _pageContainer.innerHTML = '<div class="container">' + skeletonHTML() + '</div>';
    }
    Promise.resolve(renderer.render(_pageContainer, page))
      .then(() => { if (isAppPage) wrapPageContent(_pageContainer); })
      .catch(err => {
        console.error(`[router] render error for "${page}":`, err);
        if (isAppPage) {
          _pageContainer.innerHTML = '<div class="container">' + renderErrorHTML(page, err) + '</div>';
          const retry = _pageContainer.querySelector('[data-retry-page]');
          if (retry) {
            retry.addEventListener('click', () => navigateTo(retry.dataset.retryPage));
          }
        }
      });
  }

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
    Promise.resolve(PAGE_RENDERERS[currentPage].render(_pageContainer, currentPage))
      .then(() => { if (!FULLSCREEN_PAGES.has(currentPage)) wrapPageContent(_pageContainer); })
      .catch(console.error);
  }
}

/**
 * Check if the current page requires authentication.
 * @param {string} page
 * @returns {boolean}
 */
export function requiresAuth(page) {
  return !FULLSCREEN_PAGES.has(page);
}

/**
 * Initialise router event listeners and cache DOM references.
 * @param {HTMLElement} pageContainer
 */
export function initRouter(pageContainer) {
  _pageContainer = pageContainer;
  _appLayout = document.querySelector('.app-layout');

  on('navigate', e => {
    if (e.detail?.page) navigateTo(e.detail.page);
  });

  on('data:changed', refreshCurrentPage);

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

export function getPageContainer() {
  return _pageContainer;
}
