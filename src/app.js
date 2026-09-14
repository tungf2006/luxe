/**
 * @file Luxe application bootstrap.
 * Entry point — initialises navigation, theme, modal, and router,
 * then renders the default page.
 *
 * Architecture:
 *   app.js → router.js → feature modules → services & components
 *   Feature modules communicate with the router via the event bus
 *   (src/utils/eventBus.js) to avoid circular dependencies.
 */

import { navigateTo, initRouter } from './router.js';
import { init as initTransactionForm } from './features/transactions/transactionForm.js';
import dataService from './services/dataService.js';
import { DEFAULT_PAGE } from './constants/navigation.js';

/**
 * Attach click listeners to all [data-page] elements (nav links, brand logo).
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
 * Wire up the mobile nav toggle button.
 */
function initMobileNav() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded', isOpen);
    });
  }
}

/**
 * Apply saved theme (dark/light) from settings before first paint.
 */
async function applySavedTheme() {
  const settings = await dataService.getSettings();
  if (settings.theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
}

/**
 * Main initialisation.
 */
async function initApp() {
  await applySavedTheme();

  // Initialise feature-level singletons
  initNavigation();
  initMobileNav();
  initTransactionForm(); // attaches document-level listener for [data-open-modal]

  // Initialise router (sets up event bus listeners)
  const pageContainer = document.getElementById('page-container');
  if (pageContainer) {
    initRouter(pageContainer);

    // Render the initial page (from URL hash or default)
    const hash = window.location.hash.replace('#', '');
    navigateTo(hash || DEFAULT_PAGE);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
