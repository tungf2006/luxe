/**
 * @file UIStates.js - Secondary UI States (Loading, Empty, Error)
 */

export function renderKpiSkeleton() {
  return `
    <div class="kpi-card skeleton-shimmer" style="height: 120px; border-radius: var(--radius-md);">
      <div class="kpi-skeleton-title" style="width: 40%; height: 16px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-bottom: 12px;"></div>
      <div class="kpi-skeleton-value" style="width: 70%; height: 32px; background: rgba(255,255,255,0.1); border-radius: 4px;"></div>
    </div>
  `;
}

export function renderTableSkeleton(rows = 3) {
  let html = '<div class="table-skeleton">';
  for (let i = 0; i < rows; i++) {
    html += `
      <div class="skeleton-shimmer" style="height: 48px; border-radius: var(--radius-sm); margin-bottom: 8px; background: rgba(255,255,255,0.05);"></div>
    `;
  }
  html += '</div>';
  return html;
}

export function renderChartSkeleton() {
  return `
    <div class="chart-skeleton skeleton-shimmer" style="height: 250px; border-radius: var(--radius-md); background: rgba(255,255,255,0.05);"></div>
  `;
}

export function renderEmptyState({ icon = 'svg', title = 'Không có dữ liệu', description = 'Chưa có thông tin để hiển thị.', actionText = '', actionId = '' }) {
  let actionHtml = '';
  if (actionText && actionId) {
    actionHtml = `<button type="button" class="btn btn-primary" id="${actionId}" style="margin-top: 16px;">${actionText}</button>`;
  }
  return `
    <div class="empty-state">
      <div class="empty-state-icon" style="margin-bottom: 16px; opacity: 0.5;">
        ${icon === 'svg' ? '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>' : icon}
      </div>
      <h3 class="empty-state-title" style="margin-bottom: 8px; color: var(--text-primary); font-size: 1.1rem;">${title}</h3>
      <p class="empty-state-description" style="color: var(--text-muted); font-size: 0.9rem;">${description}</p>
      ${actionHtml}
    </div>
  `;
}

export function renderErrorState({ message = 'Đã có lỗi xảy ra', onRetryId = '' }) {
  let retryHtml = '';
  if (onRetryId) {
    retryHtml = `<button type="button" class="btn btn-secondary" id="${onRetryId}" style="margin-top: 16px;">Thử lại</button>`;
  }
  return `
    <div class="error-state" style="padding: 24px; text-align: center; background: var(--negative-bg); border: 1px solid var(--negative-border); border-radius: var(--radius-md);">
      <div style="color: var(--negative); margin-bottom: 12px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
      <h3 style="color: var(--text-primary); margin-bottom: 8px;">Không thể tải dữ liệu</h3>
      <p style="color: var(--text-muted); margin-bottom: 0;">${message}</p>
      ${retryHtml}
    </div>
  `;
}
