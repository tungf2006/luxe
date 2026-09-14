/**
 * @file Settings feature module.
 * Renders the settings page with tabs: Profile, Financial, Notifications,
 * Appearance, and Security. Handles theme toggle, toggle switches, and form saves.
 */

import dataService from '../../services/dataService.js';
import { showToast } from '../../components/ui/Toast.js';
import { emit } from '../../utils/eventBus.js';
import { escapeHtml } from '../../utils/format.js';

/* --------------------------------------------------------------- *
 * Constants
 * --------------------------------------------------------------- */
const MOCK_USER = {
  firstName: 'Alex',
  lastName: 'Kim',
  email: 'alex.kim@luxe.finance',
};

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'VND', label: 'VND (₫)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JPY', label: 'JPY (¥)' },
];

const PAY_DAYS = [
  { value: '1st',  label: 'Ngày 1' },
  { value: '15th', label: 'Ngày 15' },
  { value: 'last', label: 'Ngày cuối tháng' },
];

const BUDGET_PERIODS = [
  { value: 'monthly',   label: 'Hàng tháng' },
  { value: 'weekly',    label: 'Hàng tuần' },
  { value: 'bi-weekly', label: 'Hai tuần' },
];

const TABS = [
  { id: 'profile',       label: 'Hồ sơ',         icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', panel: 'settings-profile' },
  { id: 'financial',     label: 'Tài chính',     icon: '<line x1="12" y1="1" x2="12" y2="23"/><line x1="17" y1="5" x2="9.5" y2="5"/>', panel: 'settings-financial' },
  { id: 'notifications', label: 'Thông báo',     icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', panel: 'settings-notifications' },
  { id: 'appearance',    label: 'Giao diện',     icon: '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>', panel: 'settings-appearance' },
  { id: 'security',      label: 'Bảo mật',        icon: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', panel: 'settings-security' },
];

/* --------------------------------------------------------------- *
 * HTML builders
 * --------------------------------------------------------------- */
function tabButtonHTML(tab, isActive) {
  const iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.5rem;vertical-align:middle;">${tab.icon}</svg>`;
  return `
    <button class="settings-tab-btn ${isActive ? 'active' : ''}" id="st-${tab.id}" data-panel="${tab.panel}">
      ${iconSvg} ${tab.label}
    </button>
  `;
}

function settingRowHTML(title, desc, controlHTML) {
  return `
    <div class="settings-row">
      <div>
        <div class="settings-label-title">${title}</div>
        <div class="settings-label-desc">${desc}</div>
      </div>
      ${controlHTML}
    </div>
  `;
}

function selectHTML(id, label, value, options) {
  const opts = options.map(o =>
    `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`
  ).join('');
  return `<select class="select-dropdown" id="${id}" aria-label="${label}">${opts}</select>`;
}

function toggleHTML(id, title, checked) {
  return `
    <label class="toggle-switch" aria-label="${title}">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} aria-checked="${checked ? 'true' : 'false'}"/>
      <span class="toggle-slider"></span>
    </label>
  `;
}

function profilePanelHTML(user) {
  const initials = user.firstName.charAt(0) + user.lastName.charAt(0);
  return `
    <div class="settings-panel" id="settings-profile">
      <div style="display:flex;align-items:center;gap:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border-subtle);">
        <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#38BDF8);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:1.5rem;color:white;box-shadow:var(--shadow-glow);">
          ${initials}
        </div>
        <div>
         <div style="font-weight:700;font-size:1.15rem;">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</div>
         <div style="color:var(--text-secondary);font-size:0.875rem;">${escapeHtml(user.email)}</div>
         <button class="btn-secondary" style="margin-top:0.6rem;padding:0.35rem 0.85rem;font-size:0.8rem;" data-action="change-photo">Đổi ảnh</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;">
        <div class="form-group">
           <label class="form-label">Tên</label>
           <input class="form-input" type="text" value="${user.firstName}" aria-label="Tên đệm"/>
        </div>
        <div class="form-group">
           <label class="form-label">Họ</label>
           <input class="form-input" type="text" value="${user.lastName}" aria-label="Họ"/>
        </div>
        <div class="form-group" style="grid-column:1/-1;">
           <label class="form-label">Địa chỉ email</label>
           <input class="form-input" type="email" value="${user.email}" aria-label="Địa chỉ email"/>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:0.5rem;">
         <button class="btn-add-transaction" id="save-profile-btn" type="button">Lưu thay đổi</button>
      </div>
    </div>
  `;
}

function financialPanelHTML(settings) {
  return `
    <div class="settings-panel" id="settings-financial" style="display:none;">
      ${settingRowHTML('Đơn vị tiền tệ', 'Dùng cho tất cả số dư và báo cáo',
         selectHTML('setting-currency', 'Đơn vị tiền tệ', settings.currency, CURRENCIES))}
       ${settingRowHTML('Ngày nhận lương', 'Ngày trong tháng bạn thường nhận thu nhập',
         selectHTML('setting-payday', 'Ngày nhận lương', settings.payDay, PAY_DAYS))}
       ${settingRowHTML('Chu kỳ ngân sách', 'Ngân sách được tính và đặt lại như thế nào',
         selectHTML('setting-budget-period', 'Chu kỳ ngân sách', settings.budgetPeriod, BUDGET_PERIODS))}
      <div style="display:flex;justify-content:flex-end;">
                 <button class="btn-add-transaction" id="save-financial-btn" type="button">Lưu tùy chọn</button>
      </div>
    </div>
  `;
}

function notificationsPanelHTML(settings) {
  const n = settings.notifications;
  return `
    <div class="settings-panel" id="settings-notifications" style="display:none;">
      ${settingRowHTML('Cảnh báo ngân sách', 'Thông báo khi chi tiêu vượt quá 80% ngân sách',
         toggleHTML('notif-budget-warning', 'Cảnh báo ngân sách', n.budgetWarning))}
      ${settingRowHTML('Tóm tắt hàng tuần', 'Nhận bản tóm tắt mỗi tuần vào Chủ nhật',
         toggleHTML('notif-weekly-summary', 'Tóm tắt hàng tuần', n.weeklySummary))}
      ${settingRowHTML('Cảnh báo giao dịch lớn', 'Cảnh báo cho giao dịch vượt quá 500.000₫',
         toggleHTML('notif-large-transaction', 'Cảnh báo giao dịch lớn', n.largeTransaction))}
      ${settingRowHTML('Đề xuất AI', 'Mẹo tài chính cá nhân và phát hiện bất thường',
         toggleHTML('notif-ai-insights', 'Đề xuất AI', n.aiInsights))}
    </div>
  `;
}

function appearancePanelHTML(settings) {
  const isDark = settings.theme !== 'light';
  return `
    <div class="settings-panel" id="settings-appearance" style="display:none;">
      ${settingRowHTML('Giao diện', 'Chọn giữa chế độ tối và sáng', `
         <div style="display:flex;gap:0.5rem;">
           <button class="btn-secondary ${isDark ? 'active-theme-btn' : ''}" id="theme-dark" aria-pressed="${isDark}">
             🌙 Tối
           </button>
           <button class="btn-secondary ${!isDark ? 'active-theme-btn' : ''}" id="theme-light" aria-pressed="${!isDark}">
             ☀️ Sáng
           </button>
         </div>
       `)}
      ${settingRowHTML('Chế độ gọn', 'Giảm khoảng cách để hiển thị nhiều thông tin hơn',
         toggleHTML('toggle-compact', 'Chế độ gọn', settings.compactMode))}
      ${settingRowHTML('Hiệu ứng hoạt hình', 'Kích hoạt các chuyển tiếp mượt mà',
         toggleHTML('toggle-animations', 'Hiệu ứng hoạt hình', settings.animations))}
    </div>
  `;
}

function securityPanelHTML() {
  return `
    <div class="settings-panel" id="settings-security" style="display:none;">
      ${settingRowHTML('Xác thực hai yếu tố', 'Thêm lớp bảo mật bổ sung cho tài khoản của bạn',
         toggleHTML('toggle-2fa', 'Xác thực hai yếu tố', false))}
      ${settingRowHTML('Đổi mật khẩu', 'Lần cuối cách đây 42 ngày',
         '<button class="btn-secondary">Đổi</button>')}
      ${settingRowHTML('Xóa tài khoản', 'Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu của bạn',
         '<button class="btn-secondary" id="delete-account" style="color:var(--negative);border-color:var(--negative-border);">Xóa</button>')}
    </div>
  `;
}

function settingsContainerHTML(user, settings) {
  return `
    <div class="settings-container">
      <aside class="settings-sidebar" role="navigation" aria-label="Phần cài đặt">
        ${TABS.map((tab, i) => tabButtonHTML(tab, i === 0)).join('')}
      </aside>
      <div id="settings-content">
        ${profilePanelHTML(user)}
        ${financialPanelHTML(settings)}
        ${notificationsPanelHTML(settings)}
        ${appearancePanelHTML(settings)}
        ${securityPanelHTML()}
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Main render
 * --------------------------------------------------------------- */
export async function render(container) {
  const settings = await dataService.getSettings();
  const user = MOCK_USER;

  // Apply saved theme and feature toggles to body
  document.body.classList.toggle('theme-light', settings.theme === 'light');
  document.body.classList.toggle('compact', settings.compactMode);
  document.body.classList.toggle('no-animations', !settings.animations);

  container.innerHTML = settingsContainerHTML(user, settings);

  attachListeners(container, settings);
}

/* --------------------------------------------------------------- *
 * Event listeners
 * --------------------------------------------------------------- */
function attachListeners(container, settings) {
  // Tab switching
  const tabBtns = container.querySelectorAll('.settings-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const panelId = btn.dataset.panel;
      container.querySelectorAll('.settings-panel').forEach(p => {
        p.style.display = p.id === panelId ? 'flex' : 'none';
      });
    });
  });

  // Theme toggle
  const darkBtn = container.querySelector('#theme-dark');
  const lightBtn = container.querySelector('#theme-light');

  darkBtn?.addEventListener('click', () => {
    document.body.classList.remove('theme-light');
    darkBtn.classList.add('active-theme-btn');
    lightBtn.classList.remove('active-theme-btn');
    darkBtn.setAttribute('aria-pressed', 'true');
    lightBtn.setAttribute('aria-pressed', 'false');
    dataService.updateSettings({ theme: 'dark' });
     showToast('Chế độ tối đã bật', 'info');
  });

  lightBtn?.addEventListener('click', () => {
    document.body.classList.add('theme-light');
    lightBtn.classList.add('active-theme-btn');
    darkBtn.classList.remove('active-theme-btn');
    lightBtn.setAttribute('aria-pressed', 'true');
    darkBtn.setAttribute('aria-pressed', 'false');
    dataService.updateSettings({ theme: 'light' });
     showToast('Chế độ sáng đã bật', 'info');
  });

  // Notification / feature toggles
  const toggleMap = {
    'notif-budget-warning':  { path: ['notifications', 'budgetWarning'], label: 'Cảnh báo ngân sách' },
    'notif-weekly-summary':  { path: ['notifications', 'weeklySummary'], label: 'Tóm tắt hàng tuần' },
    'notif-large-transaction': { path: ['notifications', 'largeTransaction'], label: 'Cảnh báo giao dịch lớn' },
    'notif-ai-insights':     { path: ['notifications', 'aiInsights'], label: 'Đề xuất AI' },
    'toggle-compact':        { path: ['compactMode'], label: 'Chế độ gọn', sideEffect: c => document.body.classList.toggle('compact', c) },
    'toggle-animations':     { path: ['animations'], label: 'Hiệu ứng hoạt hình', sideEffect: c => document.body.classList.toggle('no-animations', !c) },
    'toggle-2fa':            { path: ['security', 'twoFactor'], label: 'Xác thực hai yếu tố' },
  };

  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    const mapping = toggleMap[cb.id];
    if (!mapping) return;

    cb.addEventListener('change', () => {
      const newSettings = {};
      let obj = newSettings;
      for (let i = 0; i < mapping.path.length - 1; i++) {
        obj[mapping.path[i]] = {};
        obj = obj[mapping.path[i]];
      }
      obj[mapping.path[mapping.path.length - 1]] = cb.checked;

      // Deep merge into current settings
      const current = { ...settings };
      let target = current;
      for (let i = 0; i < mapping.path.length - 1; i++) {
        if (!target[mapping.path[i]]) target[mapping.path[i]] = {};
        target = target[mapping.path[i]];
      }
      target[mapping.path[mapping.path.length - 1]] = cb.checked;
      Object.assign(settings, current);

      if (mapping.sideEffect) mapping.sideEffect(cb.checked);

      dataService.updateSettings(current).then(() => {
        showToast(`${mapping.label} ${cb.checked ? 'đã bật' : 'đã tắt'}`, 'info');
      });
    });
  });

  // Profile save
  container.querySelector('#save-profile-btn')?.addEventListener('click', () => {
     showToast('Hồ sơ đã được lưu!', 'success');
  });

  // Financial preferences save
  container.querySelector('#save-financial-btn')?.addEventListener('click', () => {
    const currency = container.querySelector('#setting-currency')?.value;
    const payDay = container.querySelector('#setting-payday')?.value;
    const budgetPeriod = container.querySelector('#setting-budget-period')?.value;
    dataService.updateSettings({ currency, payDay, budgetPeriod }).then(() => {
       showToast('Tùy chọn đã được lưu!', 'success');
    });
  });

  // Change photo
  container.querySelector('[data-action="change-photo"]')?.addEventListener('click', () => {
     showToast('Tính năng tải ả lên sẽ sớm được ra mắt.', 'info');
  });

  // Delete account
  const deleteBtn = container.querySelector('#delete-account');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn xóa tài khoản vĩnh viễn? Hành động này không thể hoàn tác.')) {
        dataService.resetToDefaults();
        emit('data:changed');
        showToast('Tài khoản đã bị xóa. Dữ liệu đã được đặt lại.', 'success');
      }
    });
  }
}

export default { render };
