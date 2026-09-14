/**
 * @file Reusable panel header component.
 * Standardised header used across dashboard cards, reports, and more.
 */

/**
 * Render a panel header with optional action link.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} [params.subtitle]
 * @param {string} [params.iconSvg]   SVG markup (inline)
 * @param {string} [params.actionHtml]  Right-side action (link or button HTML)
 * @returns {string}
 */
export function panelHeaderHTML({ title, subtitle = '', iconSvg = '', actionHtml = '' }) {
  return `
    <div class="panel-header">
      <div class="panel-title-group">
        ${iconSvg ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconSvg}</svg>` : ''}
        <div>
          <div class="panel-title">${title}</div>
          ${subtitle ? `<div class="panel-subtitle">${subtitle}</div>` : ''}
        </div>
      </div>
      ${actionHtml ? actionHtml : ''}
    </div>
  `;
}
