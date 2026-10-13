/**
 * @file Budget Reset & Edit Modal Component.
 * Implements full interactive workflows for:
 * 1. "Đặt lại ngân sách" (Reset all budgets with Smart Presets: Luxe Default, 50/30/20 Rule, Zero-out)
 * 2. "Sửa / Đặt lại hạn mức" (Edit / Re-set single category budget with quick preset chips & default revert)
 * 3. "Đặt ngân sách mới" (Add new budget for available categories)
 */

import dataService from '../../services/dataAdapter.js';
import { CATEGORIES, CATEGORY_MAP, getCategoryLabelVi, getCategoryAvatarHtml, EXPENSE_CATEGORIES } from '../../constants/categories.js';
import {
  formatCurrency,
  formatCompactCurrency,
  escapeHtml,
  parseNumber,
  parseVndInput,
  formatAmount,
  getLocalMonthString,
  getActiveCurrency,
} from '../../utils/format.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';
import { openModal, closeModal } from '../../components/ui/Modal.js';
import { t } from '../../utils/i18n.js';

const RESET_MODAL_ID = 'reset-budgets-modal';
const EDIT_MODAL_ID = 'edit-budget-modal';
const ADD_MODAL_ID = 'add-budget-modal';

/* --------------------------------------------------------------- *
 * SVG Helpers
 * --------------------------------------------------------------- */
const SVG_ICONS = {
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  rotateCcw: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  spark: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
};

function renderSvg(iconKey, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG_ICONS[iconKey] || ''}</svg>`;
}

/* --------------------------------------------------------------- *
 * Ensure Modal Element in DOM
 * --------------------------------------------------------------- */
function ensureModal(modalId) {
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', `${modalId}-title`);
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = '<div class="modal-dialog"></div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modalId);
    });
  }
  return modal;
}

/* --------------------------------------------------------------- *
 * 1. RESET ALL BUDGETS MODAL
 * --------------------------------------------------------------- */

/**
 * Compute candidate limits for each preset mode
 */
function calculatePresetLimits(mode, income, currentBudgets, defaults) {
  const currentMap = new Map((currentBudgets || []).map(b => [b.category, b.limit]));

  if (mode === '50_30_20') {
    const inc = Number(income) > 0 ? Number(income) : 20000000;
    // 50% Needs: bills 20%, food 20%, transport 10%
    // 30% Wants: shopping 15%, entertainment 15%
    // 20% Savings/Health: health 10%
    const shares = {
      bills: 0.20,
      food: 0.20,
      transport: 0.10,
      shopping: 0.15,
      entertainment: 0.15,
      health: 0.10,
    };
    return defaults.map(d => {
      const share = shares[d.category] || 0.10;
      const newLimit = Math.round(inc * share);
      const curr = currentMap.get(d.category) ?? 0;
      return {
        category: d.category,
        currentLimit: curr,
        newLimit,
        diff: newLimit - curr,
      };
    });
  }

  if (mode === 'zero') {
    return defaults.map(d => {
      const curr = currentMap.get(d.category) ?? 0;
      return {
        category: d.category,
        currentLimit: curr,
        newLimit: 0,
        diff: -curr,
      };
    });
  }

  // Default mode: Luxe Recommended
  return defaults.map(d => {
    const curr = currentMap.get(d.category) ?? 0;
    return {
      category: d.category,
      currentLimit: curr,
      newLimit: d.limit,
      diff: d.limit - curr,
    };
  });
}

/**
 * Open the "Đặt lại ngân sách" modal
 */
export async function openResetBudgetsModal() {
  const modal = ensureModal(RESET_MODAL_ID);
  const dialog = modal.querySelector('.modal-dialog');

  const [currentBudgets, transactions] = await Promise.all([
    dataService.getBudgets(),
    dataService.getTransactions(),
  ]);

  const defaults = typeof dataService.getBudgetDefaults === 'function'
    ? dataService.getBudgetDefaults()
    : [
        { id: 'b01', category: 'food', limit: 800, spent: 0 },
        { id: 'b02', category: 'transport', limit: 300, spent: 0 },
        { id: 'b03', category: 'entertainment', limit: 300, spent: 0 },
        { id: 'b04', category: 'shopping', limit: 500, spent: 0 },
        { id: 'b05', category: 'bills', limit: 1500, spent: 0 },
        { id: 'b06', category: 'health', limit: 300, spent: 0 },
      ];

  const currentMonth = getLocalMonthString(new Date());
  const monthIncome = (transactions || [])
    .filter(t => t && t.type === 'income' && typeof t.date === 'string' && t.date.startsWith(currentMonth))
    .reduce((s, t) => s + parseNumber(t.amount), 0);

  let selectedMode = 'default';
  let inputIncome = monthIncome > 0 ? monthIncome : 20000000;

  function renderDialog() {
    const previewItems = calculatePresetLimits(selectedMode, inputIncome, currentBudgets, defaults);
    const totalCurrent = previewItems.reduce((s, item) => s + item.currentLimit, 0);
    const totalNew = previewItems.reduce((s, item) => s + item.newLimit, 0);
    const totalDiff = totalNew - totalCurrent;

    dialog.innerHTML = `
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:0.6rem;">
          <div class="budget-modal-header-icon" style="background:rgba(34,197,94,0.12);color:var(--accent-brand);width:34px;height:34px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;">
            ${renderSvg('rotateCcw', 17)}
          </div>
          <div>
            <h2 class="modal-title" id="${RESET_MODAL_ID}-title" style="margin:0;font-size:1.15rem;font-weight:700;">Đặt lại ngân sách</h2>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Khôi phục hoặc tái thiết lập hạn mức chi tiêu định kỳ</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" id="btn-close-reset-modal" aria-label="Đóng cửa sổ">
          ${renderSvg('close', 18)}
        </button>
      </div>

      <div class="modal-form" style="padding:1.25rem 1.5rem;max-height:75vh;overflow-y:auto;">
        <!-- Safe Guarantee Banner -->
        <div class="budget-safe-banner" style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.85rem 1rem;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius-md);color:var(--text-secondary);font-size:0.82rem;line-height:1.45;">
          <div style="color:var(--accent-brand);flex-shrink:0;margin-top:1px;">
            ${renderSvg('shield', 18)}
          </div>
          <div>
            <strong style="color:var(--text-primary);display:block;margin-bottom:2px;">Giao dịch được bảo vệ 100%</strong>
            Toàn bộ lịch sử chi tiêu thực tế của bạn sẽ được giữ nguyên vẹn. Thao tác này chỉ thiết lập lại hạn mức cho các danh mục.
          </div>
        </div>

        <!-- Mode Selection -->
        <div class="form-group" style="margin-top:0.5rem;">
          <label class="form-label">Chọn phương thức đặt lại:</label>
          <div class="budget-reset-modes" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:0.6rem;">
            <!-- Option 1: Luxe Default -->
            <button type="button" class="budget-mode-btn ${selectedMode === 'default' ? 'active' : ''}" data-mode="default" style="display:flex;flex-direction:column;align-items:flex-start;padding:0.75rem;border-radius:var(--radius-md);border:1px solid ${selectedMode === 'default' ? 'var(--accent-brand)' : 'var(--border-card)'};background:${selectedMode === 'default' ? 'rgba(34,197,94,0.08)' : 'var(--bg-surface-elevated)'};color:var(--text-primary);cursor:pointer;text-align:left;transition:all var(--transition-fast);">
              <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:0.4rem;">
                <span style="color:var(--accent-brand);">${renderSvg('spark', 16)}</span>
                <span class="mode-badge" style="font-size:0.68rem;padding:2px 6px;border-radius:10px;background:rgba(34,197,94,0.18);color:var(--accent-brand);font-weight:600;">Khuyên dùng</span>
              </div>
              <strong style="font-size:0.85rem;margin-bottom:2px;">Mặc định Luxe</strong>
              <span style="font-size:0.72rem;color:var(--text-muted);line-height:1.3;">6 danh mục chuẩn theo khuyến nghị Luxe</span>
            </button>

            <!-- Option 2: 50/30/20 Rule -->
            <button type="button" class="budget-mode-btn ${selectedMode === '50_30_20' ? 'active' : ''}" data-mode="50_30_20" style="display:flex;flex-direction:column;align-items:flex-start;padding:0.75rem;border-radius:var(--radius-md);border:1px solid ${selectedMode === '50_30_20' ? 'var(--accent-brand)' : 'var(--border-card)'};background:${selectedMode === '50_30_20' ? 'rgba(34,197,94,0.08)' : 'var(--bg-surface-elevated)'};color:var(--text-primary);cursor:pointer;text-align:left;transition:all var(--transition-fast);">
              <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:0.4rem;">
                <span style="color:#38BDF8;">${renderSvg('calculator', 16)}</span>
                <span class="mode-badge" style="font-size:0.68rem;padding:2px 6px;border-radius:10px;background:rgba(56,189,248,0.15);color:#38BDF8;font-weight:600;">Thông minh</span>
              </div>
              <strong style="font-size:0.85rem;margin-bottom:2px;">Quy tắc 50/30/20</strong>
              <span style="font-size:0.72rem;color:var(--text-muted);line-height:1.3;">Tự động phân bổ theo thu nhập tháng</span>
            </button>

            <!-- Option 3: Zero Out -->
            <button type="button" class="budget-mode-btn ${selectedMode === 'zero' ? 'active' : ''}" data-mode="zero" style="display:flex;flex-direction:column;align-items:flex-start;padding:0.75rem;border-radius:var(--radius-md);border:1px solid ${selectedMode === 'zero' ? 'var(--accent-brand)' : 'var(--border-card)'};background:${selectedMode === 'zero' ? 'rgba(34,197,94,0.08)' : 'var(--bg-surface-elevated)'};color:var(--text-primary);cursor:pointer;text-align:left;transition:all var(--transition-fast);">
              <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:0.4rem;">
                <span style="color:#F59E0B;">${renderSvg('rotateCcw', 16)}</span>
                <span class="mode-badge" style="font-size:0.68rem;padding:2px 6px;border-radius:10px;background:rgba(245,158,11,0.15);color:#F59E0B;font-weight:600;">Làm mới</span>
              </div>
              <strong style="font-size:0.85rem;margin-bottom:2px;">Đặt về 0</strong>
              <span style="font-size:0.72rem;color:var(--text-muted);line-height:1.3;">Xóa trắng hạn mức để tự nhập lại từ đầu</span>
            </button>
          </div>
        </div>

        <!-- Dynamic Input for 50/30/20 -->
        ${selectedMode === '50_30_20' ? `
          <div class="form-group" style="padding:0.75rem 1rem;background:rgba(56,189,248,0.05);border:1px dashed rgba(56,189,248,0.25);border-radius:var(--radius-md);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
              <label for="reset-income-input" class="form-label" style="margin:0;color:var(--text-primary);">Thu nhập cơ sở để phân bổ:</label>
              <span style="font-size:0.75rem;color:#38BDF8;">50% Cần thiết · 30% Mong muốn · 20% Tiết kiệm</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <input type="text" id="reset-income-input" class="form-input" value="${formatAmount(inputIncome)}" style="font-family:var(--font-mono);font-weight:600;font-size:1rem;color:var(--accent-brand);" />
              <button type="button" class="btn-secondary" id="btn-use-actual-income" style="font-size:0.75rem;white-space:nowrap;padding:0.55rem 0.75rem;" title="Lấy thu nhập thực tế tháng này">
                Thu nhập tháng này
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Live Impact Preview Table -->
        <div class="budget-preview-section" style="margin-top:0.6rem;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.4rem;">
            <span class="form-label">Xem trước hạn mức dự kiến:</span>
            <span style="font-size:0.75rem;color:var(--text-muted);">${previewItems.length} danh mục</span>
          </div>

          <div class="budget-preview-table" style="background:var(--bg-surface-elevated);border:1px solid var(--border-card);border-radius:var(--radius-md);overflow:hidden;">
            <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:0.5rem;padding:0.5rem 0.85rem;background:rgba(255,255,255,0.02);border-bottom:1px solid var(--border-subtle);font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;">
              <span>Danh mục</span>
              <span style="text-align:right;">Hiện tại</span>
              <span style="text-align:center;">➔</span>
              <span style="text-align:right;">Hạn mức mới</span>
            </div>

            <div style="max-height:210px;overflow-y:auto;">
              ${previewItems.map(item => {
                const catName = getCategoryLabelVi(item.category) || item.category;
                const diffLabel = item.diff > 0
                  ? `<span style="font-size:0.7rem;color:var(--positive);">(+${formatCompactCurrency(item.diff)})</span>`
                  : item.diff < 0
                    ? `<span style="font-size:0.7rem;color:var(--warning);">(${formatCompactCurrency(item.diff)})</span>`
                    : '<span style="font-size:0.7rem;color:var(--text-muted);">(0)</span>';

                return `
                  <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:0.5rem;padding:0.5rem 0.85rem;align-items:center;border-bottom:1px solid var(--border-subtle);font-size:0.83rem;">
                    <div style="display:flex;align-items:center;gap:0.5rem;min-width:0;">
                      ${getCategoryAvatarHtml(item.category, 'sm')}
                      <span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(catName)}</span>
                    </div>
                    <span style="text-align:right;color:var(--text-secondary);font-family:var(--font-mono);">${formatCurrency(item.currentLimit)}</span>
                    <span style="color:var(--text-muted);font-size:0.75rem;">➔</span>
                    <div style="text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--text-primary);display:flex;flex-direction:column;align-items:flex-end;">
                      <span>${formatCurrency(item.newLimit)}</span>
                      ${diffLabel}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Total Summary Footer -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 0.85rem;background:rgba(34,197,94,0.04);border-top:1px solid var(--border-card);font-size:0.85rem;">
              <span style="font-weight:600;color:var(--text-primary);">Tổng ngân sách:</span>
              <div style="display:flex;align-items:center;gap:0.4rem;font-family:var(--font-mono);font-weight:700;">
                <span style="color:var(--text-muted);">${formatCurrency(totalCurrent)}</span>
                <span style="color:var(--text-muted);font-weight:normal;">➔</span>
                <span style="color:var(--accent-brand);font-size:0.95rem;">${formatCurrency(totalNew)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="padding:1rem 1.5rem;display:flex;justify-content:flex-end;align-items:center;gap:0.75rem;border-top:1px solid var(--border-subtle);background:var(--bg-surface);">
        <button type="button" class="btn-secondary" id="btn-cancel-reset" style="padding:0.6rem 1.1rem;font-size:0.88rem;">Hủy</button>
        <button type="button" class="btn-add-transaction" id="btn-confirm-reset" style="padding:0.6rem 1.3rem;font-size:0.88rem;display:inline-flex;align-items:center;gap:0.45rem;">
          ${renderSvg('check', 16)}
          <span>Xác nhận đặt lại ngân sách</span>
        </button>
      </div>
    `;

    bindDialogEvents();
  }

  function bindDialogEvents() {
    // Close button
    dialog.querySelector('#btn-close-reset-modal')?.addEventListener('click', () => {
      closeModal(RESET_MODAL_ID);
    });

    dialog.querySelector('#btn-cancel-reset')?.addEventListener('click', () => {
      closeModal(RESET_MODAL_ID);
    });

    // Mode Buttons
    dialog.querySelectorAll('.budget-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMode = btn.dataset.mode;
        renderDialog();
      });
    });

    // Income Input in 50/30/20 mode
    const incomeInput = dialog.querySelector('#reset-income-input');
    if (incomeInput) {
      incomeInput.addEventListener('input', e => {
        const raw = e.target.value;
        const val = parseVndInput(raw) || 0;
        inputIncome = val;
        if (!/[a-zA-Z]/i.test(raw)) {
          incomeInput.value = formatAmount(val);
        }
      });

      incomeInput.addEventListener('blur', () => {
        incomeInput.value = formatAmount(inputIncome);
      });

      incomeInput.addEventListener('change', () => {
        incomeInput.value = formatAmount(inputIncome);
        renderDialog();
      });
    }

    dialog.querySelector('#btn-use-actual-income')?.addEventListener('click', () => {
      inputIncome = monthIncome > 0 ? monthIncome : 20000000;
      renderDialog();
    });

    // Confirm Action
    dialog.querySelector('#btn-confirm-reset')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = `<span class="loading-spinner" style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;display:inline-block;animation:spin 0.8s linear infinite;"></span> Đang đặt lại...`;

      try {
        await dataService.resetBudgets({
          mode: selectedMode,
          totalIncome: inputIncome,
        });

        closeModal(RESET_MODAL_ID);
        showToast('Đã đặt lại ngân sách thành công!', 'success');
      } catch (err) {
        console.error('[budgetResetModal] Error resetting budgets:', err);
        showToast(`Không thể đặt lại ngân sách: ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = `${renderSvg('check', 16)} Xác nhận đặt lại ngân sách`;
      }
    });
  }

  renderDialog();
  openModal(RESET_MODAL_ID);
}

/* --------------------------------------------------------------- *
 * 2. EDIT / RE-SET SINGLE BUDGET LIMIT MODAL
 * --------------------------------------------------------------- */

/**
 * Open the "Sửa / Đặt lại hạn mức" modal for a specific budget
 * @param {Object} budget - The budget object { id, category, limit, spent }
 */
export async function openEditBudgetModal(budget) {
  if (!budget) return;
  const modal = ensureModal(EDIT_MODAL_ID);
  const dialog = modal.querySelector('.modal-dialog');

  const catName = getCategoryLabelVi(budget.category) || budget.category;
  const defaults = typeof dataService.getBudgetDefaults === 'function' ? dataService.getBudgetDefaults() : [];
  const defaultItem = defaults.find(d => d.category === budget.category);
  const defaultLimit = defaultItem ? defaultItem.limit : 500000;

  let currentLimitVal = budget.limit || 0;

  function renderEditDialog() {
    const rawPct = currentLimitVal > 0 ? Math.round(((budget.spent || 0) / currentLimitVal) * 100) : 0;
    const isAtDefault = currentLimitVal === defaultLimit;

    dialog.innerHTML = `
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:0.6rem;">
          <div class="budget-modal-header-icon" style="background:rgba(34,197,94,0.12);color:var(--accent-brand);width:34px;height:34px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;">
            ${renderSvg('edit', 17)}
          </div>
          <div>
            <h2 class="modal-title" id="${EDIT_MODAL_ID}-title" style="margin:0;font-size:1.15rem;font-weight:700;">Sửa hạn mức chi tiêu</h2>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Điều chỉnh hoặc đặt lại hạn mức cho ${escapeHtml(catName)}</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" id="btn-close-edit-modal" aria-label="Đóng cửa sổ">
          ${renderSvg('close', 18)}
        </button>
      </div>

      <div class="modal-form" style="padding:1.25rem 1.5rem;">
        <!-- Category Banner -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;background:var(--bg-surface-elevated);border:1px solid var(--border-card);border-radius:var(--radius-md);">
          <div style="display:flex;align-items:center;gap:0.75rem;">
            ${getCategoryAvatarHtml(budget.category, 'md')}
            <div>
              <strong style="display:block;font-size:0.95rem;color:var(--text-primary);">${escapeHtml(catName)}</strong>
              <span style="font-size:0.78rem;color:var(--text-muted);">Đã chi trong tháng: <strong style="color:var(--text-primary);">${formatCurrency(budget.spent || 0)}</strong></span>
            </div>
          </div>
          <span class="budget-status-pill" style="font-size:0.78rem;padding:3px 8px;border-radius:12px;background:rgba(255,255,255,0.06);color:var(--text-secondary);font-weight:600;">
            ${rawPct}% ngân sách
          </span>
        </div>

        <!-- Limit Input -->
        <div class="form-group" style="margin-top:0.75rem;">
          <label for="edit-limit-input" class="form-label">Hạn mức chi tiêu mới:</label>
          <div style="position:relative;">
            <input type="text" id="edit-limit-input" class="form-input" value="${formatAmount(currentLimitVal)}" style="font-family:var(--font-mono);font-size:1.15rem;font-weight:700;padding-right:2.5rem;color:var(--text-primary);" />
            <span style="position:absolute;right:1rem;top:50%;transform:translateY(-50%);color:var(--text-muted);font-weight:600;font-size:0.85rem;">
              ${getActiveCurrency()}
            </span>
          </div>
        </div>

        <!-- Quick Preset Delta Chips -->
        <div class="form-group">
          <span style="font-size:0.75rem;color:var(--text-muted);">Tăng nhanh số tiền:</span>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
            <button type="button" class="btn-secondary chip-btn" data-delta="200000" style="padding:0.35rem 0.65rem;font-size:0.78rem;">+200K</button>
            <button type="button" class="btn-secondary chip-btn" data-delta="500000" style="padding:0.35rem 0.65rem;font-size:0.78rem;">+500K</button>
            <button type="button" class="btn-secondary chip-btn" data-delta="1000000" style="padding:0.35rem 0.65rem;font-size:0.78rem;">+1M</button>
            <button type="button" class="btn-secondary chip-btn" data-delta="2000000" style="padding:0.35rem 0.65rem;font-size:0.78rem;">+2M</button>
          </div>
        </div>

        <!-- Reset to Default Quick Action -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;background:rgba(34,197,94,0.05);border:1px dashed rgba(34,197,94,0.3);border-radius:var(--radius-md);margin-top:0.25rem;">
          <div>
            <span style="display:block;font-size:0.82rem;font-weight:600;color:var(--text-primary);">Mức khuyến nghị mặc định:</span>
            <span style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);">${formatCurrency(defaultLimit)}</span>
          </div>
          <button type="button" class="btn-secondary" id="btn-revert-default" style="font-size:0.78rem;display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.75rem;" ${isAtDefault ? 'disabled' : ''}>
            ${renderSvg('rotateCcw', 13)}
            <span>Đặt về mặc định</span>
          </button>
        </div>
      </div>

      <div class="modal-footer" style="padding:1rem 1.5rem;display:flex;justify-content:flex-end;gap:0.75rem;border-top:1px solid var(--border-subtle);background:var(--bg-surface);">
        <button type="button" class="btn-secondary" id="btn-cancel-edit" style="padding:0.6rem 1.1rem;font-size:0.88rem;">Hủy</button>
        <button type="button" class="btn-add-transaction" id="btn-save-edit-limit" style="padding:0.6rem 1.3rem;font-size:0.88rem;display:inline-flex;align-items:center;gap:0.45rem;">
          ${renderSvg('check', 16)}
          <span>Lưu hạn mức</span>
        </button>
      </div>
    `;

    bindEditEvents();
  }

  function bindEditEvents() {
    dialog.querySelector('#btn-close-edit-modal')?.addEventListener('click', () => {
      closeModal(EDIT_MODAL_ID);
    });

    dialog.querySelector('#btn-cancel-edit')?.addEventListener('click', () => {
      closeModal(EDIT_MODAL_ID);
    });

    const limitInput = dialog.querySelector('#edit-limit-input');
    if (limitInput) {
      limitInput.addEventListener('input', e => {
        const raw = e.target.value;
        currentLimitVal = parseVndInput(raw) || 0;
        if (!/[a-zA-Z]/i.test(raw)) {
          limitInput.value = formatAmount(currentLimitVal);
        }
      });
      limitInput.addEventListener('blur', () => {
        limitInput.value = formatAmount(currentLimitVal);
      });
    }

    // Delta chips
    dialog.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.delta) || 0;
        currentLimitVal += delta;
        renderEditDialog();
      });
    });

    // Revert to default
    dialog.querySelector('#btn-revert-default')?.addEventListener('click', () => {
      currentLimitVal = defaultLimit;
      renderEditDialog();
      showToast(`Đã khôi phục hạn mức ${catName} về ${formatCurrency(defaultLimit)}`, 'info');
    });

    // Save
    dialog.querySelector('#btn-save-edit-limit')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = `<span class="loading-spinner"></span> Đang lưu...`;

      try {
        await dataService.updateBudget(budget.id, { limit: currentLimitVal });
        closeModal(EDIT_MODAL_ID);
        showToast(`Đã cập nhật hạn mức ${catName}: ${formatCurrency(currentLimitVal)}`, 'success');
      } catch (err) {
        console.error('[budgetResetModal] Error updating budget:', err);
        showToast(`Không thể cập nhật ngân sách: ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = `${renderSvg('check', 16)} Lưu hạn mức`;
      }
    });
  }

  renderEditDialog();
  openModal(EDIT_MODAL_ID);
}

/* --------------------------------------------------------------- *
 * 3. ADD NEW BUDGET MODAL
 * --------------------------------------------------------------- */

/**
 * Open the "Đặt ngân sách mới" modal
 */
export async function openAddBudgetModal() {
  const modal = ensureModal(ADD_MODAL_ID);
  const dialog = modal.querySelector('.modal-dialog');

  const currentBudgets = await dataService.getBudgets();
  const existingCatSet = new Set((currentBudgets || []).map(b => b.category));
  const availableCategories = EXPENSE_CATEGORIES.filter(c => !existingCatSet.has(c.id));

  let selectedCategory = availableCategories[0]?.id || 'other';
  let initialLimit = 500000;

  function renderAddDialog() {
    dialog.innerHTML = `
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:0.6rem;">
          <div class="budget-modal-header-icon" style="background:rgba(34,197,94,0.12);color:var(--accent-brand);width:34px;height:34px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;">
            ${renderSvg('plus', 17)}
          </div>
          <div>
            <h2 class="modal-title" id="${ADD_MODAL_ID}-title" style="margin:0;font-size:1.15rem;font-weight:700;">Đặt ngân sách mới</h2>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Tạo hạn mức theo dõi chi tiêu cho danh mục</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" id="btn-close-add-modal" aria-label="Đóng cửa sổ">
          ${renderSvg('close', 18)}
        </button>
      </div>

      <div class="modal-form" style="padding:1.25rem 1.5rem;">
        ${availableCategories.length === 0 ? `
          <div style="padding:1.5rem;text-align:center;color:var(--text-muted);">
            ${renderSvg('check', 32)}
            <p style="margin-top:0.75rem;font-size:0.9rem;">Bạn đã thiết lập ngân sách cho tất cả các danh mục chi tiêu!</p>
          </div>
        ` : `
          <!-- Select Category -->
          <div class="form-group">
            <label for="add-budget-cat-select" class="form-label">Chọn danh mục:</label>
            <select id="add-budget-cat-select" class="form-select">
              ${availableCategories.map(c => `
                <option value="${c.id}" ${c.id === selectedCategory ? 'selected' : ''}>${escapeHtml(c.labelVi)}</option>
              `).join('')}
            </select>
          </div>

          <!-- Limit Input -->
          <div class="form-group" style="margin-top:0.75rem;">
            <label for="add-budget-limit-input" class="form-label">Hạn mức chi tiêu mong muốn:</label>
            <div style="position:relative;">
              <input type="text" id="add-budget-limit-input" class="form-input" value="${formatAmount(initialLimit)}" style="font-family:var(--font-mono);font-size:1.15rem;font-weight:700;padding-right:2.5rem;color:var(--text-primary);" />
              <span style="position:absolute;right:1rem;top:50%;transform:translateY(-50%);color:var(--text-muted);font-weight:600;font-size:0.85rem;">
                ${getActiveCurrency()}
              </span>
            </div>
          </div>

          <!-- Quick presets -->
          <div class="form-group">
            <span style="font-size:0.75rem;color:var(--text-muted);">Gợi ý hạn mức nhanh:</span>
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
              <button type="button" class="btn-secondary add-preset-btn" data-val="300000" style="padding:0.35rem 0.65rem;font-size:0.78rem;">300.000 ₫</button>
              <button type="button" class="btn-secondary add-preset-btn" data-val="500000" style="padding:0.35rem 0.65rem;font-size:0.78rem;">500.000 ₫</button>
              <button type="button" class="btn-secondary add-preset-btn" data-val="1000000" style="padding:0.35rem 0.65rem;font-size:0.78rem;">1.000.000 ₫</button>
              <button type="button" class="btn-secondary add-preset-btn" data-val="2000000" style="padding:0.35rem 0.65rem;font-size:0.78rem;">2.000.000 ₫</button>
            </div>
          </div>
        `}
      </div>

      <div class="modal-footer" style="padding:1rem 1.5rem;display:flex;justify-content:flex-end;gap:0.75rem;border-top:1px solid var(--border-subtle);background:var(--bg-surface);">
        <button type="button" class="btn-secondary" id="btn-cancel-add" style="padding:0.6rem 1.1rem;font-size:0.88rem;">Hủy</button>
        ${availableCategories.length > 0 ? `
          <button type="button" class="btn-add-transaction" id="btn-save-new-budget" style="padding:0.6rem 1.3rem;font-size:0.88rem;display:inline-flex;align-items:center;gap:0.45rem;">
            ${renderSvg('plus', 16)}
            <span>Tạo ngân sách</span>
          </button>
        ` : ''}
      </div>
    `;

    bindAddEvents();
  }

  function bindAddEvents() {
    dialog.querySelector('#btn-close-add-modal')?.addEventListener('click', () => {
      closeModal(ADD_MODAL_ID);
    });

    dialog.querySelector('#btn-cancel-add')?.addEventListener('click', () => {
      closeModal(ADD_MODAL_ID);
    });

    const catSelect = dialog.querySelector('#add-budget-cat-select');
    if (catSelect) {
      catSelect.addEventListener('change', e => {
        selectedCategory = e.target.value;
      });
    }

    const limitInput = dialog.querySelector('#add-budget-limit-input');
    if (limitInput) {
      limitInput.addEventListener('input', e => {
        const raw = e.target.value;
        initialLimit = parseVndInput(raw) || 0;
        if (!/[a-zA-Z]/i.test(raw)) {
          limitInput.value = formatAmount(initialLimit);
        }
      });
      limitInput.addEventListener('blur', () => {
        limitInput.value = formatAmount(initialLimit);
      });
    }

    dialog.querySelectorAll('.add-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        initialLimit = Number(btn.dataset.val) || 0;
        if (limitInput) limitInput.value = formatAmount(initialLimit);
      });
    });

    dialog.querySelector('#btn-save-new-budget')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = `<span class="loading-spinner"></span> Đang tạo...`;

      try {
        await dataService.addBudget({
          category: selectedCategory,
          limit: initialLimit,
          spent: 0,
        });

        closeModal(ADD_MODAL_ID);
        const catName = getCategoryLabelVi(selectedCategory);
        showToast(`Đã tạo ngân sách cho ${catName}: ${formatCurrency(initialLimit)}`, 'success');
      } catch (err) {
        console.error('[budgetResetModal] Error adding budget:', err);
        showToast(`Không thể tạo ngân sách: ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = `${renderSvg('plus', 16)} Tạo ngân sách`;
      }
    });
  }

  renderAddDialog();
  openModal(ADD_MODAL_ID);
}
