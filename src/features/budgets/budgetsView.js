/**
 * @file Budgets feature module.
 * Renders the budgets page: summary KPIs and budget cards grid.
 */

import dataService, { getBudgetProgress } from '../../services/dataService.js';
import { kpiCardHTML } from '../../components/ui/KPICard.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { formatCurrency, formatCompactCurrency, escapeHtml, parseNumber } from '../../utils/format.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';
import { CATEGORY_MAP, getCategoryLabelVi, getCategoryIcon, getCategoryColor } from '../../constants/categories.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { t } from '../../utils/i18n.js';
import { getBudgetProgressClass, getBudgetProgressColor } from '../../utils/progress.js';
import { getRoute } from '../../config/routes.js';

/* --------------------------------------------------------------- *
 * SVG icon fragments
 * --------------------------------------------------------------- */
const ICONS = {
  wallet:  '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  target:  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  spark:   '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  grid:    '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" h2="9"/><line x1="9" y1="15" h2="9"/>',
  alertTriangle: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  alertOctagon:  '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  moreVertical: '<circle cx="12" cy="6" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/>',
  edit:        '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>',
  eye:         '<circle cx="12" cy="12" r="10"/><line x1="2" y1="2" x2="22" y2="22"></line>',
  trash:       '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
  warningMini: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
};

function kpiIcon(pathFrag) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathFrag}</svg>`;
}

function alertIcon(pathFrag, color) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;">${pathFrag}</svg>`;
}

/* --------------------------------------------------------------- *
 * Budget alert HTML builder (3-level system)
 * --------------------------------------------------------------- */
function budgetAlertHTML(pct, remaining, catName) {
  if (pct < 75) return '';

  let variant, icon, message;

  if (pct >= 75 && pct < 90) {
    variant = 'warning';
    icon = alertIcon(ICONS.alertTriangle, '#fcd34d');
    message = `Gần giới hạn — chỉ còn <strong>${formatCurrency(remaining)}</strong> cho ${escapeHtml(catName)} trong tháng này.`;
  } else if (pct >= 90 && remaining >= 0) {
    variant = 'danger';
    icon = alertIcon(ICONS.alertOctagon, '#fca5a5');
    message = `Nguy hiểm — chỉ còn <strong>${formatCurrency(remaining)}</strong> cho ${escapeHtml(catName)} trong tháng này.`;
  } else {
    // > 100% — vượt ngân sách
    variant = 'over';
    const overAmount = Math.abs(remaining);
    icon = alertIcon(ICONS.alertOctagon, '#fca5a5');
    message = `<strong>Vượt ngân sách</strong> — đã vượt <strong>${formatCurrency(overAmount)}</strong> cho ${escapeHtml(catName)} trong tháng này.`;
  }

  return `
    <div class="budget-alert budget-alert--${variant}" style="margin-top:0.75rem;">
      ${icon}
      <span>${message}</span>
    </div>`;
}

/* --------------------------------------------------------------- *
 * Insight helpers (7-day sparkline, daily avg, projection)
 * --------------------------------------------------------------- */

/**
 * Daily expense totals for a category over the last 7 days.
 * @param {Array} txList
 * @param {string} category
 * @returns {number[]} 7 values (oldest → newest)
 */
function getCategory7DaySeries(txList, category) {
  const now = new Date();
  const series = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const daySpent = txList
      .filter(tx => tx.type === 'expense' && tx.category === category && tx.date === dateStr)
      .reduce((s, tx) => s + parseNumber(tx.amount), 0);
    series.push(daySpent);
  }
  return series;
}

/**
 * Render a compact inline SVG sparkline from an array of values.
 * @param {number[]} values
 * @param {string} color
 * @returns {string}
 */
function sparklineSVG(values, color) {
  console.log('[sparkline] input values:', values);

  const w = 76, h = 20;
  const hasValues = Array.isArray(values) && values.length > 0;
  const hasData = hasValues && values.some(v => v > 0);

  let maxVal, pts, strokeColor, strokeWidth;

  if (!hasData) {
    maxVal = 1;
    const lineY = h * 0.5;
    pts = `0,${lineY.toFixed(1)} ${w},${lineY.toFixed(1)}`;
    strokeColor = 'rgba(148,163,184,0.25)';
    strokeWidth = 1;
  } else {
    maxVal = Math.max(...values, 1) * 1.15;
    const step = values.length > 1 ? w / (values.length - 1) : 0;
    pts = values.map((v, i) => {
      const x = i * step;
      const y = h - (v / maxVal) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    strokeColor = color;
    strokeWidth = 1.5;
  }

  return `
    <svg class="budget-sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"
         preserveAspectRatio="none" role="img" aria-label="Chi tiêu 7 ngày qua">
      <polyline points="${pts}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"
                stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

/**
 * Compute daily average & month-end projection for a budget.
 * @param {Object} budget
 * @returns {{dailyAvg:number, projected:number, exceedDay:number|null, exceedDateStr:string|null}}
 */
function computeBudgetProjection(budget) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = todayDay;

  const dailyAvg = daysElapsed > 0 ? budget.spent / daysElapsed : 0;
  const projected = dailyAvg * daysInMonth;

  let exceedDay = null;
  if (budget.limit > 0 && dailyAvg > 0 && projected > budget.limit) {
    const day = Math.ceil(budget.limit / dailyAvg);
    if (day >= 1 && day <= daysInMonth) exceedDay = day;
  }

  const monthStr = String(month + 1).padStart(2, '0');
  return {
    dailyAvg,
    projected,
    exceedDay,
    exceedDateStr: exceedDay
      ? `${String(exceedDay).padStart(2, '0')}/${monthStr}`
      : null,
  };
}

/**
 * Build the insight footer for cards whose budget is below the 75 % alert threshold.
 * @param {Object} budget
 * @param {Array} txList
 * @param {string} catName
 * @param {string} catColor
 * @returns {string}
 */
function budgetInsightHTML(budget, txList, catName, catColor) {
  const proj = computeBudgetProjection(budget);
  const series = getCategory7DaySeries(txList, budget.category);
  const spark = sparklineSVG(series, catColor);
  const hasData = series.some(v => v > 0);

  const sparklineRow = `
    <div class="budget-sparkline-row">
      <span class="budget-sparkline-label" aria-label="Chi tiêu 7 ngày qua cho ${escapeHtml(catName)}">7 ngày qua</span>
      ${spark}
    </div>`;

  const noDataNote = !hasData
    ? `<div style="color:var(--text-muted);font-size:0.7rem;margin-top:0.25rem;">Chưa có chi tiêu 7 ngày qua</div>`
    : '';

  const warning = proj.exceedDateStr
    ? `<div class="budget-insight-warning">
         ${kpiIcon(ICONS.warningMini)}
         <span>Với tốc độ hiện tại, bạn sẽ vượt ngân sách vào ngày ${proj.exceedDateStr}</span>
       </div>`
    : '';

  return `
    <div class="budget-insight">
      ${sparklineRow}
      ${noDataNote}
      <div class="budget-insight-stats">
        <span>Trung bình mỗi ngày: <strong>${formatCurrency(proj.dailyAvg)}</strong></span>
        <span class="budget-insight-divider">·</span>
        <span>Dự kiến cuối tháng: <strong>${formatCurrency(proj.projected)}</strong></span>
      </div>
      ${warning}
    </div>`;
}

/* --------------------------------------------------------------- *
 * HTML builders
 * --------------------------------------------------------------- */
function budgetSummaryKPIsHTML(budgets) {
  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const remaining = totalBudget - totalSpent;
  const pctUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return `
    <div class="kpi-grid" id="budget-kpi-grid" style="margin-bottom:2rem;">
      ${kpiCardHTML({
        id: 'budget-kpi-total',
         title: 'Tổng ngân sách',
         value: formatCompactCurrency(totalBudget),
         iconSvg: kpiIcon(ICONS.wallet),
         footerHtml: '<span class="trend-label">trong tháng</span>',
      })}
      ${kpiCardHTML({
        id: 'budget-kpi-spent',
         title: 'Tổng chi',
         value: formatCompactCurrency(totalSpent),
         valueClass: 'highlight-negative',
         iconSvg: kpiIcon(ICONS.target),
         footerHtml: `<span class="trend-badge trend-positive">${pctUsed}%</span><span class="trend-label">của ngân sách</span>`,
      })}
      ${kpiCardHTML({
        id: 'budget-kpi-remaining',
         title: 'Còn lại',
         value: formatCompactCurrency(remaining),
         valueClass: remaining >= 0 ? 'highlight-positive' : 'highlight-negative',
         iconSvg: kpiIcon(ICONS.spark),
         footerHtml: `<span class="trend-label">${remaining >= 0 ? 'còn lại' : 'vượt ngân sách'}</span>`,
      })}
      ${kpiCardHTML({
        id: 'budget-kpi-categories',
         title: 'Danh mục',
        value: String(budgets.length),
        iconSvg: kpiIcon(ICONS.grid),
        footerHtml: '<span class="trend-label">ngân sách đang hoạt động</span>',
      })}
    </div>
  `;
}

function budgetCardsHTML(budgets, txList = []) {
  if (budgets.length === 0) {
    return `
      <div class="glass-panel" style="padding:3rem;text-align:center;color:var(--text-muted);">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.4" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
         <p>Chưa có ngân sách nào. Tạo một ngân sách để bắt đầu theo dõi.</p>
      </div>
    `;
  }

  return `
    <div class="budget-cards-grid" id="budget-cards-grid">
      ${budgets.map(b => {
        const cat = CATEGORY_MAP[b.category];
        const catName = getCategoryLabelVi(b.category) || b.category;
        const catIcon = getCategoryIcon(b.category);
        const catColor = getCategoryColor(b.category);
        const rawPct = Math.round((b.spent / b.limit) * 100);
        const pct = Math.min(rawPct, 100);
        const remaining = b.limit - b.spent;
        const fillClass = getBudgetProgressClass(rawPct);
        const statusColor = getBudgetProgressColor(rawPct);
        const remainingColor = remaining >= 0 ? 'var(--positive)' : 'var(--negative)';
        const remainingText = remaining >= 0 ? `Còn ${formatCurrency(remaining)}` : `Vượt ngân sách ${formatCurrency(Math.abs(remaining))}`;
        const hasAlert = rawPct >= 75;

        return `
          <div class="budget-overview-card" id="budget-card-${b.id}">
            <button class="budget-card-menu-btn"
                    data-action="toggle-budget-menu"
                    data-budget-id="${b.id}"
                    aria-haspopup="true"
                    aria-expanded="false"
                    aria-label="Tùy chọn ngân sách ${escapeHtml(catName)}">
              ${kpiIcon(ICONS.moreVertical)}
            </button>
            <div class="budget-card-dropdown" id="budget-dropdown-${b.id}" role="menu" aria-label="Tùy chọn ngân sách ${escapeHtml(catName)}">
              <button class="budget-card-menu-item" data-action="edit-budget" data-budget-id="${b.id}" data-category="${b.category}" role="menuitem">
                ${kpiIcon(ICONS.edit)} Sửa hạn mức
              </button>
              <button class="budget-card-menu-item" data-action="view-budget-tx" data-budget-id="${b.id}" data-category="${b.category}" role="menuitem">
                ${kpiIcon(ICONS.eye)} Xem giao dịch
              </button>
              <div class="budget-card-divider"></div>
              <button class="budget-card-menu-item danger" data-action="delete-budget" data-budget-id="${b.id}" data-category="${escapeHtml(catName)}" role="menuitem">
                ${kpiIcon(ICONS.trash)} Xoá ngân sách
              </button>
            </div>

            <div class="budget-card-top">
              <span class="budget-card-title">
                ${catIcon} ${escapeHtml(catName)}
              </span>
              <span style="font-size:0.8rem;font-weight:600;color:${statusColor};">${pct}% đã dùng</span>
            </div>

            <div style="margin-bottom:0.5rem;">
                <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(catName)} ngân sách ${pct}% đã dùng">
                <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
              </div>
            </div>

            <div class="budget-spend-numbers">
              <div>
            <div style="font-family:var(--font-display);font-size:1.35rem;font-weight:700;">${formatCurrency(b.spent)}</div>
            <div style="font-size:0.775rem;color:var(--text-muted);">trong ngân sách ${formatCurrency(b.limit)}</div>
              </div>
              <div style="text-align:right;">
                    <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:600;color:${remainingColor};">${formatCurrency(remaining >= 0 ? remaining : -Math.abs(remaining))}</div>
                  <div style="font-size:0.775rem;color:var(--text-muted);">${remaining >= 0 ? 'còn lại' : 'vượt ngân sách'}</div>
              </div>
            </div>

            ${hasAlert ? budgetAlertHTML(rawPct, remaining, catName) : budgetInsightHTML(b, txList, catName, catColor)}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Main render
 * --------------------------------------------------------------- */
export async function render(container, page = 'budgets') {
  const route = getRoute(page);
  const [budgets, transactions] = await Promise.all([
    dataService.getBudgets(),
    dataService.getTransactions(),
  ]);

  const progressBudgets = getBudgetProgress(budgets, transactions);

  container.innerHTML = `
    ${pageHeaderHTML({
      title: route.title,
      description: route.description,
      actionHTML: `
        <button class="btn-add-transaction" data-action="add-budget" aria-label="Đặt ngân sách mới">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Đặt ngân sách mới
        </button>
      `,
    })}
    ${budgetSummaryKPIsHTML(progressBudgets)}
    ${progressBudgets.length > 0 ? budgetLegendHTML() : ''}
    ${budgetCardsHTML(progressBudgets, transactions)}
  `;

  attachListeners(container);
}

function budgetLegendHTML() {
  return `
    <div class="budget-legend" aria-label="${t('budgets.legend.ariaLabel')}">
      <span class="budget-legend-label">${t('budgets.legend.label')}</span>
      <span class="budget-legend-item"><span class="budget-legend-dot ok" aria-hidden="true"></span>${t('budgets.legend.ok')}</span>
      <span class="budget-legend-item"><span class="budget-legend-dot low-warning" aria-hidden="true"></span>${t('budgets.legend.lowWarning')}</span>
      <span class="budget-legend-item"><span class="budget-legend-dot warning" aria-hidden="true"></span>${t('budgets.legend.warning')}</span>
      <span class="budget-legend-item"><span class="budget-legend-dot danger" aria-hidden="true"></span>${t('budgets.legend.danger')}</span>
      <span class="budget-legend-item"><span class="budget-legend-dot over" aria-hidden="true"></span>${t('budgets.legend.over')}</span>
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Dropdown helpers
 * --------------------------------------------------------------- */
function closeBudgetDropdowns(container) {
  container.querySelectorAll('.budget-card-dropdown').forEach(d => d.classList.remove('open'));
  container.querySelectorAll('[data-action="toggle-budget-menu"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

function toggleBudgetDropdown(container, budgetId) {
  const dropdown = container.querySelector(`#budget-dropdown-${budgetId}`);
  const btn = container.querySelector(`[data-action="toggle-budget-menu"][data-budget-id="${budgetId}"]`);
  if (!dropdown || !btn) return;

  const willOpen = !dropdown.classList.contains('open');

  // Close all, then open the requested one
  closeBudgetDropdowns(container);
  if (willOpen) {
    dropdown.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
}

/* --------------------------------------------------------------- *
 * Event listeners
 * --------------------------------------------------------------- */
let _docClickHandler = null;
let _docKeydownHandler = null;
let _containerClickHandler = null;

function attachListeners(container) {
  if (_docClickHandler) document.removeEventListener('click', _docClickHandler);
  if (_docKeydownHandler) document.removeEventListener('keydown', _docKeydownHandler);
  if (_containerClickHandler) container.removeEventListener('click', _containerClickHandler);

  _docClickHandler = e => {
    if (!e.target.closest('.budget-card-dropdown')) closeBudgetDropdowns(container);
  };
  document.addEventListener('click', _docClickHandler);

  _docKeydownHandler = e => {
    if (e.key === 'Escape') closeBudgetDropdowns(container);
  };
  document.addEventListener('keydown', _docKeydownHandler);

  _containerClickHandler = e => {
    // Toggle dropdown
    const toggleBtn = e.target.closest('[data-action="toggle-budget-menu"]');
    if (toggleBtn) {
      e.stopPropagation();
      toggleBudgetDropdown(container, toggleBtn.dataset.budgetId);
      return;
    }

    // Edit budget limit
    const editBtn = e.target.closest('[data-action="edit-budget"]');
    if (editBtn) {
      e.stopPropagation();
      closeBudgetDropdowns(container);
      showToast('Tính năng sửa hạn mức sẽ sớm được ra mắt.', 'info');
      return;
    }

    // View transactions for this category
    const viewBtn = e.target.closest('[data-action="view-budget-tx"]');
    if (viewBtn) {
      e.stopPropagation();
      closeBudgetDropdowns(container);
      emit('navigate', { page: 'transactions' });
      return;
    }

    // Delete budget
    const deleteBtn = e.target.closest('[data-action="delete-budget"]');
    if (deleteBtn) {
      e.stopPropagation();
      const budgetId = deleteBtn.dataset.budgetId;
      const catName = deleteBtn.dataset.category || 'ngân sách';
      closeBudgetDropdowns(container);
      if (confirm(`Xoá ngân sách "${catName}"?`)) {
        dataService.deleteBudget(budgetId);
        emit('data:changed');
        showToast('Đã xoá ngân sách.', 'info');
      }
      return;
    }

    // Set New Budget button
    if (e.target.closest('[data-action="add-budget"]')) {
      showToast('Tính năng tạo ngân sách sẽ sớm được ra mắt.', 'info');
    }
  };
  container.addEventListener('click', _containerClickHandler);
}

export default { render };
