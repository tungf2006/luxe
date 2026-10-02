/**
 * @file Accounts feature module.
 * Renders the accounts page with account cards.
 */

import dataService from '../../services/dataAdapter.js';
import { formatCurrency, formatCompactCurrency, escapeHtml, getActiveCurrency } from '../../utils/format.js';
import { DonutChart, initDonutChart } from '../../components/charts/DonutChart.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { showToast } from '../../components/ui/Toast.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { getRoute } from '../../config/routes.js';
import { getBankAvatarInfo, getBankAvatarHtml } from '../../constants/banks.js';

const ICONS = {

  wallet: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  credit: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/>',
  savings: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
};

function kpiIcon(pathFrag) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathFrag}</svg>`;
}

function extractLast4(account) {
  if (account.account_number) {
    const s = String(account.account_number).trim();
    return s.length >= 4 ? s.slice(-4) : s;
  }
  if (account.accountNumber) {
    const s = String(account.accountNumber).trim();
    return s.length >= 4 ? s.slice(-4) : s;
  }
  const numMatch = (account.name || '').match(/(\d{4})(?!\d)/);
  if (numMatch) return numMatch[1];
  return null;
}

function accountCardHTML(account) {
  const typeMap = {
    checking: 'Thanh toán',
    savings: 'Tiết kiệm',
    credit: 'Thẻ tín dụng',
    cash: 'Tiền mặt',
    wallet: 'Ví điện tử',
    ewallet: 'Ví điện tử',
  };
  const typeLabel = typeMap[account.type] || account.type || 'Tài khoản';
  const avatar = getBankAvatarInfo(account.name);
  const balanceClass = account.balance >= 0 ? 'highlight-positive' : 'highlight-negative';
  const currencyBadge = account.currency || getActiveCurrency();
  const last4 = extractLast4(account);

  return `
    <div class="account-card" id="account-card-${account.id}" style="background: radial-gradient(circle at top left, ${avatar.bg}14 0%, rgba(255, 255, 255, 0.02) 65%), var(--bg-surface); border-color: ${avatar.bg}33;">
      <div class="account-card-header">
        <div class="account-card-main">
          ${getBankAvatarHtml(account.name, 'md', 'account-card-avatar')}
          <div class="account-info">
            <div class="account-name" title="${escapeHtml(account.name)}">${escapeHtml(account.name)}</div>
            <div class="account-meta-row">
              <span class="account-type-badge ${escapeHtml(account.type || '')}">${escapeHtml(typeLabel)}</span>
              ${last4 ? `<span class="account-number-pill" title="Số tài khoản kết thúc bằng ${escapeHtml(last4)}">•••• ${escapeHtml(last4)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="account-actions">
          <button class="account-menu-btn" data-action="toggle-menu" aria-label="Tùy chọn tài khoản" aria-expanded="false" aria-controls="account-menu-${account.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
          <div class="account-menu-dropdown" id="account-menu-${account.id}" role="menu">
            <button class="account-menu-item" data-action="edit-account" data-account-id="${account.id}" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Sửa
            </button>
            <div class="account-menu-divider"></div>
            <button class="account-menu-item danger" data-action="delete-account" data-account-id="${account.id}" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Xoá
            </button>
          </div>
        </div>
      </div>
      <div class="account-balance ${balanceClass}">
        ${account.balance < 0 ? '-' : ''}${formatCurrency(Math.abs(account.balance), currencyBadge)}
        <span class="account-currency-badge" aria-label="${currencyBadge}">${currencyBadge}</span>
      </div>
    </div>
  `;
}

function accountsSummaryHTML(accounts) {
  const total = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const count = accounts.length;

  return `
    <div class="kpi-grid" id="accounts-kpi-grid" style="margin-bottom:2rem;">
      <div class="kpi-card" id="account-kpi-total">
        <div class="kpi-header">
          <span class="kpi-title">Tổng số dư</span>
          <span class="kpi-icon-badge" aria-hidden="true">${kpiIcon(ICONS.wallet)}</span>
        </div>
        <div class="kpi-value ${total >= 0 ? 'highlight-positive' : 'highlight-negative'}">${formatCompactCurrency(total)}</div>
        <div class="kpi-footer"><span class="trend-label">tất cả tài khoản</span></div>
      </div>
      <div class="kpi-card" id="account-kpi-count">
        <div class="kpi-header">
          <span class="kpi-title">Số tài khoản</span>
          <span class="kpi-icon-badge" aria-hidden="true">${kpiIcon(ICONS.credit)}</span>
        </div>
        <div class="kpi-value">${count}</div>
        <div class="kpi-footer"><span class="trend-label">đang liên kết</span></div>
      </div>
    </div>
  `;
}

function emptyStateHTML() {
  return `
    <div class="glass-panel" style="padding:3rem;text-align:center;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.3" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/></svg>
      <p style="color:var(--text-muted);margin-bottom:1rem;">Chưa có tài khoản nào. Thêm tài khoản để bắt đầu theo dõi số dư.</p>
      <button class="btn-add-transaction" data-action="add-account" aria-label="Thêm tài khoản đầu tiên">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Thêm tài khoản đầu tiên
      </button>
    </div>
  `;
}

const ACCOUNT_CHART_COLORS = ['#22C55E', '#38BDF8', '#F59E0B', '#A78BDA', '#F43F5E', '#14B8A3'];

function balanceChartHTML(accounts, currency) {
  const positive = accounts.filter(a => (a.balance || 0) > 0);
  const chartTotal = positive.reduce((sum, a) => sum + (a.balance || 0), 0);
  const chartData = positive.map((a, i) => {
    const avatar = getBankAvatarInfo(a.name);
    return {
      label: a.name,
      value: a.balance,
      color: ACCOUNT_CHART_COLORS[i % ACCOUNT_CHART_COLORS.length],
      avatar,
    };
  });
  const donutHtml = DonutChart({
    data: chartData,
    totalLabel: formatCurrency(chartTotal, currency),
    totalSub: 'TỔNG SỐ DƯ',
    currency: currency,
    size: 200,
  });
  return `
    <div class="glass-panel" id="account-balance-chart-panel">
      ${panelHeaderHTML({
        title: 'Phân bổ số dư',
        subtitle: 'Tỷ lệ giữa các tài khoản',
        iconSvg: ICONS.wallet,
      })}
      <div class="account-balance-chart">
        ${donutHtml}
      </div>
    </div>
  `;
}

export async function render(container, page = 'accounts') {
  const route = getRoute(page);
  const accounts = await dataService.getAccounts();
  const currency = getActiveCurrency();

  container.innerHTML = `
    ${pageHeaderHTML({
      title: route.title,
      description: route.description,
      actionHTML: `
        <button class="btn-add-transaction" data-action="add-account" aria-label="Thêm tài khoản">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Thêm tài khoản
        </button>
      `,
    })}
    ${accounts.length === 0 ? emptyStateHTML() : `

      ${accountsSummaryHTML(accounts)}
      ${balanceChartHTML(accounts, currency)}
      <div class="accounts-grid" id="accounts-grid">
        ${accounts.map(account => accountCardHTML(account)).join('')}
      </div>
    `}
  `;

  initDonutChart(container, currency);
  attachListeners(container);
}

function attachListeners(container) {
  container.addEventListener('click', e => {
    if (e.target.closest('[data-action="add-account"]')) {
      showToast('Tính năng thêm tài khoản sẽ sớm được ra mắt.', 'info');
      return;
    }

    // Toggle account menu dropdown
    const menuBtn = e.target.closest('[data-action="toggle-menu"]');
    if (menuBtn) {
      const card = menuBtn.closest('.account-card');
      const menuId = menuBtn.getAttribute('aria-controls');
      const dropdown = card?.querySelector(`#${menuId}`);
      if (dropdown) {
        const isOpen = dropdown.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', isOpen);
      }
      return;
    }

    // Close dropdowns when clicking outside
    if (!e.target.closest('.account-menu-dropdown')) {
      container.querySelectorAll('.account-menu-dropdown.open').forEach(d => d.classList.remove('open'));
      container.querySelectorAll('[data-action="toggle-menu"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    }

    // Edit account
    if (e.target.closest('[data-action="edit-account"]')) {
      const btn = e.target.closest('[data-action="edit-account"]');
      const accountId = btn.dataset.accountId;
      showToast(`Sửa tài khoản ${accountId} - tính năng sẽ sớm ra mắt.`, 'info');
      return;
    }

    // Delete account
    if (e.target.closest('[data-action="delete-account"]')) {
      const btn = e.target.closest('[data-action="delete-account"]');
      const accountId = btn.dataset.accountId;
      showToast(`Xoá tài khoản ${accountId} - tính năng sẽ sớm ra mắt.`, 'info');
      return;
    }
  });
}

export default { render };

