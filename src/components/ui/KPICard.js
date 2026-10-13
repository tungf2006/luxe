/**
 * @file Reusable KPI card component.
 * Used on the dashboard, budgets, and recurring pages.
 */

import { escapeHtml } from '../../utils/format.js';

/**
 * Render a KPI skeleton card markup for loading states.
 * @param {string} [id]
 * @returns {string}
 */
export function kpiSkeletonCardHTML(id = '') {
  return `
    <div class="kpi-card kpi-card-skeleton" ${id ? `id="${id}"` : ''} aria-busy="true" aria-label="Đang tải dữ liệu">
      <div class="kpi-header">
        <span class="kpi-skeleton-bar kpi-skeleton-title"></span>
        <span class="kpi-skeleton-bar kpi-skeleton-info"></span>
      </div>
      <div class="kpi-value">
        <span class="kpi-skeleton-bar kpi-skeleton-value"></span>
      </div>
      <div class="kpi-footer">
        <span class="kpi-skeleton-bar kpi-skeleton-footer"></span>
      </div>
    </div>
  `;
}

/**
 * Render a KPI card.
 * @param {Object} params
 * @param {string} params.id             DOM id
 * @param {string} params.title          Card title
 * @param {string} [params.value]        Displayed value (empty/null renders "—")
 * @param {string} [params.valueClass]   CSS class for value (e.g. 'highlight-positive', 'highlight-warning', 'highlight-negative')
 * @param {string} [params.footerHtml]   Optional footer HTML (delta badge + comparison period label)
 * @param {string} [params.tooltip]      Optional tooltip text shown next to the title on an info icon (keyboard-accessible)
 * @param {boolean} [params.loading]     Render skeleton loading placeholder
 * @returns {string}
 */
export function kpiCardHTML({
  id,
  title,
  value,
  valueClass = '',
  footerHtml = '',
  tooltip = '',
  loading = false,
}) {
  if (loading) {
    return kpiSkeletonCardHTML(id);
  }

  const isEmpty = value == null || value === '' || value === undefined || (typeof value === 'number' && isNaN(value));
  const displayValue = isEmpty ? '<span class="kpi-empty-val">—</span>' : value;

  const infoIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  return `
    <div class="kpi-card" id="${id}">
      <div class="kpi-header">
        <span class="kpi-title">${title}</span>
        ${tooltip ? `
          <span class="kpi-info"
                tabindex="0"
                role="button"
                aria-label="${escapeHtml(tooltip)}"
                title="${escapeHtml(tooltip)}">
            ${infoIcon}
            <span class="kpi-tooltip-bubble" role="tooltip">${escapeHtml(tooltip)}</span>
          </span>
        ` : ''}
      </div>
      <div class="kpi-value ${valueClass}">${displayValue}</div>
      ${footerHtml ? `<div class="kpi-footer">${footerHtml}</div>` : ''}
    </div>
  `;
}

/**
 * Optional keyboard event listener binder for KPI tooltips (Escape key dismissal).
 * @param {HTMLElement} [container=document]
 */
export function initKpiTooltips(container = document) {
  container.querySelectorAll('.kpi-info').forEach(el => {
    el.addEventListener('focus', () => {
      el.classList.add('is-focused');
    });
    el.addEventListener('blur', () => {
      el.classList.remove('is-focused');
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        el.blur();
      }
    });
  });
}
