/**
 * Luxe Financial Management — App Logic
 * Handles: SPA navigation, data store, transaction CRUD, charts,
 *          budgets, settings tabs, modal, and toast notifications.
 */

'use strict';

/* ==========================================================================
   Data Store
   ========================================================================== */
const STORAGE_KEYS = { TX: 'luxe_transactions', BUDGETS: 'luxe_budgets' };

const CATEGORY_ICONS = {
  Food: '🛒', Shopping: '🛍️', Transport: '🚌', Entertainment: '🎬',
  Bills: '⚡', Health: '💊', Income: '💼', Other: '📦'
};

const DEFAULT_TRANSACTIONS = [
  { id: 't01', merchant: 'Salary', category: 'Income', type: 'income', date: '2026-09-12', amount: 4200, status: 'completed' },
  { id: 't02', merchant: 'Freelance Project', category: 'Income', type: 'income', date: '2026-09-11', amount: 2220, status: 'completed' },
  { id: 't03', merchant: 'Grocery Store', category: 'Food', type: 'expense', date: '2026-09-13', amount: 86, status: 'completed' },
  { id: 't04', merchant: 'Starbucks', category: 'Food', type: 'expense', date: '2026-09-13', amount: 12, status: 'completed' },
  { id: 't05', merchant: 'Uber', category: 'Transport', type: 'expense', date: '2026-09-12', amount: 18, status: 'completed' },
  { id: 't06', merchant: 'Netflix', category: 'Entertainment', type: 'expense', date: '2026-09-10', amount: 15, status: 'completed' },
  { id: 't07', merchant: 'Electric Utility', category: 'Bills', type: 'expense', date: '2026-09-09', amount: 95, status: 'completed' },
  { id: 't08', merchant: 'Amazon', category: 'Shopping', type: 'expense', date: '2026-09-08', amount: 64, status: 'completed' },
  { id: 't09', merchant: 'Dr. Smith Clinic', category: 'Health', type: 'expense', date: '2026-09-07', amount: 120, status: 'completed' },
  { id: 't10', merchant: 'Whole Foods', category: 'Food', type: 'expense', date: '2026-09-06', amount: 73, status: 'completed' },
  { id: 't11', merchant: 'Rent', category: 'Bills', type: 'expense', date: '2026-09-01', amount: 1250, status: 'completed' },
  { id: 't12', merchant: 'Gym Membership', category: 'Health', type: 'expense', date: '2026-09-01', amount: 45, status: 'completed' },
  { id: 't13', merchant: 'Apple Store', category: 'Shopping', type: 'expense', date: '2026-09-05', amount: 249, status: 'pending' },
  { id: 't14', merchant: 'Spotify', category: 'Entertainment', type: 'expense', date: '2026-09-01', amount: 10, status: 'completed' },
  { id: 't15', merchant: 'Shell Gas', category: 'Transport', type: 'expense', date: '2026-09-04', amount: 55, status: 'completed' },
];

const DEFAULT_BUDGETS = [
  { id: 'b01', category: 'Food', limit: 800, spent: 576, icon: '🛒', color: '#6366F1' },
  { id: 'b02', category: 'Transport', limit: 300, spent: 135, icon: '🚌', color: '#38BDF8' },
  { id: 'b03', category: 'Entertainment', limit: 300, spent: 246, icon: '🎬', color: '#F59E0B' },
  { id: 'b04', category: 'Shopping', limit: 500, spent: 155, icon: '🛍️', color: '#22C55E' },
  { id: 'b05', category: 'Bills', limit: 1500, spent: 1345, icon: '⚡', color: '#F43F5E' },
  { id: 'b06', category: 'Health', limit: 300, spent: 165, icon: '💊', color: '#A78BFA' },
];

function loadData(key, defaults) {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : defaults;
  } catch { return defaults; }
}

function saveData(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

let transactions = loadData(STORAGE_KEYS.TX, DEFAULT_TRANSACTIONS);
let budgets = loadData(STORAGE_KEYS.BUDGETS, DEFAULT_BUDGETS);

/* ==========================================================================
   Navigation / SPA Router
   ========================================================================== */
const pages = ['dashboard', 'transactions', 'budgets', 'reports', 'settings'];

function navigateTo(page) {
  if (!pages.includes(page)) return;

  // Update page views
  document.querySelectorAll('.page-view').forEach(p => {
    if (p.id === `page-${page}`) {
      p.classList.add('active-page');
    } else {
      p.classList.remove('active-page');
    }
  });

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
    link.setAttribute('aria-current', link.dataset.page === page ? 'page' : 'false');
  });

  // Close mobile nav
  const nav = document.getElementById('main-nav');
  nav.classList.remove('mobile-open');
  document.getElementById('mobile-nav-toggle').setAttribute('aria-expanded', 'false');

  // Render page-specific content
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'budgets': renderBudgets(); break;
    case 'reports': break; // Static SVG charts
    case 'settings': break;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Bind navigation
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });

  // Mobile toggle
  document.getElementById('mobile-nav-toggle').addEventListener('click', () => {
    const nav = document.getElementById('main-nav');
    const isOpen = nav.classList.toggle('mobile-open');
    document.getElementById('mobile-nav-toggle').setAttribute('aria-expanded', isOpen);
  });

  // Initialize
  initModal();
  initSettingsTabs();
  initThemeToggle();
  initChartPeriodToggle();
  initTransactionFilters();
  renderDashboard();
  renderTransactions();
  renderBudgets();

  // Set today date as default for transaction modal
  document.getElementById('tx-date').valueAsDate = new Date();
});

/* ==========================================================================
   Dashboard Render
   ========================================================================== */
function renderDashboard() {
  renderRecentTransactions();
  renderDashboardBudgets();
}

function formatAmount(amount, type) {
  const fmt = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0 });
  const prefix = type === 'income' ? '+' : '-';
  return prefix + fmt.format(amount);
}

function formatCurrency(amount) {
  const f = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0 });
  return f.format(Math.abs(amount));
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hôm nay';
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
}

function renderRecentTransactions() {
  const tbody = document.getElementById('recent-tx-tbody');
  if (!tbody) return;
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  tbody.innerHTML = recent.map(tx => `
    <tr>
      <td>
        <div class="merchant-cell">
          <div class="merchant-icon">${CATEGORY_ICONS[tx.category] || '📦'}</div>
          <div class="merchant-details">
            <span class="merchant-name">${escapeHtml(tx.merchant)}</span>
          </div>
        </div>
      </td>
      <td><span class="category-tag">${escapeHtml(tx.category)}</span></td>
      <td style="color:var(--text-secondary);font-size:0.85rem;">${formatDate(tx.date)}</td>
      <td class="table-amount ${tx.type === 'income' ? 'highlight-positive' : 'highlight-negative'}">
        ${formatAmount(tx.amount, tx.type)}
      </td>
    </tr>
  `).join('');
}

function renderDashboardBudgets() {
  const container = document.getElementById('dashboard-budget-list');
  if (!container) return;
  container.innerHTML = budgets.map(b => {
    const pct = Math.min(Math.round((b.spent / b.limit) * 100), 100);
    const cls = pct >= 80 ? 'warning' : pct <= 50 ? 'safe' : '';
    return `
      <div class="budget-item">
        <div class="budget-info">
          <span class="budget-category-name">
            ${b.icon} ${b.category}
          </span>
          <span class="budget-values">
            $${b.spent}/$${b.limit}
            <span class="budget-percent ${pct >= 80 ? 'highlight-negative' : pct <= 50 ? 'highlight-positive' : ''}">${pct}%</span>
          </span>
        </div>
        <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${b.category} budget: ${pct}% used">
          <div class="progress-fill ${cls}" style="width:${pct}%;background:${!cls ? b.color : ''}"></div>
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   Transactions Page Render
   ========================================================================== */
let txPage = 1;
const TX_PER_PAGE = 8;
let txFilters = { search: '', type: '', category: '', month: '' };

function getFilteredTx() {
  return transactions.filter(tx => {
    const search = txFilters.search.toLowerCase();
    const matchSearch = !search || tx.merchant.toLowerCase().includes(search) || tx.category.toLowerCase().includes(search);
    const matchType = !txFilters.type || tx.type === txFilters.type;
    const matchCat = !txFilters.category || tx.category === txFilters.category;
    const matchMonth = !txFilters.month || tx.date.includes(txFilters.month);
    return matchSearch && matchType && matchCat && matchMonth;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTransactions() {
  const filtered = getFilteredTx();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / TX_PER_PAGE));
  if (txPage > totalPages) txPage = totalPages;
  const paged = filtered.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  const tbody = document.getElementById('all-tx-tbody');
  const emptyState = document.getElementById('tx-empty-state');
  if (!tbody) return;

  if (paged.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    tbody.innerHTML = paged.map(tx => `
      <tr id="tx-row-${tx.id}">
        <td>
          <div class="merchant-cell">
            <div class="merchant-icon">${CATEGORY_ICONS[tx.category] || '📦'}</div>
            <div class="merchant-details">
              <span class="merchant-name">${escapeHtml(tx.merchant)}</span>
            </div>
          </div>
        </td>
        <td><span class="category-tag">${escapeHtml(tx.category)}</span></td>
        <td style="color:var(--text-secondary);font-size:0.85rem;">${formatDate(tx.date)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;font-weight:500;padding:0.2rem 0.6rem;border-radius:var(--radius-full);background:${tx.status === 'completed' ? 'var(--positive-bg)' : 'var(--warning-bg)'};color:${tx.status === 'completed' ? 'var(--positive)' : 'var(--warning)'};">
            ${tx.status === 'completed' ? '✓' : '⏳'} ${tx.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
          </span>
        </td>
        <td class="table-amount ${tx.type === 'income' ? 'highlight-positive' : 'highlight-negative'}">
          ${formatAmount(tx.amount, tx.type)}
        </td>
        <td style="text-align:center;">
          <button class="btn-secondary" onclick="deleteTx('${tx.id}')" aria-label="Xóa ${escapeHtml(tx.merchant)}" style="padding:0.3rem 0.65rem;font-size:0.75rem;color:var(--negative);border-color:var(--negative-border);">
            Xóa
          </button>
        </td>
      </tr>
    `).join('');
  }

  const countEl = document.getElementById('tx-count-label');
  const pageEl = document.getElementById('tx-page-indicator');
  if (countEl) countEl.textContent = `Hiển thị ${paged.length} / ${total} giao dịch`;
  if (pageEl) pageEl.textContent = `Trang ${txPage} / ${totalPages}`;

  const prevBtn = document.getElementById('tx-prev-page');
  const nextBtn = document.getElementById('tx-next-page');
  if (prevBtn) prevBtn.disabled = txPage <= 1;
  if (nextBtn) nextBtn.disabled = txPage >= totalPages;
}

function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveData(STORAGE_KEYS.TX, transactions);
  renderTransactions();
  renderRecentTransactions();
  showToast('Giao dịch đã bị xóa.', '🗑️');
}

window.deleteTx = deleteTx; // expose for inline onclick

function initTransactionFilters() {
  const searchEl = document.getElementById('tx-search');
  const typeEl = document.getElementById('tx-filter-type');
  const catEl = document.getElementById('tx-filter-category');
  const monthEl = document.getElementById('tx-filter-month');
  const prevBtn = document.getElementById('tx-prev-page');
  const nextBtn = document.getElementById('tx-next-page');

  if (searchEl) searchEl.addEventListener('input', e => { txFilters.search = e.target.value; txPage = 1; renderTransactions(); });
  if (typeEl) typeEl.addEventListener('change', e => { txFilters.type = e.target.value; txPage = 1; renderTransactions(); });
  if (catEl) catEl.addEventListener('change', e => { txFilters.category = e.target.value; txPage = 1; renderTransactions(); });
  if (monthEl) monthEl.addEventListener('change', e => { txFilters.month = e.target.value; txPage = 1; renderTransactions(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { txPage--; renderTransactions(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { txPage++; renderTransactions(); });

  // Export CSV
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportCSV);
}

function exportCSV() {
  const headers = ['Ngày', 'Người thu', 'Danh mục', 'Loại', 'Số tiền', 'Trạng thái'];
  const rows = transactions.map(tx => [
    tx.date, `"${tx.merchant}"`, tx.category, tx.type,
    (tx.type === 'income' ? '' : '-') + tx.amount, tx.status
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'luxe-transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Đã xuất CSV thành công!', '📊');
}

/* ==========================================================================
   Budgets Page Render
   ========================================================================== */
function renderBudgets() {
  const grid = document.getElementById('budget-cards-grid');
  if (!grid) return;

  grid.innerHTML = budgets.map(b => {
    const pct = Math.min(Math.round((b.spent / b.limit) * 100), 100);
    const remaining = b.limit - b.spent;
    const cls = pct >= 80 ? 'warning' : pct <= 50 ? 'safe' : '';
    const statusColor = pct >= 80 ? 'var(--negative)' : pct <= 50 ? 'var(--positive)' : 'var(--text-secondary)';

    return `
      <div class="budget-overview-card" id="budget-card-${b.id}">
        <div class="budget-card-top">
          <span class="budget-card-title">
            ${b.icon} ${b.category}
          </span>
          <span style="font-size:0.8rem;font-weight:600;color:${statusColor};">${pct}% đã dùng</span>
        </div>

        <div style="margin-bottom:0.5rem;">
          <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${b.category} ngân sách ${pct}% đã dùng">
            <div class="progress-fill ${cls}" style="width:${pct}%;${!cls ? `background:${b.color}` : ''}"></div>
          </div>
        </div>

        <div class="budget-spend-numbers">
          <div>
            <div style="font-family:var(--font-display);font-size:1.35rem;font-weight:700;">${formatCurrency(b.spent)}</div>
            <div style="font-size:0.775rem;color:var(--text-muted);">trong ngân sách ${formatCurrency(b.limit)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:600;color:${remaining > 0 ? 'var(--positive)' : 'var(--negative)'};">
              ${remaining >= 0 ? formatCurrency(remaining) : formatCurrency(-remaining)}
            </div>
            <div style="font-size:0.775rem;color:var(--text-muted);">${remaining >= 0 ? 'còn lại' : 'vượt ngân sách'}</div>
          </div>
        </div>

        ${pct >= 80 ? `<div class="insight-card" style="margin-top:0.75rem;padding:0.75rem;gap:0.6rem;">
          <span style="font-size:1rem;">⚠️</span>
          <p style="font-size:0.8rem;color:var(--text-primary);">Gần giới hạn — chỉ còn ${formatCurrency(remaining)} cho ${b.category} trong tháng này.</p>
        </div>` : ''}
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   Modal: Add Transaction
   ========================================================================== */
function initModal() {
  const modal = document.getElementById('add-tx-modal');
  const openBtns = ['open-add-tx-modal', 'open-add-tx-modal-2'];
  const closeBtn = document.getElementById('close-add-tx-modal');
  const cancelBtn = document.getElementById('cancel-add-tx');
  const confirmBtn = document.getElementById('confirm-add-tx');
  const typeExpense = document.getElementById('type-expense');
  const typeIncome = document.getElementById('type-income');
  const typeValue = document.getElementById('tx-type-value');

  openBtns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openModal());
  });

  function openModal() {
    modal.classList.add('open');
    document.getElementById('tx-merchant').focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('add-tx-form').reset();
    document.getElementById('tx-date').valueAsDate = new Date();
    // Reset type
    typeValue.value = 'expense';
    typeExpense.classList.add('active', 'expense');
    typeIncome.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Keyboard trap
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  // Type toggle
  typeExpense.addEventListener('click', () => {
    typeValue.value = 'expense';
    typeExpense.classList.add('active', 'expense');
    typeExpense.setAttribute('aria-pressed', 'true');
    typeIncome.classList.remove('active');
    typeIncome.setAttribute('aria-pressed', 'false');
  });

  typeIncome.addEventListener('click', () => {
    typeValue.value = 'income';
    typeIncome.classList.add('active', 'income');
    typeIncome.setAttribute('aria-pressed', 'true');
    typeExpense.classList.remove('active', 'expense');
    typeExpense.setAttribute('aria-pressed', 'false');
  });

  // Save transaction
  confirmBtn.addEventListener('click', () => {
    const merchant = document.getElementById('tx-merchant').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const category = document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;
    const type = typeValue.value;

    if (!merchant || !amount || isNaN(amount) || amount <= 0 || !category || !date) {
       showToast('Vui lòng điền đầy đủ thông tin chính xác.', '⚠️');
      return;
    }

    const newTx = {
      id: 't' + Date.now(),
      merchant, category, type, date,
      amount: Math.abs(amount),
      status: 'completed'
    };

    transactions.unshift(newTx);
    saveData(STORAGE_KEYS.TX, transactions);

    // Update budget spent if expense
    if (type === 'expense') {
      const bud = budgets.find(b => b.category === category);
      if (bud) {
        bud.spent = Math.min(bud.spent + newTx.amount, bud.limit * 1.5);
        saveData(STORAGE_KEYS.BUDGETS, budgets);
      }
    }

    closeModal();
    renderRecentTransactions();
    renderTransactions();
    renderDashboardBudgets();
    renderBudgets();
    showToast(`Giao dịch đã thêm: ${type === 'income' ? '+' : '-'}${formatCurrency(amount)} · ${merchant}`, '✅');
  });
}

/* ==========================================================================
   Settings Tabs
   ========================================================================== */
function initSettingsTabs() {
  const tabBtns = document.querySelectorAll('.settings-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update tab buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show target panel
      const panelId = btn.dataset.panel;
      document.querySelectorAll('.settings-panel').forEach(p => {
        p.style.display = p.id === panelId ? 'flex' : 'none';
      });
    });
  });

  // Save profile feedback
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) saveBtn.addEventListener('click', () => showToast('Hồ sơ đã được lưu!', '✅'));
}

/* ==========================================================================
   Theme Toggle
   ========================================================================== */
function initThemeToggle() {
  const darkBtn = document.getElementById('theme-dark');
  const lightBtn = document.getElementById('theme-light');

  if (darkBtn) darkBtn.addEventListener('click', () => {
    document.body.classList.remove('theme-light');
    darkBtn.style.borderColor = 'var(--accent-brand)';
    darkBtn.style.color = 'var(--accent-brand-light)';
    lightBtn.style.borderColor = '';
    lightBtn.style.color = '';
    darkBtn.setAttribute('aria-pressed', 'true');
    lightBtn.setAttribute('aria-pressed', 'false');
    showToast('Chế độ tối đã bật', '🌙');
  });

  if (lightBtn) lightBtn.addEventListener('click', () => {
    document.body.classList.add('theme-light');
    lightBtn.style.borderColor = 'var(--accent-brand)';
    lightBtn.style.color = 'var(--accent-brand-light)';
    darkBtn.style.borderColor = '';
    darkBtn.style.color = '';
    lightBtn.setAttribute('aria-pressed', 'true');
    darkBtn.setAttribute('aria-pressed', 'false');
    showToast('Chế độ sáng đã bật', '☀️');
  });
}

/* ==========================================================================
   Chart Period Toggle
   ========================================================================== */
function initChartPeriodToggle() {
  const weekBtn = document.getElementById('chart-weekly');
  const monthBtn = document.getElementById('chart-monthly');

  const monthLabels = document.querySelector('.chart-axis-labels');

  if (weekBtn) weekBtn.addEventListener('click', () => {
    weekBtn.classList.add('active');
    weekBtn.setAttribute('aria-pressed', 'true');
    monthBtn.classList.remove('active');
    monthBtn.setAttribute('aria-pressed', 'false');
    if (monthLabels) monthLabels.innerHTML = '<span>Thứ 2</span><span>Thứ 3</span><span>Thứ 4</span><span>Thứ 5</span><span>Thứ 6</span><span>Thứ 7</span><span>Chủ nhật</span>';
  });

  if (monthBtn) monthBtn.addEventListener('click', () => {
    monthBtn.classList.add('active');
    monthBtn.setAttribute('aria-pressed', 'true');
    weekBtn.classList.remove('active');
    weekBtn.setAttribute('aria-pressed', 'false');
    if (monthLabels) monthLabels.innerHTML = '<span>1</span><span>5</span><span>9</span><span>13</span><span>17</span><span>22</span><span>27</span><span>30</span>';
  });
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */
function showToast(message, icon = 'ℹ️', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<span aria-hidden="true">${icon}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

/* ==========================================================================
   Utilities
   ========================================================================== */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
