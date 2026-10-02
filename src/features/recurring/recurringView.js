/**
 * @file Recurring Transactions feature module.
 * Renders upcoming recurring transactions list with sorting, action column (3-dots),
 * in-place toggle switch for status, URL query params state, bulk actions, and mobile responsive cards.
 */

import dataService from '../../services/dataAdapter.js';
import { formatCurrency, formatAmount, escapeHtml, formatRelative, formatDateShort, formatDateLong, parseNumber } from '../../utils/format.js';
import { CATEGORY_MAP } from '../../constants/categories.js';
import { panelHeaderHTML } from '../../components/ui/PanelHeader.js';
import { kpiCardHTML } from '../../components/ui/KPICard.js';
import { showToast, showToastWithAction } from '../../components/ui/Toast.js';
import { actionDropdownHTML, statusToggleHTML } from '../../components/ui/TransactionCells.js';
import { showConfirmModal } from '../../components/ui/ConfirmModal.js';
import { emit } from '../../utils/eventBus.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { getRoute } from '../../config/routes.js';

const RECURRING_ICONS = {
  cost: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
  calendar: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="9" y1="12" x2="9.01" y2="12"/><line x1="15" y1="12" x2="15.01" y2="12"/>',
};

/* --------------------------------------------------------------- *
 * Module State & Query Helpers
 * --------------------------------------------------------------- */
let _recurringList = [];
let _sortField = 'nextDate';
let _sortDir = 'asc';
let _searchQuery = '';
let _statusFilter = '';
let selectedRecurringIds = new Set();
let undoBackupRecurring = null;

function readUrlParams() {
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return;

  const params = new URLSearchParams(hash.slice(qIdx));
  if (params.has('search')) _searchQuery = params.get('search');
  if (params.has('status')) _statusFilter = params.get('status');
  if (params.has('sort')) _sortField = params.get('sort');
  if (params.has('dir')) _sortDir = params.get('dir');
}

function updateUrlParams() {
  const params = new URLSearchParams();
  if (_searchQuery) params.set('search', _searchQuery);
  if (_statusFilter) params.set('status', _statusFilter);
  if (_sortField !== 'nextDate') params.set('sort', _sortField);
  if (_sortDir !== 'asc') params.set('dir', _sortDir);

  const queryString = params.toString();
  const baseHash = '#recurring';
  const newHash = queryString ? `${baseHash}?${queryString}` : baseHash;

  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash);
  }
}

function getFilteredRecurring() {
  return _recurringList.filter(item => {
    const search = _searchQuery.toLowerCase();
    const matchSearch = !search ||
      item.merchant.toLowerCase().includes(search) ||
      (CATEGORY_MAP[item.category]?.labelVi || item.category).toLowerCase().includes(search);
    const matchStatus = !_statusFilter || item.status === _statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    let cmp = 0;
    if (_sortField === 'nextDate') {
      cmp = new Date(a.nextDate) - new Date(b.nextDate);
    } else if (_sortField === 'amount') {
      cmp = parseNumber(a.amount) - parseNumber(b.amount);
    } else if (_sortField === 'merchant') {
      cmp = String(a.merchant).localeCompare(String(b.merchant));
    } else if (_sortField === 'category') {
      cmp = String(a.category).localeCompare(String(b.category));
    } else if (_sortField === 'frequency') {
      cmp = String(a.frequency).localeCompare(String(b.frequency));
    } else if (_sortField === 'status') {
      cmp = String(a.status).localeCompare(String(b.status));
    } else {
      cmp = String(a[_sortField] || '').localeCompare(String(b[_sortField] || ''));
    }
    return _sortDir === 'asc' ? cmp : -cmp;
  });
}

function kpiIcon(pathFrag) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathFrag}</svg>`;
}

function monthlyRecurringTotal(list) {
  return list
    .filter(r => r.type === 'expense' && (r.status === 'active' || r.is_active))
    .reduce((sum, r) => {
      const amt = parseNumber(r.amount);
      if (r.frequency === 'weekly') return sum + amt * 4.345;
      if (r.frequency === 'yearly') return sum + amt / 12;
      return sum + amt;
    }, 0);
}

function upcomingDueItems(list) {
  const now = new Date();
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  return list
    .filter(r => (r.status === 'active' || r.is_active) && r.nextDate)
    .map(r => ({ ...r, _due: new Date(r.nextDate + 'T00:00:00') }))
    .filter(r => r._due >= now && r._due <= deadline)
    .sort((a, b) => a._due - b._due)
    .map(r => ({ ...r, diffDays: Math.ceil((r._due - now) / (1000 * 60 * 60 * 24)) }));
}

function recurringSummaryHTML(monthlyTotal) {
  return kpiCardHTML({
    id: 'recurring-monthly-cost',
    title: 'Tổng chi định kỳ hàng tháng',
    value: formatAmount(monthlyTotal, 'expense'),
    valueClass: 'highlight-negative',
    iconSvg: kpiIcon(RECURRING_ICONS.cost),
    footerHtml: '<span class="trend-label">chi phí lặp lại</span>',
  });
}

function upcomingDueHTML(list) {
  const items = upcomingDueItems(list);
  if (items.length === 0) {
    return `
      <div class="glass-panel" id="recurring-upcoming-panel">
        ${panelHeaderHTML({ title: 'Sắp đến hạn (30 ngày)', subtitle: 'Không có khoản nào', iconSvg: RECURRING_ICONS.calendar })}
        <p style="color:var(--text-muted);font-size:0.85rem;">Không có giao dịch định kỳ nào trong 30 ngày tới.</p>
      </div>
    `;
  }

  const rows = items.map(r => {
    const amountClass = r.type === 'income' ? 'highlight-positive' : 'highlight-negative';
    const rel = formatRelative(r.nextDate);
    return `
      <div class="recurring-upcoming-item">
        <div class="recurring-item-main">
          <span class="recurring-item-icon" aria-hidden="true">${r.icon || '💸'}</span>
          <div class="recurring-item-info">
            <span class="recurring-item-name">${escapeHtml(r.merchant)}</span>
            <span class="recurring-item-date" title="${escapeHtml(formatDateLong(r.nextDate))}">${escapeHtml(rel)} · ${escapeHtml(CATEGORY_MAP[r.category]?.labelVi || r.category)}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <span class="recurring-item-days" aria-label="${r.diffDays} ngày tới">${r.diffDays}d</span>
          <span class="recurring-item-amount ${amountClass}">${formatAmount(r.amount, r.type)}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="glass-panel" id="recurring-upcoming-panel">
      ${panelHeaderHTML({
        title: 'Sắp đến hạn (30 ngày)',
        subtitle: `${items.length} khoản`,
        iconSvg: RECURRING_ICONS.calendar,
      })}
      <div class="recurring-upcoming-list">
        ${rows}
      </div>
    </div>
  `;
}

function renderSortIndicator(field) {
  const isCurrent = _sortField === field;
  const dirIcon = isCurrent ? (_sortDir === 'asc' ? '↑' : '↓') : '↕';
  return `<span class="sort-icon" aria-hidden="true">${dirIcon}</span>`;
}

function recurringTableHTML() {
  return `
    <div class="glass-panel" style="padding:0;overflow:hidden;position:relative;">
      <!-- Filter Bar -->
      <div style="display:flex;gap:0.75rem;padding:1rem 1.25rem;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap;">
        <div class="search-input-box" role="search" style="flex:1;min-width:200px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="search" id="recurring-search" value="${escapeHtml(_searchQuery)}" placeholder="Tìm kiếm giao dịch định kỳ…" />
        </div>
        <select class="select-dropdown" id="recurring-filter-status">
          <option value="">Tất cả trạng thái</option>
          <option value="active" ${_statusFilter === 'active' ? 'selected' : ''}>Đang bật</option>
          <option value="inactive" ${_statusFilter === 'inactive' ? 'selected' : ''}>Đã tắt</option>
        </select>
      </div>

      <!-- Desktop Table -->
      <div class="transactions-table-wrapper">
        <table class="luxe-table" aria-label="Giao dịch định kỳ">
          <thead>
            <tr>
              <th scope="col" style="width:40px;text-align:center;">
                <input type="checkbox" id="recurring-select-all" class="tx-select-all" title="Chọn tất cả" />
              </th>
              <th scope="col" data-sort="merchant" aria-sort="${_sortField === 'merchant' ? (_sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                Tên ${renderSortIndicator('merchant')}
              </th>
              <th scope="col" data-sort="category" aria-sort="${_sortField === 'category' ? (_sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                Danh mục ${renderSortIndicator('category')}
              </th>
              <th scope="col" data-sort="frequency" aria-sort="${_sortField === 'frequency' ? (_sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                Tần suất ${renderSortIndicator('frequency')}
              </th>
              <th scope="col" data-sort="nextDate" aria-sort="${_sortField === 'nextDate' ? (_sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                Ngày tiếp theo ${renderSortIndicator('nextDate')}
              </th>
              <th scope="col" style="text-align:right" data-sort="amount" aria-sort="${_sortField === 'amount' ? (_sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                Số tiền ${renderSortIndicator('amount')}
              </th>
              <th scope="col" data-sort="status" aria-sort="${_sortField === 'status' ? (_sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                Bật / Tắt ${renderSortIndicator('status')}
              </th>
              <th scope="col" style="text-align:center;width:80px;">Hành động</th>
            </tr>
          </thead>
          <tbody id="recurring-tbody">
            <!-- Populated dynamically -->
          </tbody>
        </table>
      </div>

      <!-- Mobile Responsive Cards -->
      <div class="tx-mobile-cards" id="recurring-mobile-cards"></div>

      <!-- Empty State -->
      <div id="recurring-empty-state" class="empty-state" style="display:none;padding:3rem 1.5rem;text-align:center;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.4;">
          <rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="8" x2="21" y2="8"></line>
        </svg>
        <h4 style="margin-bottom:0.5rem;color:var(--text-primary);">Chưa có giao dịch định kỳ phù hợp</h4>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.25rem;">Thử điều chỉnh từ khóa tìm kiếm hoặc bộ lọc.</p>
        <button type="button" class="btn-secondary" id="btn-reset-recurring-filters">Xóa bộ lọc</button>
      </div>
    </div>

    <!-- Floating Bulk Action Bar -->
    <div class="floating-bulk-bar" id="recurring-bulk-bar">
      <span class="bulk-bar-count" id="recurring-bulk-count">Đã chọn 0 mục</span>
      <div class="bulk-bar-actions">
        <button type="button" class="btn-secondary" id="btn-recurring-bulk-active" style="font-size:0.8rem;padding:0.4rem 0.75rem;">Bật hàng loạt</button>
        <button type="button" class="btn-secondary" id="btn-recurring-bulk-inactive" style="font-size:0.8rem;padding:0.4rem 0.75rem;">Tắt hàng loạt</button>
        <button type="button" class="btn-danger" id="btn-recurring-bulk-delete" style="font-size:0.8rem;padding:0.4rem 0.75rem;">Xóa đã chọn</button>
        <button type="button" class="btn-secondary" id="btn-recurring-bulk-deselect" aria-label="Bỏ chọn" style="padding:0.4rem 0.6rem;font-size:0.8rem;">✕</button>
      </div>
    </div>
  `;
}

function renderTableBody(container) {
  updateUrlParams();
  const filtered = getFilteredRecurring();

  const tbody = container.querySelector('#recurring-tbody');
  const cardsContainer = container.querySelector('#recurring-mobile-cards');
  const emptyState = container.querySelector('#recurring-empty-state');
  const selectAll = container.querySelector('#recurring-select-all');

  if (selectAll) {
    selectAll.checked = filtered.length > 0 && filtered.every(r => selectedRecurringIds.has(r.id));
  }

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
  } else {
    if (emptyState) emptyState.style.display = 'none';

    // 1. Desktop Table Rows
    tbody.innerHTML = filtered.map(r => {
      const isSelected = selectedRecurringIds.has(r.id);
      const isActive = r.status === 'active' || r.is_active;
      const freqLabel = r.frequency === 'monthly' ? 'Hàng tháng' : r.frequency === 'weekly' ? 'Hàng tuần' : 'Hàng năm';
      const typeClass = r.type === 'income' ? 'highlight-positive' : 'highlight-negative';
      const sign = r.type === 'income' ? '+' : '-';

      return `
        <tr id="recurring-row-${r.id}" class="${isSelected ? 'selected-row' : ''}">
          <td style="text-align:center;">
            <input type="checkbox" class="recurring-checkbox" data-id="${r.id}" ${isSelected ? 'checked' : ''} />
          </td>
          <td>
            <div class="merchant-cell">
              <div class="merchant-icon" aria-hidden="true">${r.icon || '📦'}</div>
              <div class="merchant-details">
                <span class="merchant-name">${escapeHtml(r.merchant)}</span>
              </div>
            </div>
          </td>
          <td><span class="category-tag">${escapeHtml(CATEGORY_MAP[r.category]?.labelVi || r.category)}</span></td>
          <td style="color:var(--text-secondary);font-size:0.85rem;">${freqLabel}</td>
          <td style="color:var(--text-secondary);font-size:0.85rem;">${formatDateShort(r.nextDate)}</td>
          <td class="table-amount ${typeClass}">${sign}${formatCurrency(r.amount)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              ${statusToggleHTML(r.id, isActive)}
              <span style="font-size:0.75rem;color:${isActive ? 'var(--positive)' : 'var(--text-muted)'};">
                ${isActive ? 'Đang bật' : 'Đã tắt'}
              </span>
            </div>
          </td>
          <td style="text-align:center;">
            ${actionDropdownHTML(r.id, 'recurring')}
          </td>
        </tr>
      `;
    }).join('');

    // 2. Mobile Responsive Cards (<768px)
    if (cardsContainer) {
      cardsContainer.innerHTML = filtered.map(r => {
        const isSelected = selectedRecurringIds.has(r.id);
        const isActive = r.status === 'active' || r.is_active;
        const freqLabel = r.frequency === 'monthly' ? 'Hàng tháng' : r.frequency === 'weekly' ? 'Hàng tuần' : 'Hàng năm';
        const typeClass = r.type === 'income' ? 'highlight-positive' : 'highlight-negative';
        return `
          <div class="tx-card ${isSelected ? 'selected' : ''}" id="recurring-card-${r.id}">
            <div class="tx-card-header">
              <div style="display:flex;align-items:center;gap:0.6rem;">
                <input type="checkbox" class="recurring-checkbox" data-id="${r.id}" ${isSelected ? 'checked' : ''} />
                <span style="font-size:1.2rem;" aria-hidden="true">${r.icon || '📦'}</span>
                <span class="tx-card-title">${escapeHtml(r.merchant)}</span>
              </div>
              ${actionDropdownHTML(r.id, 'recurring')}
            </div>
            <div class="tx-card-sub">
              <span class="category-tag">${escapeHtml(CATEGORY_MAP[r.category]?.labelVi || r.category)}</span>
              <span>•</span>
              <span>${freqLabel}</span>
              <span>•</span>
              <span>Đến hạn: ${formatDateShort(r.nextDate)}</span>
            </div>
            <div class="tx-card-footer">
              <div style="display:flex;align-items:center;gap:0.5rem;">
                ${statusToggleHTML(r.id, isActive)}
                <span style="font-size:0.75rem;color:${isActive ? 'var(--positive)' : 'var(--text-muted)'};">
                  ${isActive ? 'Đang bật' : 'Đã tắt'}
                </span>
              </div>
              <div class="tx-card-amount ${typeClass}">${formatAmount(r.amount, r.type)}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  updateFloatingBulkBar(container);
}

function updateFloatingBulkBar(container) {
  const bulkBar = container.querySelector('#recurring-bulk-bar');
  const countEl = container.querySelector('#recurring-bulk-count');
  if (!bulkBar) return;

  if (selectedRecurringIds.size > 0) {
    if (countEl) countEl.textContent = `Đã chọn ${selectedRecurringIds.size} mục`;
    bulkBar.classList.add('show');
  } else {
    bulkBar.classList.remove('show');
  }
}

/* --------------------------------------------------------------- *
 * Event Listeners
 * --------------------------------------------------------------- */
function attachListeners(container) {
  // Add recurring button trigger
  container.addEventListener('click', e => {
    if (e.target.closest('[data-action="add-recurring"]')) {
      showToast('Tính năng tạo giao dịch định kỳ sẽ sớm được ra mắt.', 'info');
    }
  });

  // Search input
  const searchEl = container.querySelector('#recurring-search');
  if (searchEl) {
    let timeout;
    searchEl.addEventListener('input', e => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        _searchQuery = e.target.value;
        renderTableBody(container);
      }, 250);
    });
  }

  // Status filter
  container.querySelector('#recurring-filter-status')?.addEventListener('change', e => {
    _statusFilter = e.target.value;
    renderTableBody(container);
  });

  // Reset filters
  container.querySelector('#btn-reset-recurring-filters')?.addEventListener('click', () => {
    _searchQuery = '';
    _statusFilter = '';
    const sInput = container.querySelector('#recurring-search');
    const sFilter = container.querySelector('#recurring-filter-status');
    if (sInput) sInput.value = '';
    if (sFilter) sFilter.value = '';
    renderTableBody(container);
  });

  // Sort click
  container.querySelectorAll('[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      if (th.dataset.sort === _sortField) {
        _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        _sortField = th.dataset.sort;
        _sortDir = 'asc';
      }
      renderTableBody(container);
    });
  });

  // Select all checkbox
  container.querySelector('#recurring-select-all')?.addEventListener('change', e => {
    const isChecked = e.target.checked;
    const filtered = getFilteredRecurring();

    filtered.forEach(r => {
      if (isChecked) selectedRecurringIds.add(r.id);
      else selectedRecurringIds.delete(r.id);
    });
    renderTableBody(container);
  });

  // Individual checkbox
  container.addEventListener('change', e => {
    if (e.target.classList.contains('recurring-checkbox')) {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedRecurringIds.add(id);
      else selectedRecurringIds.delete(id);
      renderTableBody(container);
    }
  });

  // In-place Toggle Switch Status Change
  container.addEventListener('change', async e => {
    if (e.target.classList.contains('recurring-status-toggle')) {
      const id = e.target.dataset.id;
      const isChecked = e.target.checked;
      const newStatus = isChecked ? 'active' : 'inactive';

      await dataService.updateRecurring(id, { status: newStatus, is_active: isChecked });
      _recurringList = await dataService.getRecurring();
      emit('data:changed');
      renderTableBody(container);
      showToast(`Đã ${isChecked ? 'bật' : 'tắt'} giao dịch định kỳ.`, 'info');
    }
  });

  // 3-Dots Action items click
  container.addEventListener('click', async e => {
    const menuItem = e.target.closest('.action-menu-item');
    if (!menuItem) return;

    const action = menuItem.dataset.action;
    const id = menuItem.dataset.id;
    const item = _recurringList.find(r => r.id === id);
    if (!item) return;

    menuItem.closest('.action-dropdown')?.classList.remove('show');

    if (action === 'view-recurring') {
      await showConfirmModal({
        title: `Giao dịch định kỳ: ${item.merchant}`,
        message: `Số tiền: ${formatCurrency(item.amount)}\nTần suất: ${item.frequency}\nNgày tiếp theo: ${item.nextDate}\nTrạng thái: ${item.status === 'active' ? 'Đang bật' : 'Đã tắt'}`,
        confirmText: 'Đóng',
        cancelText: '',
        type: 'primary',
      });
    } else if (action === 'edit-recurring') {
      showToast(`Chỉnh sửa ${item.merchant} - Tính năng đang phát triển.`, 'info');
    } else if (action === 'duplicate-recurring') {
      const dup = { ...item, id: undefined, merchant: `${item.merchant} (Bản sao)` };
      await dataService.addRecurring(dup);
      _recurringList = await dataService.getRecurring();
      emit('data:changed');
      renderTableBody(container);
      showToast(`Đã nhân bản: ${dup.merchant}`, 'success');
    } else if (action === 'delete-recurring') {
      const confirmed = await showConfirmModal({
        title: 'Xóa giao dịch định kỳ',
        message: `Bạn có chắc muốn xóa "${item.merchant}"?`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        type: 'danger',
      });

      if (confirmed) {
        undoBackupRecurring = { ...item };
        await dataService.deleteRecurring(id);
        _recurringList = await dataService.getRecurring();
        selectedRecurringIds.delete(id);
        emit('data:changed');
        renderTableBody(container);

        showToastWithAction(
          `Đã xóa giao dịch định kỳ "${item.merchant}".`,
          'Hoàn tác',
          async () => {
            if (undoBackupRecurring) {
              await dataService.addRecurring(undoBackupRecurring);
              _recurringList = await dataService.getRecurring();
              undoBackupRecurring = null;
              emit('data:changed');
              renderTableBody(container);
              showToast('Đã khôi phục giao dịch định kỳ.', 'success');
            }
          },
          'info',
          5000
        );
      }
    }
  });

  // Floating Bulk Bar Actions
  container.querySelector('#btn-recurring-bulk-deselect')?.addEventListener('click', () => {
    selectedRecurringIds.clear();
    renderTableBody(container);
  });

  container.querySelector('#btn-recurring-bulk-active')?.addEventListener('click', async () => {
    for (const id of selectedRecurringIds) {
      await dataService.updateRecurring(id, { status: 'active', is_active: true });
    }
    _recurringList = await dataService.getRecurring();
    emit('data:changed');
    renderTableBody(container);
    showToast(`Đã bật ${selectedRecurringIds.size} giao dịch định kỳ.`, 'success');
  });

  container.querySelector('#btn-recurring-bulk-inactive')?.addEventListener('click', async () => {
    for (const id of selectedRecurringIds) {
      await dataService.updateRecurring(id, { status: 'inactive', is_active: false });
    }
    _recurringList = await dataService.getRecurring();
    emit('data:changed');
    renderTableBody(container);
    showToast(`Đã tắt ${selectedRecurringIds.size} giao dịch định kỳ.`, 'info');
  });

  container.querySelector('#btn-recurring-bulk-delete')?.addEventListener('click', async () => {
    if (selectedRecurringIds.size === 0) return;
    const count = selectedRecurringIds.size;
    const confirmed = await showConfirmModal({
      title: 'Xóa hàng loạt giao dịch định kỳ',
      message: `Bạn có chắc chắn muốn xóa ${count} mục đã chọn?`,
      confirmText: `Xóa ${count} mục`,
      cancelText: 'Hủy',
      type: 'danger',
    });

    if (confirmed) {
      const deletedItems = _recurringList.filter(r => selectedRecurringIds.has(r.id));
      for (const id of selectedRecurringIds) {
        await dataService.deleteRecurring(id);
      }
      _recurringList = await dataService.getRecurring();
      selectedRecurringIds.clear();
      emit('data:changed');
      renderTableBody(container);

      showToastWithAction(
        `Đã xóa ${count} giao dịch định kỳ.`,
        'Hoàn tác',
        async () => {
          for (const item of deletedItems) {
            await dataService.addRecurring(item);
          }
          _recurringList = await dataService.getRecurring();
          emit('data:changed');
          renderTableBody(container);
          showToast(`Đã khôi phục ${count} giao dịch định kỳ.`, 'success');
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
export async function render(container, page = 'recurring') {
  const route = getRoute(page);
  _recurringList = await dataService.getRecurring();
  readUrlParams();

  const sorted = [..._recurringList].sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));
  const monthlyTotal = monthlyRecurringTotal(sorted);

  container.innerHTML = `
    ${pageHeaderHTML({
      title: route.title,
      description: route.description,
      actionHTML: `
        <button class="btn-add-transaction" data-action="add-recurring" aria-label="Thêm giao dịch định kỳ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Thêm giao dịch
        </button>
      `,
    })}
    <div class="recurring-summary-grid">
      ${recurringSummaryHTML(monthlyTotal)}
      ${upcomingDueHTML(sorted)}
    </div>
    ${recurringTableHTML()}
  `;

  renderTableBody(container);
  attachListeners(container);
}

export default { render };
