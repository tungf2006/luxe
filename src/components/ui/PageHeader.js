import { escapeHtml } from '../../utils/format.js';

export function pageHeaderHTML({ title, description, actionHTML }) {
  const hasAction = Boolean(actionHTML);
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-header-title">${escapeHtml(title)}</h1>
        ${description ? `<p class="page-header-desc">${escapeHtml(description)}</p>` : ''}
      </div>
      ${hasAction ? `<div class="page-header-actions">${actionHTML}</div>` : ''}
    </div>
  `;
}
