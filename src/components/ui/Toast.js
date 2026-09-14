/**
 * @file Toast notification system.
 * Provides a simple showToast API used app-wide.
 */

const ICONS = {
  success: '✅',
  warning: '⚠️',
  info:    'ℹ️',
  error:   '❌',
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

function escapeHtmlLocal(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
