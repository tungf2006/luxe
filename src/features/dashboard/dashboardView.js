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
import { getPeriodHighlights, generatePeriodSuggestions } from './periodInsights.js';
import { getDashboardStats, normalizeDate } from './dashboardStats.js';
import { renderPeriodSelector, attachPeriodSelectorListeners, getPeriodRange } from '../../components/ui/PeriodSelector.js';
import {
  renderSpendingChart,
  destroySpendingChart,
  computeDailySeries,
  getSpendingChartSubtitle,
} from '../../components/charts/spendingChart.js';
import { kpiCardHTML, initKpiTooltips } from '../../components/ui/KPICard.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { renderChartSkeleton, renderEmptyState } from '../../components/ui/UIStates.js';
import {
  merchantCellHTML,
} from '../../components/ui/TransactionCells.js';
import {
  formatCurrency,
  formatAmount,
  formatCompact,
  formatCompactCurrency,
  escapeHtml,
  getTrend,
  formatDateShort,
  formatDateLong,
  formatMonthYear,
  formatRelative,
  getLocalDateString,
  getRecentDateGroupLabel,
  getDayNameVi,
  getTransactionAmountClass,
  getTransactionType,
  isVoidTransaction,
} from '../../utils/format.js';
import { getCurrentUser } from '../../services/authService.js';
import { CATEGORIES, CATEGORY_SVGS, getCategoryLabelVi, getCategoryIcon, getCategoryAvatarHtml } from '../../constants/categories.js';
import { edit as editTransaction } from '../transactions/transactionForm.js';
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
 * Module-scoped state for chart toggles and page period
 * ---------------------------------------------------------------- */
let _period = '7d';
let _periodState = getPeriodRange('thisMonth');
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
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathFrag}</svg>`;
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
 * When there is no prior data to compare (a missing or zero baseline or days < 7),
 * a muted "—" or "Chưa đủ dữ liệu so sánh" fallback is rendered instead.
 *
 * @param {{direction:'up'|'down'|'flat',change:number}|null} trend
 * @param {Object} [opts]
 * @param {string} [opts.suffix='%']        Unit suffix ('%' or 'pp')
 * @param {'up'|'down'} [opts.goodDirection='up']  Which direction is "good" for this KPI
 * @param {number} [opts.days=0]            Number of elapsed days in current period
 * @returns {string}
 */
function trendBadgeHTML(trend, { suffix = '%', goodDirection = 'up', days = 0 } = {}) {
  if (!trend) {
    const fallbackTitle = days > 0 && days < 7 ? 'Chưa đủ dữ liệu so sánh (cần ≥ 7 ngày)' : t('dashboard.kpi.noComparison');
    return `<span class="trend-badge trend-neutral" title="${escapeHtml(fallbackTitle)}" aria-label="${escapeHtml(fallbackTitle)}">—</span>`;
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

/**
 * Resolve display name for user greeting.
 * @param {Object} [settings]
 * @returns {string}
 */
function getUserDisplayName(settings) {
  const user = getCurrentUser();
  if (user) {
    const name = user.user_metadata?.display_name ||
                 user.user_metadata?.full_name ||
                 user.user_metadata?.name ||
                 (user.email ? user.email.split('@')[0] : null);
    if (name) return name;
  }
  const nameEl = document.getElementById('user-name');
  if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
    const text = nameEl.textContent.trim();
    if (text) return text;
  }
  if (settings?.firstName) {
    return settings.firstName;
  }
  return 'Alex';
}

/**
 * Compact Page Header (≤ 72px):
 * Greeting "Xin chào, {tên}", Vietnamese date, and PeriodSelector (Task 4).
 * @param {string} userName
 * @returns {string}
 */
function dashboardHeaderHTML(userName) {
  const d = new Date();
  const dayName = getDayNameVi(d);
  const dateLong = formatDateLong(getLocalDateString(d));
  const fullDateText = dayName ? `${dayName}, ${dateLong}` : dateLong;

  return `
    <header class="dashboard-page-header" id="dashboard-page-header">
      <div class="dashboard-header-greeting">
        <h1 class="dashboard-greeting-title hero-headline">
          Xin chào, <span class="dashboard-user-name">${escapeHtml(userName)}</span>
        </h1>
        <p class="dashboard-header-date">
          <svg class="dashboard-date-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>${escapeHtml(fullDateText)}</span>
        </p>
      </div>
      <div class="dashboard-header-actions">
        ${renderPeriodSelector(_periodState)}
      </div>
    </header>
  `;
}

function kpiGridHTML({ totalBalance = 0, income = 0, expenses = 0, savingsRate = 0, compareRange = '', deltas = {}, days = 0, loading = false } = {}) {
  const compareLabel = days < 7
    ? 'Chưa đủ dữ liệu so sánh'
    : t('dashboard.kpi.compareRange', { range: compareRange });

  // Format full vs compact values for monetary metrics (Full by default, compact when space is tight)
  const fullBalance = formatCurrency(totalBalance, { asHtml: true });
  const compactBalance = formatCompact(totalBalance, { asHtml: true });
  const fullIncome = formatCurrency(income, { asHtml: true });
  const compactIncome = formatCompact(income, { asHtml: true });
  const fullExpenses = formatCurrency(expenses, { asHtml: true });
  const compactExpenses = formatCompact(expenses, { asHtml: true });

  const balanceValueHtml = `<span class="val-full" title="${escapeHtml(formatCurrency(totalBalance))}">${fullBalance}</span><span class="val-compact" title="${escapeHtml(formatCurrency(totalBalance))}">${compactBalance}</span>`;
  const incomeValueHtml = `<span class="val-full" title="${escapeHtml(formatCurrency(income))}">${fullIncome}</span><span class="val-compact" title="${escapeHtml(formatCurrency(income))}">${compactIncome}</span>`;
  const expensesValueHtml = `<span class="val-full" title="${escapeHtml(formatCurrency(expenses))}">${fullExpenses}</span><span class="val-compact" title="${escapeHtml(formatCurrency(expenses))}">${compactExpenses}</span>`;

  // Savings rate threshold colors: ≥20% xanh (green), 0-20% vàng (amber), <0% đỏ (red)
  let savingsValueHtml = '—';
  let savingsClass = 'highlight-positive';
  if (savingsRate != null && !isNaN(savingsRate) && (income > 0 || expenses > 0)) {
    savingsValueHtml = `${savingsRate.toFixed(1)}%`;
    if (savingsRate >= 20) {
      savingsClass = 'highlight-positive'; // xanh (≥20%)
    } else if (savingsRate >= 0) {
      savingsClass = 'highlight-warning';  // vàng (0-20%)
    } else {
      savingsClass = 'highlight-negative'; // đỏ (<0%)
    }
  }

  const kpis = [
    {
      id: 'kpi-total-balance',
      title: t('dashboard.kpi.totalBalance'),
      value: balanceValueHtml,
      valueClass: 'auto-compact highlight-neutral',
      goodDirection: 'up',
      tooltip: t('dashboard.kpi.totalBalanceTooltip'),
      trend: deltas?.net || null,
      suffix: '%',
    },
    {
      id: 'kpi-income',
      title: t('dashboard.kpi.income'),
      value: incomeValueHtml,
      valueClass: 'auto-compact highlight-positive',
      goodDirection: 'up',
      tooltip: t('dashboard.kpi.incomeTooltip'),
      trend: deltas?.income || null,
      suffix: '%',
    },
    {
      id: 'kpi-expenses',
      title: t('dashboard.kpi.expenses'),
      value: expensesValueHtml,
      valueClass: 'auto-compact highlight-negative',
      goodDirection: 'down',
      tooltip: t('dashboard.kpi.expensesTooltip'),
      trend: deltas?.expense || null,
      suffix: '%',
    },
    {
      id: 'kpi-savings',
      title: t('dashboard.kpi.savingsRate'),
      value: savingsValueHtml,
      valueClass: savingsClass,
      goodDirection: 'up',
      tooltip: t('dashboard.kpi.savingsRateTooltip'),
      trend: deltas?.savingsRate || null,
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
        tooltip: kpi.tooltip,
        loading,
        footerHtml: `${trendBadgeHTML(kpi.trend, { suffix: kpi.suffix, goodDirection: kpi.goodDirection, days })}<span class="trend-label" title="${escapeHtml(compareRange)}">${compareLabel}</span>`,
      })).join('')}
    </div>
  `;
}

function getChartAreaContent(state, chartHtml, period) {
  if (state === 'loading') {
    return renderChartSkeleton();
  }
  if (state === 'empty') {
    const emptyIcon = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
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

function spendingChartPanelHTML({ period, subtitle, incomeTotal, expenseTotal, isEmpty = false }) {
  const showBadges = !isEmpty;

  return `
    <div class="glass-panel spending-overview-panel" id="spending-overview-panel">
      ${panelHeaderHTML({
         title: t('dashboard.spending.title'),
         subtitle: subtitle,
         iconSvg: DASHBOARD_ICONS.chart,
        actionHtml: `
          <div class="filter-pills" role="group" aria-label="Khung thời gian biểu đồ">
            <button class="filter-btn ${period === '7d' ? 'active' : ''}" data-chart-period="7d" aria-pressed="${period === '7d'}">7 ngày</button>
            <button class="filter-btn ${period === '30d' ? 'active' : ''}" data-chart-period="30d" aria-pressed="${period === '30d'}">30 ngày</button>
            <button class="filter-btn ${period === 'period' ? 'active' : ''}" data-chart-period="period" aria-pressed="${period === 'period'}">Theo kỳ</button>
          </div>
        `,
      })}
      ${showBadges ? `
      <div class="chart-summary-badges">
        <div class="chart-summary-item">
          <span class="chart-color-dot income" aria-hidden="true"></span>
          <span class="chart-summary-label">${t('dashboard.spending.incomeLabel')}</span>
          <span class="chart-summary-val" id="chart-summary-income">${formatCurrency(incomeTotal || 0, { asHtml: true })}</span>
        </div>
        <div class="chart-summary-item">
          <span class="chart-color-dot expense" aria-hidden="true"></span>
          <span class="chart-summary-label">${t('dashboard.spending.expenseLabel')}</span>
          <span class="chart-summary-val" id="chart-summary-expenses">${formatCurrency(expenseTotal || 0, { asHtml: true })}</span>
        </div>
      </div>
      ` : ''}
      <div id="spending-chart-container">
        ${isEmpty ? `
          <div class="chart-empty-state">
            <div class="chart-empty-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <h4 class="chart-empty-title">Chưa có giao dịch trong kỳ</h4>
            <p class="chart-empty-desc">Thêm thu nhập hoặc chi phí để theo dõi biến động tài chính.</p>
            <button type="button" class="btn btn-primary" id="chart-empty-add-tx">
              Thêm giao dịch
            </button>
          </div>
        ` : `
          <div class="spending-chart-wrapper">
            <canvas id="spending-chart-canvas" role="img" aria-label="Biểu đồ thu nhập và chi phí"></canvas>
          </div>
        `}
      </div>
    </div>
  `;
}

/**
 * Render monochrome category SVG icon (strictly zero emoji).
 * @param {string} categoryId
 * @returns {string}
 */
function getCategoryMonochromeSvgHtml(categoryId) {
  const svg = CATEGORY_SVGS[categoryId] || CATEGORY_SVGS.other;
  return `
    <span class="recent-tx-cat-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${svg}
      </svg>
    </span>
  `;
}

/**
 * Render status badge with tooltip explanation. Only renders for non-completed statuses.
 * @param {'completed'|'pending'|'failed'|'cancelled'} status
 * @returns {string}
 */
function getRecentTxStatusBadgeHtml(status) {
  if (!status || status === 'completed') {
    return '';
  }

  if (status === 'pending') {
    return `
      <span class="status-badge status-badge-pending" role="status" aria-label="Đang chờ xử lý" title="Giao dịch đang chờ xử lý từ ngân hàng hoặc ví điện tử">
        <span class="status-pulse-dot" aria-hidden="true"></span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Đang chờ</span>
      </span>
    `;
  }

  if (status === 'failed') {
    return `
      <span class="status-badge status-badge-failed" role="status" aria-label="Thất bại" title="Giao dịch thất bại / chưa hoàn tất thanh toán">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>Thất bại</span>
      </span>
    `;
  }

  if (status === 'cancelled') {
    return `
      <span class="status-badge status-badge-cancelled" role="status" aria-label="Đã huỷ" title="Giao dịch đã bị người dùng hoặc hệ thống huỷ">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>
        <span>Đã huỷ</span>
      </span>
    `;
  }

  return '';
}

function recentTransactionsHTML(recentTx) {
  const emptyIcon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

  if (!recentTx || recentTx.length === 0) {
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
                <th scope="col" class="recent-tx-th-merchant">${t('dashboard.recentTx.headers.transaction', 'Giao dịch')}</th>
                <th scope="col" class="recent-tx-th-status">${t('dashboard.recentTx.headers.status', 'Trạng thái')}</th>
                <th scope="col" class="recent-tx-th-amount" style="text-align:right">${t('dashboard.recentTx.headers.amount', 'Số tiền')}</th>
              </tr>
            </thead>
            <tbody id="recent-tx-tbody">
              <tr>
                <td colspan="3" class="empty-state-cell" style="text-align:center; padding: 2.25rem 1rem;">
                  <span class="empty-state-icon" aria-hidden="true">${emptyIcon}</span>
                  <p style="margin-top:0.5rem; color: var(--text-muted);">${t('dashboard.recentTx.empty', 'Chưa có giao dịch')}</p>
                  <button type="button" class="btn btn-primary btn-sm" id="btn-empty-add-tx" data-open-modal="add-tx-modal" style="margin-top:0.75rem;">
                    Thêm giao dịch đầu tiên
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Strictly maximum 6 transactions
  const displayTx = recentTx.slice(0, 6);

  // Group by date
  const dateGroups = [];
  const groupMap = new Map();

  for (const tx of displayTx) {
    const dateKey = (tx.date || '').slice(0, 10);
    if (!groupMap.has(dateKey)) {
      const group = {
        date: dateKey,
        label: getRecentDateGroupLabel(dateKey),
        transactions: [],
      };
      groupMap.set(dateKey, group);
      dateGroups.push(group);
    }
    groupMap.get(dateKey).transactions.push(tx);
  }

  const groupRowsHtml = dateGroups.map(group => {
    const groupHeaderHtml = `
      <tr class="recent-tx-group-row">
        <td colspan="3" class="recent-tx-group-header">
          <div class="recent-tx-group-title">
            <span class="recent-tx-group-badge">${escapeHtml(group.label)}</span>
          </div>
        </td>
      </tr>
    `;

    const txRowsHtml = group.transactions.map(tx => {
      const isVoid = isVoidTransaction(tx);
      const rowStatusClass = `tx-row-${tx.status || 'completed'}`;
      const amountClass = getTransactionAmountClass(tx);
      const statusBadge = getRecentTxStatusBadgeHtml(tx.status);
      const hasStatusBadge = Boolean(statusBadge);

      return `
        <tr class="recent-tx-row ${rowStatusClass} ${isVoid ? 'is-void' : ''} ${hasStatusBadge ? 'has-status-badge' : 'no-status-badge'}"
            data-recent-tx-id="${escapeHtml(String(tx.id))}"
            role="button"
            tabindex="0"
            aria-label="${escapeHtml(tx.merchant)} - ${formatAmount(tx.amount, getTransactionType(tx))}">
          <td class="recent-tx-cell-merchant">
            ${getCategoryMonochromeSvgHtml(tx.category)}
            <div class="recent-tx-merchant-info">
              <div class="recent-tx-title" title="${escapeHtml(tx.merchant)}">${escapeHtml(tx.merchant)}</div>
              <div class="recent-tx-subline">${escapeHtml(getCategoryLabelVi(tx.category) || tx.category)}</div>
            </div>
          </td>
          <td class="recent-tx-cell-status">
            ${statusBadge}
          </td>
          <td class="recent-tx-cell-amount table-amount ${amountClass}">
            ${formatAmount(tx.amount, getTransactionType(tx), { asHtml: true })}
          </td>
        </tr>
      `;
    }).join('');

    return groupHeaderHtml + txRowsHtml;
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
              <th scope="col" class="recent-tx-th-merchant">${t('dashboard.recentTx.headers.transaction', 'Giao dịch')}</th>
              <th scope="col" class="recent-tx-th-status">${t('dashboard.recentTx.headers.status', 'Trạng thái')}</th>
              <th scope="col" class="recent-tx-th-amount" style="text-align:right">${t('dashboard.recentTx.headers.amount', 'Số tiền')}</th>
            </tr>
          </thead>
          <tbody id="recent-tx-tbody">
            ${groupRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function budgetProgressHTML(budgets) {
  // Only display categories that have an active budget limit > 0
  const budgeted = (budgets || []).filter(b => (b.budget || b.limit || 0) > 0);
  if (budgeted.length === 0) {
    const emptyWalletIcon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
    return `
      <div class="glass-panel" id="budget-progress-panel">
        ${panelHeaderHTML({
          title: t('dashboard.budgetProgress.title'),
          subtitle: nowFormatted(),
          iconSvg: DASHBOARD_ICONS.wallet,
          actionHtml: '<button type="button" class="view-all-link" data-nav="budgets" aria-label="' + t('dashboard.budgetProgress.manageAria') + '">' + t('dashboard.budgetProgress.manage') + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></button>',
        })}
        <div class="budget-empty-state">
          <div class="budget-empty-icon" aria-hidden="true">${emptyWalletIcon}</div>
          <h4 class="budget-empty-title">Chưa có ngân sách</h4>
          <p class="budget-empty-desc">Thiết lập hạn mức chi tiêu để kiểm soát ngân sách theo từng danh mục.</p>
          <button type="button" class="btn btn-primary btn-sm budget-empty-cta" data-nav="budgets">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Tạo ngân sách
          </button>
        </div>
      </div>
    `;
  }

  // 1. Calculate overall totals across all budgeted categories
  const totalSpent = budgeted.reduce((sum, b) => sum + (b.spent || 0), 0);
  const totalPending = budgeted.reduce((sum, b) => sum + (b.pending || 0), 0);
  const totalLimit = budgeted.reduce((sum, b) => sum + (b.budget || b.limit || 0), 0);
  const totalRemaining = totalLimit - totalSpent;
  const isTotalOver = totalRemaining < 0;

  const totalRawPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const totalClampedPct = Math.min(totalRawPct, 100);
  const totalConfirmedSpent = Math.max(0, totalSpent - totalPending);
  const totalConfirmedPct = totalLimit > 0 ? Math.min(100, Math.round((totalConfirmedSpent / totalLimit) * 100)) : 0;
  const totalPendingPct = totalLimit > 0 ? Math.min(100 - totalConfirmedPct, Math.round((totalPending / totalLimit) * 100)) : 0;
  const totalFillClass = getBudgetProgressClass(totalRawPct);

  // 2. Sort by % descending
  const sortedBudgeted = [...budgeted].map(b => {
    const category = b.categoryId || b.category;
    const limit = b.budget != null ? b.budget : (b.limit || 0);
    const spent = b.spent || 0;
    const pending = b.pending || 0;
    const rawPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return {
      ...b,
      category,
      limit,
      spent,
      pending,
      rawPct,
    };
  }).sort((a, b) => b.rawPct - a.rawPct);

  // 3. Take at most 5 items
  const displayItems = sortedBudgeted.slice(0, 5);

  const items = displayItems.map(b => {
    const { category, limit, spent, pending, rawPct } = b;
    const clampedPct = Math.min(rawPct, 100);
    const confirmedSpent = Math.max(0, spent - pending);
    const confirmedPct = limit > 0 ? Math.min(100, Math.round((confirmedSpent / limit) * 100)) : 0;
    const pendingPct = limit > 0 ? Math.min(100 - confirmedPct, Math.round((pending / limit) * 100)) : 0;

    const remaining = limit - spent;
    const isOver = remaining < 0;

    const fillClass = getBudgetProgressClass(rawPct);
    const statusColor = getBudgetProgressColor(rawPct);
    const pctClass = rawPct > 90 ? 'highlight-negative' : rawPct >= 70 ? 'highlight-warning' : 'highlight-positive';
    const catLabel = getCategoryLabelVi(category) || category;

    const sublineRemainingText = isOver
      ? `Vượt ${formatCurrency(Math.abs(remaining))}`
      : `Còn ${formatCurrency(remaining)}`;

    return `
      <div class="budget-item ${isOver ? 'budget-item--over' : ''}">
        <div class="budget-info">
          <span class="budget-category-name">
            ${getCategoryAvatarHtml(category, 'sm')}
            <span class="budget-category-title" title="${escapeHtml(catLabel)}">${escapeHtml(catLabel)}</span>
          </span>
          <span class="budget-values">
            <span class="budget-spent-ratio" title="${escapeHtml(formatCurrency(spent))} / ${escapeHtml(formatCurrency(limit))}">${formatCompact(spent, { asHtml: true })} / ${formatCompact(limit, { asHtml: true })}</span>
            <span class="budget-percent ${pctClass}" style="color:${statusColor};">${rawPct}%</span>
          </span>
        </div>
        <div class="progress-track ${rawPct === 0 ? 'progress-track--zero' : ''}" role="progressbar" aria-valuenow="${clampedPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(catLabel)} ngân sách: ${rawPct}% (${formatCurrency(spent)} / ${formatCurrency(limit)})">
          <div class="progress-fill ${fillClass}" style="width:${confirmedPct}%;"></div>
          ${pendingPct > 0 ? `<div class="progress-fill progress-fill--pending" style="width:${pendingPct}%;" title="Đang chờ: ${formatCurrency(pending)}"></div>` : ''}
        </div>
        <div class="budget-item-subline">
          <span class="budget-subline ${isOver ? 'budget-subline--over' : 'budget-subline--remain'}">
            ${isOver ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DASHBOARD_ICONS.alertTriangle}</svg> ` : ''}${sublineRemainingText}
          </span>
          ${pending > 0 ? `<span class="budget-subline-pending">(chờ: ${formatCurrency(pending)})</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Subtitle format: Đã chi X / Tổng Y · còn Z (hoặc vượt Z)
  const headerSummaryText = `Đã chi ${formatCurrency(totalSpent)} / Tổng ${formatCurrency(totalLimit)} · ${isTotalOver ? `vượt ${formatCurrency(Math.abs(totalRemaining))}` : `còn ${formatCurrency(totalRemaining)}`}`;

  const subtitleHtml = `
    <span class="budget-header-spent">Đã chi <strong>${formatCurrency(totalSpent)}</strong> / Tổng <strong>${formatCurrency(totalLimit)}</strong></span>
    <span class="budget-header-sep">·</span>
    <span class="budget-header-diff ${isTotalOver ? 'is-over' : 'is-remain'}">${isTotalOver ? `vượt ${formatCurrency(Math.abs(totalRemaining))}` : `còn ${formatCurrency(totalRemaining)}`}</span>
  `;

  return `
    <div class="glass-panel" id="budget-progress-panel">
      ${panelHeaderHTML({
        title: t('dashboard.budgetProgress.title'),
        subtitle: subtitleHtml,
        iconSvg: DASHBOARD_ICONS.wallet,
        actionHtml: '<button type="button" class="view-all-link" data-nav="budgets" aria-label="' + t('dashboard.budgetProgress.manageAria') + '">' + t('dashboard.budgetProgress.manage') + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></button>',
      })}
      <div class="budget-total-progress-wrap">
        <div class="progress-track budget-total-track ${totalRawPct === 0 ? 'progress-track--zero' : ''}" role="progressbar" aria-valuenow="${totalClampedPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ tổng ngân sách: ${totalRawPct}% (${headerSummaryText})">
          <div class="progress-fill ${totalFillClass}" style="width:${totalConfirmedPct}%;"></div>
          ${totalPendingPct > 0 ? `<div class="progress-fill progress-fill--pending" style="width:${totalPendingPct}%;" title="Đang chờ: ${formatCurrency(totalPending)}"></div>` : ''}
        </div>
      </div>
      <div class="budget-list" id="dashboard-budget-list">
        ${items}
      </div>
      <div class="budget-widget-footer">
        <button type="button" class="view-all-link budget-manage-link" data-nav="budgets" aria-label="${t('dashboard.budgetProgress.manageAria')}">
          Quản lý ngân sách →
        </button>
      </div>
    </div>
  `;
}

function insightCardHTML(optionsOrInsight, budgets, stats, periodTx) {
  let periodTransactions = [];
  let currentBudgets = [];
  let currentStats = {};
  let suggestions = [];
  let isEmpty = false;

  if (optionsOrInsight && typeof optionsOrInsight === 'object' && optionsOrInsight.periodTx) {
    periodTransactions = optionsOrInsight.periodTx;
    currentBudgets = optionsOrInsight.budgets || [];
    currentStats = optionsOrInsight.stats || {};
    isEmpty = periodTransactions.length === 0;
    if (!isEmpty) {
      suggestions = generatePeriodSuggestions({
        periodTx: periodTransactions,
        budgets: currentBudgets,
        stats: currentStats,
        days: optionsOrInsight.periodState?.days || 30,
      });
    }
  } else if (optionsOrInsight && typeof optionsOrInsight === 'object' && optionsOrInsight.text) {
    if (optionsOrInsight.text.includes('Theo dõi giao dịch đầu tiên')) {
      isEmpty = true;
    } else {
      suggestions = [{
        id: 'legacy-insight',
        type: optionsOrInsight.type === 'danger' ? 'danger' : optionsOrInsight.type === 'warning' ? 'warning' : optionsOrInsight.type === 'positive' ? 'positive' : 'info',
        iconType: optionsOrInsight.type === 'warning' ? 'alertTriangle' : optionsOrInsight.type === 'positive' ? 'checkCircle' : 'receipt',
        title: optionsOrInsight.text,
        detail: optionsOrInsight.detail || '',
      }];
    }
  } else if (Array.isArray(periodTx)) {
    periodTransactions = periodTx;
    currentBudgets = budgets || [];
    currentStats = stats || {};
    isEmpty = periodTransactions.length === 0;
    if (!isEmpty) {
      suggestions = generatePeriodSuggestions({
        periodTx: periodTransactions,
        budgets: currentBudgets,
        stats: currentStats,
        days: 30,
      });
    }
  }

  return `
    <div class="insight-card ${isEmpty ? 'insight-card--empty' : ''}" id="insight-card" role="complementary" aria-label="Gợi ý chi tiêu">
      <div class="insight-card-header">
        <span class="insight-tag">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${DASHBOARD_ICONS.spark}
          </svg>
          ${t('dashboard.insight.tag') || 'Gợi ý'}
        </span>
        <span class="insight-rule-badge">Quy tắc tài chính</span>
      </div>

      ${isEmpty ? `
        <div class="insight-empty-body">
          <p class="insight-empty-msg">Chưa có giao dịch để tạo gợi ý</p>
          <span class="insight-empty-hint">Gợi ý sẽ tự động hiển thị khi có dữ liệu thu chi</span>
        </div>
      ` : `
        <div class="insight-suggestions-list">
          ${suggestions.map(s => {
            let iconSvg = DASHBOARD_ICONS.receipt;
            if (s.iconType === 'alertTriangle') iconSvg = DASHBOARD_ICONS.alertTriangle;
            else if (s.iconType === 'checkCircle') iconSvg = DASHBOARD_ICONS.checkCircle;
            else if (s.iconType === 'calendar') iconSvg = DASHBOARD_ICONS.chart;

            return `
              <div class="insight-suggestion-item insight-suggestion--${s.type}">
                <div class="insight-suggestion-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    ${iconSvg}
                  </svg>
                </div>
                <div class="insight-suggestion-content">
                  <div class="insight-suggestion-title">${escapeHtml(s.title)}</div>
                  <div class="insight-suggestion-detail">${escapeHtml(s.detail)}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

function quickStatsHTML(optionsOrNet, transactions, settings, stats, budgets, periodState) {
  let netCashFlow, periodTx, userSettings, currentStats, currentBudgets, currentPeriodState;
  if (typeof optionsOrNet === 'object' && optionsOrNet !== null && !Array.isArray(optionsOrNet)) {
    netCashFlow = optionsOrNet.netCashFlow;
    periodTx = optionsOrNet.periodTx || [];
    userSettings = optionsOrNet.settings || {};
    currentStats = optionsOrNet.stats || {};
    currentBudgets = optionsOrNet.budgets || [];
    currentPeriodState = optionsOrNet.periodState || _periodState;
  } else {
    netCashFlow = optionsOrNet;
    periodTx = transactions || [];
    userSettings = settings || {};
    currentStats = stats || {};
    currentBudgets = budgets || [];
    currentPeriodState = periodState || _periodState;
  }

  const highlights = getPeriodHighlights({
    periodTx,
    budgets: currentBudgets,
    settings: userSettings,
    stats: currentStats.income != null ? currentStats : { net: netCashFlow },
    baseDate: new Date(),
  });

  const periodSubtitle = currentPeriodState?.label || formatMonthYear(getLocalDateString(new Date()));

  if (highlights.isEmpty) {
    return `
      <div class="glass-panel highlights-panel" id="quick-stats-panel" aria-label="Điểm nhấn kỳ này">
        <div class="panel-header highlights-panel-header">
          <div class="highlights-header-title-wrap">
            <span class="panel-title">${t('dashboard.highlights.title') || 'Điểm nhấn kỳ này'}</span>
            <span class="panel-subtitle highlights-period-subtitle">${escapeHtml(periodSubtitle)}</span>
          </div>
          <div class="highlights-header-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${DASHBOARD_ICONS.chart}
            </svg>
          </div>
        </div>
        <div class="highlights-empty-state">
          <div class="highlights-empty-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${DASHBOARD_ICONS.receipt}
            </svg>
          </div>
          <p class="highlights-empty-title">${t('dashboard.highlights.emptyTitle') || 'Chưa có giao dịch trong kỳ'}</p>
          <p class="highlights-empty-sub">${t('dashboard.highlights.emptySub') || 'Thêm giao dịch thu nhập hoặc chi phí để xem điểm nhấn.'}</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="glass-panel highlights-panel" id="quick-stats-panel" aria-label="Điểm nhấn kỳ này">
      <div class="panel-header highlights-panel-header">
        <div class="highlights-header-title-wrap">
          <span class="panel-title">${t('dashboard.highlights.title') || 'Điểm nhấn kỳ này'}</span>
          <span class="panel-subtitle highlights-period-subtitle">${escapeHtml(periodSubtitle)}</span>
        </div>
        <div class="highlights-header-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${DASHBOARD_ICONS.chart}
          </svg>
        </div>
      </div>
      <div class="highlights-metrics-list">
        <!-- 1. Dòng tiền ròng -->
        <div class="highlight-metric-row highlight-net-row">
          <div class="highlight-metric-meta">
            <span class="highlight-metric-label">${t('dashboard.highlights.netCashFlow') || 'Dòng tiền ròng'}</span>
            <span class="highlight-metric-hint">${t('dashboard.highlights.netSubline') || 'Thu − Chi'}</span>
          </div>
          <div class="highlight-metric-val ${highlights.netClass}" style="color: ${highlights.netColor};">
            <span class="highlight-net-amount">${highlights.netFormatted}</span>
          </div>
        </div>

        <!-- 2. Chi lớn nhất (tên rút gọn 1 dòng) -->
        <div class="highlight-metric-row highlight-largest-row">
          <div class="highlight-metric-meta">
            <span class="highlight-metric-label">${t('dashboard.highlights.largestExpense') || 'Chi lớn nhất'}</span>
          </div>
          <div class="highlight-metric-val highlight-largest-val">
            ${highlights.largest ? `
              <span class="highlight-merchant-name" title="${escapeHtml(highlights.largest.merchant)}">${escapeHtml(highlights.largest.merchant)}</span>
              <span class="highlight-merchant-amount">${highlights.largest.formattedAmount}</span>
            ` : `
              <span class="highlight-val-empty text-muted">${t('dashboard.highlights.noExpenseThisPeriod') || 'Không có chi phí trong kỳ'}</span>
            `}
          </div>
        </div>

        <!-- 3. Còn N ngày đến kỳ lương (dd/mm) -->
        <div class="highlight-metric-row highlight-payday-row">
          <div class="highlight-metric-meta">
            <span class="highlight-metric-label">${t('dashboard.highlights.payDay') || 'Kỳ lương'}</span>
          </div>
          <div class="highlight-metric-val highlight-payday-val">
            <span class="highlight-payday-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${highlights.payDayInfo.text}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- *
 * Chart period toggle — re-renders the spending chart
 * ---------------------------------------------------------------- */
async function updateChart(container, period, transactions, periodState) {
  const chartContainer = container.querySelector('#spending-chart-container');
  const incomeEl = container.querySelector('#chart-summary-income');
  const expenseEl = container.querySelector('#chart-summary-expenses');
  const badgesContainer = container.querySelector('.chart-summary-badges');
  const subtitleEl = container.querySelector('#spending-overview-panel .panel-subtitle');
  if (!chartContainer) return;

  destroySpendingChart();

  let chartData;
  if (period === 'period') {
    chartData = computeDailySeries(transactions, 'period', periodState);
  } else {
    chartData = computeDailySeries(transactions, period);
  }

  const incomeTotal = chartData.reduce((s, d) => s + (d.income || 0), 0);
  const expenseTotal = chartData.reduce((s, d) => s + (d.expense || 0), 0);
  const hasData = chartData.some(d => d.income > 0 || d.expense > 0);

  if (subtitleEl) {
    subtitleEl.textContent = getSpendingChartSubtitle(period, periodState, chartData);
  }

  if (incomeEl) incomeEl.innerHTML = formatCurrency(incomeTotal, { asHtml: true });
  if (expenseEl) expenseEl.innerHTML = formatCurrency(expenseTotal, { asHtml: true });
  if (badgesContainer) badgesContainer.style.display = hasData ? 'flex' : 'none';

  if (!hasData) {
    chartContainer.innerHTML = `
      <div class="chart-empty-state">
        <div class="chart-empty-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <h4 class="chart-empty-title">Chưa có giao dịch trong kỳ</h4>
        <p class="chart-empty-desc">Thêm thu nhập hoặc chi phí để theo dõi biến động tài chính.</p>
        <button type="button" class="btn btn-primary" id="chart-empty-add-tx">
          Thêm giao dịch
        </button>
      </div>
    `;
    const addBtn = chartContainer.querySelector('#chart-empty-add-tx');
    if (addBtn) {
      addBtn.addEventListener('click', () => emit('navigate', { page: 'transactions' }));
    }
  } else {
    chartContainer.innerHTML = `
      <div class="spending-chart-wrapper">
        <canvas id="spending-chart-canvas" role="img" aria-label="Biểu đồ thu nhập và chi phí"></canvas>
      </div>
    `;
    const canvas = chartContainer.querySelector('#spending-chart-canvas');
    if (canvas) {
      renderSpendingChart(canvas, { data: chartData });
    }
  }
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

  // Compute unified statistics for the dashboard via shared selector based on global period state
  const stats = await getDashboardStats({
    from: _periodState.from,
    to: _periodState.to,
    period: _periodState.period,
    transactions,
    budgets,
    accounts,
  });

  // Filter transactions within the selected period for widgets
  const fromStr = stats.range.from;
  const toStr = stats.range.to;
  const periodTx = (transactions || []).filter(tx => {
    const d = normalizeDate(tx.date);
    return (!fromStr || d >= fromStr) && (!toStr || d <= toStr);
  });

  const totalBalance = stats.balance;
  const savingsRate = stats.savingsRate;
  const netCashFlow = stats.net;

  const recentTx = [...periodTx]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  const insight = generateInsight(periodTx.length ? periodTx : transactions, budgets);

  // Spending chart: compute daily series
  let chartData;
  if (_period === 'period') {
    if (stats.daily && stats.daily.length > 0) {
      chartData = stats.daily.map(d => ({
        date: d.date,
        income: d.income,
        expense: d.expense,
        expenses: d.expense,
      }));
    } else {
      chartData = computeDailySeries(transactions, 'period', _periodState);
    }
  } else {
    chartData = computeDailySeries(transactions, _period, _periodState);
  }

  const chartIncome = chartData.reduce((s, d) => s + (d.income || 0), 0);
  const chartExpenses = chartData.reduce((s, d) => s + (d.expense || 0), 0);
  const chartHasData = chartData.some(d => d.income > 0 || d.expense > 0);
  const chartSubtitle = getSpendingChartSubtitle(_period, _periodState, chartData);

  const userName = getUserDisplayName(settings);

  container.innerHTML = `
    <div class="dashboard-layout" id="dashboard-layout">
      ${errorBoundary(() => dashboardHeaderHTML(userName), 'dashboard-header')}

      <section class="dashboard-kpi-row" aria-label="Chỉ số chính">
        ${errorBoundary(() => kpiGridHTML({
          totalBalance,
          income: stats.income,
          expenses: stats.expense,
          savingsRate,
          compareRange: stats.prev.label,
          deltas: stats.deltas,
          days: stats.range.days,
        }), 'kpi')}
      </section>

      <section class="dashboard-grid-row dashboard-row-chart-budget">
        <div class="dashboard-col-chart">
          ${errorBoundary(() => spendingChartPanelHTML({
            period: _period,
            subtitle: chartSubtitle,
            incomeTotal: chartIncome,
            expenseTotal: chartExpenses,
            isEmpty: !chartHasData,
          }), 'spending-chart')}
        </div>
        <div class="dashboard-col-budget">
          ${errorBoundary(() => budgetProgressHTML(stats.byCategory), 'budget-progress')}
        </div>
      </section>

      <section class="dashboard-grid-row dashboard-row-tx-sidebar">
        <div class="dashboard-col-tx">
          ${errorBoundary(() => recentTransactionsHTML(recentTx), 'recent-transactions')}
        </div>
        <div class="dashboard-col-sidebar">
          ${errorBoundary(() => quickStatsHTML({
            netCashFlow,
            periodTx,
            settings,
            stats,
            budgets,
            periodState: _periodState,
          }), 'quick-stats')}
          ${errorBoundary(() => insightCardHTML({
            periodTx,
            budgets,
            stats,
            periodState: _periodState,
          }), 'insight')}
        </div>
      </section>
    </div>
  `;

  // Initialize chart canvas if data is available
  if (chartHasData) {
    const canvas = container.querySelector('#spending-chart-canvas');
    if (canvas) {
      renderSpendingChart(canvas, { data: chartData });
    }
  } else {
    destroySpendingChart();
  }

  attachListeners(container);

  const regressionTestDiv = document.createElement('div');
  regressionTestDiv.innerHTML = 'Regression test: àáảãạăâêôơƯđĐ – — ‘’ “” … 💰 ⚠️ ✅ Quản lý ngân sách, thu – chi, Ngày';
  regressionTestDiv.setAttribute('aria-hidden', 'true');
  regressionTestDiv.setAttribute('id', 'encoding-regression-test');
  regressionTestDiv.style.position = 'absolute';
  regressionTestDiv.style.left = '-9999px';
  regressionTestDiv.style.width = '1px';
  regressionTestDiv.style.height = '1px';
  regressionTestDiv.style.overflow = 'hidden';
  container.appendChild(regressionTestDiv);
}

/* ---------------------------------------------------------------- *
 * Event listeners
 * ---------------------------------------------------------------- */
function attachListeners(container) {
  // Period selector change listener
  attachPeriodSelectorListeners(container, (newRange) => {
    _periodState = newRange;
    render(container);
  });

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
      updateChart(container, _period, _transactions, _periodState);
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

  // Initialize keyboard accessibility on KPI tooltips
  initKpiTooltips(container);

  // Recent transactions row click & keyboard handler to open transaction details
  container.querySelectorAll('.recent-tx-row').forEach(row => {
    const handleOpen = () => {
      const txId = row.dataset.recentTxId;
      const tx = _transactions.find(t => String(t.id) === String(txId));
      if (tx) {
        editTransaction(tx);
      }
    };

    row.addEventListener('click', handleOpen);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
    });
  });
}

export default { render };


