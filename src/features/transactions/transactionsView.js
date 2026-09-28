/**
 * @file Transactions feature module.
 * Renders the full transactions list with search, type/category/month/status
 * filters, multi-column sort, URL query state sync, checkboxes & floating bulk actions,
 * confirmation modal + undo toast delete flow, 3-dots action menu, empty state, and responsive card list.
 */

import dataService, { computeTotals } from '../../services/dataService.js';
import { escapeHtml, formatAmount, formatCurrency, formatDateLong, formatDateGroupHeader, formatMonthYear } from '../../utils/format.js';
import { CATEGORIES, CATEGORY_MAP, CATEGORY_ICONS, getCategoryLabelVi } from '../../constants/categories.js';
import { showToast, showToastWithAction } from '../../components/ui/Toast.js';
import { statusBadgeHTML, merchantCellHTML, categoryTagHTML, actionDropdownHTML, paymentMethodHTML } from '../../components/ui/TransactionCells.js';
import { showConfirmModal, showCategorySelectModal } from '../../components/ui/ConfirmModal.js';
import { edit as editTransaction } from './transactionForm.js';
import { emit } from '../../utils/eventBus.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { getRoute } from '../../config/routes.js';

/* --------------------------------------------------------------- *
 * Module-level state (preserved & synced with URL query)
 * --------------------------------------------------------------- */
const TX_PER_PAGE = 8;
let txPage = 1;
let txFilters = { search: '', type: '', category: '', month: '', status: '', payment_method: '' };
let _sortField = 'date';
let _sortDir = 'desc';
let _transactions = [];
let selectedTxIds = new Set();
let undoBackupTx = null;

/* --------------------------------------------------------------- *
 * URL Query Sync Helpers
 * --------------------------------------------------------------- */
function readUrlParams() {
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return;

  const params = new URLSearchParams(hash.slice(qIdx));
  if (params.has('search')) txFilters.search = params.get('search');
  if (params.has('type')) txFilters.type = params.get('type');
  if (params.has('category')) txFilters.category = params.get('category');
  if (params.has('month')) txFilters.month = params.get('month');
  if (params.has('status')) txFilters.status = params.get('status');
  if (params.has('payment_method')) txFilters.payment_method = params.get('payment_method');
  if (params.has('sort')) _sortField = params.get('sort');
  if (params.has('dir')) _sortDir = params.get('dir');
  if (params.has('page')) txPage = parseInt(params.get('page'), 10) || 1;
}

function updateUrlParams() {
  const params = new URLSearchParams();
  if (txFilters.search) params.set('search', txFilters.search);
  if (txFilters.type) params.set('type', txFilters.type);
  if (txFilters.category) params.set('category', txFilters.category);
  if (txFilters.month) params.set('month', txFilters.month);
  if (txFilters.status) params.set('status', txFilters.status);
  if (txFilters.payment_method) params.set('payment_method', txFilters.payment_method);
  if (_sortField !== 'date') params.set('sort', _sortField);
  if (_sortDir !== 'desc') params.set('dir', _sortDir);
  if (txPage > 1) params.set('page', String(txPage));

  const queryString = params.toString();
  const baseHash = '#transactions';
  const newHash = queryString ? `${baseHash}?${queryString}` : baseHash;

  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash);
  }
}

/* --------------------------------------------------------------- *
 * Filtering & sorting
 * --------------------------------------------------------------- */
function getFilteredTx() {
  return _transactions.filter(tx => {
    const search = txFilters.search.toLowerCase();
    const matchSearch = !search ||
      tx.merchant.toLowerCase().includes(search) ||
      tx.category.toLowerCase().includes(search);
    const matchType = !txFilters.type || tx.type === txFilters.type;
    const matchCat = !txFilters.category || tx.category === txFilters.category;
    const matchMonth = !txFilters.month || tx.date.startsWith(txFilters.month);
    const matchStatus = !txFilters.status || tx.status === txFilters.status;
    const matchPayment = !txFilters.payment_method || tx.payment_method === txFilters.payment_method;
    return matchSearch && matchType && matchCat && matchMonth && matchStatus && matchPayment;
  }).sort((a, b) => {
    let cmp = 0;
    if (_sortField === 'date') {
      cmp = new Date(b.date) - new Date(a.date);
    } else if (_sortField === 'amount') {
      cmp = Number(b.amount) - Number(a.amount);
    } else if (_sortField === 'merchant') {
      cmp = String(a.merchant).localeCompare(String(b.merchant));
    } else if (_sortField === 'category') {
      cmp = String(a.category).localeCompare(String(b.category));
    } else if (_sortField === 'status') {
      cmp = String(a.status).localeCompare(String(b.status));
    } else if (_sortField === 'payment_method') {
      cmp = String(a.payment_method || '').localeCompare(String(b.payment_method || ''));
    } else {
      cmp = String(a[_sortField] || '').localeCompare(String(b[_sortField] || ''));
    }
    return _sortDir === 'desc' ? cmp : -cmp;
  });
}

function resetFilters() {
  txFilters = { search: '', type: '', category: '', month: '', status: '', payment_method: '' };
  txPage = 1;
  _sortField = 'date';
  _sortDir = 'desc';
  selectedTxIds.clear();
  updateUrlParams();
}

/* --------------------------------------------------------------- *
 * HTML Builders
 * --------------------------------------------------------------- */
const SUMMARY_ICONS = {
  income: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  expense: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
  net: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="16" y1="12" x2="8" y2="12"/>',
};

function summaryIcon(pathFrag) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathFrag}</svg>`;
}

function summaryCardsHTML() {
  const totals = computeTotals(getFilteredTx());
  const netClass = totals.net >= 0 ? 'highlight-positive' : 'highlight-negative';
  return `
    <div class="kpi-grid" id="tx-summary-grid" style="margin-bottom:1.5rem;">
      <div class="kpi-card" id="tx-summary-income">
        <div class="kpi-header">
          <span class="kpi-title">Tổng thu</span>
          <span class="kpi-icon-badge" aria-hidden="true">${summaryIcon(SUMMARY_ICONS.income)}</span>
        </div>
        <div class="kpi-value highlight-positive" id="tx-summary-income-value">${formatAmount(totals.income, 'income')}</div>
        <div class="kpi-footer"><span class="trend-label">theo bộ lọc</span></div>
      </div>
      <div class="kpi-card" id="tx-summary-expense">
        <div class="kpi-header">
          <span class="kpi-title">Tổng chi</span>
          <span class="kpi-icon-badge" aria-hidden="true">${summaryIcon(SUMMARY_ICONS.expense)}</span>
        </div>
        <div class="kpi-value highlight-negative" id="tx-summary-expense-value">${formatAmount(totals.expenses, 'expense')}</div>
        <div class="kpi-footer"><span class="trend-label">theo bộ lọc</span></div>
      </div>
      <div class="kpi-card" id="tx-summary-net">
        <div class="kpi-header">
          <span class="kpi-title">Số dư ròng</span>
          <span class="kpi-icon-badge" aria-hidden="true">${summaryIcon(SUMMARY_ICONS.net)}</span>
        </div>
        <div class="kpi-value ${netClass}" id="tx-summary-net-value">${formatAmount(totals.net, totals.net >= 0 ? 'income' : 'expense')}</div>
        <div class="kpi-footer"><span class="trend-label">thu – chi</span></div>
      </div>
    </div>
  `;
}

function updateSummary(container) {
  const totals = computeTotals(getFilteredTx());
  const incomeEl = container.querySelector('#tx-summary-income-value');
  const expenseEl = container.querySelector('#tx-summary-expense-value');
  const netEl = container.querySelector('#tx-summary-net-value');
  if (incomeEl) incomeEl.textContent = formatAmount(totals.income, 'income');
  if (expenseEl) expenseEl.textContent = formatAmount(totals.expenses, 'expense');
  if (netEl) {
    netEl.textContent = formatAmount(totals.net, totals.net >= 0 ? 'income' : 'expense');
    netEl.classList.toggle('highlight-positive', totals.net >= 0);
    netEl.classList.toggle('highlight-negative', totals.net < 0);
  }
}

function monthOptionsHTML(transactions) {
  const months = [...new Set(transactions.map(tx => tx.date.slice(0, 7)))]
    .sort().reverse();
  return '<option value="">Tất cả tháng</option>' +
    months.map(m => {
      const d = new Date(m + '-01');
      const label = formatMonthYear(d.toISOString().slice(0, 10));
      return `<option value="${m}" ${txFilters.month === m ? 'selected' : ''}>${label}</option>`;
    }).join('');
}

function filterBarHTML() {
  return `
    <div class="tx-filter-bar" style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.5rem;">
      <div class="search-input-box" role="search" style="flex:1;min-width:200px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="search" id="tx-search" value="${escapeHtml(txFilters.search)}" placeholder="Tìm kiếm giao dịch…" aria-label="Tìm kiếm giao dịch" />
      </div>
      <select class="select-dropdown" id="tx-filter-type" aria-label="Lọc theo loại">
        <option value="">Tất cả loại</option>
        <option value="income" ${txFilters.type === 'income' ? 'selected' : ''}>Thu nhập</option>
        <option value="expense" ${txFilters.type === 'expense' ? 'selected' : ''}>Chi phí</option>
      </select>
      <select class="select-dropdown" id="tx-filter-category" aria-label="Lọc theo danh mục">
        <option value="">Tất cả danh mục</option>
        ${CATEGORIES.map(c => `<option value="${c.id}" ${txFilters.category === c.id ? 'selected' : ''}>${escapeHtml(c.labelVi)}</option>`).join('')}
      </select>
      <select class="select-dropdown" id="tx-filter-payment" aria-label="Lọc theo phương thức">
        <option value="">Tất cả phương thức</option>
        <option value="cash" ${txFilters.payment_method === 'cash' ? 'selected' : ''}>Tiền mặt</option>
        <option value="card" ${txFilters.payment_method === 'card' ? 'selected' : ''}>Thẻ</option>
        <option value="transfer" ${txFilters.payment_method === 'transfer' ? 'selected' : ''}>Chuyển khoản</option>
        <option value="ewallet" ${txFilters.payment_method === 'ewallet' ? 'selected' : ''}>Ví điện tử</option>
      </select>
      <select class="select-dropdown" id="tx-filter-status" aria-label="Lọc theo trạng thái">
        <option value="">Tất cả trạng thái</option>
        <option value="completed" ${txFilters.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
        <option value="pending" ${txFilters.status === 'pending' ? 'selected' : ''}>Đang chờ</option>
        <option value="failed" ${txFilters.status === 'failed' ? 'selected' : ''}>Thất bại</option>
        <option value="cancelled" ${txFilters.status === 'cancelled' ? 'selected' : ''}>Đã huỷ</option>
      </select>
      <select class="select-dropdown" id="tx-filter-month" aria-label="Lọc theo tháng">
        ${monthOptionsHTML(_transactions)}
      </select>
    </div>
  `;
}

function renderSortIndicator(field) {
  const isCurrent = _sortField === field;
  const dirIcon = isCurrent ? (_sortDir === 'desc' ? '↓' : '↑') : '↕';
  return `<span class="sort-icon" aria-hidden="true">${dirIcon}</span>`;
}

function tableHTML() {
  return `
    <div class="glass-panel" style="padding:0;overflow:hidden;position:relative;">
      <div class="transactions-table-wrapper">
        <table class="luxe-table" id="all-tx-table" aria-label="Tất cả giao dịch">
          <thead>
            <tr>
              <th scope="col" style="width:40px;text-align:center;">
                <input type="checkbox" id="tx-select-all" class="tx-select-all" title="Chọn tất cả trang này" />
              </th>
              <th scope="col" data-sort="merchant" aria-sort="${_sortField === 'merchant' ? (_sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}">
                Người thu ${renderSortIndicator('merchant')}
              </th>
              <th scope="col" data-sort="category" aria-sort="${_sortField === 'category' ? (_sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}">
                Danh mục ${renderSortIndicator('category')}
              </th>
              <th scope="col" data-sort="date" aria-sort="${_sortField === 'date' ? (_sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}">
                Ngày ${renderSortIndicator('date')}
              </th>
              <th scope="col" data-sort="payment_method" aria-sort="${_sortField === 'payment_method' ? (_sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}">
                Phương thức ${renderSortIndicator('payment_method')}
              </th>
              <th scope="col" data-sort="status" aria-sort="${_sortField === 'status' ? (_sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}">
                Trạng thái ${renderSortIndicator('status')}
              </th>
              <th scope="col" style="text-align:right;" data-sort="amount" aria-sort="${_sortField === 'amount' ? (_sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}">
                Số tiền ${renderSortIndicator('amount')}
              </th>
              <th scope="col" style="text-align:center;width:80px;">Hành động</th>
            </tr>
          </thead>
          <tbody id="all-tx-tbody">
            <!-- Populated by renderTableBody() -->
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards View (<768px) -->
      <div class="tx-mobile-cards" id="all-tx-cards"></div>

      <!-- Empty State -->
      <div id="tx-empty-state" class="empty-state" style="display:none;padding:3rem 1.5rem;text-align:center;">
        <div class="empty-state-content">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.4;" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <h4 style="margin-bottom:0.5rem;color:var(--text-primary);">Không có giao dịch phù hợp</h4>
          <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.25rem;">Thử thay đổi từ khóa hoặc bộ lọc của bạn.</p>
          <button type="button" class="btn-secondary" id="btn-reset-filters">Xóa bộ lọc</button>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem;border-top:1px solid var(--border-subtle);">
        <span id="tx-count-label" style="font-size:0.8rem;color:var(--text-muted);"></span>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <button class="btn-secondary" id="tx-prev-page" aria-label="Trang trước">← Trước</button>
          <span id="tx-page-indicator" style="padding:0.4rem 0.75rem;font-size:0.85rem;color:var(--text-secondary);"></span>
          <button class="btn-secondary" id="tx-next-page" aria-label="Trang sau">Sau →</button>
        </div>
      </div>
    </div>

    <!-- Floating Bulk Action Bar -->
    <div class="floating-bulk-bar" id="floating-bulk-bar">
      <span class="bulk-bar-count" id="bulk-bar-count">Đã chọn 0 giao dịch</span>
      <div class="bulk-bar-actions">
        <button type="button" class="btn-secondary" id="btn-bulk-category" style="font-size:0.8rem;padding:0.4rem 0.75rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
          Đổi danh mục
        </button>
        <button type="button" class="btn-secondary" id="btn-bulk-export" style="font-size:0.8rem;padding:0.4rem 0.75rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Xuất CSV
        </button>
        <button type="button" class="btn-danger" id="btn-bulk-delete" style="font-size:0.8rem;padding:0.4rem 0.75rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Xóa đã chọn
        </button>
        <button type="button" class="btn-secondary" id="btn-bulk-deselect" aria-label="Bỏ chọn" style="padding:0.4rem 0.6rem;font-size:0.8rem;">✕</button>
      </div>
    </div>
  `;
}

function renderTableBody(container) {
  updateSummary(container);
  updateUrlParams();

  const filtered = getFilteredTx();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / TX_PER_PAGE));
  if (txPage > totalPages) txPage = totalPages;
  const paged = filtered.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  const tbody = container.querySelector('#all-tx-tbody');
  const cardsContainer = container.querySelector('#all-tx-cards');
  const emptyState = container.querySelector('#tx-empty-state');
  const selectAll = container.querySelector('#tx-select-all');

  if (selectAll) {
    const pagedIds = paged.map(t => t.id);
    selectAll.checked = pagedIds.length > 0 && pagedIds.every(id => selectedTxIds.has(id));
  }

  if (!tbody) return;

  if (paged.length === 0) {
    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
  } else {
    if (emptyState) emptyState.style.display = 'none';

    // 1. Desktop Table Rows
    const rows = [];
    let currentDate = null;

    for (const tx of paged) {
      if (tx.date !== currentDate) {
        currentDate = tx.date;
        const headerText = formatDateGroupHeader(currentDate);
        const tooltip = formatDateLong(currentDate);
        rows.push(`
          <tr class="tx-date-header" data-date="${currentDate}">
            <td colspan="8" class="tx-date-header-cell" title="${escapeHtml(tooltip)}">
              <span>${escapeHtml(headerText)}</span>
            </td>
          </tr>
        `);
      }

      const isSelected = selectedTxIds.has(tx.id);
      rows.push(`
        <tr id="tx-row-${tx.id}" class="${isSelected ? 'selected-row' : ''}">
          <td style="text-align:center;">
            <input type="checkbox" class="tx-checkbox" data-id="${tx.id}" ${isSelected ? 'checked' : ''} />
          </td>
          <td>${merchantCellHTML(tx)}</td>
          <td>${categoryTagHTML(tx.category)}</td>
          <td style="color:var(--text-secondary);font-size:0.85rem;">${tx.date}</td>
          <td>${paymentMethodHTML(tx.payment_method)}</td>
          <td>${statusBadgeHTML(tx.status)}</td>
          <td class="table-amount ${tx.type === 'income' ? 'highlight-positive' : 'highlight-negative'}">
            ${formatAmount(tx.amount, tx.type)}
          </td>
          <td style="text-align:center;">
            ${actionDropdownHTML(tx.id, 'tx')}
          </td>
        </tr>
      `);
    }

    tbody.innerHTML = rows.join('');

    // 2. Mobile Responsive Cards (<768px)
    if (cardsContainer) {
      cardsContainer.innerHTML = paged.map(tx => {
        const isSelected = selectedTxIds.has(tx.id);
        const icon = CATEGORY_ICONS[tx.category] || '📦';
        const amountClass = tx.type === 'income' ? 'highlight-positive' : 'highlight-negative';
        return `
          <div class="tx-card ${isSelected ? 'selected' : ''}" id="tx-card-${tx.id}">
            <div class="tx-card-header">
              <div style="display:flex;align-items:center;gap:0.6rem;">
                <input type="checkbox" class="tx-checkbox" data-id="${tx.id}" ${isSelected ? 'checked' : ''} />
                <span style="font-size:1.2rem;" aria-hidden="true">${icon}</span>
                <span class="tx-card-title">${escapeHtml(tx.merchant)}</span>
              </div>
              ${actionDropdownHTML(tx.id, 'tx')}
            </div>
            <div class="tx-card-sub">
              ${categoryTagHTML(tx.category)}
              <span>•</span>
              <span>${tx.date}</span>
            </div>
            <div class="tx-card-footer">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                ${paymentMethodHTML(tx.payment_method)}
                ${statusBadgeHTML(tx.status)}
              </div>
              <div class="tx-card-amount ${amountClass}">${formatAmount(tx.amount, tx.type)}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  updatePaginationUI(container, total, totalPages);
  updateFloatingBulkBar(container);
}

function updatePaginationUI(container, total, totalPages) {
  const countEl = container.querySelector('#tx-count-label');
  const pageEl = container.querySelector('#tx-page-indicator');
  const prevBtn = container.querySelector('#tx-prev-page');
  const nextBtn = container.querySelector('#tx-next-page');
  const paged = getFilteredTx().slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  if (countEl) countEl.textContent = `Hiển thị ${paged.length} / ${total} giao dịch`;
  if (pageEl) pageEl.textContent = `Trang ${txPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = txPage <= 1;
  if (nextBtn) nextBtn.disabled = txPage >= totalPages;
}

function updateFloatingBulkBar(container) {
  const bulkBar = container.querySelector('#floating-bulk-bar');
  const countEl = container.querySelector('#bulk-bar-count');
  if (!bulkBar) return;

  if (selectedTxIds.size > 0) {
    if (countEl) countEl.textContent = `Đã chọn ${selectedTxIds.size} giao dịch`;
    bulkBar.classList.add('show');
  } else {
    bulkBar.classList.remove('show');
  }
}

/* --------------------------------------------------------------- *
 * CSV Export
 * --------------------------------------------------------------- */
function exportCSV(txListToExport = _transactions) {
  const headers = ['Ngày', 'Người thu', 'Danh mục', 'Loại', 'Số tiền', 'Phương thức', 'Trạng thái'];
  const rows = txListToExport.map(tx => [
    tx.date,
    `"${tx.merchant}"`,
    getCategoryLabelVi(tx.category) || tx.category,
    tx.type,
    (tx.type === 'income' ? '' : '-') + formatCurrency(tx.amount),
    tx.payment_method || '—',
    tx.status || 'completed',
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'luxe-transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Đã xuất CSV ${txListToExport.length} giao dịch!`, 'success');
}

/* --------------------------------------------------------------- *
 * Event Listeners
 * --------------------------------------------------------------- */
function attachListeners(container) {
  // Search input (debounced)
  const searchEl = container.querySelector('#tx-search');
  if (searchEl) {
    let timeout;
    searchEl.addEventListener('input', e => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        txFilters.search = e.target.value.toLowerCase();
        txPage = 1;
        renderTableBody(container);
      }, 250);
    });
  }

  // Type filter
  container.querySelector('#tx-filter-type')?.addEventListener('change', e => {
    txFilters.type = e.target.value;
    txPage = 1;
    renderTableBody(container);
  });

  // Category filter
  container.querySelector('#tx-filter-category')?.addEventListener('change', e => {
    txFilters.category = e.target.value;
    txPage = 1;
    renderTableBody(container);
  });

  // Payment method filter
  container.querySelector('#tx-filter-payment')?.addEventListener('change', e => {
    txFilters.payment_method = e.target.value;
    txPage = 1;
    renderTableBody(container);
  });

  // Status filter
  container.querySelector('#tx-filter-status')?.addEventListener('change', e => {
    txFilters.status = e.target.value;
    txPage = 1;
    renderTableBody(container);
  });

  // Month filter
  container.querySelector('#tx-filter-month')?.addEventListener('change', e => {
    txFilters.month = e.target.value;
    txPage = 1;
    renderTableBody(container);
  });

  // Reset filters empty state button
  container.querySelector('#btn-reset-filters')?.addEventListener('click', () => {
    resetFilters();
    _transactions.forEach(() => {});
    const search = container.querySelector('#tx-search');
    const type = container.querySelector('#tx-filter-type');
    const cat = container.querySelector('#tx-filter-category');
    const status = container.querySelector('#tx-filter-status');
    const payment = container.querySelector('#tx-filter-payment');
    const month = container.querySelector('#tx-filter-month');
    if (search) search.value = '';
    if (type) type.value = '';
    if (cat) cat.value = '';
    if (status) status.value = '';
    if (payment) payment.value = '';
    if (month) month.value = '';
    renderTableBody(container);
  });

  // Sort by column header click
  container.querySelectorAll('[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      if (th.dataset.sort === _sortField) {
        _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        _sortField = th.dataset.sort;
        _sortDir = 'desc';
      }
      renderTableBody(container);
    });
  });

  // Checkbox select-all
  container.querySelector('#tx-select-all')?.addEventListener('change', e => {
    const isChecked = e.target.checked;
    const filtered = getFilteredTx();
    const paged = filtered.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

    paged.forEach(tx => {
      if (isChecked) selectedTxIds.add(tx.id);
      else selectedTxIds.delete(tx.id);
    });
    renderTableBody(container);
  });

  // Checkbox individual select
  container.addEventListener('change', e => {
    if (e.target.classList.contains('tx-checkbox')) {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedTxIds.add(id);
      else selectedTxIds.delete(id);
      renderTableBody(container);
    }
  });

  // Pagination
  container.querySelector('#tx-prev-page')?.addEventListener('click', () => {
    if (txPage > 1) {
      txPage--;
      renderTableBody(container);
    }
  });
  container.querySelector('#tx-next-page')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredTx().length / TX_PER_PAGE));
    if (txPage < totalPages) {
      txPage++;
      renderTableBody(container);
    }
  });

  // Export CSV main button
  container.querySelector('[data-action="export-csv"]')?.addEventListener('click', () => exportCSV(_transactions));

  // 3-Dots Dropdown menu toggle & actions
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-action="toggle-menu"]');
    if (trigger) {
      e.stopPropagation();
      const dropdown = trigger.closest('.action-dropdown');
      document.querySelectorAll('.action-dropdown.show').forEach(d => {
        if (d !== dropdown) d.classList.remove('show');
      });
      dropdown?.classList.toggle('show');
      return;
    }

    // Close open dropdowns when clicking outside
    if (!e.target.closest('.action-dropdown')) {
      document.querySelectorAll('.action-dropdown.show').forEach(d => d.classList.remove('show'));
    }
  });

  // Table & Card Action Items Click
  container.addEventListener('click', async e => {
    const menuItem = e.target.closest('.action-menu-item');
    if (!menuItem) return;

    const action = menuItem.dataset.action;
    const id = menuItem.dataset.id;
    const tx = _transactions.find(t => t.id === id);
    if (!tx) return;

    // Close dropdown menu
    menuItem.closest('.action-dropdown')?.classList.remove('show');

    if (action === 'view-tx') {
      await showConfirmModal({
        title: `Chi tiết: ${tx.merchant}`,
        message: `Số tiền: ${formatCurrency(tx.amount)}\nLoại: ${tx.type === 'income' ? 'Thu nhập' : 'Chi phí'}\nDanh mục: ${getCategoryLabelVi(tx.category)}\nNgày: ${tx.date}\nPhương thức: ${tx.payment_method || '—'}\nTrạng thái: ${tx.status}`,
        confirmText: 'Đóng',
        cancelText: '',
        type: 'primary',
      });
    } else if (action === 'edit-tx') {
      editTransaction(tx);
    } else if (action === 'duplicate-tx') {
      const dup = { ...tx, id: undefined, merchant: `${tx.merchant} (Bản sao)` };
      await dataService.addTransaction(dup);
      _transactions = await dataService.getTransactions();
      emit('data:changed');
      renderTableBody(container);
      showToast(`Đã nhân bản giao dịch: ${dup.merchant}`, 'success');
    } else if (action === 'delete-tx') {
      const confirmed = await showConfirmModal({
        title: 'Xác nhận xóa giao dịch',
        message: `Bạn có chắc chắn muốn xóa "${tx.merchant}" (${formatCurrency(tx.amount)})?`,
        confirmText: 'Xóa giao dịch',
        cancelText: 'Hủy',
        type: 'danger',
      });

      if (confirmed) {
        undoBackupTx = { ...tx };
        await dataService.deleteTransaction(id);
        _transactions = await dataService.getTransactions();
        selectedTxIds.delete(id);
        emit('data:changed');
        renderTableBody(container);

        showToastWithAction(
          `Đã xóa giao dịch "${tx.merchant}".`,
          'Hoàn tác',
          async () => {
            if (undoBackupTx) {
              await dataService.addTransaction(undoBackupTx);
              _transactions = await dataService.getTransactions();
              undoBackupTx = null;
              emit('data:changed');
              renderTableBody(container);
              showToast('Đã khôi phục giao dịch.', 'success');
            }
          },
          'info',
          5000
        );
      }
    }
  });

  // Floating Bulk Bar Actions
  container.querySelector('#btn-bulk-deselect')?.addEventListener('click', () => {
    selectedTxIds.clear();
    renderTableBody(container);
  });

  container.querySelector('#btn-bulk-export')?.addEventListener('click', () => {
    const selectedList = _transactions.filter(t => selectedTxIds.has(t.id));
    exportCSV(selectedList);
  });

  container.querySelector('#btn-bulk-category')?.addEventListener('click', async () => {
    if (selectedTxIds.size === 0) return;
    const newCat = await showCategorySelectModal(CATEGORIES);
    if (newCat) {
      for (const id of selectedTxIds) {
        await dataService.updateTransaction(id, { category: newCat });
      }
      _transactions = await dataService.getTransactions();
      emit('data:changed');
      renderTableBody(container);
      showToast(`Đã đổi danh mục cho ${selectedTxIds.size} giao dịch.`, 'success');
    }
  });

  container.querySelector('#btn-bulk-delete')?.addEventListener('click', async () => {
    if (selectedTxIds.size === 0) return;
    const count = selectedTxIds.size;
    const confirmed = await showConfirmModal({
      title: 'Xác nhận xóa hàng loạt',
      message: `Bạn có chắc chắn muốn xóa ${count} giao dịch đã chọn?`,
      confirmText: `Xóa ${count} giao dịch`,
      cancelText: 'Hủy',
      type: 'danger',
    });

    if (confirmed) {
      const deletedItems = _transactions.filter(t => selectedTxIds.has(t.id));
      for (const id of selectedTxIds) {
        await dataService.deleteTransaction(id);
      }
      _transactions = await dataService.getTransactions();
      selectedTxIds.clear();
      emit('data:changed');
      renderTableBody(container);

      showToastWithAction(
        `Đã xóa ${count} giao dịch.`,
        'Hoàn tác',
        async () => {
          for (const item of deletedItems) {
            await dataService.addTransaction(item);
          }
          _transactions = await dataService.getTransactions();
          emit('data:changed');
          renderTableBody(container);
          showToast(`Đã khôi phục ${count} giao dịch.`, 'success');
        },
        'info',
        5000
      );
    }
  });
}

/* --------------------------------------------------------------- *
 * Main Render Entry Point
 * --------------------------------------------------------------- */
export async function render(container, page = 'transactions') {
  const route = getRoute(page);
  _transactions = await dataService.getTransactions();
  readUrlParams();

  container.innerHTML = `
    ${pageHeaderHTML({
      title: route.title,
      description: route.description,
      actionHTML: `
        <button class="btn-secondary" id="export-csv-btn" data-action="export-csv" aria-label="Xuất CSV">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1 2 2H5a2 2 0 0 1 2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Xuất CSV
        </button>
        <button class="btn-add-transaction" data-open-modal="add-tx-modal" id="open-add-tx-modal-2" aria-label="Thêm giao dịch">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Thêm giao dịch
        </button>
      `,
    })}
    ${filterBarHTML()}
    ${summaryCardsHTML()}
    ${tableHTML()}
  `;

  renderTableBody(container);
  attachListeners(container);
}
