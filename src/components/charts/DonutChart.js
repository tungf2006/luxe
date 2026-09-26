/**
 * @file DonutChart — data-driven SVG donut chart for category breakdown.
 * Uses stroke-dasharray technique for clean circular segments on <circle>.
 * Features: 600ms ease-out draw animation, hover highlight, tooltip, center total label.
 */

import { formatCurrency, formatCompactCurrency, escapeHtml, parseNumber } from '../../utils/format.js';
import { DonutLegend } from '../ui/Legend.js';

const DEFAULT_SIZE = 180;
const DEFAULT_STROKE_WIDTH = 22;

/**
 * Calculate percentage breakdown for a list of category data items.
 * Safely handles empty arrays, zero totals, null/undefined values, and string amounts.
 * @param {Array<{label?: string, value?: any, color?: string}>} data
 * @returns {Array<{label: string, value: number, color: string, pct: number, ratio: number}>}
 */
export function calculatePercentages(data) {
  if (!Array.isArray(data) || data.length === 0) return [];

  const parsedItems = data
    .filter(d => d !== null && d !== undefined && typeof d === 'object')
    .map(d => ({
      ...d,
      label: d.label || 'Khác',
      value: parseNumber(d.value),
    }))
    .filter(d => d.value > 0);

  if (parsedItems.length === 0) return [];

  const total = parsedItems.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0) return [];

  return parsedItems.map(d => {
    const ratio = d.value / total;
    return {
      ...d,
      pct: Number((ratio * 100).toFixed(1)),
      ratio,
    };
  });
}

/**
 * Compute segment geometric properties for SVG rendering.
 * @param {Array<{label:string, value:number, color?:string}>} data
 * @param {number} size
 * @returns {Array<{label:string, value:number, color:string, pct:number, ratio:number, dashArray:number, dashoffset:number, radius:number, circumference:number}>|null}
 */
export function computeSegments(data, size = DEFAULT_SIZE) {
  const itemsWithPct = calculatePercentages(data);
  if (itemsWithPct.length === 0) return null;

  const strokeWidth = DEFAULT_STROKE_WIDTH;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedOffset = 0;
  return itemsWithPct.map(d => {
    const dashArray = d.ratio * circumference;
    const dashoffset = -accumulatedOffset;
    accumulatedOffset += dashArray;

    return {
      ...d,
      dashArray,
      dashoffset,
      radius,
      circumference,
    };
  });
}

/**
 * Render a donut chart SVG + legend markup string.
 * @param {Object} params
 * @param {Array<{label:string, value:number, color?:string}>} params.data
 * @param {string} [params.totalLabel] Pre-formatted total label
 * @param {string} [params.totalSub] Subtitle (e.g. "TỔNG CHI")
 * @param {string} [params.currency] Currency code for formatting fallback
 * @param {number} [params.size=180]
 * @returns {string}
 */
export function DonutChart({ data, totalLabel, totalSub, currency = 'VND', size = DEFAULT_SIZE }) {
  const segments = computeSegments(data, size);

  // Empty state guard if total === 0 or no data
  if (!segments || segments.length === 0) {
    return `
      <div class="chart-empty donut-empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:${size}px;text-align:center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:0.75rem;" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <p style="color:var(--text-muted);font-size:0.875rem;">Chưa có chi tiêu trong tháng này</p>
      </div>
    `;
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - DEFAULT_STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const totalAmount = segments.reduce((sum, s) => sum + s.value, 0);

  const segmentSvg = segments.map((s, i) => `
    <circle
      class="donut-segment"
      data-index="${i}"
      data-label="${escapeHtml(s.label)}"
      data-value="${s.value}"
      data-pct="${s.pct.toFixed(1)}"
      data-dash="${s.dashArray}"
      cx="${cx}"
      cy="${cy}"
      r="${radius}"
      fill="none"
      stroke="${s.color || 'var(--accent-brand)'}"
      stroke-width="${DEFAULT_STROKE_WIDTH}"
      stroke-linecap="butt"
      stroke-dasharray="${s.dashArray} ${circumference}"
      stroke-dashoffset="${s.dashoffset}"
      transform="rotate(-90 ${cx} ${cy})"
      style="transform-origin: ${cx}px ${cy}px; transform: rotate(-90deg);"
    />
  `).join('');

  const centerValue = totalLabel || formatCurrency(totalAmount, currency);
  const centerSub = totalSub || 'TỔNG CHI';

  return `
    <div class="donut-chart-container" role="img" aria-label="Biểu đồ tròn phân bổ chi tiêu theo danh mục">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut-svg" aria-hidden="true">
        ${segmentSvg}
        <g class="donut-center">
          <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-total-value" fill="var(--text-primary)" font-size="18" font-weight="700" font-family="Outfit, sans-serif">${escapeHtml(centerValue)}</text>
          <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="donut-total-sub" fill="var(--text-muted)" font-size="11" font-weight="600" font-family="Inter, sans-serif" letter-spacing="0.08em">${escapeHtml(centerSub)}</text>
        </g>
      </svg>
      ${DonutLegend(segments)}
      <div class="donut-tooltip" role="tooltip" aria-hidden="true"></div>
    </div>
  `;
}

/**
 * Initialize donut chart interactions after DOM insertion.
 * Call this after the DonutChart HTML has been inserted into the DOM.
 * @param {HTMLElement} container - Parent element containing the .donut-chart-container
 * @param {string} [currency='VND']
 */
export function initDonutChart(container, currency = 'VND') {
  const chartContainer = container.querySelector('.donut-chart-container');
  if (!chartContainer || chartContainer.dataset.donutInitialized) return;

  chartContainer.dataset.donutInitialized = 'true';

  const segments = chartContainer.querySelectorAll('.donut-segment');
  const legendItems = chartContainer.querySelectorAll('.legend-item');
  const tooltip = chartContainer.querySelector('.donut-tooltip');

  function showTooltip(index, clientX, clientY) {
    const seg = segments[index];
    if (!seg) return;
    const label = seg.dataset.label || '';
    const value = parseNumber(seg.dataset.value || '0');
    const pct = parseFloat(seg.dataset.pct || '0');
    tooltip.textContent = `${label}: ${formatCurrency(value, currency)} (${pct.toFixed(1)}%)`;
    tooltip.style.left = `${clientX + 12}px`;
    tooltip.style.top = `${clientY - 8}px`;
    tooltip.style.opacity = '1';
    tooltip.setAttribute('aria-hidden', 'false');
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.style.opacity = '0';
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function setHover(index, isHover) {
    segments.forEach((seg, i) => {
      const match = (i === index && isHover);
      seg.classList.toggle('is-hovered', match);
      if (match) {
        seg.setAttribute('stroke-width', String(DEFAULT_STROKE_WIDTH + 4));
      } else {
        seg.setAttribute('stroke-width', String(DEFAULT_STROKE_WIDTH));
      }
    });
    legendItems.forEach((item, i) => {
      item.classList.toggle('is-hovered', i === index && isHover);
    });
  }

  // Segment interactions
  segments.forEach((seg, i) => {
    seg.addEventListener('mouseenter', e => {
      setHover(i, true);
      showTooltip(i, e.clientX, e.clientY);
    });
    seg.addEventListener('mousemove', e => showTooltip(i, e.clientX, e.clientY));
    seg.addEventListener('mouseleave', () => {
      setHover(i, false);
      hideTooltip();
    });
    seg.addEventListener('focus', e => {
      setHover(i, true);
      const rect = seg.getBoundingClientRect();
      showTooltip(i, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    seg.addEventListener('blur', () => {
      setHover(i, false);
      hideTooltip();
    });
  });

  // Legend interactions (sync with segments)
  legendItems.forEach((item, i) => {
    item.addEventListener('mouseenter', e => {
      setHover(i, true);
      showTooltip(i, e.clientX, e.clientY);
    });
    item.addEventListener('mousemove', e => showTooltip(i, e.clientX, e.clientY));
    item.addEventListener('mouseleave', () => {
      setHover(i, false);
      hideTooltip();
    });
    item.addEventListener('focus', e => {
      setHover(i, true);
      const rect = item.getBoundingClientRect();
      showTooltip(i, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    item.addEventListener('blur', () => {
      setHover(i, false);
      hideTooltip();
    });
  });

  // Keyboard support
  chartContainer.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideTooltip();
      segments.forEach((seg, i) => setHover(i, false));
    }
  });
}