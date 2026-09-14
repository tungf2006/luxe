/**
 * @file Budgets feature module.
 * Renders the budgets page: summary KPIs and budget cards grid.
 */

import dataService from '../../services/dataService.js';
import { kpiCardHTML } from '../../components/ui/KPICard.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { formatCurrency, escapeHtml } from '../../utils/format.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';
import { CATEGORY_MAP } from '../../constants/categories.js';

/* --------------------------------------------------------------- *
 * SVG icon fragments
 * --------------------------------------------------------------- */
const ICONS = {
  wallet:  '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  target:  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  spark:   '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  grid:    '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" h2="9"/><line x1="9" y1="15" h2="9"/>',
};

function kpiIcon(pathFrag) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathFrag}</svg>`;
}

/* --------------------------------------------------------------- *
 * HTML builders
 * --------------------------------------------------------------- */
function pageBannerHTML() {
  return `
    <div class="page-title-banner">
      <div>
         <h2>Ngân sách</h2>
         <p>Theo dõi và kiểm soát giới hạn chi tiêu của bạn</p>
      </div>
        <button class="btn-add-transaction" data-action="add-budget" aria-label="Đặt ngân sách mới">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Đặt ngân sách mới
        </button>
    </div>
  `;
}

function budgetSummaryKPIsHTML(budgets) {
  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const remaining = totalBudget - totalSpent;
  const pctUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return `
    <div class="kpi-grid" id="budget-kpi-grid" style="margin-bottom:2rem;">
      ${kpiCardHTML({
        id: 'budget-kpi-total',
         title: 'Tổng ngân sách',
         value: formatCurrency(totalBudget),
         iconSvg: kpiIcon(ICONS.wallet),
         footerHtml: '<span class="trend-label">trong tháng</span>',
      })}
      ${kpiCardHTML({
        id: 'budget-kpi-spent',
         title: 'Tổng chi',
         value: formatCurrency(totalSpent),
         valueClass: 'highlight-negative',
         iconSvg: kpiIcon(ICONS.target),
         footerHtml: `<span class="trend-badge trend-positive">${pctUsed}%</span><span class="trend-label">của ngân sách</span>`,
      })}
      ${kpiCardHTML({
        id: 'budget-kpi-remaining',
         title: 'Còn lại',
         value: formatCurrency(remaining),
         valueClass: remaining >= 0 ? 'highlight-positive' : 'highlight-negative',
         iconSvg: kpiIcon(ICONS.spark),
         footerHtml: `<span class="trend-label">${remaining >= 0 ? 'còn lại' : 'vượt ngân sách'}</span>`,
      })}
      ${kpiCardHTML({
        id: 'budget-kpi-categories',
         title: 'Danh mục',
        value: String(budgets.length),
        iconSvg: kpiIcon(ICONS.grid),
        footerHtml: '<span class="trend-label">ngân sách đang hoạt động</span>',
      })}
    </div>
  `;
}

function budgetCardsHTML(budgets) {
  if (budgets.length === 0) {
    return `
      <div class="glass-panel" style="padding:3rem;text-align:center;color:var(--text-muted);">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.4" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
         <p>Chưa có ngân sách nào. Tạo một ngân sách để bắt đầu theo dõi.</p>
      </div>
    `;
  }

  return `
    <div class="budget-cards-grid" id="budget-cards-grid">
      ${budgets.map(b => {
        const pct = Math.min(Math.round((b.spent / b.limit) * 100), 100);
        const remaining = b.limit - b.spent;
        const cls = pct >= 80 ? 'warning' : pct <= 50 ? 'safe' : '';
        const statusColor = pct >= 80 ? 'var(--negative)' : pct <= 50 ? 'var(--positive)' : 'var(--text-secondary)';
        const remainingColor = remaining >= 0 ? 'var(--positive)' : 'var(--negative)';
        const remainingText = remaining >= 0 ? `Còn ${formatCurrency(remaining)}` : `Vượt ngân sách ${formatCurrency(Math.abs(remaining))}`;

        return `
          <div class="budget-overview-card" id="budget-card-${b.id}">
            <div class="budget-card-top">
              <span class="budget-card-title">
                ${b.icon} ${escapeHtml(CATEGORY_MAP[b.category]?.name || b.category)}
              </span>
              <span style="font-size:0.8rem;font-weight:600;color:${statusColor};">${pct}% đã dùng</span>
            </div>

            <div style="margin-bottom:0.5rem;">
                <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${CATEGORY_MAP[b.category]?.name || b.category} ngân sách ${pct}% đã dùng">
                <div class="progress-fill ${cls}" style="width:${pct}%;${!cls ? 'background:' + b.color : ''}"></div>
              </div>
            </div>

            <div class="budget-spend-numbers">
              <div>
           <div style="font-family:var(--font-display);font-size:1.35rem;font-weight:700;">${formatCurrency(b.spent)}</div>
           <div style="font-size:0.775rem;color:var(--text-muted);">trong ngân sách ${formatCurrency(b.limit)}</div>
              </div>
              <div style="text-align:right;">
                   <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:600;color:${remainingColor};">${formatCurrency(remaining >= 0 ? remaining : -Math.abs(remaining))}</div>
                 <div style="font-size:0.775rem;color:var(--text-muted);">${remaining >= 0 ? 'còn lại' : 'vượt ngân sách'}</div>
              </div>
            </div>

            ${pct >= 80 ? `
            <div class="insight-card" style="margin-top:0.75rem;padding:0.75rem;gap:0.6rem;">
              <span style="font-size:1rem;" aria-hidden="true">⚠️</span>
               <p style="font-size:0.8rem;color:var(--text-primary);">Gần giới hạn — chỉ còn ${formatCurrency(remaining)} cho ${escapeHtml(CATEGORY_MAP[b.category]?.name || b.category)} trong tháng này.</p>
            </div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Main render
 * --------------------------------------------------------------- */
export async function render(container) {
  const budgets = await dataService.getBudgets();

  container.innerHTML = `
    ${pageBannerHTML()}
    ${budgetSummaryKPIsHTML(budgets)}
    ${budgetCardsHTML(budgets)}
  `;

  attachListeners(container);
}

/* --------------------------------------------------------------- *
 * Event listeners
 * --------------------------------------------------------------- */
function attachListeners(container) {
  // Set New Budget button (placeholder for future full implementation)
  container.addEventListener('click', e => {
    if (e.target.closest('[data-action="add-budget"]')) {
       showToast('Tính năng tạo ngân sách sẽ sớm được ra mắt.', 'info');
    }
  });
}

export default { render };
