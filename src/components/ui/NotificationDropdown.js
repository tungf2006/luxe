/**
 * @file NotificationDropdown.js
 * Interactive Notification Center dropdown component for Luxe Topbar.
 *
 * Features:
 *   - Real-time badge counter synchronization (shows count, hides when 0)
 *   - Category-specific tinted SVG icons (warning, bill, insight, success, system) - Zero emojis
 *   - Instant filter tabs: Tất cả (All), Chưa đọc (Unread), Cảnh báo & Hoá đơn (Finance)
 *   - Mark single notification as read on click
 *   - Mark all notifications as read ("Đánh dấu tất cả đã đọc")
 *   - Individual notification dismissal / deletion
 *   - Action links that navigate directly to target routes (e.g. #/budgets, #/reports)
 *   - Footer link to Settings > Notifications panel
 *   - Accessible: Keyboard focus trap, Esc to close, outside-click close, ARIA expanded & controls
 *   - Synchronized via eventBus on 'notifications:changed'
 */

import dataService from '../../services/dataAdapter.js';
import { escapeHtml } from '../../utils/format.js';
import { on, emit } from '../../utils/eventBus.js';
import { showToast } from './Toast.js';
import { navigateTo } from '../../router.js';

let _activeFilter = 'all';
let _isOpen = false;
let _notifications = [];

/**
 * Format timestamp into relative Vietnamese time string.
 * @param {string} isoString
 * @returns {string}
 */
export function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const past = new Date(isoString).getTime();
  if (isNaN(past)) return '';
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  const d = new Date(past);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Return category icon SVG and styling according to notification type.
 * Zero-emoji discipline.
 * @param {string} type
 * @returns {{ html: string, bg: string, border: string, color: string }}
 */
function getNotificationIconInfo(type) {
  switch (type) {
    case 'warning':
    case 'budget':
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.28)',
        color: '#F59E0B',
        html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      };
    case 'bill':
    case 'recurring':
      return {
        bg: 'rgba(6, 182, 212, 0.12)',
        border: 'rgba(6, 182, 212, 0.28)',
        color: '#06B6D4',
        html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      };
    case 'insight':
    case 'ai':
      return {
        bg: 'rgba(139, 92, 246, 0.12)',
        border: 'rgba(139, 92, 246, 0.28)',
        color: '#8B5CF6',
        html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      };
    case 'success':
    case 'income':
      return {
        bg: 'rgba(34, 197, 94, 0.12)',
        border: 'rgba(34, 197, 94, 0.28)',
        color: '#22C55E',
        html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      };
    case 'system':
    default:
      return {
        bg: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.28)',
        color: '#3B82F6',
        html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      };
  }
}

/**
 * Filter notifications array based on selected tab.
 * @param {Array} list
 * @param {string} filter
 * @returns {Array}
 */
function filterList(list, filter) {
  if (filter === 'unread') {
    return list.filter(n => !n.is_read);
  }
  if (filter === 'finance') {
    return list.filter(n => ['warning', 'bill', 'budget', 'income', 'expense'].includes(n.type) || ['budget', 'bill', 'finance'].includes(n.category));
  }
  return list;
}

/**
 * Render single notification row HTML.
 * @param {Object} notif
 * @returns {string}
 */
function renderNotificationItemHTML(notif) {
  const icon = getNotificationIconInfo(notif.type);
  const timeAgo = formatTimeAgo(notif.created_at);
  const isUnread = !notif.is_read;

  return `
    <div class="notif-item ${isUnread ? 'is-unread' : ''}" data-id="${escapeHtml(notif.id)}" tabindex="0" role="article" aria-label="${escapeHtml(notif.title)}">
      <div class="notif-item-icon-box" style="background:${icon.bg};border:1px solid ${icon.border};">
        ${icon.html}
      </div>
      <div class="notif-item-body">
        <div class="notif-item-header">
          <div class="notif-item-title-row">
            ${isUnread ? '<span class="notif-unread-dot" aria-hidden="true"></span>' : ''}
            <span class="notif-item-title">${escapeHtml(notif.title)}</span>
          </div>
          <span class="notif-item-time">${escapeHtml(timeAgo)}</span>
        </div>
        <p class="notif-item-message">${escapeHtml(notif.message || '')}</p>
        <div class="notif-item-footer">
          ${notif.action_url && notif.action_label ? `
            <button type="button" class="notif-item-action-btn" data-url="${escapeHtml(notif.action_url)}" data-id="${escapeHtml(notif.id)}">
              <span>${escapeHtml(notif.action_label)}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          ` : '<span></span>'}
          <button type="button" class="notif-item-delete-btn" data-delete-id="${escapeHtml(notif.id)}" title="Xoá thông báo" aria-label="Xoá thông báo">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render empty state HTML when no notifications match.
 * @param {string} filter
 * @returns {string}
 */
function renderEmptyStateHTML(filter) {
  const desc = filter === 'unread'
    ? 'Bạn không có thông báo chưa đọc nào.'
    : filter === 'finance'
    ? 'Chưa có cảnh báo ngân sách hay lịch hoá đơn nào.'
    : 'Bạn đã cập nhật tất cả thông tin mới nhất.';

  return `
    <div class="notif-empty-state">
      <div class="notif-empty-icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <div class="notif-empty-title">Không có thông báo mới</div>
      <div class="notif-empty-desc">${escapeHtml(desc)}</div>
    </div>
  `;
}

/**
 * Re-render dropdown inner markup and attach item-level event handlers.
 */
function renderDropdownContent() {
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;

  const totalCount = _notifications.length;
  const unreadCount = _notifications.filter(n => !n.is_read).length;
  const financeCount = _notifications.filter(n => ['warning', 'bill', 'budget', 'income', 'expense'].includes(n.type) || ['budget', 'bill', 'finance'].includes(n.category)).length;

  const filtered = filterList(_notifications, _activeFilter);

  dropdown.innerHTML = `
    <div class="notif-header">
      <div class="notif-header-left">
        <span class="notif-header-title">Thông báo</span>
        ${unreadCount > 0 ? `<span class="notif-unread-count-pill" id="notif-unread-count-pill">${unreadCount} mới</span>` : ''}
      </div>
      <div class="notif-header-right">
        ${unreadCount > 0 ? `
          <button type="button" class="notif-mark-all-btn" id="notif-mark-all-btn" title="Đánh dấu tất cả là đã đọc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Đã đọc tất cả</span>
          </button>
        ` : ''}
      </div>
    </div>

    <div class="notif-tabs" role="tablist" aria-label="Bộ lọc thông báo">
      <button type="button" class="notif-tab ${Math.min(1, _activeFilter === 'all' ? 1 : 0) ? 'active' : ''}" data-filter="all" role="tab" aria-selected="${_activeFilter === 'all'}">
        Tất cả (${totalCount})
      </button>
      <button type="button" class="notif-tab ${_activeFilter === 'unread' ? 'active' : ''}" data-filter="unread" role="tab" aria-selected="${_activeFilter === 'unread'}">
        Chưa đọc (${unreadCount})
      </button>
      <button type="button" class="notif-tab ${_activeFilter === 'finance' ? 'active' : ''}" data-filter="finance" role="tab" aria-selected="${_activeFilter === 'finance'}">
        Tài chính (${financeCount})
      </button>
    </div>

    <div class="notif-list" id="notif-list" role="region" aria-label="Danh sách các thông báo">
      ${filtered.length > 0 ? filtered.map(renderNotificationItemHTML).join('') : renderEmptyStateHTML(_activeFilter)}
    </div>

    <div class="notif-footer">
      <button type="button" class="notif-footer-link" id="notif-settings-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>Cài đặt thông báo</span>
      </button>
    </div>
  `;

  // Content rendered; delegated listener in initNotificationDropdown handles all clicks
}

/**
 * Open the notification dropdown.
 */
export function openNotificationDropdown() {
  const notifBtn = document.getElementById('notif-btn');
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown || !notifBtn) return;

  _isOpen = true;
  dropdown.classList.add('open');
  dropdown.setAttribute('aria-hidden', 'false');
  notifBtn.setAttribute('aria-expanded', 'true');
  renderDropdownContent();
}

/**
 * Close the notification dropdown.
 */
export function closeNotificationDropdown() {
  const notifBtn = document.getElementById('notif-btn');
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown || !notifBtn) return;

  _isOpen = false;
  dropdown.classList.remove('open');
  dropdown.setAttribute('aria-hidden', 'true');
  notifBtn.setAttribute('aria-expanded', 'false');
}

/**
 * Toggle open/close of notification dropdown.
 */
export function toggleNotificationDropdown() {
  if (_isOpen) {
    closeNotificationDropdown();
  } else {
    // Close user avatar menu if open to avoid overlap
    const userMenu = document.getElementById('user-menu-dropdown');
    if (userMenu && userMenu.classList.contains('open')) {
      userMenu.classList.remove('open');
      userMenu.setAttribute('aria-hidden', 'true');
      const avatarBtn = document.getElementById('avatar-btn');
      if (avatarBtn) avatarBtn.setAttribute('aria-expanded', 'false');
    }
    openNotificationDropdown();
  }
}

/**
 * Fetch latest notifications from dataService and update badge + open panel.
 */
export async function refreshNotifications() {
  try {
    _notifications = await dataService.getNotifications();
  } catch (err) {
    console.warn('[NotificationDropdown] Error loading notifications:', err);
    _notifications = [];
  }

  const unreadCount = _notifications.filter(n => !n.is_read).length;
  updateBadgeUI(unreadCount);

  if (_isOpen) {
    renderDropdownContent();
  }
}

/**
 * Update topbar bell badge count and visibility.
 * @param {number} count
 */
export function updateBadgeUI(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;

  if (count <= 0) {
    badge.textContent = '0';
    badge.style.display = 'none';
    badge.setAttribute('aria-label', '0 thông báo chưa đọc');
  } else {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.style.display = 'flex';
    badge.setAttribute('aria-label', `${count} thông báo chưa đọc`);
  }
}

/**
 * Initialize the notification dropdown system.
 * Attach listeners to bell button, document outside click, and eventBus.
 */
export async function initNotificationDropdown() {
  const notifBtn = document.getElementById('notif-btn');
  const dropdown = document.getElementById('notif-dropdown');
  if (!notifBtn || !dropdown) return;

  // Toggle on bell click
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotificationDropdown();
  });

  // Delegated clicks inside dropdown
  dropdown.addEventListener('click', async (e) => {
    e.stopPropagation();

    // 1. Mark all read
    const markAllBtn = e.target.closest('#notif-mark-all-btn');
    if (markAllBtn) {
      await dataService.markAllNotificationsRead();
      showToast('Đã đánh dấu tất cả thông báo là đã đọc', 'success');
      return;
    }

    // 2. Filter tabs
    const tab = e.target.closest('.notif-tab');
    if (tab) {
      _activeFilter = tab.dataset.filter;
      renderDropdownContent();
      return;
    }

    // 3. Settings link
    const settingsLink = e.target.closest('#notif-settings-link');
    if (settingsLink) {
      closeNotificationDropdown();
      window.__ACTIVE_SETTINGS_TAB = 'notifications';
      navigateTo('settings');
      return;
    }

    // 4. Delete button
    const deleteBtn = e.target.closest('.notif-item-delete-btn');
    if (deleteBtn) {
      const id = deleteBtn.dataset.deleteId;
      if (id) {
        await dataService.deleteNotification(id);
        showToast('Đã xoá thông báo', 'info');
      }
      return;
    }

    // 5. Action button
    const actionBtn = e.target.closest('.notif-item-action-btn');
    if (actionBtn) {
      const id = actionBtn.dataset.id;
      const url = actionBtn.dataset.url;
      if (id) {
        await dataService.markNotificationRead(id);
      }
      closeNotificationDropdown();
      if (url) {
        const cleanPage = url.replace(/^#\/?/, '').split('?')[0];
        if (cleanPage) {
          navigateTo(cleanPage);
        }
      }
      return;
    }

    // 6. Notification item row click
    const item = e.target.closest('.notif-item');
    if (item) {
      const id = item.dataset.id;
      const notif = _notifications.find(n => n.id === id);
      if (notif && !notif.is_read) {
        await dataService.markNotificationRead(id);
      }
      return;
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.isConnected || e.target.closest('#notif-menu')) {
      return;
    }
    if (_isOpen) {
      closeNotificationDropdown();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _isOpen) {
      closeNotificationDropdown();
      notifBtn.focus();
    }
  });

  // Listen to cross-module notification changes
  on('notifications:changed', (e) => {
    if (typeof e?.detail?.unreadCount === 'number') {
      updateBadgeUI(e.detail.unreadCount);
    }
    refreshNotifications();
  });

  on('data:changed', () => {
    refreshNotifications();
  });

  // Initial load
  await refreshNotifications();
}
