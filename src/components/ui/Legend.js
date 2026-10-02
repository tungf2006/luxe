/**
 * @file Legend — shared donut legend component.
 */

import { escapeHtml, formatCurrency } from '../../utils/format.js';

/**
 * Render a vertical donut legend.
 * @param {Array<{label:string, value:number, color?:string, pct:number, formattedValue?:string, avatar?:{initial:string, bg:string, textColor:string}, subItems?:Array}>} items
 * @param {string} [currency='VND']
 * @returns {string}
 */
export function DonutLegend(items, currency = 'VND') {
  if (!items || items.length === 0) return '';

  return `
    <div class="donut-legend" role="list" aria-label="Chỉ mục danh mục">
      ${items.map((item, i) => {
        const formattedAmount = item.formattedValue || formatCurrency(item.value, currency);
        const subItemsJson = item.subItems ? escapeHtml(JSON.stringify(item.subItems)) : '';
        const ariaLabelText = `${item.label}: ${formattedAmount} (${item.pct.toFixed(1)}%)`;

        return `
        <button
          type="button"
          class="legend-item"
          data-index="${i}"
          data-label="${escapeHtml(item.label)}"
          data-value="${item.value}"
          data-pct="${item.pct.toFixed(1)}"
          ${subItemsJson ? `data-subitems="${subItemsJson}"` : ''}
          role="listitem"
          tabindex="0"
          aria-label="${escapeHtml(ariaLabelText)}"
        >
          ${item.avatar ? `
            <span class="account-avatar legend-avatar" style="background:${item.avatar.bg};color:${item.avatar.textColor};" aria-hidden="true">${escapeHtml(item.avatar.initial)}</span>
          ` : `
            <span class="legend-color" style="background:${item.color || 'var(--accent-brand)'};" aria-hidden="true"></span>
          `}
          <div class="legend-info">
            <span class="legend-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
            <span class="legend-value">
              <span class="legend-amount">${escapeHtml(formattedAmount)}</span>
              <span class="legend-pct">${item.pct.toFixed(1)}%</span>
            </span>
          </div>
        </button>
      `;
      }).join('')}
    </div>
  `;
}

