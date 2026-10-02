/**
 * @file SPA router — maps routes to feature render functions with Route Guard
 * and OAuth callback hash resolution.
 *
 * Architecture:
 *   - App routes (dashboard, transactions, etc.) — require authentication (meta.requiresAuth = true)
 *   - Auth routes (login, register, etc.) — public, shown when unauthenticated
 *   - Route Guard intercepts unauthenticated requests and redirects to `#/login?redirect=<target>`
 *   - Google OAuth Hash Resolver intercepts `access_token` or `code` callback URLs,
 *     preventing hash routing collisions and cleaning browser history.
 */

import { on } from './utils/eventBus.js';
import { DEFAULT_PAGE, getNavItem, getPageDocumentTitle } from './constants/navigation.js';
import { isAuthenticated, isInitializing } from './services/authService.js';

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

/** Public routes accessible without authentication */
export const PUBLIC_ROUTES = new Set([
  'login',
  'register',
  'forgot-password',
  'verify-email',
  'reset-password',
  'loading',
]);

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
  dashboard:         dashboardView,
  transactions:      transactionsView,
  budgets:           budgetsView,
  reports:           reportsView,
  goals:             goalsView,
  recurring:         recurringView,
  accounts:          accountsView,
  settings:          settingsView,
  login:             authPageView,
  register:          authPageView,
  'forgot-password': authPageView,
  'verify-email':    authPageView,
  'reset-password':  authPageView,
  onboarding:        onboardingView,
  loading:           authPageView,
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

/* ---------------------------------------------------------------- *
 * Route Guard & OAuth Resolver Helpers
 * ---------------------------------------------------------------- */

/**
 * Check if a page route requires authentication.
 * @param {string} page
 * @returns {boolean}
 */
export function requiresAuth(page) {
  return !PUBLIC_ROUTES.has(page);
}

/**
 * Extract redirect query parameter from current hash (e.g. `#/login?redirect=transactions`)
 * @returns {string|null}
 */
export function getRedirectRoute() {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]redirect=([^&]+)/);
  if (match && match[1]) {
    const decoded = decodeURIComponent(match[1]);
    if (PAGE_RENDERERS[decoded] && !PUBLIC_ROUTES.has(decoded)) {
      return decoded;
    }
  }
  return null;
}

/**
 * Inspect URL for Google OAuth or recovery callbacks:
 * - Implicit flow hash: `#access_token=...&refresh_token=...`
 * - PKCE code query: `?code=...`
 * - Error description: `#error=access_denied...`
 * @returns {{ isCallback: boolean, error: string|null }}
 */
export function checkOAuthCallback() {
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  const hasAccessToken = hash.includes('access_token=') || hash.includes('refresh_token=');
  const hasError = hash.includes('error=') || hash.includes('error_description=');
  const hasCode = search.includes('code=');

  if (hasError) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const errorDesc = params.get('error_description') || params.get('error') || 'Đăng nhập Google thất bại.';
    console.warn('[router] OAuth callback error detected:', errorDesc);
    window.history.replaceState({}, document.title, window.location.pathname + '#login');
    return { isCallback: true, error: errorDesc };
  }

  if (hasAccessToken || hasCode) {
    return { isCallback: true, error: null };
  }

  return { isCallback: false, error: null };
}

/**
 * Clean OAuth callback tokens and codes from the browser URL, restoring clean hash.
 * @param {string} [destinationPage='dashboard']
 */
export function cleanOAuthUrl(destinationPage = DEFAULT_PAGE) {
  const targetHash = `#${destinationPage}`;
  window.history.replaceState(
    { page: destinationPage },
    getPageDocumentTitle(destinationPage),
    window.location.pathname + targetHash
  );
}

/* ---------------------------------------------------------------- *
 * Navigation Core
 * ---------------------------------------------------------------- */

/**
 * Navigate to a page with Route Guard middleware.
 * @param {string} page - Target page name
 * @param {object} [options]
 * @param {boolean} [options.replace=false] - Whether to replace history state
 */
export function navigateTo(page, options = {}) {
  // If target page doesn't exist in registry, fallback
  if (!PAGE_RENDERERS[page]) {
    page = isAuthenticated() ? DEFAULT_PAGE : 'login';
  }

  // 1. ROUTE GUARD: Check if page requires authentication
  if (!isInitializing()) {
    if (requiresAuth(page) && !isAuthenticated()) {
      // User is unauthenticated attempting to access protected route
      // Redirect to login preserving the target route
      console.info(`[router] Route Guard: Access to "${page}" redirected to login.`);
      const redirectParam = encodeURIComponent(page);
      currentPage = 'login';
      updateLayoutVisibility('login');
      closeMobileOverlays();
      updateNavActiveState('login');

      const targetHash = `#/login?redirect=${redirectParam}`;
      if (options.replace) {
        window.history.replaceState({ page: 'login', redirect: page }, '', targetHash);
      } else {
        window.history.pushState({ page: 'login', redirect: page }, '', targetHash);
      }

      const renderer = PAGE_RENDERERS.login;
      const authContent = document.getElementById('auth-content');
      if (renderer?.render && authContent) {
        renderer.render(authContent, 'login');
      }
      return;
    }
  }

  currentPage = page;

  updateLayoutVisibility(page);
  closeMobileOverlays();
  updateNavActiveState(page);

  const renderer = PAGE_RENDERERS[page];
  if (renderer?.render && _pageContainer) {
    const isFullscreen = FULLSCREEN_PAGES.has(page);
    const authContent = document.getElementById('auth-content');
    const targetContainer = (isFullscreen && authContent) ? authContent : _pageContainer;

    if (!isFullscreen && authContent) {
      authContent.innerHTML = '';
    }

    const isAppPage = !isFullscreen;
    if (isAppPage && _pageContainer.innerHTML.trim() === '') {
      _pageContainer.innerHTML = '<div class="container">' + skeletonHTML() + '</div>';
    }

    Promise.resolve(renderer.render(targetContainer, page))
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

  const expectedHash = `#${page}`;
  if (window.location.hash !== expectedHash && !window.location.hash.startsWith(`#${page}?`)) {
    if (options.replace) {
      window.history.replaceState({ page }, '', expectedHash);
    } else {
      window.history.pushState({ page }, '', expectedHash);
    }
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
 * Parse page name from current hash (handling query params like `#/login?redirect=...`).
 * @returns {string}
 */
export function getPageFromHash() {
  const raw = window.location.hash || '';
  const clean = raw.replace(/^#\/?/, '');
  const [pagePart] = clean.split('?');
  return pagePart.trim();
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

  // Sync hash changes (both browser back/forward and programmatic changes)
  const handleHashOrPopState = () => {
    const oauthStatus = checkOAuthCallback();
    if (oauthStatus.isCallback) {
      // Supabase is exchanging tokens in background — hold on loading page
      return;
    }

    const page = getPageFromHash();
    if (page && PAGE_RENDERERS[page]) {
      navigateTo(page, { replace: true });
    }
  };

  window.addEventListener('popstate', handleHashOrPopState);
  window.addEventListener('hashchange', handleHashOrPopState);
}

export function getCurrentPage() {
  return currentPage;
}

export function getPageContainer() {
  return _pageContainer;
}
