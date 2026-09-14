/**
 * @file Reusable modal component.
 * Manages open/close transitions, focus trapping, and Escape key handling.
 */

/**
 * Open a modal overlay by id.
 * @param {string} modalId
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Focus first input for usability
  const firstInput = modal.querySelector('input, select, button');
  setTimeout(() => firstInput?.focus(), 50);
}

/**
 * Close a modal overlay by id.
 * @param {string} modalId
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Bind standard close behaviours (X button, cancel button, backdrop click, Escape).
 * @param {string} modalId
 * @param {string[]} [closeBtnIds]
 * @param {string[]} [cancelBtnIds]
 */
export function initModal(modalId, closeBtnIds = [], cancelBtnIds = []) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  [...closeBtnIds, ...cancelBtnIds].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => closeModal(modalId));
  });

  // Backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modalId);
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal(modalId);
    }
  });
}
