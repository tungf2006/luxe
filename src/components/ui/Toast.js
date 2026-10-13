/**
 * @file Toast notification system.
 * Provides a simple showToast API used app-wide.
 * Supports an optional action button via showToastWithAction().
 */

const ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

let container = null;

/**
 * Ensure the toast container exists (creates it if necessary).
 * @returns {HTMLElement}
 */
function getContainer() {
  if (container) return container;
  container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'warning'|'info'|'error'} [type='info']
 * @param {number} [duration=3500]
 */
export function showToast(message, type = 'info', duration = 3500) {
  const ct = getContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<span aria-hidden="true">${ICONS[type] || ICONS.info}</span><span>${escapeHtmlLocal(message)}</span>`;
  ct.appendChild(toast);

  toast.style.transition = 'all 0.3s ease-out';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

/**
 * Show a toast with an optional action button (e.g. undo).
 * @param {string} message
 * @param {string} actionLabel
 * @param {() => void} onAction
 * @param {'success'|'warning'|'info'|'error'} [type='info']
 * @param {number} [duration=5000]
 */
export function showToastWithAction(message, actionLabel, onAction, type = 'info', duration = 5000) {
  const ct = getContainer();
  const toast = document.createElement('div');
  toast.className = 'toast toast--action';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span aria-hidden="true">${ICONS[type] || ICONS.info}</span>
    <span class="toast__text">${escapeHtmlLocal(message)}</span>
    <button type="button" class="toast__action">${escapeHtmlLocal(actionLabel)}</button>
  `;
  ct.appendChild(toast);

  const actionBtn = toast.querySelector('.toast__action');
  let removed = false;
  const dismiss = () => {
    if (removed) return;
    removed = true;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 350);
  };

  actionBtn.addEventListener('click', () => {
    onAction();
    dismiss();
  });

  toast.style.transition = 'all 0.3s ease-out';
  setTimeout(dismiss, duration);
}

function escapeHtmlLocal(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
