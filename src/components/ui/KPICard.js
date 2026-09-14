/**
 * @file Reusable KPI card component.
 * Used on the dashboard and budgets page with different footer content.
 */

/**
 * Render a KPI card.
 * @param {Object} params
 * @param {string} params.id          DOM id
 * @param {string} params.title       Card title
 * @param {string} params.value       Displayed value
 * @param {string} [params.valueClass]  CSS class for value (e.g. 'highlight-positive')
 * @param {string} [params.footerHtml]  Optional footer HTML (trend badges, subtitles)
 * @param {string} [params.iconSvg]    SVG icon markup for the header badge
 * @returns {string}
 */
export function kpiCardHTML({ id, title, value, valueClass = '', footerHtml = '', iconSvg = '' }) {
  return `
    <div class="kpi-card" id="${id}">
      <div class="kpi-header">
        <span class="kpi-title">${title}</span>
        ${iconSvg ? `<span class="kpi-icon-badge" aria-hidden="true">${iconSvg}</span>` : ''}
      </div>
      <div class="kpi-value ${valueClass}">${value}</div>
      ${footerHtml ? `<div class="kpi-footer">${footerHtml}</div>` : ''}
    </div>
  `;
}
