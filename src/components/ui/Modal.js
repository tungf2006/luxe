/**
 * @file Reusable modal component.
 * Manages open/close transitions, focus trapping, and Escape key handling.
 * Ensures accessibility with ARIA attributes and keyboard navigation.
 */

/**
 * Open a modal overlay by id.
 * @param {string} modalId
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  bindModalKeyboard();
  lastActiveElement = document.activeElement;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  modal.setAttribute('data-state', 'open');
  document.body.style.overflow = 'hidden';

  const focusable = getFocusableElements(modal);
  if (focusable.length > 0) setTimeout(() => focusable[0].focus(), 50);
}

/**
 * Close a modal overlay by id.
 * @param {string} modalId
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('data-state', 'closed');
  document.body.style.overflow = '';
  restoreLastFocus();
}

let lastActiveElement = null;
let modalKeydownBound = false;

/**
 * Get all focusable elements within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), details, summary'
    )
  ).filter(el => {
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  });
}

/**
 * Trap focus within the modal.
 * @param {HTMLElement} modal
 * @param {KeyboardEvent} e
 */
function trapFocus(modal, e) {
  if (e.key !== 'Tab') return;

  const focusable = getFocusableElements(modal);
  if (focusable.length === 0) return;

  const firstEl = focusable[0];
  const lastEl = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    }
  } else {
    if (document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }
}

function saveLastFocus() {
  lastActiveElement = document.activeElement;
}

function restoreLastFocus() {
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    lastActiveElement.focus();
  }
}

function bindModalKeyboard() {
  if (modalKeydownBound) return;
  modalKeydownBound = true;
  document.addEventListener('keydown', e => {
    const modal = document.querySelector('.modal-overlay.open');
    if (!modal) return;
    if (e.key === 'Escape') {
      closeModal(modal.id);
      return;
    }
    trapFocus(modal, e);
  });
}

/**
 * Bind standard close behaviours (X button, cancel button, backdrop click, Escape).
 * Includes focus trapping for accessibility.
 * @param {string} modalId
 * @param {string[]} [closeBtnIds]
 * @param {string[]} [cancelBtnIds]
 */
export function initModal(modalId, closeBtnIds = [], cancelBtnIds = []) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  [...closeBtnIds, ...cancelBtnIds].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      closeModal(modalId);
    });
  });

  // Backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modalId);
  });

  // Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal(modalId);
    }

    bindModalKeyboard();
  };
  document.addEventListener('keydown', escHandler);

  // Focus trap
  const focusHandler = (e) => {
    if (modal.classList.contains('open')) {
      trapFocus(modal, e);
    }
  };
  document.addEventListener('keydown', focusHandler);

  // Track last active element when modal opens
  modal.addEventListener('transitionend', () => {
    if (modal.classList.contains('open')) {
      saveLastFocus();
    }
  });
}
