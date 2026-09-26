/**
 * @file Settings feature module.
 * 2-column layout: 240px left nav + flex:1 right panel.
 * Tabs: Profile, Financial, Notifications, Appearance, Security.
 * Dirty-state save bar appears on any change.
 */

import dataService from '../../services/dataService.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';
import { escapeHtml } from '../../utils/format.js';
import { setActiveCurrency, getActiveCurrency } from '../../utils/format.js';
import { CATEGORIES } from '../../constants/categories.js';
import { pageHeaderHTML } from '../../components/ui/PageHeader.js';
import { getRoute } from '../../config/routes.js';

/* --------------------------------------------------------------- *
 * Constants
 * --------------------------------------------------------------- */
const MOCK_USER = {
  firstName: 'Alex',
  lastName: 'Kim',
  email: 'alex.kim@luxe.finance',
  phone: '',
  timezone: 'Asia/Ho_Chi_Minh',
};

const CURRENCIES = [
  { value: 'VND', label: 'VND (₫)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JPY', label: 'JPY (¥)' },
];

const NUMBER_FORMATS = [
  { value: 'vi', label: '1.234.567 (Việt Nam)' },
  { value: 'en', label: '1,234,567 (Anh/Mỹ)' },
  { value: 'de', label: '1 234 567 (Châu Âu)' },
];

const BUDGET_START_DAYS = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `Ngày ${i + 1}`,
}));

const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Hà Nội / TP.HCM (UTC+7)' },
  { value: 'Asia/Bangkok',     label: 'Bangkok (UTC+7)' },
  { value: 'Asia/Singapore',   label: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo',       label: 'Tokyo (UTC+9)' },
  { value: 'Europe/London',    label: 'London (UTC+0/+1)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
];

const ACCENT_COLORS = [
  { value: '#6366F1', label: 'Indigo'  },
  { value: '#22C55E', label: 'Emerald' },
  { value: '#38BDF8', label: 'Sky'     },
  { value: '#F59E0B', label: 'Amber'   },
  { value: '#F43F5E', label: 'Rose'    },
  { value: '#A78BDA', label: 'Purple'  },
];

const TABS = [
  { id: 'profile',       label: 'Hồ sơ',     icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  { id: 'financial',     label: 'Tài chính', icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
  { id: 'notifications', label: 'Thông báo', icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
  { id: 'appearance',    label: 'Giao diện', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>' },
  { id: 'security',      label: 'Bảo mật',   icon: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
];

/* --------------------------------------------------------------- *
 * Shared helpers
 * --------------------------------------------------------------- */
function icon(paths, size = 16, color = 'currentColor') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function selectHTML(id, value, options, attrs = '') {
  const opts = options.map(o =>
    `<option value="${escapeHtml(o.value)}" ${o.value === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
  ).join('');
  return `<select class="select-dropdown" id="${id}" ${attrs}>${opts}</select>`;
}

function inputHTML(id, type, value, placeholder = '', attrs = '') {
  return `<input class="form-input" type="${type}" id="${id}" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder)}" ${attrs}/>`;
}

function toggleHTML(id, checked, label) {
  return `
    <label class="toggle-switch" for="${id}" aria-label="${escapeHtml(label)}">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} aria-checked="${checked}"/>
      <span class="toggle-slider"></span>
    </label>`;
}

function sectionHeadHTML(title) {
  return `<div class="settings-section-head"><span>${title}</span></div>`;
}

function rowHTML(title, desc, control, opts = {}) {
  const extraClass = opts.destructive ? ' settings-row--destructive' : '';
  return `
    <div class="settings-row${extraClass}">
      <div class="settings-row-label">
        <div class="settings-label-title${opts.destructive ? ' settings-label-title--red' : ''}">${title}</div>
        ${desc ? `<div class="settings-label-desc">${desc}</div>` : ''}
      </div>
      <div class="settings-row-control">${control}</div>
    </div>`;
}

/* --------------------------------------------------------------- *
 * Panel: Profile
 * --------------------------------------------------------------- */
function profilePanelHTML(user) {
  const initials = (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
  return `
    <div class="settings-panel" id="panel-profile" role="tabpanel" aria-labelledby="stab-profile" hidden>
      ${sectionHeadHTML('Ảnh đại diện')}
      <div class="settings-avatar-row">
        <div class="settings-avatar" aria-hidden="true">${initials}</div>
        <div>
          <div style="font-weight:700;font-size:1rem;margin-bottom:0.2rem;">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:0.75rem;">${escapeHtml(user.email)}</div>
          <button class="btn-secondary" data-action="change-photo" style="font-size:0.8rem;padding:0.3rem 0.85rem;">
            ${icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', 13)}
            Đổi ảnh
          </button>
        </div>
      </div>

      ${sectionHeadHTML('Thông tin cá nhân')}
      <div class="settings-form-grid">
        <div class="form-group">
          <label class="form-label" for="s-first-name">Họ</label>
          ${inputHTML('s-first-name', 'text', user.firstName, 'Họ', 'data-dirty="profile"')}
        </div>
        <div class="form-group">
          <label class="form-label" for="s-last-name">Tên</label>
          ${inputHTML('s-last-name', 'text', user.lastName, 'Tên', 'data-dirty="profile"')}
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label" for="s-email">Email</label>
          ${inputHTML('s-email', 'email', user.email, '', 'readonly data-dirty="profile"')}
        </div>
        <div class="form-group">
          <label class="form-label" for="s-phone">Số điện thoại</label>
          ${inputHTML('s-phone', 'tel', user.phone || '', '+84 xxx xxx xxx', 'data-dirty="profile"')}
        </div>
        <div class="form-group">
          <label class="form-label" for="s-timezone">Múi giờ</label>
          ${selectHTML('s-timezone', user.timezone, TIMEZONES, 'data-dirty="profile"')}
        </div>
      </div>
    </div>`;
}

/* --------------------------------------------------------------- *
 * Panel: Financial
 * --------------------------------------------------------------- */
function financialPanelHTML(s) {
  const catRows = CATEGORIES.map(c => `
    <div class="settings-cat-row" data-cat-id="${escapeHtml(c.id)}">
      <span class="settings-cat-dot" style="background:${c.color};"></span>
      <span class="settings-cat-icon">${c.icon}</span>
      <span class="settings-cat-name">${escapeHtml(c.labelVi)}</span>
      <span class="settings-cat-type ${c.type === 'income' ? 'settings-cat-income' : 'settings-cat-expense'}">${c.type === 'income' ? 'Thu' : 'Chi'}</span>
      <div class="settings-cat-actions">
        <button class="settings-icon-btn" data-action="edit-cat" data-cat-id="${escapeHtml(c.id)}" title="Sửa">
          ${icon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', 13)}
        </button>
        <button class="settings-icon-btn settings-icon-btn--danger" data-action="delete-cat" data-cat-id="${escapeHtml(c.id)}" title="Xoá">
          ${icon('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>', 13)}
        </button>
      </div>
    </div>`).join('');

  return `
    <div class="settings-panel" id="panel-financial" role="tabpanel" aria-labelledby="stab-financial" hidden>
      ${sectionHeadHTML('Tiền tệ & Định dạng')}
      ${rowHTML('Đơn vị tiền tệ', 'Áp dụng cho toàn bộ số dư và báo cáo',
        selectHTML('s-currency', s.currency, CURRENCIES, 'data-dirty="financial"'))}
      ${rowHTML('Định dạng số', 'Cách hiển thị số lớn',
        selectHTML('s-number-format', s.numberFormat || 'vi', NUMBER_FORMATS, 'data-dirty="financial"'))}

      ${sectionHeadHTML('Kỳ ngân sách')}
      ${rowHTML('Ngày bắt đầu kỳ', 'Ngày trong tháng kỳ ngân sách bắt đầu',
        selectHTML('s-budget-start', s.budgetStartDay || '1', BUDGET_START_DAYS, 'data-dirty="financial"'))}

      ${sectionHeadHTML('Danh mục')}
      <div class="settings-cat-list">${catRows}</div>
      <div>
        <button class="btn-secondary settings-add-cat-btn" data-action="add-cat" style="font-size:0.82rem;">
          ${icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 13)}
          Thêm danh mục
        </button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------- *
 * Panel: Notifications
 * --------------------------------------------------------------- */
function notificationsPanelHTML(s) {
  const n = s.notifications || {};
  return `
    <div class="settings-panel" id="panel-notifications" role="tabpanel" aria-labelledby="stab-notifications" hidden>
      ${sectionHeadHTML('Cảnh báo')}
      ${rowHTML('Cảnh báo vượt ngân sách',
        'Thông báo khi chi tiêu vượt 80% hạn mức bất kỳ danh mục nào',
        toggleHTML('notif-budget', n.budgetWarning !== false, 'Cảnh báo vượt ngân sách'))}
      ${rowHTML('Nhắc hoá đơn định kỳ',
        'Nhắc nhở trước 3 ngày khi hoá đơn định kỳ đến hạn',
        toggleHTML('notif-bills', n.recurringBills !== false, 'Nhắc hoá đơn định kỳ'))}
      ${rowHTML('Cảnh báo giao dịch lớn',
        'Cảnh báo khi có giao dịch vượt quá 500.000₫',
        toggleHTML('notif-large-tx', n.largeTransaction || false, 'Cảnh báo giao dịch lớn'))}

      ${sectionHeadHTML('Báo cáo')}
      ${rowHTML('Báo cáo hàng tháng',
        'Nhận tóm tắt tài chính vào đầu mỗi tháng',
        toggleHTML('notif-monthly', n.monthlyReport !== false, 'Báo cáo hàng tháng'))}
      ${rowHTML('Tóm tắt hàng tuần',
        'Bản tóm tắt ngắn mỗi Chủ nhật',
        toggleHTML('notif-weekly', n.weeklySummary !== false, 'Tóm tắt hàng tuần'))}
      ${rowHTML('Đề xuất AI',
        'Mẹo tài chính cá nhân và phát hiện bất thường',
        toggleHTML('notif-ai', n.aiInsights !== false, 'Đề xuất AI'))}
    </div>`;
}

/* --------------------------------------------------------------- *
 * Panel: Appearance
 * --------------------------------------------------------------- */
function appearancePanelHTML(s) {
  const theme = s.theme || 'dark';
  const accent = s.accentColor || '#6366F1';

  const themeButtons = ['dark', 'light', 'system'].map(t => {
    const labels = { dark: '🌙 Tối', light: '☀️ Sáng', system: '💻 Hệ thống' };
    return `<button class="settings-theme-btn ${theme === t ? 'active' : ''}" data-theme="${t}" aria-pressed="${theme === t}">${labels[t]}</button>`;
  }).join('');

  const accentSwatches = ACCENT_COLORS.map(c =>
    `<button class="settings-accent-swatch ${c.value === accent ? 'active' : ''}"
      data-accent="${c.value}" style="background:${c.value};" title="${c.label}" aria-label="${c.label}" aria-pressed="${c.value === accent}"></button>`
  ).join('');

  return `
    <div class="settings-panel" id="panel-appearance" role="tabpanel" aria-labelledby="stab-appearance" hidden>
      ${sectionHeadHTML('Chủ đề')}
      ${rowHTML('Giao diện', 'Chọn chủ đề sáng, tối hoặc theo hệ thống',
        `<div class="settings-theme-group">${themeButtons}</div>`)}
      ${rowHTML('Màu nhấn', 'Màu chính sử dụng trên toàn giao diện',
        `<div class="settings-accent-group">${accentSwatches}</div>`)}

      ${sectionHeadHTML('Hiệu ứng')}
      ${rowHTML('Hiệu ứng hoạt hình',
        'Bật chuyển tiếp và hoạt ảnh mượt mà',
        toggleHTML('toggle-animations', s.animations !== false, 'Hiệu ứng hoạt hình'))}
      ${rowHTML('Chế độ gọn',
        'Giảm khoảng cách để hiển thị nhiều thông tin hơn',
        toggleHTML('toggle-compact', s.compactMode || false, 'Chế độ gọn'))}
    </div>`;
}

function sessionDeviceIcon(device) {
  const isMobile = /iPhone|Android|iOS|Mobile|Điện thoại/i.test(device);
  const mobilePaths = '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>';
  const desktopPaths = '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
  return icon(isMobile ? mobilePaths : desktopPaths, 16);
}

/* --------------------------------------------------------------- *
 * Panel: Security
 * --------------------------------------------------------------- */
function securityPanelHTML() {
  const sessions = [
    { device: 'Chrome trên Windows', location: 'Hà Nội, VN', time: 'Hiện tại', current: true },
    { device: 'Safari trên iPhone',   location: 'TP.HCM, VN',  time: '2 giờ trước', current: false },
  ];
  const sessionRows = sessions.map(ses => `
    <div class="settings-session-row">
      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="session-device-icon" aria-hidden="true">${sessionDeviceIcon(ses.device)}</span>
          <span style="font-size:0.875rem;font-weight:600;">${ses.device}${ses.current ? ' <span class="settings-session-badge">Hiện tại</span><span class="session-active-dot" aria-label="Đang hoạt động"></span>' : ''}</span>
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${ses.location} · ${ses.time}</div>
      </div>
      ${ses.current ? '' : `<button class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.7rem;" data-action="revoke-session">Thu hồi</button>`}
    </div>`).join('');

  return `
    <div class="settings-panel" id="panel-security" role="tabpanel" aria-labelledby="stab-security" hidden>
      ${sectionHeadHTML('Mật khẩu')}
      <div class="settings-form-grid settings-form-grid--narrow">
        <div class="form-group">
          <label class="form-label" for="s-pw-current">Mật khẩu hiện tại</label>
          <div class="password-input-wrapper">
            <input class="form-input password-input" type="password" id="s-pw-current" placeholder="••••••••"/>
            <button type="button" class="password-toggle" data-pw-toggle="s-pw-current" aria-label="Hiện/ẩn mật khẩu" tabindex="-1">
              <span class="password-toggle-icon" aria-hidden="true">${icon('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', 14)}</span>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="s-pw-new">Mật khẩu mới</label>
          <div class="password-input-wrapper">
            <input class="form-input password-input" type="password" id="s-pw-new" placeholder="Tối thiểu 8 ký tự"/>
            <button type="button" class="password-toggle" data-pw-toggle="s-pw-new" aria-label="Hiện/ẩn mật khẩu" tabindex="-1">
              <span class="password-toggle-icon" aria-hidden="true">${icon('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', 14)}</span>
            </button>
          </div>
          <div class="password-strength" id="pw-strength" style="display:none;">
            <div class="password-strength-bar">
              <div class="password-strength-fill" id="pw-strength-fill"></div>
            </div>
            <span class="password-strength-text" id="pw-strength-text"></span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="s-pw-confirm">Xác nhận mật khẩu mới</label>
          <div class="password-input-wrapper">
            <input class="form-input password-input" type="password" id="s-pw-confirm" placeholder="Nhập lại mật khẩu"/>
            <button type="button" class="password-toggle" data-pw-toggle="s-pw-confirm" aria-label="Hiện/ẩn mật khẩu" tabindex="-1">
              <span class="password-toggle-icon" aria-hidden="true">${icon('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', 14)}</span>
            </button>
          </div>
          <span class="form-error" id="pw-confirm-error"></span>
        </div>
        <div>
          <button class="btn-secondary" id="btn-change-password" data-action="change-password" style="font-size:0.85rem;" disabled>Đổi mật khẩu</button>
        </div>
      </div>

      ${sectionHeadHTML('Bảo mật nâng cao')}
      ${rowHTML('Xác thực hai yếu tố (2FA)',
        'Yêu cầu mã xác nhận mỗi lần đăng nhập',
        toggleHTML('toggle-2fa', false, 'Xác thực hai yếu tố'))}

      ${sectionHeadHTML('Phiên đăng nhập')}
      <div class="settings-sessions-list">${sessionRows}</div>
      <div>
        <button class="btn-secondary" data-action="revoke-all" style="font-size:0.82rem;">Thu hồi tất cả phiên khác</button>
      </div>

      ${sectionHeadHTML('Vùng nguy hiểm')}
      ${rowHTML('Xoá tài khoản',
        'Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu. Không thể hoàn tác.',
        `<button class="btn-danger" id="btn-delete-account" data-action="delete-account">
          ${icon('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>', 13)} Xoá tài khoản
        </button>`,
        { destructive: true })}
    </div>`;
}

/* --------------------------------------------------------------- *
 * Shell
 * --------------------------------------------------------------- */
function settingsShellHTML(user, s, route) {
  const navItems = TABS.map((t, i) => `
    <button class="stab ${i === 0 ? 'stab--active' : ''}" id="stab-${t.id}" data-panel="panel-${t.id}"
      role="tab" aria-selected="${i === 0}" aria-controls="panel-${t.id}">
      ${icon(t.icon, 16)}
      <span>${t.label}</span>
    </button>`).join('');

  return `
    ${pageHeaderHTML({
      title: route.title,
      description: route.description,
    })}
    <div class="settings-shell">

      <nav class="settings-nav" role="tablist" aria-label="Danh mục cài đặt">
        ${navItems}
      </nav>
      <div class="settings-content-area">
        ${profilePanelHTML(user)}
        ${financialPanelHTML(s)}
        ${notificationsPanelHTML(s)}
        ${appearancePanelHTML(s)}
        ${securityPanelHTML()}
      </div>
    </div>
    <div class="settings-save-bar" id="settings-save-bar" aria-live="polite" hidden>
      <span class="settings-save-bar-msg">
        ${icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 15)}
        Bạn có thay đổi chưa được lưu
      </span>
      <div style="display:flex;gap:0.5rem;">
        <button class="btn-secondary" id="settings-discard-btn">Huỷ</button>
        <button class="btn-add-transaction" id="settings-save-btn">Lưu thay đổi</button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------- *
 * Main render
 * --------------------------------------------------------------- */
export async function render(container, page = 'settings') {
  const route = getRoute(page);
  const s = await dataService.getSettings();
  const user = { ...MOCK_USER };

  document.body.classList.toggle('theme-light', s.theme === 'light');
  document.body.classList.toggle('compact', !!s.compactMode);
  document.body.classList.toggle('no-animations', !s.animations);

  container.innerHTML = settingsShellHTML(user, s, route);

  activateTab(container, 'panel-profile');
  attachListeners(container, s);
}

/* --------------------------------------------------------------- *
 * Tab activation
 * --------------------------------------------------------------- */
function activateTab(container, panelId) {
  container.querySelectorAll('.stab').forEach(btn => {
    const active = btn.dataset.panel === panelId;
    btn.classList.toggle('stab--active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  container.querySelectorAll('.settings-panel').forEach(p => {
    const active = p.id === panelId;
    if (active) {
      p.removeAttribute('hidden');
    } else {
      p.setAttribute('hidden', '');
    }
  });
}

/* --------------------------------------------------------------- *
 * Dirty state
 * --------------------------------------------------------------- */
function setDirty(container, dirty) {
  const bar = container.querySelector('#settings-save-bar');
  if (!bar) return;
  if (dirty) {
    bar.removeAttribute('hidden');
  } else {
    bar.setAttribute('hidden', '');
  }
}

/* --------------------------------------------------------------- *
 * Event listeners
 * --------------------------------------------------------------- */
function attachListeners(container, settings) {
  if (container.__settingsAbort) {
    container.__settingsAbort.abort();
  }
  const ctrl = new AbortController();
  container.__settingsAbort = ctrl;
  const sig = { signal: ctrl.signal };

  let dirty = false;

  function markDirty() {
    dirty = true;
    setDirty(container, true);
  }

  /* ---- Tab nav ---- */
  container.querySelectorAll('.stab').forEach(btn => {
    btn.addEventListener('click', () => activateTab(container, btn.dataset.panel), sig);
  });

  /* ---- Dirty detection on inputs & selects ---- */
  container.addEventListener('input', e => {
    if (e.target.matches('[data-dirty]')) markDirty();
  }, sig);
  container.addEventListener('change', e => {
    if (e.target.matches('[data-dirty]')) markDirty();
  }, sig);

  /* ---- Save bar ---- */
  container.querySelector('#settings-save-btn')?.addEventListener('click', async () => {
    const currency = container.querySelector('#s-currency')?.value;
    const budgetStartDay = container.querySelector('#s-budget-start')?.value;
    const numberFormat = container.querySelector('#s-number-format')?.value;
    if (currency || budgetStartDay || numberFormat) {
      await dataService.updateSettings({ currency, budgetStartDay, numberFormat });
      if (currency) setActiveCurrency(currency);
      emit('data:changed');
    }
    dirty = false;
    setDirty(container, false);
    showToast('Cài đặt đã được lưu!', 'success');
  }, sig);

  container.querySelector('#settings-discard-btn')?.addEventListener('click', () => {
    dirty = false;
    setDirty(container, false);
    dataService.getSettings().then(s => {
       container.innerHTML = settingsShellHTML({ ...MOCK_USER }, s, route);
      activateTab(container, 'panel-profile');
      attachListeners(container, s);
    });
  }, sig);

  /* ---- Instant toggles (no dirty bar needed) ---- */
  const instantToggles = {
    'notif-budget':    ['notifications', 'budgetWarning'],
    'notif-bills':     ['notifications', 'recurringBills'],
    'notif-large-tx':  ['notifications', 'largeTransaction'],
    'notif-monthly':   ['notifications', 'monthlyReport'],
    'notif-weekly':    ['notifications', 'weeklySummary'],
    'notif-ai':        ['notifications', 'aiInsights'],
    'toggle-2fa':      ['security', 'twoFactor'],
    'toggle-compact':  ['compactMode'],
    'toggle-animations': ['animations'],
  };

  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    const path = instantToggles[cb.id];
    if (!path) return;
    cb.addEventListener('change', () => {
      const patch = {};
      if (path.length === 2) {
        patch[path[0]] = { ...(settings[path[0]] || {}), [path[1]]: cb.checked };
      } else {
        patch[path[0]] = cb.checked;
      }
      Object.assign(settings, patch);
      if (cb.id === 'toggle-compact') document.body.classList.toggle('compact', cb.checked);
      if (cb.id === 'toggle-animations') document.body.classList.toggle('no-animations', !cb.checked);
      dataService.updateSettings(settings).then(() => {
        showToast(cb.checked ? 'Đã bật' : 'Đã tắt', 'info');
      });
    });
  });

  /* ---- Theme buttons ---- */
  container.querySelectorAll('.settings-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.settings-theme-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      const t = btn.dataset.theme;
      settings.theme = t;
      document.body.classList.toggle('theme-light', t === 'light');
      dataService.updateSettings({ theme: t });
      showToast(`Giao diện ${btn.textContent.trim()} đã bật`, 'info');
    });
  });

  /* ---- Accent color swatches ---- */
  container.querySelectorAll('.settings-accent-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      container.querySelectorAll('.settings-accent-swatch').forEach(s => {
        s.classList.remove('active');
        s.setAttribute('aria-pressed', 'false');
      });
      sw.classList.add('active');
      sw.setAttribute('aria-pressed', 'true');
      const color = sw.dataset.accent;
      document.documentElement.style.setProperty('--accent-brand', color);
      dataService.updateSettings({ accentColor: color });
      showToast('Màu nhấn đã thay đổi', 'info');
    });
  });

  /* ---- Change photo ---- */
  container.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'change-photo') {
      showToast('Tính năng tải ảnh sẽ sớm ra mắt.', 'info');
    }

    if (action === 'change-password') {
      const current = container.querySelector('#s-pw-current')?.value;
      const pw = container.querySelector('#s-pw-new')?.value;
      const confirm = container.querySelector('#s-pw-confirm')?.value;
      if (!current) { showToast('Vui lòng nhập mật khẩu hiện tại.', 'error'); return; }
      if (!pw) { showToast('Vui lòng nhập mật khẩu mới.', 'error'); return; }
      if (pw !== confirm) { showToast('Mật khẩu xác nhận không khớp.', 'error'); return; }
      showToast('Mật khẩu đã được cập nhật!', 'success');
    }

    if (action === 'add-cat') {
      showToast('Tính năng thêm danh mục sẽ sớm ra mắt.', 'info');
    }

    if (action === 'edit-cat') {
      const catId = e.target.closest('[data-cat-id]')?.dataset.catId;
      showToast(`Sửa danh mục "${catId}" — sắp ra mắt.`, 'info');
    }

    if (action === 'delete-cat') {
      const catId = e.target.closest('[data-cat-id]')?.dataset.catId;
      if (confirm(`Xoá danh mục "${catId}"? Giao dịch hiện tại sẽ không bị ảnh hưởng.`)) {
        showToast(`Đã xoá danh mục "${catId}".`, 'success');
        e.target.closest('.settings-cat-row')?.remove();
      }
    }

    if (action === 'revoke-session') {
      e.target.closest('.settings-session-row')?.remove();
      showToast('Phiên đã bị thu hồi.', 'success');
    }

    if (action === 'revoke-all') {
      showToast('Tất cả phiên khác đã bị thu hồi.', 'success');
    }

    if (action === 'delete-account') {
      if (confirm('Bạn có chắc chắn muốn xoá tài khoản vĩnh viễn?\nHành động này không thể hoàn tác.')) {
        dataService.resetToDefaults();
        emit('data:changed');
        showToast('Tài khoản đã bị xoá. Dữ liệu đã được đặt lại.', 'success');
      }
    }
  }, sig);

  /* ---- Password visibility toggles ---- */
  container.querySelectorAll('[data-pw-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputId = btn.dataset.pwToggle;
      const input = container.querySelector('#' + inputId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const iconSpan = btn.querySelector('.password-toggle-icon');
      if (iconSpan) {
        iconSpan.innerHTML = isPassword
          ? icon('<path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 3-3c0-1.66-1.34-3-3-3a3 3 0 0 0-1.12-2.12Z"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><line x1="2" y1="2" x2="22" y2="22"/>', 14)
          : icon('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', 14);
      }
    });
  });

  /* ---- Password strength & confirm validation ---- */
  const pwNew = container.querySelector('#s-pw-new');
  const pwConfirm = container.querySelector('#s-pw-confirm');
  const pwStrengthEl = container.querySelector('#pw-strength');
  const pwStrengthFill = container.querySelector('#pw-strength-fill');
  const pwStrengthText = container.querySelector('#pw-strength-text');
  const pwConfirmError = container.querySelector('#pw-confirm-error');
  const btnChangePw = container.querySelector('#btn-change-password');

  function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;

    if (score <= 2) return { score, label: 'Yếu', color: 'var(--negative)' };
    if (score <= 4) return { score, label: 'Trung bình', color: 'var(--warning)' };
    return { score, label: 'Mạnh', color: 'var(--emerald-accent)' };
  }

  function validatePasswordForm() {
    const pw = pwNew?.value || '';
    const confirm = pwConfirm?.value || '';

    if (pwStrengthEl && pwStrengthFill && pwStrengthText) {
      if (pw) {
        const strength = getPasswordStrength(pw);
        pwStrengthEl.style.display = 'flex';
        pwStrengthFill.style.width = Math.max(10, (strength.score / 6) * 100) + '%';
        pwStrengthFill.style.background = strength.color;
        pwStrengthText.textContent = strength.label;
        pwStrengthText.style.color = strength.color;
      } else {
        pwStrengthEl.style.display = 'none';
      }
    }

    if (pwConfirmError) {
      if (confirm && pw && confirm !== pw) {
        pwConfirmError.style.display = 'block';
        pwConfirmError.textContent = 'Mật khẩu xác nhận không khớp.';
        pwConfirm.classList.add('is-invalid');
      } else if (confirm && pw && confirm === pw) {
        pwConfirmError.style.display = 'none';
        pwConfirm.classList.remove('is-invalid');
      } else {
        pwConfirmError.style.display = 'none';
        pwConfirm.classList.remove('is-invalid');
      }
    }

    if (btnChangePw) {
      const currentPw = container.querySelector('#s-pw-current')?.value || '';
      btnChangePw.disabled = !(currentPw && pw && confirm && pw === confirm);
    }
  }

  if (pwNew) pwNew.addEventListener('input', validatePasswordForm);
  if (pwConfirm) pwConfirm.addEventListener('input', validatePasswordForm);
  container.querySelector('#s-pw-current')?.addEventListener('input', validatePasswordForm);
  validatePasswordForm();
}

export default { render };
