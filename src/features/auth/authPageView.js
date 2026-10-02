/**
 * @file Auth page view — renders auth screens (login, register, forgot-password, etc.)
 * Integrates the modern tabbed login/register view with Google OAuth and password security.
 */

import { authViews, authLoadingHTML } from './authViews.js';
import { renderLoginView } from '../../views/loginView.js';
import { t } from '../../utils/i18n.js';

export async function render(container, page) {
  if (page === 'loading') {
    container.innerHTML = authLoadingHTML();
    return;
  }

  // Use the new unified tabbed view for login and register
  if (page === 'login' || page === 'register') {
    renderLoginView(container, page);
    return;
  }

  const view = authViews[page];

  if (!view) {
    container.innerHTML = '<p class="auth-subtitle">' + t('app.noPage') + '</p>';
    return;
  }

  container.innerHTML = view.html();

  const attachEvents = view.attachEvents;
  if (attachEvents) {
    attachEvents(container);
  }
}
