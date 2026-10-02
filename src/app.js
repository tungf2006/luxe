/**
 * @file Luxe application bootstrap.
 * Entry point — initialises auth, navigation, theme, modal, and router,
 * then renders the initial page.
 *
 * Architecture:
 *   app.js → router.js → feature modules → services & components
 *   Feature modules communicate with the router via the event bus
 *   (src/utils/eventBus.js) to avoid circular dependencies.
 *
 * Auth flow:
 *   1. Show auth-loading screen
 *   2. initAuth() — check Supabase session / localStorage mock
 *   3. If authenticated → dashboard (or onboarding if incomplete)
 *   4. If not authenticated → login
 *   5. Listen for auth state changes throughout the session
 */

import { navigateTo, initRouter } from './router.js';
import { init as initTransactionForm } from './features/transactions/transactionForm.js';
import dataService, { useSupabase, useLocalStorage } from './services/dataAdapter.js';
import { DEFAULT_PAGE } from './constants/navigation.js';
import { injectNavMarkup } from './components/ui/navRenderer.js';
import { showToast } from './components/ui/Toast.js';
import {
  initAuth,
  isAuthenticated,
  getCurrentUser,
  isInitializing,
} from './services/authService.js';
import { MOCK_MODE } from './config/env.js';
import { on } from './utils/eventBus.js';
import { setActiveCurrency } from './utils/format.js';
import { initI18n, t } from './utils/i18n.js';

import { initStorage } from './services/storage.js';

/**
 * Attach click listeners to all [data-page] elements (sidebar links,
 * bottom nav items, more-sheet links, brand logo).
 */
function initNavigation() {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });
}

/**
 * Wire up the mobile nav toggle — slides the sidebar off-canvas on mobile.
 */
function initMobileNav() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    function closeSidebar() {
      sidebar.classList.remove('mobile-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = sidebar.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', e => {
      if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        closeSidebar();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
        closeSidebar();
      }
    });

    sidebar.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => closeSidebar());
    });
  }
}

/**
 * Wire up the mobile "more" sheet — reveals secondary pages on small screens.
 */
function initMobileMoreSheet() {
  const moreBtn = document.getElementById('mobile-nav-more');
  const sheet = document.getElementById('mobile-more-sheet');
  const backdrop = document.getElementById('mobile-more-backdrop');
  if (!moreBtn || !sheet) return;

  function open() {
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    moreBtn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    moreBtn.setAttribute('aria-expanded', 'false');
  }

  moreBtn.addEventListener('click', e => {
    e.preventDefault();
    open();
  });
  if (backdrop) backdrop.addEventListener('click', close);

  // Close sheet when a more-link is chosen
  sheet && sheet.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', () => close());
  });
}

/**
 * Wire up the avatar dropdown menu in the topbar.
 */
function initTopbarDropdown() {
  const avatarBtn = document.getElementById('avatar-btn');
  const dropdown = document.getElementById('user-menu-dropdown');
  if (!avatarBtn || !dropdown) return;

  function open() {
    dropdown.classList.add('open');
    dropdown.setAttribute('aria-hidden', 'false');
    avatarBtn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    dropdown.classList.remove('open');
    dropdown.setAttribute('aria-hidden', 'true');
    avatarBtn.setAttribute('aria-expanded', 'false');
  }

  avatarBtn.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? close() : open();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#user-menu')) close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });

  dropdown.querySelectorAll('[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      close();
      import('./router.js').then(m => m.navigateTo(item.dataset.page));
    });
  });
}

/**
 * Attach logout button listener.
 */
function initLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { signOut } = await import('./services/authService.js');
      logoutBtn.disabled = true;
      logoutBtn.textContent = t('app.signingOut');
      await signOut();
      const pageContainer = document.getElementById('page-container');
      if (pageContainer) pageContainer.innerHTML = '';
      window.location.hash = '#login';
      window.location.reload();
    });
  }
}

/**
 * Apply saved theme (dark/light) and currency from settings before first paint.
 */
async function applySavedTheme() {
  const settings = await dataService.getSettings();
  setActiveCurrency(settings.currency || 'VND');
  if (settings.theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
}

/**
 * Show the authenticated user's name in the header.
 */
function updateUserHeader() {
  const user = getCurrentUser();
  if (!user) return;

  const nameEl = document.getElementById('user-name');
  if (nameEl) {
    const displayName = user.user_metadata?.display_name ||
                        user.user_metadata?.full_name ||
                        user.user_metadata?.name ||
                        user.email?.split('@')[0] ||
                        'Người dùng';
    nameEl.textContent = displayName;
    nameEl.style.display = 'inline-block';
  }

  const avatarEl = document.getElementById('user-avatar');
  const fallback = document.getElementById('user-avatar-fallback');
  if (avatarEl && fallback) {
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    if (avatarUrl) {
      avatarEl.src = avatarUrl;
      avatarEl.style.display = 'block';
      fallback.style.display = 'none';
    } else {
      avatarEl.style.display = 'none';
      const initials = (user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || 'UX')
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      fallback.textContent = initials || 'UX';
      fallback.style.display = 'flex';
    }
  }
}

/**
 * Main initialisation.
 */
async function initApp() {
  // Initialize IndexedDB storage layer (non-blocking, migrates localStorage → IDB)
  initStorage().then(({ engine, migrated }) => {
    if (migrated) console.info(`[Luxe] Storage migrated to ${engine}`);
  }).catch(() => { /* localStorage fallback active */ });

  await initI18n();
  await applySavedTheme();

  injectNavMarkup();
  initNavigation();
  initMobileNav();
  initMobileMoreSheet();
  initTopbarDropdown();
  initLogout();
  initTransactionForm();

  const pageContainer = document.getElementById('page-container');
  if (!pageContainer) return;

  initRouter(pageContainer);

  navigateTo('loading');

  let authReady = false;
  const maxWait = MOCK_MODE ? 50 : 3000;
  const start = Date.now();
  while (isInitializing() && Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 50));
  }

  await initAuth();

  if (isAuthenticated()) {
    // If returning from Google OAuth redirect, clean the callback hash/code from URL
    const { cleanOAuthUrl, getRedirectRoute } = await import('./router.js');
    const destination = getRedirectRoute() || DEFAULT_PAGE;
    cleanOAuthUrl(destination);

    const user = getCurrentUser();
    if (user?.id) {
      useSupabase(user.id);
    }
    updateUserHeader();
    navigateTo(destination);
  } else {
    navigateTo('login');
  }

  window.addEventListener('auth:signed_in', async () => {
    const user = getCurrentUser();
    if (user?.id) {
      window.__SUPABASE_USER_ID = user.id;
      useSupabase(user.id);

      const { cleanOAuthUrl, getRedirectRoute } = await import('./router.js');
      const destination = getRedirectRoute() || DEFAULT_PAGE;
      cleanOAuthUrl(destination);

      updateUserHeader();
      navigateTo(destination);
    }
  });

  window.addEventListener('auth:signed_out', () => {
    const pageContainer = document.getElementById('page-container');
    useLocalStorage();
    if (pageContainer) pageContainer.innerHTML = '';
    window.location.hash = '#login';
    window.location.reload();
  });

  // Offline-First Network Status Listeners
  window.addEventListener('online', () => {
    showToast('Đã kết nối Internet. Dữ liệu đang được đồng bộ.', 'success');
  });

  window.addEventListener('offline', () => {
    showToast('Mất kết nối Internet. Luxe chuyển sang chế độ Offline-First.', 'warning');
  });
}

document.addEventListener('DOMContentLoaded', initApp);
