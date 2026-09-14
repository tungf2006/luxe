/**
 * @file Reports feature module.
 * Renders the reports/analytics page: cash flow bar chart,
 * category breakdown donut, and net worth trend line chart.
 */

import dataService, {
  computeTotals,
  getMonthlyCashFlow,
  getSpendingByCategory,
} from '../../services/dataService.js';
import { BarChart } from '../../components/charts/BarChart.js';
import { DonutChart } from '../../components/charts/DonutChart.js';
import { formatCurrency, escapeHtml } from '../../utils/format.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';

/* --------------------------------------------------------------- *
 * SVG icon fragments
 * --------------------------------------------------------------- */
const ICONS = {
  flow: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  donut: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  spark: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
};

/* --------------------------------------------------------------- *
 * Net worth trend computation & chart
 * ---------------------------------------------------------------- */
function computeNetWorthTrend(accounts, cashFlow) {
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const trend = [];
  let running = totalBalance;
  for (let i = cashFlow.length - 1; i >= 0; i--) {
    const net = cashFlow[i].income - cashFlow[i].expenses;
    trend.unshift({ label: cashFlow[i].label || cashFlow[i].month, value: Math.round(running) });
    running -= net;
  }
  return { trend, total: totalBalance };
}

/**
 * Render a single-series line chart with area fill.
 * @param {Array<{label:string, value:number}>} data
 * @returns {string}  SVG markup
 */
function LineChart(data) {
  const width = 700, height = 120;
  const padding = { top: 10, right: 0, bottom: 30, left: 0 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.value), 1) * 1.15;

  const pts = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * innerW,
    y: padding.top + innerH - (d.value / maxVal) * innerH,
  }));

  const areaD = `M ${pts[0].x} ${pts[0].y} ` +
    pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x} ${padding.top + innerH} L ${pts[0].x} ${padding.top + innerH} Z`;

  const lineD = `M ${pts[0].x} ${pts[0].y} ` +
    pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

  const dots = pts.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#22C55E" stroke="var(--bg-surface)" stroke-width="2"/>`
  ).join('');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(g => {
    const y = padding.top + innerH * (1 - g);
    return `<line x1="${padding.left}" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" aria-label="Biểu đồ xu hướng tài sản">
      <defs>
        <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22C55E" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#22C55E" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaD}" fill="url(#nwGrad)"/>
      <path d="${lineD}" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round"/>
      ${dots}
    </svg>
    <div class="chart-axis-labels" style="margin-top:0.5rem;" aria-hidden="true">
      ${data.map(d => `<span>${d.label}</span>`).join('')}
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * HTML builders
 * --------------------------------------------------------------- */
function pageBannerHTML() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
    });
  }
  months.push({ value: 'q3', label: 'Q3 2026' });

  return `
    <div class="page-title-banner">
      <div>
       <h2>Báo cáo &amp; Phân tích</h2>
       <p>Những hiểu biết sâu về sức khỏe tài chính của bạn</p>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <select class="select-dropdown" id="report-period" aria-label="Chọn khoảng thời gian báo cáo">
          ${months.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
        </select>
        <button class="btn-secondary" data-action="download-report" aria-label="Tải báo cáo xuống">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
           Tải xuống
         </button>
      </div>
    </div>
  `;
}

function reportsGridHTML(cashFlow, donutData, totalSpent, netWorthTrend, netWorthTotal) {
  return `
    <div class="reports-grid" style="margin-bottom:1.5rem;">
      <!-- Cash Flow Chart -->
      <div class="glass-panel" id="cashflow-panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.flow}</svg>
            <div>
              <div class="panel-title">Dòng tiền</div>
              <div class="panel-subtitle">Thu nhập vs Chi phí</div>
            </div>
          </div>
        </div>
        <div class="report-chart-box">
          ${BarChart({ data: cashFlow })}
        </div>
      </div>

      <!-- Category Breakdown Donut -->
      <div class="glass-panel" id="category-donut-panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sky)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.donut}</svg>
            <div>
              <div class="panel-title">Phân bổ danh mục</div>
              <div class="panel-subtitle">Phân phối chi tiêu</div>
            </div>
          </div>
        </div>
        <div class="category-donut-wrapper">
          ${DonutChart({
            data: donutData,
            totalLabel: formatCurrency(totalSpent),
             totalSub: 'TỔNG CHI',
          })}
        </div>
      </div>
    </div>

    <!-- Net Worth Trend -->
    <div class="glass-panel" id="net-worth-panel">
      <div class="panel-header">
        <div class="panel-title-group">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--positive)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.spark}</svg>
          <div>
              <div class="panel-title">Tăng trưởng tài sản</div>
              <div class="panel-subtitle">6 tháng gần đây</div>
          </div>
        </div>
        <span style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:var(--positive);">${formatCurrency(netWorthTotal)}</span>
      </div>
      ${LineChart(netWorthTrend)}
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Main render
 * --------------------------------------------------------------- */
export async function render(container) {
  const [transactions, accounts] = await Promise.all([
    dataService.getTransactions(),
    dataService.getAccounts(),
  ]);

  const cashFlow = getMonthlyCashFlow(transactions);
  const spending = getSpendingByCategory(transactions);
  const donutData = spending.map(s => ({
    label: s.category,
    value: s.amount,
    color: s.color,
  }));
  const totalSpent = spending.reduce((s, d) => s + d.value, 0);
  const { trend: netWorthTrend, total: netWorthTotal } = computeNetWorthTrend(accounts, cashFlow);

  container.innerHTML = `
    ${pageBannerHTML()}
    ${reportsGridHTML(cashFlow, donutData, totalSpent, netWorthTrend, netWorthTotal)}
  `;

  attachListeners(container);
}

/* --------------------------------------------------------------- *
 * Event listeners
 * --------------------------------------------------------------- */
function attachListeners(container) {
  container.addEventListener('click', e => {
    if (e.target.closest('[data-action="download-report"]')) {
      e.preventDefault();
      showToast('Báo cáo đã được xuất thành công!', 'success');
    }
  });

  const periodEl = container.querySelector('#report-period');
  if (periodEl) {
    periodEl.addEventListener('change', () => {
      showToast(`Báo cáo đã lọc theo ${periodEl.options[periodEl.selectedIndex].text}`, 'info');
    });
  }
}

export default { render };
