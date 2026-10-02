/**
 * @file Financial Goals feature module.
 * Renders the goals page with progress cards.
 */

import dataService from '../../services/dataAdapter.js';
import { formatCurrency, formatCompactCurrency, escapeHtml, formatMonthYear } from '../../utils/format.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { showToast } from '../../components/ui/Toast.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { getRoute } from '../../config/routes.js';

function goalCardHTML(goal) {
  const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
  const remaining = goal.target - goal.current;
  const deadline = formatMonthYear(goal.deadline);
  const isCompleted = pct >= 100;
  const pctColor = pct >= 80 ? 'var(--positive)' : pct >= 50 ? 'var(--emerald-accent-light)' : 'var(--text-secondary)';

  // Crisp SVG icons per goal category (zero-emoji UX)
  const goalSVGs = {
    savings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
    investment: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    emergency: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    retirement: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    education: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    travel: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    vehicle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    house: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    other: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
  };
  const icon = goalSVGs[goal.category] || goalSVGs.other;
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

