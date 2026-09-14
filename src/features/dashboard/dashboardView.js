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
import {
  merchantCellHTML,
  amountHTML,
} from '../../components/ui/TransactionCells.js';
import {
  formatCurrency,
  formatAmount,
  formatPercent,
  escapeHtml,
  getTrend,
  capitalize,
} from '../../utils/format.js';
import { CATEGORY_ICONS, CATEGORY_MAP } from '../../constants/categories.js';
import { emit } from '../../utils/eventBus.js';

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
  return new Date().toLocaleDateString('vi-VN', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function todayShort() {
  return new Date().toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function lastMonthKey() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.toISOString().slice(0, 7);
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
 * Render a trend badge with direction arrow.
 * @param {{direction:'up'|'down'|'flat',change:number}} trend
 * @param {string} [suffix='']
 */
function trendBadgeHTML(trend, suffix = '%') {
  if (trend.direction === 'flat') {
    return `<span class="trend-badge" style="color:var(--text-muted);">—</span>`;
  }
  const cls = trend.direction === 'up' ? 'trend-positive' : 'trend-negative';
  const icon = trend.direction === 'up'
    ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DASHBOARD_ICONS.trendUp}</svg>`
    : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DASHBOARD_ICONS.trendDown}</svg>`;
  const sign = trend.change > 0 ? '+' : '';
  return `
    <span class="trend-badge ${cls}">
      ${icon}
      ${sign}${trend.change}${suffix}
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
        <span class="hero-tagline-text">Danh mục sống động · ${todayShort()}</span>
       </div>
       <h1 class="hero-headline">Tiền của bạn,<br>được quản lý đẹp mắt.</h1>
       <p class="hero-subheadline">Theo dõi chi tiêu, quản lý ngân sách và rèn luyện thói quen tài chính tốt.</p>
    </div>
  `;
}

function kpiGridHTML(totalBalance, monthTotals, lastMonthTotals, savingsRate, lastMonthSavingsRate, netChange) {
  const incomeTrend = getTrend(monthTotals.income, lastMonthTotals.income);
  const expenseTrend = getTrend(monthTotals.expenses, lastMonthTotals.expenses);
  const savingsTrend = getTrend(savingsRate, lastMonthSavingsRate);
  const balanceTrend = getTrend(netChange, lastMonthTotals.income - lastMonthTotals.expenses);

  return `
    <div class="kpi-grid" id="kpi-grid">
      ${kpiCardHTML({
        id: 'kpi-total-balance',
        title: 'Tổng số dư',
        value: formatCurrency(totalBalance),
        iconSvg: kpiIcon(DASHBOARD_ICONS.balance),
        footerHtml: `${trendBadgeHTML(balanceTrend)}<span class="trend-label">so với tháng trước</span>`,
      })}
      ${kpiCardHTML({
        id: 'kpi-income',
        title: 'Thu nhập',
        value: formatAmount(monthTotals.income, 'income'),
        valueClass: 'highlight-positive',
        iconSvg: kpiIcon(DASHBOARD_ICONS.income),
        footerHtml: `${trendBadgeHTML(incomeTrend)}<span class="trend-label">so với tháng trước</span>`,
      })}
      ${kpiCardHTML({
        id: 'kpi-expenses',
        title: 'Chi phí',
        value: formatAmount(monthTotals.expenses, 'expense'),
        valueClass: 'highlight-negative',
        iconSvg: kpiIcon(DASHBOARD_ICONS.expense),
        footerHtml: `${trendBadgeHTML(expenseTrend)}<span class="trend-label">so với tháng trước</span>`,
      })}
      ${kpiCardHTML({
        id: 'kpi-savings',
        title: 'Tỷ lệ tiết kiệm',
        value: `${savingsRate.toFixed(1)}%`,
        valueClass: 'highlight-positive',
        iconSvg: kpiIcon(DASHBOARD_ICONS.savings),
        footerHtml: `${trendBadgeHTML(savingsTrend, 'pp')}<span class="trend-label">so với tháng trước</span>`,
      })}
    </div>
  `;
}

function spendingChartPanelHTML(chartHtml, weekTotalIncome, weekTotalExpenses) {
  return `
    <div class="glass-panel" id="spending-overview-panel">
      ${panelHeaderHTML({
         title: 'Tổng quan chi tiêu',
         subtitle: 'Thu nhập vs Chi phí',
         iconSvg: DASHBOARD_ICONS.chart,
        actionHtml: `
          <div class="filter-pills" role="group" aria-label="Time period">
              <button class="filter-btn active" data-chart-period="week" aria-pressed="true">Tuần</button>
              <button class="filter-btn" data-chart-period="month" aria-pressed="false">Tháng</button>
          </div>
        `,
      })}
      <div class="chart-summary-badges">
        <div class="chart-summary-item">
          <span class="chart-color-dot purple" aria-hidden="true"></span>
          <span class="chart-summary-label">Thu nhập</span>
          <span class="chart-summary-val" id="chart-summary-income">${formatCurrency(weekTotalIncome)}</span>
        </div>
        <div class="chart-summary-item">
          <span class="chart-color-dot cyan" aria-hidden="true"></span>
          <span class="chart-summary-label">Chi phí</span>
          <span class="chart-summary-val" id="chart-summary-expenses">${formatCurrency(weekTotalExpenses)}</span>
        </div>
      </div>
      <div id="spending-chart-container">
        ${chartHtml}
      </div>
    </div>
  `;
}

function recentTransactionsHTML(recentTx) {
  const rows = recentTx.length === 0
        ? `<tr><td colspan="4" class="empty-state-cell"><span class="empty-state-icon" aria-hidden="true">📊</span><p style="margin-top:0.5rem;">Không có giao dịch gần đây.</p></td></tr>`
        : recentTx.map(tx => `
        <tr>
          <td>${merchantCellHTML(tx)}</td>
          <td><span class="category-tag">${escapeHtml(CATEGORY_MAP[tx.category]?.name || tx.category)}</span></td>
          <td style="color:var(--text-secondary);font-size:0.85rem;">${formatShortDate(tx.date)}</td>
          <td class="table-amount ${tx.type === 'income' ? 'highlight-positive' : 'highlight-negative'}">
            ${formatAmount(tx.amount, tx.type)}
          </td>
        </tr>
      `).join('');

  return `
    <div class="glass-panel" id="recent-tx-panel">
      ${panelHeaderHTML({
         title: 'Giao dịch gần đây',
         subtitle: '7 ngày qua',
         iconSvg: DASHBOARD_ICONS.receipt,
         actionHtml: '<a class="view-all-link" data-nav="transactions" href="#" aria-label="Xem tất cả giao dịch">Xem tất cả <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></a>',
      })}
      <div class="transactions-table-wrapper">
        <table class="luxe-table" id="recent-tx-table" aria-label="Recent transactions">
          <thead>
            <tr>
               <th scope="col">Người thu</th>
               <th scope="col">Danh mục</th>
               <th scope="col">Ngày</th>
               <th scope="col" style="text-align:right">Số tiền</th>
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
    return `
      <div class="glass-panel" id="budget-progress-panel">
        ${panelHeaderHTML({ title: 'Tiến trình ngân sách', subtitle: nowFormatted(), iconSvg: DASHBOARD_ICONS.wallet })}
        <div class="empty-state"><div class="empty-state-content"><span class="empty-state-icon">📊</span><p>Chưa có ngân sách nào cho giai đoạn này.</p></div></div>
      </div>
    `;
  }

  const items = budgets.map(b => {
    const pct = Math.min(Math.round((b.spent / b.limit) * 100), 100);
    const cls = pct >= 80 ? 'warning' : pct <= 50 ? 'safe' : '';
    const pctColor = pct >= 80 ? 'var(--negative)' : pct <= 50 ? 'var(--positive)' : 'var(--text-secondary)';
    const pctClass = pct >= 80 ? 'highlight-negative' : pct <= 50 ? 'highlight-positive' : '';
    return `
      <div class="budget-item">
        <div class="budget-info">
          <span class="budget-category-name">
            ${b.icon} ${escapeHtml(CATEGORY_MAP[b.category]?.name || b.category)}
          </span>
          <span class="budget-values">
            ${formatCurrency(b.spent)}/${formatCurrency(b.limit)}
            <span class="budget-percent ${pctClass}" style="color:${pctColor};">${pct}%</span>
          </span>
        </div>
        <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${b.category} ngân sách: ${pct}%">
          <div class="progress-fill ${cls}" style="width:${pct}%;${!cls ? 'background:' + b.color : ''}"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="glass-panel" id="budget-progress-panel">
      ${panelHeaderHTML({
        title: 'Tiến trình ngân sách',
        subtitle: nowFormatted(),
        iconSvg: DASHBOARD_ICONS.wallet,
        actionHtml: '<a class="view-all-link" data-nav="budgets" href="#" aria-label="Quản lý ngân sách">Quản lý <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></a>',
      })}
      <div class="budget-list" id="dashboard-budget-list">
        ${items}
      </div>
    </div>
  `;
}

function insightCardHTML(insight) {
  let icon = '💡';
  if (insight.type === 'warning') icon = '⚠️';
  else if (insight.type === 'positive') icon = '✅';

  return `
    <div class="insight-card" id="insight-card" role="complementary" aria-label="Financial insight">
      <div class="insight-icon" aria-hidden="true">${icon}</div>
      <div class="insight-body">
        <div class="insight-tag">Phân tích AI</div>
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
    : '<span style="color:var(--text-muted);">Không có chi phí trong tháng này</span>';

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
     <span class="panel-title" style="font-size:1rem;">Tổng quan hàng tháng</span>
         <span class="panel-subtitle">${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.9rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:0.75rem;border-bottom:1px solid var(--border-subtle);">
           <span style="font-size:0.875rem;color:var(--text-secondary);">Dòng tiền mạnh</span>
           <span style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:${netClass};">${netSign}${formatCurrency(Math.abs(netCashFlow))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:0.75rem;border-bottom:1px solid var(--border-subtle);">
           <span style="font-size:0.875rem;color:var(--text-secondary);">Chi phí lớn nhất</span>
           ${largestHtml}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
           <span style="font-size:0.875rem;color:var(--text-secondary);">Ngày nhận lương</span>
           ${payDaysHtml}
        </div>
      </div>
    </div>
  `;
}

function formatShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
}

/* ---------------------------------------------------------------- *
 * Chart period toggle — re-renders the spending chart
 * ---------------------------------------------------------------- */
function updateChart(container, period, transactions) {
  const chartContainer = container.querySelector('#spending-chart-container');
  const incomeEl = container.querySelector('#chart-summary-income');
  const expenseEl = container.querySelector('#chart-summary-expenses');
  if (!chartContainer) return;

  let chartData;
  let incomeTotal, expenseTotal;

  if (period === 'week') {
    chartData = getWeeklySeries(transactions);
  } else {
    chartData = getMonthlyCashFlow(transactions);
  }
  incomeTotal = chartData.reduce((s, d) => s + d.income, 0);
  expenseTotal = chartData.reduce((s, d) => s + d.expenses, 0);

  chartContainer.innerHTML = AreaChart({ data: chartData });
  if (incomeEl) incomeEl.textContent = formatCurrency(incomeTotal);
  if (expenseEl) expenseEl.textContent = formatCurrency(expenseTotal);
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
  const currentMonth = new Date().toISOString().slice(0, 7);
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

  const recentTx = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  const insight = generateInsight(monthTx, budgets);
  const netCashFlow = monthTotals.income - monthTotals.expenses;

  const weeklyData = getWeeklySeries(transactions);
  const weekIncome = weeklyData.reduce((s, d) => s + d.income, 0);
  const weekExpenses = weeklyData.reduce((s, d) => s + d.expenses, 0);

  container.innerHTML = `
    <div class="hero-overview">
      ${heroHeaderHTML()}
      ${kpiGridHTML(totalBalance, monthTotals, lastMonthTotals, savingsRate, lastMonthSavingsRate, netCashFlow)}
    </div>

    <div class="dashboard-content-grid">
      <div class="dashboard-col">
        ${weeklyData.length > 0 ? spendingChartPanelHTML(AreaChart({ data: weeklyData }), weekIncome, weekExpenses) : ''}
        ${recentTransactionsHTML(recentTx)}
      </div>
      <div class="dashboard-col">
        ${budgetProgressHTML(budgets)}
        ${insightCardHTML(insight)}
        ${quickStatsHTML(netCashFlow, monthTx, settings)}
      </div>
    </div>
  `;

  attachListeners(container);
}

/* ---------------------------------------------------------------- *
 * Event listeners
 * ---------------------------------------------------------------- */
function attachListeners(container) {
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

  // View-all / Manage navigation
  container.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      emit('navigate', { page: el.dataset.nav });
    });
  });
}

export default { render };
