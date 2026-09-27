/**
 * @file Legend — shared donut legend component.
 */

import { escapeHtml } from '../../utils/format.js';

/**
 * Render a vertical donut legend.
 * @param {Array<{label:string, value:number, color?:string, pct:number, avatar?:{initial:string, bg:string, textColor:string}}>} items
 * @returns {string}
 */
export function DonutLegend(items) {
  if (!items || items.length === 0) return '';

  return `
    <div class="donut-legend" role="list" aria-label="Chỉ mục danh mục">
      ${items.map((item, i) => `
        <button class="legend-item" data-index="${i}" data-label="${escapeHtml(item.label)}" data-value="${item.value}" data-pct="${item.pct.toFixed(1)}" role="listitem" tabindex="0" aria-label="${escapeHtml(item.label)}: ${item.pct.toFixed(1)}%">
          ${item.avatar ? `<span class="legend-avatar" style="background:${item.avatar.bg};color:${item.avatar.textColor};" aria-hidden="true">${escapeHtml(item.avatar.initial)}</span>` : `<span class="legend-color" style="background:${item.color || 'var(--accent-brand)'};" aria-hidden="true"></span>`}
          <span class="legend-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
          <span class="legend-value">${item.pct.toFixed(1)}%</span>
        </button>
      `).join('')}
    </div>
  `;
}
