/**
 * @file Dashboard feature module.
 * Composes KPI cards, spending chart, recent transactions,
 * budget progress, financial insights, and quick stats.
 */

import dataService, {
  computeTotals,
  getWeeklySeries,
  getMonthlyCashFlow,
  generateInsight,
} from '../../services/dataService.js';
import { AreaChart } from '../../components/charts/AreaChart.js';
import { kpiCardHTML } from '../../components/ui/KPICard.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { renderChartSkeleton, renderEmptyState } from '../../components/ui/UIStates.js';
import {
  merchantCellHTML,
} from '../../components/ui/TransactionCells.js';
import {
  formatCurrency,
  formatAmount,
  formatCompactCurrency,
  escapeHtml,
  getTrend,
  formatDateShort,
  formatDateLong,
  formatMonthYear,
  formatRelative,
  getLocalDateString,
} from '../../utils/format.js';
import { CATEGORIES, getCategoryLabelVi, getCategoryIcon } from '../../constants/categories.js';
import { emit } from '../../utils/eventBus.js';
import { t } from '../../utils/i18n.js';
import { getBudgetProgressClass, getBudgetProgressColor } from '../../utils/progress.js';

/* ---------------------------------------------------------------- *
 * Error boundary helper — wraps widget rendering, catches errors,
 * returns widget HTML or a retryable error state.
 * ---------------------------------------------------------------- */
function errorBoundary(fn, fallbackId = '') {
  try {
    return fn();
  } catch (err) {
    console.error(`[dashboard] widget error${fallbackId ? ` (${fallbackId})` : ''}:`, err);
    return `
      <div class="widget-error" data-retry-widget="${fallbackId || 'widget'}">
      <div class="widget-error-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
      <p>${t('dashboard.error.loadFailed')}</p>
      <button type="button" class="btn-secondary btn-sm" data-retry-widget="${fallbackId || 'widget'}">${t('dashboard.error.retry')}</button>
      </div>
    `;
  }
}

/* ---------------------------------------------------------------- *
 * SVG icon fragments (reused across dashboard)
 * ---------------------------------------------------------------- */
const DASHBOARD_ICONS = {
  balance:   '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  income:    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  expense:   '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
  savings:   '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  trendUp:   '<polyline points="18 15 12 9 6 15"/>',
  trendDown: '<polyline points="6 9 12 15 18 9"/>',
  chart:     '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  receipt:   '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  wallet:    '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  spark:     '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  insight:   '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  alertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
};

/* ---------------------------------------------------------------- *
 * Module-scoped state for chart toggles
 * ---------------------------------------------------------------- */
let _period = 'week';
let _transactions = [];

/* ---------------------------------------------------------------- *
 * Helpers
 * ---------------------------------------------------------------- */
function nowFormatted() {
  return formatDateLong(getLocalDateString(new Date()));
}

function todayShort() {
  return formatDateShort(getLocalDateString(new Date()));
}

function localMonthKey(date, offsetMonths = 0) {
  const d = new Date(date.getFullYear(), date.getMonth() + offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonthKey() {
  return localMonthKey(new Date(), -1);
}

/**
 * Build a human-readable comparison range for "last month" in DD–DD/MM/YYYY form.
 * Example for September 2026 → "01–31/08/2026".
 * @returns {string}
 */
function lastMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const lastMonthIndex = m === 0 ? 11 : m - 1;
  const lastMonthYear = m === 0 ? y - 1 : y;
  const lastDay = new Date(y, m, 0).getDate(); // last calendar day of the prior month
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(1)}–${pad(lastDay)}/${pad(lastMonthIndex + 1)}/${lastMonthYear}`;
}

function daysUntilPay(payDayStr, transactions) {
  if (!payDayStr) return null;
  const dayNum = parseInt(payDayStr, 10);
  if (isNaN(dayNum)) return null;
  const now = new Date();
  const payDate = new Date(now.getFullYear(), now.getMonth(), dayNum);
  if (payDate <= now) payDate.setMonth(payDate.getMonth() + 1);
  const ms = payDate - now;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Build an inline SVG icon wrapper for KPI cards.
 * @param {string} pathFrag
 */
function kpiIcon(pathFrag) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathFrag}</svg>`;
}

/**
 * Render a trend badge with a direction arrow.
 *
 * Arrow direction follows the sign of the delta (up for a positive change,
 * down for a negative change). The badge COLOR follows whether the move is
 * "good" for this KPI, not the arrow direction:
 *   - Metrics whose increase is desirable (balance, income, savings rate):
 *     goodDirection = 'up'  ? upward = green (#22C55E), downward = red (#EF4444)
 *   - Expenses, whose increase is undesirable:
 *     goodDirection = 'down' ? downward = green, upward = red
 *
 * When there is no prior data to compare (a missing or zero baseline — which
 * would otherwise trigger a division-by-zero "+100%"), a muted
 * "Chưa có dữ liệu so sánh" fallback is rendered instead.
 *
 * @param {{direction:'up'|'down'|'flat',change:number}|null} trend  null when no prior data (getTrend returns null)
 * @param {Object} [opts]
 * @param {string} [opts.suffix='%']        Unit suffix ('%' or 'pp')
 * @param {'up'|'down'} [opts.goodDirection='up']  Which direction is "good" for this KPI
 * @returns {string}
 */
function trendBadgeHTML(trend, { suffix = '%', goodDirection = 'up' } = {}) {
  if (!trend) {
    return `<span class="trend-badge trend-neutral" aria-label="${t('dashboard.kpi.noComparison')}">${t('dashboard.kpi.noComparison')}</span>`;
  }
  if (trend.direction === 'flat') {
    return `<span class="trend-badge trend-neutral" aria-label="${t('dashboard.kpi.flat')}">—</span>`;
  }
  const isGood = trend.direction === goodDirection;
  const cls = isGood ? 'trend-positive' : 'trend-negative';
  const icon = trend.direction === 'up'
    ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DASHBOARD_ICONS.trendUp}</svg>`
    : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DASHBOARD_ICONS.trendDown}</svg>`;
  const sign = trend.change > 0 ? '+' : '';
  const valence = isGood ? t('dashboard.kpi.good') : t('dashboard.kpi.bad');
  return `
    <span class="trend-badge ${cls}" aria-label="${sign}${trend.change.toFixed(1)}${suffix} — ${valence}">
      ${icon}
      ${sign}${trend.change.toFixed(1)}${suffix}
    </span>
  `;
}

/* ---------------------------------------------------------------- *
 * Section builders
 * ---------------------------------------------------------------- */

function heroHeaderHTML() {
  return `
    <div class="hero-header">
      <div class="hero-tagline-wrapper">
        <span class="hero-tagline-pulse" aria-hidden="true"></span>
        <span class="hero-tagline-text">${t('dashboard.hero.tagline', { date: nowFormatted() })}</span>
       </div>
       <h1 class="hero-headline">${t('dashboard.hero.headline')}</h1>
       <p class="hero-subheadline">${t('dashboard.hero.subheadline')}</p>
    </div>
  `;
}

function kpiGridHTML(totalBalance, monthTotals, lastMonthTotals, savingsRate, lastMonthSavingsRate, netChange, compareRange) {
  const balanceTrend = getTrend(netChange, lastMonthTotals.income - lastMonthTotals.expenses);
  const incomeTrend = getTrend(monthTotals.income, lastMonthTotals.income);
  const expenseTrend = getTrend(monthTotals.expenses, lastMonthTotals.expenses);
  const savingsTrend = getTrend(savingsRate, lastMonthSavingsRate);

  const compareLabel = t('dashboard.kpi.compareRange', { range: compareRange });

  const kpis = [
    {
      id: 'kpi-total-balance',
      title: t('dashboard.kpi.totalBalance'),
      value: formatCompactCurrency(totalBalance),
      iconSvg: kpiIcon(DASHBOARD_ICONS.balance),
      goodDirection: 'up',
      tooltip: t('dashboard.kpi.totalBalanceTooltip'),
      trend: balanceTrend,
      suffix: '%',
    },
    {
      id: 'kpi-income',
      title: t('dashboard.kpi.income'),
      value: formatCompactCurrency(monthTotals.income),
      valueClass: 'highlight-positive',
      iconSvg: kpiIcon(DASHBOARD_ICONS.income),
      goodDirection: 'up',
      tooltip: t('dashboard.kpi.incomeTooltip'),
      trend: incomeTrend,
      suffix: '%',
    },
    {
      id: 'kpi-expenses',
      title: t('dashboard.kpi.expenses'),
      value: formatCompactCurrency(monthTotals.expenses),
      valueClass: 'highlight-negative',
      iconSvg: kpiIcon(DASHBOARD_ICONS.expense),
      goodDirection: 'down',
      tooltip: t('dashboard.kpi.expensesTooltip'),
      trend: expenseTrend,
      suffix: '%',
    },
    {
      id: 'kpi-savings',
      title: t('dashboard.kpi.savingsRate'),
      value: `${savingsRate.toFixed(1)}%`,
      valueClass: 'highlight-positive',
      iconSvg: kpiIcon(DASHBOARD_ICONS.savings),
      goodDirection: 'up',
      tooltip: t('dashboard.kpi.savingsRateTooltip'),
      trend: savingsTrend,
      suffix: 'pp',
    },
  ];

  return `
    <div class="kpi-grid" id="kpi-grid">
      ${kpis.map(kpi => kpiCardHTML({
        id: kpi.id,
        title: kpi.title,
        value: kpi.value,
        valueClass: kpi.valueClass,
        iconSvg: kpi.iconSvg,
        tooltip: kpi.tooltip,
        footerHtml: `${trendBadgeHTML(kpi.trend, { suffix: kpi.suffix, goodDirection: kpi.goodDirection })}<span class="trend-label" title="${escapeHtml(compareRange)}">${compareLabel}</span>`,
      })).join('')}
    </div>
  `;
}

function getChartAreaContent(state, chartHtml, period) {
  if (state === 'loading') {
    return renderChartSkeleton();
  }
  if (state === 'empty') {
    const emptyIcon = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
    return renderEmptyState({
      icon: emptyIcon,
      title: t('dashboard.chartEmpty.title'),
      description: period === 'week' ? t('dashboard.chartEmpty.descriptionWeek') : t('dashboard.chartEmpty.descriptionMonth'),
      actionText: t('dashboard.chartEmpty.actionText'),
      actionId: 'chart-empty-add-tx',
    });
  }
  return chartHtml;
}

function spendingChartPanelHTML({ chartHtml, period, incomeTotal, expenseTotal, isEmpty = false }) {
  const showBadges = !isEmpty;

  return `
    <div class="glass-panel" id="spending-overview-panel">
      ${panelHeaderHTML({
         title: t('dashboard.spending.title'),
         subtitle: t('dashboard.spending.subtitle'),
         iconSvg: DASHBOARD_ICONS.chart,
        actionHtml: `
          <div class="filter-pills" role="group" aria-label="Time period">
            <button class="filter-btn ${period === 'week' ? 'active' : ''}" data-chart-period="week" aria-pressed="${period === 'week'}">${t('dashboard.spending.week')}</button>
            <button class="filter-btn ${period === 'month' ? 'active' : ''}" data-chart-period="month" aria-pressed="${period === 'month'}">${t('dashboard.spending.month')}</button>
          </div>
        `,
      })}
      ${showBadges ? `
      <div class="chart-summary-badges">
        <div class="chart-summary-item">
          <span class="chart-color-dot purple" aria-hidden="true"></span>
          <span class="chart-summary-label">${t('dashboard.spending.incomeLabel')}</span>
          <span class="chart-summary-val" id="chart-summary-income">${formatCurrency(incomeTotal || 0)}</span>
        </div>
        <div class="chart-summary-item">
          <span class="chart-color-dot cyan" aria-hidden="true"></span>
          <span class="chart-summary-label">${t('dashboard.spending.expenseLabel')}</span>
          <span class="chart-summary-val" id="chart-summary-expenses">${formatCurrency(expenseTotal || 0)}</span>
        </div>
      </div>
      ` : ''}
      <div id="spending-chart-container">
        ${chartHtml}
      </div>
    </div>
  `;
}

function recentTransactionsHTML(recentTx) {
  const emptyIcon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  const rows = recentTx.length === 0
        ? `<tr><td colspan="4" class="empty-state-cell"><span class="empty-state-icon" aria-hidden="true">${emptyIcon}</span><p style="margin-top:0.5rem;">${t('dashboard.recentTx.empty')}</p></td></tr>`
        : recentTx.map(tx => {
            const rel = formatRelative(tx.date);
            return `
            <tr>
              <td>${merchantCellHTML(tx)}</td>
              <td><span class="category-tag">${escapeHtml(getCategoryLabelVi(tx.category) || tx.category)}</span></td>
              <td style="color:var(--text-secondary);font-size:0.85rem;" title="${escapeHtml(formatDateLong(tx.date))}">${escapeHtml(rel)}</td>
              <td class="table-amount ${tx.type === 'income' ? 'highlight-positive' : 'highlight-negative'}">
                ${formatAmount(tx.amount, tx.type)}
              </td>
            </tr>
          `;
          }).join('');

  return `
    <div class="glass-panel" id="recent-tx-panel">
      ${panelHeaderHTML({
         title: t('dashboard.recentTx.title'),
         subtitle: t('dashboard.recentTx.subtitle'),
         iconSvg: DASHBOARD_ICONS.receipt,
          actionHtml: `<button type="button" class="view-all-link" data-nav="transactions" aria-label="${t('dashboard.recentTx.viewAllAria')}">${t('dashboard.recentTx.viewAll')} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></button>`,
      })}
      <div class="transactions-table-wrapper">
        <table class="luxe-table" id="recent-tx-table" aria-label="Recent transactions">
          <thead>
            <tr>
<th scope="col">${t('dashboard.recentTx.headers.merchant')}</th>
              <th scope="col">${t('dashboard.recentTx.headers.category')}</th>
              <th scope="col">${t('dashboard.recentTx.headers.date')}</th>
              <th scope="col" style="text-align:right">${t('dashboard.recentTx.headers.amount')}</th>
            </tr>
          </thead>
          <tbody id="recent-tx-tbody">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function budgetProgressHTML(budgets) {
  if (budgets.length === 0) {
    const emptyWalletIcon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
    return `
      <div class="glass-panel" id="budget-progress-panel">
        ${panelHeaderHTML({ title: t('dashboard.budgetProgress.title'), subtitle: nowFormatted(), iconSvg: DASHBOARD_ICONS.wallet })}
        <div class="empty-state"><div class="empty-state-content"><span class="empty-state-icon">${emptyWalletIcon}</span><p>${t('dashboard.budgetProgress.empty')}</p></div></div>
      </div>
    `;
  }

  const items = budgets.map(b => {
    const pct = Math.min(Math.round((b.spent / b.limit) * 100), 100);
    const rawPct = Math.round((b.spent / b.limit) * 100);
    const fillClass = getBudgetProgressClass(rawPct);
    const statusColor = getBudgetProgressColor(rawPct);
    const pctClass = rawPct >= 90 ? 'highlight-negative' : rawPct <= 50 ? 'highlight-positive' : '';
    return `
      <div class="budget-item">
        <div class="budget-info">
          <span class="budget-category-name">
             ${getCategoryIcon(b.category)} ${escapeHtml(getCategoryLabelVi(b.category) || b.category)}
           </span>
           <span class="budget-values">
             ${formatCurrency(b.spent)}/${formatCurrency(b.limit)}
             <span class="budget-percent ${pctClass}" style="color:${statusColor};">${pct}%</span>
           </span>
         </div>
         <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${getCategoryLabelVi(b.category)} ngân sách: ${pct}%">
           <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="glass-panel" id="budget-progress-panel">
      ${panelHeaderHTML({
        title: t('dashboard.budgetProgress.title'),
        subtitle: nowFormatted(),
        iconSvg: DASHBOARD_ICONS.wallet,
        actionHtml: '<button type="button" class="view-all-link" data-nav="budgets" aria-label="' + t('dashboard.budgetProgress.manageAria') + '">' + t('dashboard.budgetProgress.manage') + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></button>',
      })}
      <div class="budget-list" id="dashboard-budget-list">
        ${items}
      </div>
    </div>
  `;
}

function insightCardHTML(insight) {
  let iconSvg = DASHBOARD_ICONS.insight;
  if (insight.type === 'warning') iconSvg = DASHBOARD_ICONS.alertTriangle;
  else if (insight.type === 'positive') iconSvg = DASHBOARD_ICONS.checkCircle;

  return `
    <div class="insight-card" id="insight-card" role="complementary" aria-label="Financial insight">
      <div class="insight-icon" aria-hidden="true">${kpiIcon(iconSvg)}</div>
      <div class="insight-body">
        <div class="insight-tag">${t('dashboard.insight.tag')}</div>
        <p class="insight-quote">${escapeHtml(insight.text)}</p>
        <p class="insight-subtext">${escapeHtml(insight.detail)}</p>
      </div>
    </div>
  `;
}

function quickStatsHTML(netCashFlow, transactions, settings) {
  // Largest expense this month
  const expenseTx = transactions
    .filter(tx => tx.type === 'expense')
    .sort((a, b) => b.amount - a.amount);
  const largest = expenseTx[0];
    const largestHtml = largest
    ? `<span style="font-weight:600;font-size:0.875rem;">${escapeHtml(largest.merchant)} ${formatCurrency(largest.amount)}</span>`
    : '<span style="color:var(--text-muted);">' + t('dashboard.kpi.noExpenseThisMonth') + '</span>';

  // Days until pay
  const payDay = settings.payDay || '15th';
  const dayNum = parseInt(payDay, 10);
  let payDaysHtml = '<span style="color:var(--text-muted);">—</span>';
  if (!isNaN(dayNum)) {
    const days = daysUntilPay(payDay, transactions);
    payDaysHtml = `<span style="font-weight:600;font-size:0.875rem;">${days} ngày</span>`;
  }

  const netClass = netCashFlow >= 0 ? 'var(--positive)' : 'var(--negative)';
  const netSign = netCashFlow >= 0 ? '+' : '';

return `
    <div class="glass-panel" id="quick-stats-panel" style="padding:1.25rem">
      <div class="panel-header" style="margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border-subtle);">
      <span class="panel-title">${t('dashboard.monthlyOverview.title')}</span>
          <span class="panel-subtitle">${formatMonthYear(getLocalDateString(new Date()))}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.9rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:0.75rem;border-bottom:1px solid var(--border-subtle);">
           <span style="font-size:0.875rem;color:var(--text-secondary);">${t('dashboard.kpi.netChange')}</span>
           <span style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:${netClass};">${netSign}${formatCurrency(Math.abs(netCashFlow))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:0.75rem;border-bottom:1px solid var(--border-subtle);">
           <span style="font-size:0.875rem;color:var(--text-secondary);">${t('dashboard.kpi.largestExpense')}</span>
           ${largestHtml}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
           <span style="font-size:0.875rem;color:var(--text-secondary);">${t('dashboard.kpi.payDay')}</span>
           ${payDaysHtml}
        </div>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- *
 * Chart period toggle — re-renders the spending chart
 * ---------------------------------------------------------------- */
async function updateChart(container, period, transactions) {
  const chartContainer = container.querySelector('#spending-chart-container');
  const incomeEl = container.querySelector('#chart-summary-income');
  const expenseEl = container.querySelector('#chart-summary-expenses');
  const badgesContainer = container.querySelector('.chart-summary-badges');
  if (!chartContainer) return;

  chartContainer.innerHTML = renderChartSkeleton();
  if (incomeEl) incomeEl.textContent = '—';
  if (expenseEl) expenseEl.textContent = '—';
  if (badgesContainer) badgesContainer.style.display = 'flex';

  await new Promise(r => setTimeout(r, 150));

  let chartData;
  let incomeTotal, expenseTotal;

  if (period === 'week') {
    chartData = getWeeklySeries(transactions);
  } else {
    chartData = getMonthlyCashFlow(transactions);
  }
  incomeTotal = chartData.reduce((s, d) => s + d.income, 0);
  expenseTotal = chartData.reduce((s, d) => s + d.expenses, 0);

  const hasData = chartData.some(d => d.income > 0 || d.expenses > 0);
  const chartHtml = hasData ? AreaChart({ data: chartData }) : getChartAreaContent('empty', '', period);

  chartContainer.innerHTML = chartHtml;
  if (incomeEl) incomeEl.textContent = formatCurrency(incomeTotal);
  if (expenseEl) expenseEl.textContent = formatCurrency(expenseTotal);
  if (badgesContainer) badgesContainer.style.display = hasData ? 'flex' : 'none';
}

/* ---------------------------------------------------------------- *
 * Main render entry point
 * ---------------------------------------------------------------- */
export async function render(container) {
  const [transactions, budgets, accounts, settings] = await Promise.all([
    dataService.getTransactions(),
    dataService.getBudgets(),
    dataService.getAccounts(),
    dataService.getSettings(),
  ]);

  _transactions = transactions;
  const currentMonth = localMonthKey(new Date(), 0);
  const monthTx = transactions.filter(tx => tx.date.startsWith(currentMonth));
  const lastMonthTx = transactions.filter(tx => tx.date.startsWith(lastMonthKey()));

  const monthTotals = computeTotals(monthTx);
  const lastMonthTotals = computeTotals(lastMonthTx);
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const savingsRate = monthTotals.income > 0
    ? Number(((monthTotals.income - monthTotals.expenses) / monthTotals.income * 100).toFixed(1))
    : 0;
  const lastMonthSavingsRate = lastMonthTotals.income > 0
    ? Number(((lastMonthTotals.income - lastMonthTotals.expenses) / lastMonthTotals.income * 100).toFixed(1))
    : 0;

  const sortedBudgets = [...budgets].sort((a, b) => {
    const ai = CATEGORIES.findIndex(c => c.id === a.category);
    const bi = CATEGORIES.findIndex(c => c.id === b.category);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const recentTx = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  const insight = generateInsight(monthTx, sortedBudgets);
  const netCashFlow = monthTotals.income - monthTotals.expenses;
  const compareRange = lastMonthRange();

  const weeklyData = getWeeklySeries(transactions);
  const weekIncome = weeklyData.reduce((s, d) => s + d.income, 0);
  const weekExpenses = weeklyData.reduce((s, d) => s + d.expenses, 0);
  const weeklyHasData = weeklyData.some(d => d.income > 0 || d.expenses > 0);
  const weeklyChartState = weeklyHasData ? 'ready' : 'empty';
  const weeklyChartHtml = weeklyHasData ? AreaChart({ data: weeklyData }) : getChartAreaContent('empty', '', 'week');

container.innerHTML = `
    <div class="hero-overview">
      ${errorBoundary(() => heroHeaderHTML(), 'hero')}
      ${errorBoundary(() => kpiGridHTML(totalBalance, monthTotals, lastMonthTotals, savingsRate, lastMonthSavingsRate, netCashFlow, compareRange), 'kpi')}
    </div>

    <div class="dashboard-content-grid">
      <div class="dashboard-col">
        ${errorBoundary(() => spendingChartPanelHTML({
          chartHtml: weeklyChartHtml,
          period: 'week',
          incomeTotal: weekIncome,
          expenseTotal: weekExpenses,
          isEmpty: !weeklyHasData,
        }), 'spending-chart')}
        ${errorBoundary(() => recentTransactionsHTML(recentTx), 'recent-transactions')}
      </div>
      <div class="dashboard-col">
         ${errorBoundary(() => budgetProgressHTML(sortedBudgets), 'budget-progress')}
        ${errorBoundary(() => insightCardHTML(insight), 'insight')}
        ${errorBoundary(() => quickStatsHTML(netCashFlow, monthTx, settings), 'quick-stats')}
      </div>
    </div>
  `;

  attachListeners(container);

  const regressionTestDiv = document.createElement('div');
  regressionTestDiv.innerHTML = 'Regression test: àáảãạăâêôơƯđĐ – — ‘’ “” … 💰 ⚠️ ✅ Quản lý ngân sách, thu – chi, Ngày';
  regressionTestDiv.setAttribute('aria-hidden', 'true');
  regressionTestDiv.setAttribute('id', 'encoding-regression-test');
  regressionTestDiv.style.position = 'absolute';
  regressionTestDiv.style.left = '-9999px';
  container.appendChild(regressionTestDiv);
}

/* ---------------------------------------------------------------- *
 * Event listeners
 * ---------------------------------------------------------------- */
function attachListeners(container) {
  // Widget error retry - re-render page to fix failed widget
  container.querySelectorAll('[data-retry-widget]').forEach(btn => {
    btn.addEventListener('click', () => {
      emit('data:changed');
    });
  });

  // Chart period toggle
  container.querySelectorAll('[data-chart-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-chart-period]').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn);
      });
      _period = btn.dataset.chartPeriod;
      updateChart(container, _period, _transactions);
    });
  });

  // Empty state add transaction CTA
  container.querySelectorAll('#chart-empty-add-tx').forEach(btn => {
    btn.addEventListener('click', () => emit('navigate', { page: 'transactions' }));
  });

  // View-all / Manage navigation
  container.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      emit('navigate', { page: el.dataset.nav });
    });
  });
}

export default { render };


