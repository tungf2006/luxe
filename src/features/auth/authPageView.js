/**
 * @file Auth page view — renders auth screens (login, register, etc.)
 * and wires up event listeners using authViews from authViews.js.
 */

import { authViews, authLoadingHTML } from './authViews.js';
import { t } from '../../utils/i18n.js';

export async function render(container, page) {
  if (page === 'loading') {
    container.innerHTML = authLoadingHTML();
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
