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
import { BarChart, BarChartLegend, initBarChartTooltips } from '../../components/charts/BarChart.js';
import { DonutChart, initDonutChart } from '../../components/charts/DonutChart.js';
import { formatCurrency, formatCompactCurrency, formatMonthYear, getLocalDateString, getLocalMonthString } from '../../utils/format.js';
import { showToast } from '../../components/ui/Toast.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { getRoute } from '../../config/routes.js';
import { CATEGORY_MAP } from '../../constants/categories.js';
import { t } from '../../utils/i18n.js';
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
  const hasRealVariation = trend.some(d => d.value !== trend[0].value);
  return { trend, total: totalBalance, hasRealVariation };
}

/**
 * Render a single-series line chart with area fill and hover-only dots.
 * @param {Array<{label:string, value:number}>} data
 * @returns {string}  SVG + tooltip markup
 */
function LineChart(data) {
  const width = 700, height = 120;
  const padding = { top: 10, right: 0, bottom: 30, left: 0 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const vals = data.map(d => d.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const domainMin = minVal * 0.95;
  const domainMax = maxVal * 1.05 || 1;
  const range = domainMax - domainMin || 1;

  const pts = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * innerW,
    y: padding.top + innerH - ((d.value - domainMin) / range) * innerH,
  }));

  const areaD = `M ${pts[0].x} ${pts[0].y} ` +
    pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x} ${padding.top + innerH} L ${pts[0].x} ${padding.top + innerH} Z`;

  const lineD = `M ${pts[0].x} ${pts[0].y} ` +
    pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(g => {
    const y = padding.top + innerH * (1 - g);
    return `<line x1="${padding.left}" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`;
  }).join('');

  const hoverDots = pts.map((p, i) => `
    <g class="nw-hover-point" style="opacity:0;transition:opacity 0.15s;">
      <circle cx="${p.x}" cy="${p.y}" r="16" fill="transparent"/>
      <circle cx="${p.x}" cy="${p.y}" r="4" fill="#22C55E" stroke="var(--bg-surface)" stroke-width="2"/>
    </g>`
  ).join('');

  const hitAreas = pts.map((p, i) => {
    const left = i === 0 ? 0 : (pts[i - 1].x + p.x) / 2;
    const right = i === pts.length - 1 ? width : (p.x + pts[i + 1].x) / 2;
    return `<rect class="nw-hit" x="${left}" y="${padding.top}" width="${right - left}" height="${innerH}"
      fill="transparent" data-idx="${i}" style="cursor:crosshair;"/>`;
  }).join('');

  return `
    <div class="nw-chart-wrap" style="position:relative;">
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" aria-label="Biểu đồ xu hướng tài sản" id="nw-svg">
        <defs>
          <linearGradient id="nwLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#16A34A"/>
            <stop offset="100%" stop-color="#22C55E"/>
          </linearGradient>
          <linearGradient id="nwAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22C55E" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#22C55E" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${areaD}" fill="url(#nwAreaGrad)"/>
        <path d="${lineD}" fill="none" stroke="url(#nwLineGrad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${hoverDots}
        ${hitAreas}
      </svg>
      <div id="nw-tooltip" style="
        position:absolute;pointer-events:none;display:none;
        background:var(--bg-surface,#1a1a2e);border:1px solid rgba(34,197,94,0.3);
        border-radius:6px;padding:0.35rem 0.65rem;font-size:0.78rem;
        color:var(--text-primary,#fff);white-space:nowrap;z-index:10;
      "></div>
    </div>
    <div class="chart-axis-labels" style="margin-top:0.5rem;" aria-hidden="true">
      ${data.map(d => `<span>${d.label}</span>`).join('')}
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * HTML builders
 * --------------------------------------------------------------- */
function reportHeaderHTML(route) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: getLocalMonthString(d),
      label: formatMonthYear(getLocalDateString(d)),
    });
  }
  months.push({ value: 'q3', label: 'Q3 2026' });

  return pageHeaderHTML({
    title: route.title,
    description: route.description,
    actionHTML: `
      <div>
        <select class="select-dropdown" id="report-period" aria-label="Chọn khoảng thời gian báo cáo">
          ${months.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
        </select>
        <button class="btn-secondary" data-action="download-report" aria-label="Tải báo cáo xuống">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1 2 2H5a2 2 0 0 1 2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
           Tải xuống
         </button>
      </div>
    `,
  });
}


function deltaBadgeHTML(trend) {
  if (!trend || trend.length < 2) return '';
  const first = trend[0].value;
  const last = trend[trend.length - 1].value;
  if (first === 0) return '';
  const pct = ((last - first) / Math.abs(first)) * 100;
  const up = pct >= 0;
  const arrow = up
    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  const color = up ? 'var(--positive,#22C55E)' : 'var(--negative,#EF4444)';
  return `<span style="
    display:inline-flex;align-items:center;gap:2px;
    font-size:0.75rem;font-weight:600;color:${color};
    background:${up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};
    border-radius:999px;padding:2px 8px;margin-left:0.5rem;vertical-align:middle;
  " aria-label="${up ? 'tăng' : 'giảm'} ${Math.abs(pct).toFixed(1)}% so với 6 tháng trước">
    ${arrow}${Math.abs(pct).toFixed(1)}%
  </span>`;
}

function reportsGridHTML(cashFlow, donutData, totalSpent, netWorthTrend, netWorthTotal, hasRealVariation, currency = 'VND') {
  const netWorthBody = hasRealVariation
    ? LineChart(netWorthTrend)
    : `<div style="
        display:flex;align-items:center;justify-content:center;
        height:100px;font-size:0.875rem;color:var(--text-muted,rgba(255,255,255,0.4));
        border:1px dashed rgba(255,255,255,0.08);border-radius:8px;
      ">Cần thêm dữ liệu để vẽ xu hướng</div>`;

  return `
    <div class="reports-grid" style="margin-bottom:1.5rem;">
      <!-- Cash Flow Chart -->
      <div class="glass-panel" id="cashflow-panel">
        <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center;">
          <div class="panel-title-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.flow}</svg>
            <div>
              <div class="panel-title">Dòng tiền</div>
              <div class="panel-subtitle">Thu nhập vs Chi phí</div>
            </div>
          </div>
          ${BarChartLegend()}
        </div>
        <div class="report-chart-box">
          ${BarChart({ data: cashFlow, currency })}
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
            totalLabel: formatCurrency(totalSpent, currency),
            totalSub: 'TỔNG CHI',
            currency: currency,
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
        <div style="display:flex;align-items:center;">
          <span style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:var(--positive);">${formatCompactCurrency(netWorthTotal, currency)}</span>
          ${hasRealVariation ? deltaBadgeHTML(netWorthTrend) : ''}
        </div>
      </div>
      ${netWorthBody}
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Main render
 * --------------------------------------------------------------- */
export async function render(container, page = 'reports') {
  const route = getRoute(page);
  const [transactions, accounts, settings] = await Promise.all([
    dataService.getTransactions(),
    dataService.getAccounts(),
    dataService.getSettings(),
  ]);
  const currency = settings?.currency || 'VND';

  // Empty state: no transactions yet
  if (transactions.length === 0) {
    container.innerHTML = `
      ${reportHeaderHTML(route)}
      <div class="reports-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.4)" stroke-width="1.5" style="margin-bottom:1rem;" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h3 style="font-family:var(--font-display);font-size:1.25rem;font-weight:600;margin-bottom:0.5rem;">${t('charts.bar.empty.title')}</h3>
        <p style="color:var(--text-muted);max-width:360px;margin:0 auto;">${t('charts.bar.empty.sub')}</p>
        <button type="button" class="btn-add-transaction" data-nav="transactions" style="margin-top:1.5rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Thêm giao dịch đầu tiên
        </button>
      </div>
    `;
    attachListeners(container);
    return;
  }

  const cashFlow = getMonthlyCashFlow(transactions);
  const spending = getSpendingByCategory(transactions);
  const donutData = spending.map(s => ({
    label: CATEGORY_MAP[s.category]?.labelVi || s.category,
    value: s.amount,
    color: s.color,
  }));
  const totalSpent = spending.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const { trend: netWorthTrend, total: netWorthTotal, hasRealVariation } = computeNetWorthTrend(accounts, cashFlow);

  container.innerHTML = `
     ${reportHeaderHTML(route)}
    ${reportsGridHTML(cashFlow, donutData, totalSpent, netWorthTrend, netWorthTotal, hasRealVariation, currency)}
  `;

  // Initialize interactive chart tooltips
  initBarChartTooltips(container, currency);

  // Initialize donut chart interactions
  initDonutChart(container, currency);

  if (hasRealVariation) {
    initNetWorthHover(container, netWorthTrend, currency);
  }

  attachListeners(container);
}

/* --------------------------------------------------------------- *
 * Net worth chart hover interaction
 * --------------------------------------------------------------- */
function initNetWorthHover(container, trendData, currency) {
  const svg = container.querySelector('#nw-svg');
  if (!svg) return;
  const tooltip = container.querySelector('#nw-tooltip');
  const dots = svg.querySelectorAll('.nw-hover-point');
  const hits = svg.querySelectorAll('.nw-hit');

  function showDot(idx) {
    dots.forEach((d, i) => { d.style.opacity = i === idx ? '1' : '0'; });
  }
  function hideDots() {
    dots.forEach(d => { d.style.opacity = '0'; });
    if (tooltip) tooltip.style.display = 'none';
  }

  hits.forEach(hit => {
    hit.addEventListener('mouseenter', e => {
      const idx = parseInt(hit.dataset.idx, 10);
      const d = trendData[idx];
      if (!d) return;
      showDot(idx);
      if (tooltip) {
        tooltip.textContent = `${d.label}: ${formatCurrency(d.value, currency)}`;
        tooltip.style.display = 'block';
      }
    });
    hit.addEventListener('mousemove', e => {
      if (!tooltip || tooltip.style.display === 'none') return;
      const wrap = container.querySelector('.nw-chart-wrap');
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      let left = e.clientX - rect.left + 12;
      let top = e.clientY - rect.top - 32;
      const tw = tooltip.offsetWidth || 140;
      if (left + tw > rect.width - 4) left = e.clientX - rect.left - tw - 12;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${Math.max(0, top)}px`;
    });
    hit.addEventListener('mouseleave', hideDots);
  });
}

/* --------------------------------------------------------------- *
 * Event listeners
 * --------------------------------------------------------------- */
function attachListeners(container) {
  // Navigation links (empty state CTA)
  container.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      emit('navigate', { page: el.dataset.nav });
    });
  });

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
