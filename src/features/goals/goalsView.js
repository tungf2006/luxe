/**
 * @file Financial Goals feature module.
 * Renders the goals page with progress cards.
 */

import dataService from '../../services/dataAdapter.js';
import { formatCurrency, formatCompactCurrency, escapeHtml, formatMonthYear } from '../../utils/format.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { getRoute } from '../../config/routes.js';



function goalCardHTML(goal) {
  const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
  const remaining = goal.target - goal.current;
  const deadline = formatMonthYear(goal.deadline);
  const isCompleted = pct >= 100;
  const pctColor = pct >= 80 ? 'var(--positive)' : pct >= 50 ? 'var(--emerald-accent-light)' : 'var(--text-secondary)';

  // Default icons per goal type/category
  const goalIcons = {
    savings: '💰',
    investment: '📈',
    emergency: '🛡️',
    retirement: '🏖️',
    education: '🎓',
    travel: '✈️',
    vehicle: '🚗',
    house: '🏠',
    other: '🎯'
  };
  const icon = goal.icon || goalIcons[goal.category] || goalIcons.other;
  const iconBgColors = {
    savings: 'rgba(34, 197, 94, 0.2)',
    investment: 'rgba(99, 102, 241, 0.2)',
    emergency: 'rgba(244, 63, 94, 0.15)',
    retirement: 'rgba(56, 189, 248, 0.2)',
    education: 'rgba(168, 85, 247, 0.2)',
    travel: 'rgba(245, 158, 11, 0.2)',
    vehicle: 'rgba(236, 72, 153, 0.2)',
    house: 'rgba(20, 184, 166, 0.2)',
    other: 'rgba(255, 255, 255, 0.08)'
  };
  const iconBg = iconBgColors[goal.category] || iconBgColors.other;

  return `
    <div class="goal-card" id="goal-card-${goal.id}">
      <div class="goal-card-header">
        <span class="goal-icon" aria-hidden="true" style="background:${iconBg}">${icon}</span>
        <div>
          <div class="goal-name">${escapeHtml(goal.name)}</div>
          <div class="goal-deadline">Dự kiến hoàn thành: ${deadline}</div>
        </div>
      </div>
      
      <div class="goal-progress-section">
        <div class="goal-progress-header">
          <span class="goal-percent" style="color:${pctColor}">${pct}%</span>
          <span class="goal-status ${isCompleted ? 'completed' : ''}">${isCompleted ? 'Hoàn thành' : 'Đang thực hiện'}</span>
        </div>
<div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(goal.name)}: ${pct}%">
  <div class="progress-fill progress-fill--goal" style="width:${pct}%"></div>
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
    <div class="glass-panel" style="padding:3rem;text-align:center;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
      <p style="color:var(--text-muted);margin-bottom:1rem;">Chưa có mục tiêu tài chính nào.</p>
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
          <span class="overview-stat-value">${closest ? escapeHtml(closest.name) : '—'}</span>
          <span class="overview-stat-sub">${closest ? `${closestPct}% hoàn thành · còn ${formatCurrency(closestRemaining)}` : 'Chưa có mục tiêu nào'}</span>
        </div>
      </div>
    </div>
  `;
}

export async function render(container, page = 'goals') {
  const route = getRoute(page);
  const goals = await dataService.getGoals();

  container.innerHTML = `
    ${pageHeaderHTML({
      title: route.title,
      description: route.description,
      actionHTML: `
        <button class="btn-add-transaction" data-action="add-goal" aria-label="Thêm mục tiêu">
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
  container.addEventListener('click', e => {
    if (e.target.closest('[data-action="add-goal"]')) {
      showToast('Tính năng tạo mục tiêu sẽ sớm được ra mắt.', 'info');
    }
  });
}

export default { render };

