/**
 * @file Budgets feature module.
 * Renders the budgets page: summary KPIs, budget cards grid with 7-day sparklines,
 * daily allowed reference line, and month-end projection.
 */

import dataService, { getBudgetProgress } from '../../services/dataService.js';
import { kpiCardHTML } from '../../components/ui/KPICard.js';
import { formatCurrency, formatCompactCurrency, escapeHtml, parseNumber, getLocalDateString, getDayNameVi, formatDateShort } from '../../utils/format.js';
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
 * Budget alert HTML builder (>= 90% and over-budget)
 * --------------------------------------------------------------- */
function budgetAlertHTML(pct, remaining, catName) {
  if (pct < 90) return '';

  let variant, icon, message;

  if (pct >= 90 && remaining >= 0) {
    variant = 'danger';
    icon = alertIcon(ICONS.alertOctagon, '#fca5a5');
    message = `Cảnh báo: Chỉ còn <strong>${formatCurrency(remaining)}</strong> cho ${escapeHtml(catName)} trong tháng này.`;
  } else {
    // > 100% — vượt ngân sách
    variant = 'over';
    const overAmount = Math.abs(remaining);
    icon = alertIcon(ICONS.alertOctagon, '#fca5a5');
    message = `Vượt ngân sách: Đã vượt <strong>${formatCurrency(overAmount)}</strong> cho ${escapeHtml(catName)} trong tháng này.`;
  }

  return `
    <div class="budget-alert budget-alert--${variant}">
      ${icon}
      <span>${message}</span>
    </div>`;
}

/* --------------------------------------------------------------- *
 * Insight helpers (7-day sparkline, daily avg, projection)
 * --------------------------------------------------------------- */

/**
 * Daily expense records for a category over the last 7 days (oldest → newest).
 * Timezone-safe via local date matching.
 * @param {Array} txList
 * @param {string} category
 * @returns {Array<{dateStr:string, date:Date, dayLabel:string, shortLabel:string, formattedDate:string, amount:number, isToday:boolean}>}
 */
function getCategory7DaySeries(txList, category) {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = getLocalDateString(d);
    const dayLabel = i === 0 ? 'Hôm nay' : getDayNameVi(d, false);
    const shortLabel = i === 0 ? 'Hôm nay' : getDayNameVi(d, true);
    const formattedDate = formatDateShort(dateStr);

    const daySpent = (txList || [])
      .filter(tx =>
        tx &&
        tx.type === 'expense' &&
        tx.status !== 'cancelled' &&
        tx.status !== 'failed' &&
        tx.category === category &&
        tx.date === dateStr
      )
      .reduce((s, tx) => s + parseNumber(tx.amount), 0);

    days.push({
      dateStr,
      date: d,
      dayLabel,
      shortLabel,
      formattedDate,
      amount: daySpent,
      isToday: i === 0,
    });
  }
  return days;
}

/**
 * Render a rich, accessible SVG sparkline with gradient area fill,
 * reference line for daily allowed limit, endpoint emphasis, and individual day tooltips.
 * @param {Array} daySeries
 * @param {string} color
 * @param {number} dailyLimit
 * @param {string} categoryId
 * @returns {string} SVG HTML string
 */
function sparklineSVG(daySeries, color, dailyLimit = 0, categoryId = 'cat') {
  const w = 260;
  const h = 54;
  const top = 6;
  const bottom = 8;
  const left = 8;
  const right = 8;

  const pw = w - left - right;
  const ph = h - top - bottom;
  const baseY = top + ph;

  const values = daySeries.map(d => d.amount);
  const hasData = values.some(v => v > 0);
  const maxVal = Math.max(...values, dailyLimit > 0 ? dailyLimit : 1, 1) * 1.25;
  const step = pw / Math.max(daySeries.length - 1, 1);

  const gradId = `spark-grad-${categoryId}-${Math.random().toString(36).slice(2, 7)}`;

  // Calculate coordinates
  const pts = daySeries.map((d, i) => {
    const x = left + i * step;
    const y = hasData ? top + ph - (d.amount / maxVal) * ph : baseY;
    return { x, y, ...d };
  });

  const refY = dailyLimit > 0 ? top + ph - (dailyLimit / maxVal) * ph : null;

  if (!hasData) {
    // Empty state: crisp dashed baseline + subtle daily limit reference
    const refLineSVG = refY !== null
      ? `<line x1="${left}" y1="${refY.toFixed(1)}" x2="${w - right}" y2="${refY.toFixed(1)}"
               stroke="rgba(245,158,11,0.35)" stroke-width="1" stroke-dasharray="3,3">
           <title>Hạn mức cho phép TB/ngày: ${formatCurrency(dailyLimit)}</title>
         </line>`
      : '';

    const dotsSVG = pts.map(p => `
      <circle cx="${p.x.toFixed(1)}" cy="${baseY.toFixed(1)}" r="2" fill="none" stroke="rgba(148,163,184,0.4)" stroke-width="1">
        <title>${p.dayLabel} (${p.formattedDate}): 0 ₫</title>
      </circle>
    `).join('');

    return `
      <svg class="budget-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Chưa có chi tiêu 7 ngày qua">
        ${refLineSVG}
        <line x1="${left}" y1="${baseY.toFixed(1)}" x2="${w - right}" y2="${baseY.toFixed(1)}"
              stroke="rgba(148,163,184,0.3)" stroke-width="1.5" stroke-dasharray="4,4"/>
        ${dotsSVG}
      </svg>`;
  }

  // With data: area fill + curve line + daily limit ref + highlighted points
  const areaD = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} ` +
    pts.slice(1).map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${pts[pts.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L ${pts[0].x.toFixed(1)},${baseY.toFixed(1)} Z`;

  const polylinePts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const refLineSVG = refY !== null
    ? `<line x1="${left}" y1="${refY.toFixed(1)}" x2="${w - right}" y2="${refY.toFixed(1)}"
             stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-dasharray="3,3">
         <title>Hạn mức cho phép TB/ngày: ${formatCurrency(dailyLimit)}</title>
       </line>`
    : '';

  const dotsSVG = pts.map(p => {
    if (p.isToday) {
      return `
        <g class="sparkline-point-today" tabindex="0" role="img" aria-label="${p.dayLabel}: ${formatCurrency(p.amount)}">
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5" fill="${color}" opacity="0.25"/>
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}" stroke="var(--bg-surface-elevated, #18181B)" stroke-width="1.5"/>
          <title>${p.dayLabel} (${p.formattedDate}): ${formatCurrency(p.amount)}</title>
        </g>`;
    }
    if (p.amount > 0) {
      return `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${color}" stroke="var(--bg-surface-elevated, #18181B)" stroke-width="1" tabindex="0" role="img" aria-label="${p.dayLabel}: ${formatCurrency(p.amount)}">
          <title>${p.dayLabel} (${p.formattedDate}): ${formatCurrency(p.amount)}</title>
        </circle>`;
    }
    return `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.5" fill="rgba(148,163,184,0.3)" tabindex="0" role="img" aria-label="${p.dayLabel}: 0 ₫">
        <title>${p.dayLabel} (${p.formattedDate}): 0 ₫</title>
      </circle>`;
  }).join('');

  return `
    <svg class="budget-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Chi tiêu 7 ngày qua">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.32" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#${gradId})" />
      ${refLineSVG}
      <polyline points="${polylinePts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dotsSVG}
    </svg>`;
}

/**
 * Compute daily average, daily allowed limit & month-end projection for a budget.
 * @param {Object} budget
 * @returns {{dailyAvg:number, dailyLimit:number, projected:number, exceedDay:number|null, exceedDateStr:string|null}}
 */
function computeBudgetProjection(budget) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.max(todayDay, 1);

  const dailyAvg = budget.spent > 0 ? budget.spent / daysElapsed : 0;
  const dailyLimit = budget.limit > 0 ? budget.limit / daysInMonth : 0;
  const projected = dailyAvg * daysInMonth;

  let exceedDay = null;
  if (budget.limit > 0 && dailyAvg > dailyLimit && dailyAvg > 0) {
    const day = Math.ceil(budget.limit / dailyAvg);
    if (day >= 1 && day <= daysInMonth) exceedDay = day;
  }

  const monthStr = String(month + 1).padStart(2, '0');
  return {
    dailyAvg,
    dailyLimit,
    projected,
    exceedDay,
    exceedDateStr: exceedDay
      ? `${String(exceedDay).padStart(2, '0')}/${monthStr}`
      : null,
  };
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
        const rawPct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
        const pct = Math.min(rawPct, 100);
        const remaining = b.limit - b.spent;
        const fillClass = getBudgetProgressClass(rawPct);
        const statusColor = getBudgetProgressColor(rawPct);
        const remainingColor = remaining >= 0 ? 'var(--positive)' : 'var(--negative)';

        const proj = computeBudgetProjection(b);
        const daySeries = getCategory7DaySeries(txList, b.category);
        const sevenDayTotal = daySeries.reduce((s, d) => s + d.amount, 0);
        const hasData = daySeries.some(d => d.amount > 0);
        const spark = sparklineSVG(daySeries, catColor, proj.dailyLimit, b.category);

        const startDayLabel = daySeries[0]?.dayLabel || '7 ngày trước';

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
              <span class="budget-status-pill ${fillClass}">${rawPct}% đã dùng</span>
            </div>

            <div class="budget-progress-container">
              <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(catName)} ngân sách ${rawPct}% đã dùng">
                <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
              </div>
            </div>

            <div class="budget-spend-numbers">
              <div>
                <div class="budget-spent-val">${formatCurrency(b.spent)}</div>
                <div class="budget-limit-sub">trong hạn mức ${formatCurrency(b.limit)}</div>
              </div>
              <div style="text-align:right;">
                <div class="budget-remaining-val" style="color:${remainingColor};">${remaining >= 0 ? formatCurrency(remaining) : `-${formatCurrency(Math.abs(remaining))}`}</div>
                <div class="budget-remaining-sub">${remaining >= 0 ? 'còn lại' : 'vượt ngân sách'}</div>
              </div>
            </div>

            <!-- 7-Day Sparkline Section -->
            <div class="budget-sparkline-box">
              <div class="budget-sparkline-header">
                <span class="budget-sparkline-title">Chi tiêu 7 ngày qua</span>
                <span class="budget-sparkline-sum">${formatCurrency(sevenDayTotal)}</span>
              </div>

              ${spark}

              <div class="budget-sparkline-axis">
                <span>${startDayLabel}</span>
                ${proj.dailyLimit > 0 ? `<span class="budget-ref-hint" title="Hạn mức cho phép TB: ${formatCurrency(Math.round(proj.dailyLimit))}/ngày">TB cho phép: ${formatCompactCurrency(Math.round(proj.dailyLimit))}/ng</span>` : ''}
                <span>Hôm nay</span>
              </div>

              ${!hasData ? `<div class="budget-sparkline-empty">Chưa có chi tiêu 7 ngày qua</div>` : ''}
            </div>

            <!-- Stats & Projections -->
            <div class="budget-stats-grid">
              <div class="budget-stat-item">
                <span class="stat-label">TB chi/ngày</span>
                <span class="stat-val">${formatCurrency(Math.round(proj.dailyAvg))}</span>
              </div>
              <div class="budget-stat-item">
                <span class="stat-label">Dự kiến cuối tháng</span>
                <span class="stat-val">${formatCurrency(Math.round(proj.projected))}</span>
              </div>
            </div>

            ${proj.exceedDateStr ? `
              <div class="budget-insight-warning">
                ${kpiIcon(ICONS.warningMini)}
                <span>Với tốc độ hiện tại, dự kiến sẽ <strong>vượt ngân sách</strong> vào ngày ${proj.exceedDateStr}</span>
              </div>
            ` : ''}

            ${rawPct >= 90 ? budgetAlertHTML(rawPct, remaining, catName) : ''}
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
      <span class="budget-legend-item"><span class="budget-legend-dot ok" aria-hidden="true"></span>Dưới 70% (An toàn)</span>
      <span class="budget-legend-item"><span class="budget-legend-dot warning" aria-hidden="true"></span>70% - 90% (Chú ý)</span>
      <span class="budget-legend-item"><span class="budget-legend-dot danger" aria-hidden="true"></span>90% - 100% (Cảnh báo)</span>
      <span class="budget-legend-item"><span class="budget-legend-dot over" aria-hidden="true"></span>Trên 100% (Vượt mức)</span>
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
