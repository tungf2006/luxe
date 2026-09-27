/**
 * @file Reusable KPI card component.
 * Used on the dashboard and budgets page with different footer content.
 */

import { escapeHtml } from '../../utils/format.js';

/**
 * Render a KPI card.
 * @param {Object} params
 * @param {string} params.id          DOM id
 * @param {string} params.title       Card title
 * @param {string} params.value       Displayed value
 * @param {string} [params.valueClass]  CSS class for value (e.g. 'highlight-positive')
 * @param {string} [params.footerHtml]  Optional footer HTML (trend badges, subtitles)
 * @param {string} [params.iconSvg]    SVG icon markup for the header badge
 * @param {string} [params.tooltip]    Optional explanation of how the KPI is computed (shown as a native tooltip on an info icon)
 * @returns {string}
 */
export function kpiCardHTML({ id, title, value, valueClass = '', footerHtml = '', iconSvg = '', tooltip = '' }) {
  const infoIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="20"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/></svg>`;
  return `
    <div class="kpi-card" id="${id}">
      <div class="kpi-header">
        <span class="kpi-title">${title}</span>
        ${tooltip ? `<span class="kpi-info" title="${escapeHtml(tooltip)}">${infoIcon}</span>` : ''}
        ${iconSvg ? `<span class="kpi-icon-badge" aria-hidden="true">${iconSvg}</span>` : ''}
      </div>
      <div class="kpi-value ${valueClass}">${value}</div>
      ${footerHtml ? `<div class="kpi-footer">${footerHtml}</div>` : ''}
    </div>
  `;
}
