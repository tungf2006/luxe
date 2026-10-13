/**
 * @file Financial Goals feature module.
 * Renders the goals page with progress cards, analytics overview,
 * and interactive workflows (Add, Edit, Delete, Deposit).
 */

import dataService from '../../services/dataAdapter.js';
import { formatCurrency, formatCompactCurrency, escapeHtml, formatMonthYear } from '../../utils/format.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { showToast } from '../../components/ui/Toast.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { getRoute } from '../../config/routes.js';
import { getGoalCategory } from '../../constants/goals.js';
import { openAddGoalModal, openEditGoalModal, openDepositGoalModal } from './goalModal.js';
import { showConfirmModal } from '../../components/ui/ConfirmModal.js';

let _cachedGoals = [];

function goalCardHTML(goal) {
  const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
  const remaining = goal.target - goal.current;
  const deadline = formatMonthYear(goal.deadline);
  const isCompleted = pct >= 100;
  const pctColor = pct >= 80 ? 'var(--positive)' : pct >= 50 ? 'var(--emerald-accent-light)' : 'var(--text-secondary)';

  const cat = getGoalCategory(goal.category);

  return `
    <div class="goal-card" id="goal-card-${goal.id}" style="--accent-goal:${cat.color}">
      <div class="goal-card-header">
        <div class="goal-card-header-left">
          <span class="goal-icon" aria-hidden="true" style="background:${cat.bg}; color:${cat.color}; border:1px solid ${cat.border}">
            ${cat.iconSvg}
          </span>
          <div class="goal-card-info">
            <div class="goal-name text-truncate" title="${escapeHtml(goal.name)}">${escapeHtml(goal.name)}</div>
            <div class="goal-deadline">Dự kiến hoàn thành: ${deadline}</div>
          </div>
        </div>
        <div class="goal-card-actions">
          <button type="button" 
            class="goal-card-action-btn goal-deposit-btn" 
            data-action="deposit-goal" 
            data-id="${goal.id}" 
            title="Tích lũy thêm"
            aria-label="Tích lũy thêm vào ${escapeHtml(goal.name)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>+ Nạp</span>
          </button>
          <button type="button" 
            class="goal-card-icon-btn" 
            data-action="edit-goal" 
            data-id="${goal.id}" 
            title="Chỉnh sửa mục tiêu"
            aria-label="Sửa mục tiêu ${escapeHtml(goal.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" 
            class="goal-card-icon-btn goal-delete-btn" 
            data-action="delete-goal" 
            data-id="${goal.id}" 
            title="Xóa mục tiêu"
            aria-label="Xóa mục tiêu ${escapeHtml(goal.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
      
      <div class="goal-progress-section">
        <div class="goal-progress-header">
          <span class="goal-percent" style="color:${pctColor}">${pct}%</span>
          <span class="goal-status ${isCompleted ? 'completed' : ''}">${isCompleted ? 'Hoàn thành' : 'Đang thực hiện'}</span>
        </div>
        <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(goal.name)}: ${pct}%">
          <div class="progress-fill progress-fill--goal" style="width:${pct}%; background:${cat.color}"></div>
        </div>
      </div>
      
      <div class="goal-amounts">
        <div class="goal-amount-current">
          <span class="amount-label">Đã tích lũy</span>
          <span class="amount-value">${formatCurrency(goal.current)}</span>
        </div>
        <div class="goal-amount-target">
          <span class="amount-label">Mục tiêu</span>
          <span class="amount-value">${formatCurrency(goal.target)}</span>
        </div>
        <div class="goal-amount-remaining">
          <span class="amount-label">Còn thiếu</span>
          <span class="amount-value">${formatCurrency(Math.max(0, remaining))}</span>
        </div>
      </div>
    </div>
  `;
}

function emptyStateHTML() {
  return `
    <div class="glass-panel" style="padding:3.5rem 2rem;text-align:center;">
      <div class="empty-state-icon" style="width:56px;height:56px;border-radius:50%;background:rgba(16,185,129,0.1);color:var(--accent-brand);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
      </div>
      <h3 style="font-size:1.15rem;font-weight:600;color:var(--text-primary);margin-bottom:0.5rem;">Chưa có mục tiêu tài chính nào</h3>
      <p style="color:var(--text-muted);margin-bottom:1.5rem;max-width:440px;margin-left:auto;margin-right:auto;font-size:0.9rem;line-height:1.5;">
        Hãy thiết lập mục tiêu đầu tiên (mua nhà, mua xe, du lịch hoặc quỹ khẩn cấp) để Luxe đồng hành theo dõi tiến độ cùng bạn.
      </p>
      <button class="btn-add-transaction" data-action="add-goal" aria-label="Tạo mục tiêu đầu tiên">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Tạo mục tiêu đầu tiên
      </button>
    </div>
  `;
}

function goalsOverviewHTML(goals) {
  const totalSaved = goals.reduce((s, g) => s + (g.current || 0), 0);
  const active = goals.filter(g => (g.current || 0) < (g.target || 0));
  const closest = active.length
    ? [...active].sort((a, b) => (b.current / b.target) - (a.current / a.target))[0]
    : null;
  const closestPct = closest ? Math.min(Math.round((closest.current / closest.target) * 100), 100) : 0;
  const closestRemaining = closest ? Math.max(0, closest.target - closest.current) : 0;

  return `
    <div class="glass-panel goals-overview-panel">
      ${panelHeaderHTML({
        title: 'Tổng quan mục tiêu',
        subtitle: `${goals.length} mục tiêu`,
        iconSvg: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="16" y1="12" x2="12" y2="16"/>',
      })}
      <div class="goals-overview-stats">
        <div class="overview-stat">
          <span class="overview-stat-label">Tổng đã tích lũy</span>
          <span class="overview-stat-value highlight-positive">${formatCompactCurrency(totalSaved)}</span>
        </div>
        <div class="overview-stat">
          <span class="overview-stat-label">Mục tiêu đang chạy</span>
          <span class="overview-stat-value">${active.length}</span>
          <span class="overview-stat-sub">${goals.length} tổng số mục tiêu</span>
        </div>
        <div class="overview-stat">
          <span class="overview-stat-label">Gần hoàn thành nhất</span>
          <span class="overview-stat-value text-truncate">${closest ? escapeHtml(closest.name) : '—'}</span>
          <span class="overview-stat-sub">${closest ? `${closestPct}% hoàn thành · còn ${formatCurrency(closestRemaining)}` : 'Chưa có mục tiêu nào'}</span>
        </div>
      </div>
    </div>
  `;
}

export async function render(container, page = 'goals') {
  const route = getRoute(page);
  const goals = await dataService.getGoals();
  _cachedGoals = goals;

  container.innerHTML = `
    ${pageHeaderHTML({
      title: route.title,
      description: route.description,
      actionHTML: `
        <button class="btn-add-transaction" data-action="add-goal" id="btn-open-add-goal" aria-label="Thêm mục tiêu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Thêm mục tiêu
        </button>
      `,
    })}
    ${goals.length === 0 ? emptyStateHTML() : `
      ${goalsOverviewHTML(goals)}
      <div class="goals-grid" id="goals-grid">
        ${goals.map(goal => goalCardHTML(goal)).join('')}
      </div>
    `}
  `;

  attachListeners(container);
}

function attachListeners(container) {
  container.addEventListener('click', async e => {
    // 1. Add Goal
    if (e.target.closest('[data-action="add-goal"]')) {
      openAddGoalModal();
      return;
    }

    // 2. Deposit Goal
    const depositBtn = e.target.closest('[data-action="deposit-goal"]');
    if (depositBtn) {
      const id = depositBtn.dataset.id;
      const goal = _cachedGoals.find(g => g.id === id);
      if (goal) {
        openDepositGoalModal(goal);
      }
      return;
    }

    // 3. Edit Goal
    const editBtn = e.target.closest('[data-action="edit-goal"]');
    if (editBtn) {
      const id = editBtn.dataset.id;
      const goal = _cachedGoals.find(g => g.id === id);
      if (goal) {
        openEditGoalModal(goal);
      }
      return;
    }

    // 4. Delete Goal
    const deleteBtn = e.target.closest('[data-action="delete-goal"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const goal = _cachedGoals.find(g => g.id === id);
      if (!goal) return;

      const confirmed = await showConfirmModal({
        title: 'Xóa mục tiêu tài chính',
        message: `Bạn có chắc chắn muốn xóa mục tiêu "${goal.name}" không? Thao tác này không thể hoàn tác.`,
        confirmText: 'Xóa mục tiêu',
        cancelText: 'Giữ lại',
        type: 'danger',
      });

      if (confirmed) {
        try {
          await dataService.deleteGoal(id);
          showToast(`Đã xóa mục tiêu "${goal.name}".`, 'info');
        } catch (err) {
          showToast(`Không thể xóa: ${err.message}`, 'error');
        }
      }
    }
  });
}

export default { render };
