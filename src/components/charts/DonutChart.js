/**
 * @file DonutChart — data-driven SVG donut chart for category breakdown.
 * Uses stroke-dasharray technique for clean circular segments on <circle>.
 * Features: 600ms ease-out draw animation, hover/focus highlight, dynamic tooltip,
 * dynamic center total/slice label, keyboard navigation, and small slice grouping (<3%).
 */

import { formatCurrency, escapeHtml, parseNumber } from '../../utils/format.js';
import { DonutLegend } from '../ui/Legend.js';

const DEFAULT_SIZE = 180;
const DEFAULT_STROKE_WIDTH = 22;
let donutIdCounter = 0;

/**
 * Calculate percentage breakdown for a list of category data items.
 * Safely handles empty arrays, zero totals, null/undefined values, and string amounts.
 * Automatically aggregates slices with pct < threshold (default 3%) into "Khác" (Other).
 * @param {Array<{label?: string, value?: any, color?: string}>} data
 * @param {Object} [options]
 * @param {number} [options.groupThreshold=3] Percentage threshold to group small slices
 * @param {string} [options.otherLabel='Khác'] Label for grouped slice
 * @returns {Array<{label: string, value: number, color: string, pct: number, ratio: number, subItems?: Array}>}
 */
export function calculatePercentages(data, { groupThreshold = 3, otherLabel = 'Khác' } = {}) {
  if (!Array.isArray(data) || data.length === 0) return [];

  const parsedItems = data
    .filter(d => d !== null && d !== undefined && typeof d === 'object')
    .map(d => ({
      ...d,
      label: d.label || otherLabel,
      value: parseNumber(d.value),
    }))
    .filter(d => d.value > 0);

  if (parsedItems.length === 0) return [];

  const total = parsedItems.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0) return [];

  const itemsWithPct = parsedItems.map(d => {
    const ratio = d.value / total;
    return {
      ...d,
      pct: Number((ratio * 100).toFixed(1)),
      ratio,
    };
  });

  if (groupThreshold <= 0 || itemsWithPct.length <= 1) {
    return itemsWithPct;
  }

  const normalItems = [];
  const smallItems = [];

  for (const item of itemsWithPct) {
    if (item.pct < groupThreshold) {
      smallItems.push(item);
    } else {
      normalItems.push(item);
    }
  }

  if (smallItems.length === 0) {
    return normalItems;
  }

  const otherValue = smallItems.reduce((sum, item) => sum + item.value, 0);
  const otherRatio = otherValue / total;
  const otherPct = Number((otherRatio * 100).toFixed(1));

  const existingOtherIndex = normalItems.findIndex(
    item => (item.label && item.label.toLowerCase() === otherLabel.toLowerCase()) || item.id === 'other'
  );

  if (existingOtherIndex >= 0) {
    const existing = normalItems[existingOtherIndex];
    const combinedValue = existing.value + otherValue;
    const combinedRatio = combinedValue / total;
    normalItems[existingOtherIndex] = {
      ...existing,
      value: combinedValue,
      ratio: combinedRatio,
      pct: Number((combinedRatio * 100).toFixed(1)),
      subItems: [
        { label: existing.label, value: existing.value, pct: existing.pct, color: existing.color },
        ...smallItems.map(s => ({ label: s.label, value: s.value, pct: s.pct, color: s.color || '#64748B' }))
      ],
    };
    return normalItems;
  }

  normalItems.push({
    label: otherLabel,
    value: otherValue,
    color: '#64748B',
    pct: otherPct,
    ratio: otherRatio,
    subItems: smallItems.map(s => ({
      label: s.label,
      value: s.value,
      pct: s.pct,
      color: s.color || '#64748B',
    })),
  });

  return normalItems;
}

/**
 * Compute segment geometric properties for SVG rendering.
 * @param {Array<{label:string, value:number, color?:string}>} data
 * @param {number} size
 * @param {Object} [options]
 * @returns {Array<{label:string, value:number, color:string, pct:number, ratio:number, dashArray:number, dashoffset:number, radius:number, circumference:number, subItems?:Array}>|null}
 */
export function computeSegments(data, size = DEFAULT_SIZE, options = {}) {
  const itemsWithPct = calculatePercentages(data, options);
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
  const chartId = `donut-${++donutIdCounter}`;
  const tooltipId = `donut-tooltip-${donutIdCounter}`;

  const centerValue = totalLabel || formatCurrency(totalAmount, currency);
  const centerSub = totalSub || 'TỔNG CHI';

  const segmentSvg = segments.map((s, i) => {
    const subItemsAttr = s.subItems ? `data-subitems="${escapeHtml(JSON.stringify(s.subItems))}"` : '';
    const formattedVal = formatCurrency(s.value, currency);
    return `
    <circle
      class="donut-segment"
      data-index="${i}"
      data-label="${escapeHtml(s.label)}"
      data-value="${s.value}"
      data-pct="${s.pct.toFixed(1)}"
      data-dash="${s.dashArray}"
      ${subItemsAttr}
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
      tabindex="0"
      role="button"
      aria-label="${escapeHtml(s.label)}: ${escapeHtml(formattedVal)} (${s.pct.toFixed(1)}%)"
      style="transform-origin: ${cx}px ${cy}px; transform: rotate(-90deg);"
    />
  `;
  }).join('');

  return `
    <div class="donut-chart-container" id="${chartId}" role="region" aria-label="Biểu đồ tròn phân bổ chi tiêu theo danh mục">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut-svg" aria-hidden="true">
        ${segmentSvg}
        <g class="donut-center" aria-hidden="true">
          <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-total-value" fill="var(--text-primary)" font-size="18" font-weight="700" font-family="Outfit, sans-serif" data-default="${escapeHtml(centerValue)}">${escapeHtml(centerValue)}</text>
          <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="donut-total-sub" fill="var(--text-muted)" font-size="11" font-weight="600" font-family="Inter, sans-serif" letter-spacing="0.08em" data-default="${escapeHtml(centerSub)}">${escapeHtml(centerSub)}</text>
        </g>
      </svg>
      ${DonutLegend(segments, currency)}
      <div id="${tooltipId}" class="donut-tooltip" role="tooltip" aria-hidden="true"></div>
    </div>
  `;
}

/**
 * Initialize donut chart interactions after DOM insertion.
 * Supports hover, keyboard focus, mobile tap toggle, bounds checking, and two-way sync.
 * @param {HTMLElement} container - Parent element containing the .donut-chart-container
 * @param {string} [currency='VND']
 */
export function initDonutChart(container, currency = 'VND') {
  if (!container) return;
  const chartContainers = container.querySelectorAll('.donut-chart-container');
  if (chartContainers.length === 0) return;

  chartContainers.forEach(chartContainer => {
    if (chartContainer.dataset.donutInitialized) return;
    chartContainer.dataset.donutInitialized = 'true';

    const segments = chartContainer.querySelectorAll('.donut-segment');
    const legendItems = chartContainer.querySelectorAll('.legend-item');
    const tooltip = chartContainer.querySelector('.donut-tooltip');
    const centerVal = chartContainer.querySelector('.donut-total-value');
    const centerSub = chartContainer.querySelector('.donut-total-sub');

    let activeIndex = -1;

    function renderTooltipContent(index) {
      const seg = segments[index];
      if (!seg) return '';
      const label = seg.dataset.label || '';
      const value = parseNumber(seg.dataset.value || '0');
      const pct = parseFloat(seg.dataset.pct || '0');
      const subItemsRaw = seg.dataset.subitems;

      let subItems = null;
      if (subItemsRaw) {
        try {
          subItems = JSON.parse(subItemsRaw);
        } catch (e) {}
      }

      if (Array.isArray(subItems) && subItems.length > 0) {
        return `
          <div class="donut-tooltip-header">
            <div class="donut-tooltip-title">${escapeHtml(label)} <span class="donut-tooltip-pct">(${pct.toFixed(1)}%)</span></div>
            <div class="donut-tooltip-val">${escapeHtml(formatCurrency(value, currency))}</div>
          </div>
          <div class="donut-tooltip-subitems">
            <div class="donut-tooltip-subtitle">Bao gồm:</div>
            ${subItems.map(sub => `
              <div class="donut-tooltip-subitem">
                <span class="donut-tooltip-subdot" style="background:${escapeHtml(sub.color || '#64748B')};" aria-hidden="true"></span>
                <span class="donut-tooltip-sublabel">${escapeHtml(sub.label)}</span>
                <span class="donut-tooltip-subval">${escapeHtml(formatCurrency(sub.value, currency))} (${sub.pct.toFixed(1)}%)</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      return `
        <div class="donut-tooltip-title">${escapeHtml(label)}</div>
        <div class="donut-tooltip-val">${escapeHtml(formatCurrency(value, currency))} <span class="donut-tooltip-pct">(${pct.toFixed(1)}%)</span></div>
      `;
    }

    function positionTooltip(targetRect, clientX, clientY) {
      if (!tooltip) return;
      const tooltipRect = tooltip.getBoundingClientRect();
      const margin = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let x, y;

      if (clientX !== undefined && clientY !== undefined) {
        x = clientX + 14;
        y = clientY + 10;
        if (x + tooltipRect.width + margin > vw) {
          x = clientX - tooltipRect.width - 14;
        }
        if (y + tooltipRect.height + margin > vh) {
          y = clientY - tooltipRect.height - 10;
        }
      } else if (targetRect) {
        x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        y = targetRect.top - tooltipRect.height - 10;
        if (y < margin) {
          y = targetRect.bottom + 10;
        }
        if (x + tooltipRect.width + margin > vw) {
          x = vw - tooltipRect.width - margin;
        }
      } else {
        return;
      }

      if (x < margin) x = margin;
      if (y < margin) y = margin;
      if (y + tooltipRect.height + margin > vh) y = vh - tooltipRect.height - margin;

      tooltip.style.left = `${Math.round(x)}px`;
      tooltip.style.top = `${Math.round(y)}px`;
    }

    function showTooltip(index, clientX, clientY, targetEl) {
      if (!tooltip) return;
      tooltip.innerHTML = renderTooltipContent(index);
      tooltip.classList.add('is-visible');
      tooltip.style.opacity = '1';
      tooltip.setAttribute('aria-hidden', 'false');

      const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;
      positionTooltip(targetRect, clientX, clientY);

      if (tooltip.id) {
        const item = legendItems[index];
        const seg = segments[index];
        if (item) item.setAttribute('aria-describedby', tooltip.id);
        if (seg) seg.setAttribute('aria-describedby', tooltip.id);
      }
    }

    function hideTooltip() {
      if (!tooltip) return;
      tooltip.classList.remove('is-visible');
      tooltip.style.opacity = '0';
      tooltip.setAttribute('aria-hidden', 'true');
      legendItems.forEach(item => item.removeAttribute('aria-describedby'));
      segments.forEach(seg => seg.removeAttribute('aria-describedby'));
    }

    function updateCenter(index) {
      if (!centerVal || !centerSub) return;
      if (index >= 0 && segments[index]) {
        const seg = segments[index];
        const value = parseNumber(seg.dataset.value || '0');
        const label = seg.dataset.label || '';
        centerVal.textContent = formatCurrency(value, currency);
        centerSub.textContent = label;
      } else {
        centerVal.textContent = centerVal.dataset.default || '';
        centerSub.textContent = centerSub.dataset.default || '';
      }
    }

    function setActive(index, isActive) {
      activeIndex = isActive ? index : -1;
      chartContainer.classList.toggle('has-active', isActive && index >= 0);

      segments.forEach((seg, i) => {
        const match = (i === index && isActive);
        seg.classList.toggle('is-hovered', match);
        seg.classList.toggle('is-active', match);
        seg.setAttribute('aria-pressed', match ? 'true' : 'false');
      });

      legendItems.forEach((item, i) => {
        const match = (i === index && isActive);
        item.classList.toggle('is-hovered', match);
        item.classList.toggle('is-active', match);
        item.setAttribute('aria-pressed', match ? 'true' : 'false');
      });

      updateCenter(activeIndex);
    }

    // Segments event listeners
    segments.forEach((seg, i) => {
      seg.addEventListener('mouseenter', e => {
        setActive(i, true);
        showTooltip(i, e.clientX, e.clientY, seg);
      });
      seg.addEventListener('mousemove', e => {
        positionTooltip(null, e.clientX, e.clientY);
      });
      seg.addEventListener('mouseleave', () => {
        setActive(i, false);
        hideTooltip();
      });
      seg.addEventListener('focus', () => {
        setActive(i, true);
        showTooltip(i, undefined, undefined, seg);
      });
      seg.addEventListener('blur', () => {
        setActive(i, false);
        hideTooltip();
      });
      seg.addEventListener('click', e => {
        e.stopPropagation();
        if (activeIndex === i) {
          setActive(i, false);
          hideTooltip();
        } else {
          setActive(i, true);
          showTooltip(i, e.clientX || undefined, e.clientY || undefined, seg);
        }
      });
    });

    // Legend items event listeners
    legendItems.forEach((item, i) => {
      item.addEventListener('mouseenter', e => {
        setActive(i, true);
        showTooltip(i, e.clientX, e.clientY, item);
      });
      item.addEventListener('mousemove', e => {
        positionTooltip(null, e.clientX, e.clientY);
      });
      item.addEventListener('mouseleave', () => {
        setActive(i, false);
        hideTooltip();
      });
      item.addEventListener('focus', () => {
        setActive(i, true);
        showTooltip(i, undefined, undefined, item);
      });
      item.addEventListener('blur', () => {
        setActive(i, false);
        hideTooltip();
      });
      item.addEventListener('click', e => {
        e.stopPropagation();
        if (activeIndex === i) {
          setActive(i, false);
          hideTooltip();
        } else {
          setActive(i, true);
          showTooltip(i, e.clientX || undefined, e.clientY || undefined, item);
        }
      });
    });

    // Close on click outside & Escape key
    const docClickHandler = e => {
      if (!chartContainer.contains(e.target)) {
        if (activeIndex >= 0) {
          setActive(-1, false);
          hideTooltip();
        }
      }
    };
    document.addEventListener('click', docClickHandler);

    chartContainer.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        setActive(-1, false);
        hideTooltip();
      }
    });
  });
}