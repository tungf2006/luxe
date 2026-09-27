/**
 * @file BarChart — Responsive SVG grouped bar chart for cash flow (Income vs Expenses).
 */

import { formatCurrency, escapeHtml, formatCompactNumber } from '../../utils/format.js';

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 240;
const PADDING = { top: 20, right: 15, bottom: 40, left: 55 };
const BAR_WIDTH = 14;
const BAR_GAP = 4;

/**
 * Custom SVG path for a rectangle with top-only rounded corners (4px radius).
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} [radius=4]
 * @returns {string} SVG path d attribute
 */
function topRoundedRect(x, y, width, height, radius = 4) {
  if (height <= 0 || width <= 0) return '';
  const r = Math.min(radius, height / 2, width / 2);
  if (r <= 0) {
    return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
  }
  return `M ${x} ${y + r} ` +
         `A ${r} ${r} 0 0 1 ${x + r} ${y} ` +
         `L ${x + width - r} ${y} ` +
         `A ${r} ${r} 0 0 1 ${x + width} ${y + r} ` +
         `L ${x + width} ${y + height} ` +
         `L ${x} ${y + height} Z`;
}

/**
 * Format large numbers for Y-axis tick labels (e.g. 0, 1.2K, 2.5K, 1.5M).
 * @param {number} val
 * @returns {string}
 */
// formatCompactNumber is imported from ../../utils/format.js

/**
 * Render Legend HTML string.
 * @returns {string}
 */
export function BarChartLegend() {
  return `
    <div class="barchart-legend-container" aria-label="Chú thích biểu đồ">
      <div class="barchart-legend-item">
        <span class="barchart-legend-dot income-dot"></span>
        <span class="barchart-legend-text">Thu nhập</span>
      </div>
      <div class="barchart-legend-item">
        <span class="barchart-legend-dot expense-dot"></span>
        <span class="barchart-legend-text">Chi phí</span>
      </div>
    </div>
  `;
}

/**
 * Render Skeleton Loading State HTML.
 * @returns {string}
 */
export function BarChartSkeleton() {
  return `
    <div class="barchart-skeleton-box" aria-busy="true" aria-label="Đang tải biểu đồ dòng tiền">
      <div class="barchart-skeleton-header">
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
      </div>
      <div class="barchart-skeleton-bars">
        ${Array.from({ length: 6 }).map(() => `
          <div class="skeleton-group">
            <div class="skeleton-bar" style="height: ${35 + Math.random() * 45}%;"></div>
            <div class="skeleton-bar" style="height: ${25 + Math.random() * 35}%;"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Render Empty State HTML.
 * @returns {string}
 */
export function BarChartEmpty() {
  return `
    <div class="barchart-empty-box">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.4)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div class="barchart-empty-title">Chưa có dữ liệu dòng tiền</div>
      <div class="barchart-empty-sub">Hãy thêm giao dịch thu nhập hoặc chi phí để xem phân tích dòng tiền</div>
    </div>
  `;
}

/**
 * Render a grouped SVG bar chart (income + expense per month).
 * @param {Object} params
 * @param {Array<{label:string, fullLabel?:string, income:number, expenses:number}>} params.data
 * @param {number} [params.width=600]
 * @param {number} [params.height=240]
 * @param {boolean} [params.loading=false]
 * @param {string} [params.currency='VND']
 * @returns {string} HTML markup string
 */
export function BarChart({ data, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, loading = false, currency = 'VND' }) {
  if (loading) {
    return BarChartSkeleton();
  }

  if (!Array.isArray(data) || data.length === 0 || data.every(d => (d.income || 0) === 0 && (d.expenses || 0) === 0)) {
    return BarChartEmpty();
  }

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  // Max value for Y-axis domain
  const rawMax = Math.max(...data.flatMap(d => [d.income || 0, d.expenses || 0]), 1);
  const maxVal = rawMax * 1.15;

  const groupStep = innerW / data.length;
  const totalBarsWidth = BAR_WIDTH * 2 + BAR_GAP;

  let barsSvg = '';
  let labelsSvg = '';
  let hoverOverlaySvg = '';

  data.forEach((d, i) => {
    const groupCenterX = PADDING.left + i * groupStep + groupStep / 2;
    const groupStartX = groupCenterX - totalBarsWidth / 2;

    const incomeVal = Math.max(0, d.income || 0);
    const expenseVal = Math.max(0, d.expenses || 0);

    const incomeH = (incomeVal / maxVal) * innerH;
    const expenseH = (expenseVal / maxVal) * innerH;

    const incomeY = PADDING.top + innerH - incomeH;
    const expenseY = PADDING.top + innerH - expenseH;

    const incomeX = groupStartX;
    const expenseX = groupStartX + BAR_WIDTH + BAR_GAP;

    const isCurrentMonth = i === data.length - 1;

    // Income bar path (#22c55e)
    if (incomeH > 0) {
      const incPath = topRoundedRect(incomeX, incomeY, BAR_WIDTH, incomeH, 4);
      barsSvg += `<path d="${incPath}" fill="#22C55E" opacity="${isCurrentMonth ? 1 : 0.9}" class="bar-income-rect"/>`;
    }

    // Expense bar path (#ef4444)
    if (expenseH > 0) {
      const expPath = topRoundedRect(expenseX, expenseY, BAR_WIDTH, expenseH, 4);
      barsSvg += `<path d="${expPath}" fill="#EF4444" opacity="${isCurrentMonth ? 1 : 0.9}" class="bar-expense-rect"/>`;
    }

    // X-axis Month Label
    labelsSvg += `
      <text x="${groupCenterX}" y="${height - 12}" text-anchor="middle" fill="${isCurrentMonth ? '#F8FAFC' : 'rgba(148,163,184,0.7)'}" font-size="11" font-weight="${isCurrentMonth ? '600' : '400'}" font-family="Inter, system-ui, sans-serif">
        ${escapeHtml(d.label)}
      </text>
    `;

    // Transparent Hover Overlay for tooltip
    const overlayX = PADDING.left + i * groupStep;
    hoverOverlaySvg += `
      <rect class="barchart-hover-trigger" data-group-index="${i}" data-label="${escapeHtml(d.fullLabel || d.label)}" data-income="${incomeVal}" data-expense="${expenseVal}" x="${overlayX}" y="${PADDING.top}" width="${groupStep}" height="${innerH}" fill="transparent" style="cursor:pointer;"/>
    `;
  });

  // Y-axis gridlines & compact tick values (5 tick levels)
  const gridLines = [];
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const y = PADDING.top + (innerH / tickCount) * i;
    const val = Math.round(maxVal * (1 - i / tickCount));
    const labelStr = formatCompactNumber(val);

    gridLines.push(`
      <line x1="${PADDING.left}" y1="${y}" x2="${width - PADDING.right}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="${PADDING.left - 10}" y="${y + 4}" text-anchor="end" fill="rgba(148,163,184,0.6)" font-size="11" font-family="Inter, system-ui, sans-serif">${labelStr}</text>
    `);
  }

  // Base X-axis line
  const xAxisLine = `<line x1="${PADDING.left}" y1="${PADDING.top + innerH}" x2="${width - PADDING.right}" y2="${PADDING.top + innerH}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;

  return `
    <div class="barchart-wrapper" data-currency="${currency}">
      <svg class="barchart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Biểu đồ dòng tiền Thu nhập và Chi phí">
        ${gridLines.join('')}
        ${xAxisLine}
        <g class="barchart-bars-group">
          ${barsSvg}
        </g>
        <g class="barchart-labels-group">
          ${labelsSvg}
        </g>
        <g class="barchart-hover-group">
          ${hoverOverlaySvg}
        </g>
      </svg>
      <div class="barchart-tooltip-popover" aria-hidden="true" style="display:none;position:absolute;"></div>
    </div>
  `;
}

/**
 * Initialize interactive tooltips for the BarChart inside a container element.
 * @param {HTMLElement} container
 * @param {string} [currency='VND']
 */
export function initBarChartTooltips(container, currency = 'VND') {
  if (!container) return;
  const wrapper = container.querySelector('.barchart-wrapper');
  if (!wrapper) return;

  const tooltip = wrapper.querySelector('.barchart-tooltip-popover');
  const triggers = wrapper.querySelectorAll('.barchart-hover-trigger');
  if (!tooltip || !triggers.length) return;

  triggers.forEach(trig => {
    trig.addEventListener('mouseenter', e => {
      const label = trig.getAttribute('data-label') || '';
      const income = parseFloat(trig.getAttribute('data-income') || '0');
      const expense = parseFloat(trig.getAttribute('data-expense') || '0');
      const net = income - expense;

      tooltip.innerHTML = `
        <div class="tooltip-header">${escapeHtml(label)}</div>
        <div class="tooltip-row">
          <span class="tooltip-dot income-dot"></span>
          <span class="tooltip-label">Thu nhập:</span>
          <span class="tooltip-val income">+${formatCurrency(income, currency)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot expense-dot"></span>
          <span class="tooltip-label">Chi phí:</span>
          <span class="tooltip-val expense">-${formatCurrency(expense, currency)}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row">
          <span class="tooltip-label">Dòng tiền ròng:</span>
          <span class="tooltip-val ${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : ''}${formatCurrency(net, currency)}</span>
        </div>
      `;
      tooltip.style.display = 'block';
    });

    trig.addEventListener('mousemove', e => {
      const rect = wrapper.getBoundingClientRect();
      let x = e.clientX - rect.left + 15;
      let y = e.clientY - rect.top - 70;

      // Keep inside wrapper bounds
      if (x + 180 > rect.width) {
        x = e.clientX - rect.left - 185;
      }
      if (y < 10) {
        y = e.clientY - rect.top + 15;
      }

      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    });

    trig.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

export default BarChart;
