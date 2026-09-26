/**
 * @file ConfirmModal.js
 * Reusable modal helper for confirming destructive actions or picking options.
 */

import { escapeHtml } from '../../utils/format.js';

let modalContainer = null;

function ensureContainer() {
  if (modalContainer && document.body.contains(modalContainer)) return modalContainer;
  modalContainer = document.createElement('div');
  modalContainer.id = 'confirm-modal-wrapper';
  document.body.appendChild(modalContainer);
  return modalContainer;
}

/**
 * Show a confirmation dialog.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmText='Xác nhận']
 * @param {string} [options.cancelText='Hủy']
 * @param {'danger'|'primary'} [options.type='danger']
 * @returns {Promise<boolean>}
 */
export function showConfirmModal({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', type = 'danger' }) {
  return new Promise(resolve => {
    const container = ensureContainer();
    const btnClass = type === 'danger' ? 'btn-danger' : 'btn-primary';
    
    container.innerHTML = `
      <div class="modal-overlay open" id="confirm-dialog-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div class="modal-dialog modal-dialog-sm">
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-modal-title">${escapeHtml(title)}</h3>
            <button class="modal-close-btn" type="button" data-action="cancel" aria-label="Đóng">✕</button>
          </div>
          <div class="modal-body">
            <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.5;margin-top:0.75rem;">${escapeHtml(message)}</p>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;">
            <button type="button" class="btn-secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
            <button type="button" class="${btnClass}" data-action="confirm">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `;

    const modal = container.querySelector('#confirm-dialog-modal');
    document.body.style.overflow = 'hidden';

    const cleanup = (result) => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => {
        container.innerHTML = '';
        resolve(result);
      }, 200);
    };

    modal.addEventListener('click', e => {
      if (e.target.closest('[data-action="confirm"]')) {
        cleanup(true);
      } else if (e.target.closest('[data-action="cancel"]') || e.target === modal) {
        cleanup(false);
      }
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', keyHandler);
        cleanup(false);
      }
    };
    document.addEventListener('keydown', keyHandler);
  });
}

/**
 * Show a category selector modal for bulk category update.
 * @param {Array<{id:string, labelVi:string, icon:string}>} categories
 * @returns {Promise<string|null>} Selected category ID or null
 */
export function showCategorySelectModal(categories) {
  return new Promise(resolve => {
    const container = ensureContainer();
    const optionsHTML = categories.map(c => `
      <option value="${c.id}">${c.icon} ${escapeHtml(c.labelVi)}</option>
    `).join('');

    container.innerHTML = `
      <div class="modal-overlay open" id="category-dialog-modal" role="dialog" aria-modal="true">
        <div class="modal-dialog modal-dialog-sm">
          <div class="modal-header">
            <h3 class="modal-title">Đổi danh mục hàng loạt</h3>
            <button class="modal-close-btn" type="button" data-action="cancel" aria-label="Đóng">✕</button>
          </div>
          <div class="modal-body" style="margin-top:1rem;">
            <label class="form-label" style="display:block;margin-bottom:0.5rem;">Chọn danh mục mới:</label>
            <select class="select-dropdown" id="bulk-category-select" style="width:100%;">
              ${optionsHTML}
            </select>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;">
            <button type="button" class="btn-secondary" data-action="cancel">Hủy</button>
            <button type="button" class="btn-primary" data-action="confirm">Cập nhật</button>
          </div>
        </div>
      </div>
    `;

    const modal = container.querySelector('#category-dialog-modal');
    document.body.style.overflow = 'hidden';

    const cleanup = (val) => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => {
        container.innerHTML = '';
        resolve(val);
      }, 200);
    };

    modal.addEventListener('click', e => {
      if (e.target.closest('[data-action="confirm"]')) {
        const sel = container.querySelector('#bulk-category-select');
        cleanup(sel ? sel.value : null);
      } else if (e.target.closest('[data-action="cancel"]') || e.target === modal) {
        cleanup(null);
      }
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', keyHandler);
        cleanup(null);
      }
    };
    document.addEventListener('keydown', keyHandler);
  });
}
