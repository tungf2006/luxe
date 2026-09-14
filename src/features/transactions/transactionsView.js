/**
 * @file Transactions feature module.
 * Renders the full transactions list with search, type/category/month
 * filters, date-descending sort, pagination, inline delete, and CSV export.
 */

import dataService from '../../services/dataService.js';
import { escapeHtml, formatDate, formatAmount } from '../../utils/format.js';
import { CATEGORIES, CATEGORY_MAP } from '../../constants/categories.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';

/* --------------------------------------------------------------- *
 * Module-level state (preserved across re-renders)
 * --------------------------------------------------------------- */
const TX_PER_PAGE = 8;
let txPage = 1;
let txFilters = { search: '', type: '', category: '', month: '' };
let _sortField = 'date';
let _sortDir = 'desc';
let _transactions = [];

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
    return matchSearch && matchType && matchCat && matchMonth;
  }).sort((a, b) => {
    let cmp = 0;
    if (_sortField === 'date') {
      cmp = new Date(b.date) - new Date(a.date);
    } else if (_sortField === 'amount') {
      cmp = b.amount - a.amount;
    } else {
      cmp = String(a[_sortField]).localeCompare(String(b[_sortField]));
    }
    return _sortDir === 'desc' ? cmp : -cmp;
  });
}

function resetFilters() {
  txFilters = { search: '', type: '', category: '', month: '' };
  txPage = 1;
  _sortField = 'date';
  _sortDir = 'desc';
}

/* --------------------------------------------------------------- *
 * HTML builders
 * --------------------------------------------------------------- */
function pageBannerHTML() {
  return `
    <div class="page-title-banner">
      <div>
        <h2>Giao dịch</h2>
        <p>Lịch sử đầy đủ hoạt động tài chính của bạn</p>
      </div>
      <div style="display:flex;gap:0.75rem;align-items:center;">
        <button class="btn-secondary" id="export-csv-btn" data-action="export-csv" aria-label="Xuất CSV">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Xuất CSV
        </button>
        <button class="btn-add-transaction" data-open-modal="add-tx-modal" id="open-add-tx-modal-2" aria-label="Thêm giao dịch">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Thêm giao dịch
        </button>
      </div>
    </div>
  `;
}

function monthOptionsHTML(transactions) {
  const months = [...new Set(transactions.map(tx => tx.date.slice(0, 7)))]
    .sort().reverse();
  return '<option value="">Tất cả tháng</option>' +
    months.map(m => {
      const d = new Date(m + '-01');
      const label = d.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' });
      return `<option value="${m}">${label}</option>`;
    }).join('');
}

function filterBarHTML() {
  return `
    <div class="tx-filter-bar">
      <div class="search-input-box" role="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="search" id="tx-search" placeholder="Tìm kiếm giao dịch…" aria-label="Tìm kiếm giao dịch" />
      </div>
      <select class="select-dropdown" id="tx-filter-type" aria-label="Lọc theo loại">
        <option value="">Tất cả loại</option>
        <option value="income">Thu nhập</option>
        <option value="expense">Chi phí</option>
      </select>
      <select class="select-dropdown" id="tx-filter-category" aria-label="Lọc theo danh mục">
        <option value="">Tất cả danh mục</option>
        ${CATEGORIES.map(c => `<option value="${c.key}">${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <select class="select-dropdown" id="tx-filter-month" aria-label="Lọc theo tháng">
        ${monthOptionsHTML(_transactions)}
      </select>
    </div>
  `;
}

function tableHTML() {
  return `
    <div class="glass-panel" style="padding:0;overflow:hidden;">
      <div class="transactions-table-wrapper">
        <table class="luxe-table" id="all-tx-table" aria-label="Tất cả giao dịch">
          <thead>
            <tr>
               <th scope="col">Người thu</th>
               <th scope="col">Danh mục</th>
               <th scope="col" style="cursor:pointer;" data-sort="date">
                 Ngày ${renderSortIndicator('date')}
               </th>
               <th scope="col">Trạng thái</th>
               <th scope="col" style="text-align:right;cursor:pointer;" data-sort="amount">
                 Số tiền ${renderSortIndicator('amount')}
               </th>
               <th scope="col" style="text-align:center">Hành động</th>
            </tr>
          </thead>
          <tbody id="all-tx-tbody">
            <!-- Populated by renderTableBody() -->
          </tbody>
        </table>
      </div>
      <div id="tx-empty-state" class="empty-state" style="display:none;">
        <div class="empty-state-content">
        <span class="empty-state-icon">🔍</span>
        <p>Không có giao dịch nào khớp với bộ lọc của bạn.</p></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.5rem;border-top:1px solid var(--border-subtle);">
        <span id="tx-count-label" style="font-size:0.8rem;color:var(--text-muted);"></span>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn-secondary" id="tx-prev-page" aria-label="Trang trước">← Trước</button>
          <span id="tx-page-indicator" style="padding:0.4rem 0.75rem;font-size:0.85rem;color:var(--text-secondary);"></span>
          <button class="btn-secondary" id="tx-next-page" aria-label="Trang sau">Sau →</button>
        </div>
      </div>
    </div>
  `;
}

function renderSortIndicator(field) {
  if (_sortField !== field) return '';
  const dir = _sortDir === 'desc' ? '↓' : '↑';
  return `<span aria-hidden="true">${dir}</span>`;
}

function renderTableBody(container) {
  const filtered = getFilteredTx();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / TX_PER_PAGE));
  if (txPage > totalPages) txPage = totalPages;
  const paged = filtered.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  const tbody = container.querySelector('#all-tx-tbody');
  const emptyState = container.querySelector('#tx-empty-state');
  if (!tbody) return;

  if (paged.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = paged.map(tx => `
      <tr id="tx-row-${tx.id}">
        <td>
          <div class="merchant-cell">
            <div class="merchant-icon" aria-hidden="true">${CATEGORY_ICON(tx.category)}</div>
            <div class="merchant-details">
              <span class="merchant-name">${escapeHtml(tx.merchant)}</span>
            </div>
          </div>
        </td>
          <td><span class="category-tag">${escapeHtml(CATEGORY_MAP[tx.category]?.name || tx.category)}</span></td>
        <td style="color:var(--text-secondary);font-size:0.85rem;">${formatDate(tx.date)}</td>
        <td>
          ${statusBadgeHTML(tx.status)}
        </td>
        <td class="table-amount ${tx.type === 'income' ? 'highlight-positive' : 'highlight-negative'}">
          ${formatAmount(tx.amount, tx.type)}
        </td>
        <td style="text-align:center;">
         <button class="btn-secondary" data-action="delete-tx" data-id="${tx.id}" aria-label="Xóa giao dịch ${escapeHtml(tx.merchant)}" style="padding:0.3rem 0.65rem;font-size:0.75rem;color:var(--negative);border-color:var(--negative-border);">
             Xóa
           </button>
        </td>
      </tr>
    `).join('');
  }

  updatePaginationUI(container, total, totalPages);
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

function CATEGORY_ICON(category) {
  const icons = {
    Income: '💼', Food: '🛒', Transport: '🚌', Entertainment: '🎬',
    Shopping: '🛍️', Bills: '⚡', Health: '💊', Other: '📦',
  };
  return icons[category] || '📦';
}

function statusBadgeHTML(status) {
  const cls = status === 'completed' ? 'var(--positive-bg)' : 'var(--warning-bg)';
  const color = status === 'completed' ? 'var(--positive)' : 'var(--warning)';
  const icon = status === 'completed' ? '✓' : '⏳';
  const label = status === 'completed' ? 'Hoàn thành' : 'Đang xử lý';
  return `
    <span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;font-weight:500;padding:0.2rem 0.6rem;border-radius:var(--radius-full);background:${cls};color:${color};">
      ${icon} ${escapeHtml(label)}
    </span>
  `;
}

function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/* --------------------------------------------------------------- *
 * CSV Export
 * --------------------------------------------------------------- */
function exportCSV() {
  const headers = ['Ngày', 'Người thu', 'Danh mục', 'Loại', 'Số tiền', 'Trạng thái'];
  const rows = _transactions.map(tx => [
    tx.date,
    `"${tx.merchant}"`,
    tx.category,
    tx.type,
    (tx.type === 'income' ? '' : '-') + tx.amount,
    tx.status,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'luxe-transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
   showToast('Đã xuất CSV thành công!', 'success');
}

/* --------------------------------------------------------------- *
 * Event listeners
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
      }, 300);
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

  // Month filter
  container.querySelector('#tx-filter-month')?.addEventListener('change', e => {
    txFilters.month = e.target.value;
    txPage = 1;
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
      // Update sort indicators
      container.querySelectorAll('[data-sort]').forEach(h => {
        const indicator = h.querySelector('span[aria-hidden="true"]');
        if (indicator) {
          indicator.textContent = _sortField === h.dataset.sort
            ? (_sortDir === 'desc' ? '↓' : '↑')
            : '';
        }
      });
    });
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

  // Export CSV
  container.querySelector('[data-action="export-csv"]')?.addEventListener('click', exportCSV);

  // Delete transaction (with confirmation)
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="delete-tx"]');
    if (btn) {
      const id = btn.dataset.id;
      const row = container.querySelector(`#tx-row-${id}`);
      const merchant = row?.querySelector('.merchant-name')?.textContent || 'giao dịch';
      if (confirm(`Xóa "${merchant}"?`)) {
        dataService.deleteTransaction(id);
        emit('data:changed');
         showToast('Giao dịch đã bị xóa.', 'info');
      }
    }
  });
}

/* --------------------------------------------------------------- *
 * Main render entry point
 * --------------------------------------------------------------- */
export async function render(container) {
  _transactions = await dataService.getTransactions();
  resetFilters();

  container.innerHTML = `
    ${pageBannerHTML()}
    ${filterBarHTML()}
    ${tableHTML()}
  `;

  renderTableBody(container);
  attachListeners(container);
}
