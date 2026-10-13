/**
 * @file PeriodSelector component.
 * Standardized period selection across all dashboard widgets:
 * thisMonth | last7 | lastMonth | custom.
 * Supports desktop pill group and mobile bottom sheet for screens < 768px.
 */

import { getLocalDateString, getLocalMonthString, escapeHtml } from '../../utils/format.js';

/**
 * Calculate { from, to, days } for a given period key.
 * @param {'thisMonth'|'last7'|'lastMonth'|'custom'} period
 * @param {Object} [custom] - { from, to } for custom mode
 * @returns {{ period: string, from: string, to: string, days: number, label: string }}
 */
export function getPeriodRange(period = 'thisMonth', custom = {}) {
  const now = new Date();
  let from = '';
  let to = '';

  if (period === 'last7') {
    const fromDate = new Date(now);
    fromDate.setDate(now.getDate() - 6);
    from = getLocalDateString(fromDate);
    to = getLocalDateString(now);
  } else if (period === 'lastMonth') {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 12 : now.getMonth();
    const pad = (n) => String(n).padStart(2, '0');
    from = `${y}-${pad(m)}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    to = `${y}-${pad(m)}-${pad(lastDay)}`;
  } else if (period === 'custom' && custom.from && custom.to) {
    from = custom.from;
    to = custom.to;
  } else {
    // Default: thisMonth (from 1st of month to today)
    const currentMonthStr = getLocalMonthString(now);
    from = `${currentMonthStr}-01`;
    to = getLocalDateString(now);
    period = 'thisMonth';
  }

  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const startMs = new Date(y1, m1 - 1, d1).getTime();
  const endMs = new Date(y2, m2 - 1, d2).getTime();
  const days = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

  const label = formatPeriodRangeLabel(from, to, days);

  return {
    period,
    from,
    to,
    days,
    label,
  };
}

/**
 * Format human-readable period label: e.g. "01–06/10/2026 · 6 ngày"
 * @param {string} from - YYYY-MM-DD
 * @param {string} to - YYYY-MM-DD
 * @param {number} [days]
 * @returns {string}
 */
export function formatPeriodRangeLabel(from, to, days) {
  if (!from || !to) return '';
  const [y1, m1, d1] = from.split('-');
  const [y2, m2, d2] = to.split('-');
  const numDays = days || (Math.round((new Date(to) - new Date(from)) / 86400000) + 1);

  let datePart = '';
  if (y1 === y2 && m1 === m2) {
    datePart = `${d1}–${d2}/${m1}/${y1}`;
  } else if (y1 === y2) {
    datePart = `${d1}/${m1} – ${d2}/${m2}/${y1}`;
  } else {
    datePart = `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`;
  }

  return `${datePart} · ${numDays} ngày`;
}

/**
 * Get human title for period key.
 * @param {string} periodKey
 * @returns {string}
 */
function getPeriodTitle(periodKey) {
  switch (periodKey) {
    case 'last7': return '7 ngày qua';
    case 'lastMonth': return 'Tháng trước';
    case 'custom': return 'Tùy chọn';
    case 'thisMonth':
    default:
      return 'Tháng này';
  }
}

/**
 * Format secondary subtitle for bottom sheet option.
 * @param {string} periodKey
 * @returns {string}
 */
function formatPeriodSubtitle(periodKey) {
  if (periodKey === 'custom') return 'Tự chọn ngày bắt đầu & kết thúc';
  const range = getPeriodRange(periodKey);
  const [y1, m1, d1] = range.from.split('-');
  const [y2, m2, d2] = range.to.split('-');
  return `${d1}/${m1} – ${d2}/${m2}/${y2}`;
}

/**
 * Render period selector markup.
 * @param {Object} state - Current period state { period, from, to, label }
 * @returns {string} HTML string
 */
export function renderPeriodSelector({ period = 'thisMonth', from = '', to = '', label = '' } = {}) {
  const current = getPeriodRange(period, { from, to });
  const displayLabel = label || current.label;
  const periodTitle = getPeriodTitle(current.period);

  return `
    <div class="period-selector-container" id="dashboard-period-selector">
      <!-- Desktop Pill Group (≥ 768px) -->
      <div class="period-pills-group" role="radiogroup" aria-label="Chọn kỳ xem báo cáo">
        <button type="button" class="period-pill-btn ${current.period === 'thisMonth' ? 'active' : ''}" data-period-btn="thisMonth" role="radio" aria-checked="${current.period === 'thisMonth'}">
          Tháng này
        </button>
        <button type="button" class="period-pill-btn ${current.period === 'last7' ? 'active' : ''}" data-period-btn="last7" role="radio" aria-checked="${current.period === 'last7'}">
          7 ngày qua
        </button>
        <button type="button" class="period-pill-btn ${current.period === 'lastMonth' ? 'active' : ''}" data-period-btn="lastMonth" role="radio" aria-checked="${current.period === 'lastMonth'}">
          Tháng trước
        </button>
        <button type="button" class="period-pill-btn ${current.period === 'custom' ? 'active' : ''}" data-period-btn="custom" role="radio" aria-checked="${current.period === 'custom'}">
          Tùy chọn
        </button>
      </div>

      <div class="period-range-indicator" id="period-range-indicator">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span class="period-range-text">${escapeHtml(displayLabel)}</span>
      </div>

      <div class="period-custom-popover ${current.period === 'custom' ? 'open' : ''}" id="period-custom-popover" style="display: none;">
        <div class="period-custom-inputs">
          <label class="period-custom-label">
            Từ ngày
            <input type="date" id="period-input-from" value="${escapeHtml(current.from)}" class="period-date-input" aria-label="Từ ngày" />
          </label>
          <label class="period-custom-label">
            Đến ngày
            <input type="date" id="period-input-to" value="${escapeHtml(current.to)}" class="period-date-input" aria-label="Đến ngày" />
          </label>
          <button type="button" class="btn-primary btn-sm" id="period-custom-apply">Áp dụng</button>
        </div>
      </div>

      <!-- Mobile Trigger Button (< 768px, Touch Target ≥ 44px) -->
      <button type="button" class="period-mobile-trigger" id="period-mobile-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="Chọn kỳ xem báo cáo. Hiện tại: ${escapeHtml(periodTitle)}, ${escapeHtml(displayLabel)}">
        <span class="period-mobile-trigger-content">
          <svg class="period-mobile-trigger-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="period-mobile-trigger-title">${escapeHtml(periodTitle)}</span>
          <span class="period-mobile-trigger-sep" aria-hidden="true">·</span>
          <span class="period-mobile-trigger-dates">${escapeHtml(displayLabel)}</span>
        </span>
        <svg class="period-mobile-trigger-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      <!-- Mobile Bottom Sheet (< 768px) -->
      <div class="period-sheet-backdrop" id="period-sheet-backdrop" aria-hidden="true"></div>
      <div class="period-bottom-sheet" id="period-bottom-sheet" role="dialog" aria-modal="true" aria-label="Chọn kỳ xem báo cáo" aria-hidden="true">
        <div class="period-sheet-handle" aria-hidden="true"></div>
        <div class="period-sheet-header">
          <div class="period-sheet-header-text">
            <h3 class="period-sheet-title">Chọn kỳ xem báo cáo</h3>
            <p class="period-sheet-subtitle">${escapeHtml(displayLabel)}</p>
          </div>
          <button type="button" class="period-sheet-close" id="period-sheet-close" aria-label="Đóng bảng chọn kỳ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="period-sheet-options" role="radiogroup" aria-label="Tùy chọn kỳ">
          <button type="button" class="period-sheet-option ${current.period === 'thisMonth' ? 'active' : ''}" data-sheet-period="thisMonth" role="radio" aria-checked="${current.period === 'thisMonth'}">
            <div class="period-sheet-option-info">
              <span class="period-sheet-option-title">Tháng này</span>
              <span class="period-sheet-option-sub">${formatPeriodSubtitle('thisMonth')}</span>
            </div>
            <span class="period-sheet-option-check" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </button>

          <button type="button" class="period-sheet-option ${current.period === 'last7' ? 'active' : ''}" data-sheet-period="last7" role="radio" aria-checked="${current.period === 'last7'}">
            <div class="period-sheet-option-info">
              <span class="period-sheet-option-title">7 ngày qua</span>
              <span class="period-sheet-option-sub">${formatPeriodSubtitle('last7')}</span>
            </div>
            <span class="period-sheet-option-check" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </button>

          <button type="button" class="period-sheet-option ${current.period === 'lastMonth' ? 'active' : ''}" data-sheet-period="lastMonth" role="radio" aria-checked="${current.period === 'lastMonth'}">
            <div class="period-sheet-option-info">
              <span class="period-sheet-option-title">Tháng trước</span>
              <span class="period-sheet-option-sub">${formatPeriodSubtitle('lastMonth')}</span>
            </div>
            <span class="period-sheet-option-check" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </button>

          <button type="button" class="period-sheet-option ${current.period === 'custom' ? 'active' : ''}" data-sheet-period="custom" role="radio" aria-checked="${current.period === 'custom'}">
            <div class="period-sheet-option-info">
              <span class="period-sheet-option-title">Tùy chọn khoảng ngày</span>
              <span class="period-sheet-option-sub">${formatPeriodSubtitle('custom')}</span>
            </div>
            <span class="period-sheet-option-check" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </button>
        </div>

        <div class="period-sheet-custom-form ${current.period === 'custom' ? 'open' : ''}" id="period-sheet-custom-form" style="${current.period === 'custom' ? 'display: block;' : 'display: none;'}">
          <div class="period-sheet-inputs">
            <label class="period-sheet-label">
              <span>Từ ngày</span>
              <input type="date" id="period-sheet-input-from" value="${escapeHtml(current.from)}" class="period-date-input" aria-label="Từ ngày" />
            </label>
            <label class="period-sheet-label">
              <span>Đến ngày</span>
              <input type="date" id="period-sheet-input-to" value="${escapeHtml(current.to)}" class="period-date-input" aria-label="Đến ngày" />
            </label>
          </div>
          <button type="button" class="btn btn-primary period-sheet-apply-btn" id="period-sheet-apply">Áp dụng kỳ tùy chọn</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to period selector.
 * @param {HTMLElement} container
 * @param {Function} onChange - Callback({ period, from, to, label })
 */
export function attachPeriodSelectorListeners(container, onChange) {
  const root = container.querySelector('#dashboard-period-selector');
  if (!root) return;

  const popover = root.querySelector('#period-custom-popover');
  const fromInput = root.querySelector('#period-input-from');
  const toInput = root.querySelector('#period-input-to');
  const applyBtn = root.querySelector('#period-custom-apply');

  // Desktop buttons
  root.querySelectorAll('[data-period-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const periodKey = btn.dataset.periodBtn;

      if (periodKey === 'custom') {
        if (popover) {
          const isVisible = popover.style.display === 'block';
          popover.style.display = isVisible ? 'none' : 'block';
        }
        return;
      }

      if (popover) popover.style.display = 'none';

      const newRange = getPeriodRange(periodKey);
      if (typeof onChange === 'function') {
        onChange(newRange);
      }
    });
  });

  if (applyBtn && fromInput && toInput) {
    applyBtn.addEventListener('click', () => {
      const fromVal = fromInput.value;
      const toVal = toInput.value;
      if (!fromVal || !toVal || fromVal > toVal) return;

      if (popover) popover.style.display = 'none';

      const newRange = getPeriodRange('custom', { from: fromVal, to: toVal });
      if (typeof onChange === 'function') {
        onChange(newRange);
      }
    });
  }

  // Mobile Bottom Sheet Logic (< 768px)
  const mobileTrigger = root.querySelector('#period-mobile-trigger');
  const bottomSheet = root.querySelector('#period-bottom-sheet');
  const backdrop = root.querySelector('#period-sheet-backdrop');
  const sheetClose = root.querySelector('#period-sheet-close');
  const sheetCustomForm = root.querySelector('#period-sheet-custom-form');
  const sheetFromInput = root.querySelector('#period-sheet-input-from');
  const sheetToInput = root.querySelector('#period-sheet-input-to');
  const sheetApplyBtn = root.querySelector('#period-sheet-apply');

  function openSheet() {
    if (!bottomSheet || !backdrop) return;
    bottomSheet.classList.add('open');
    bottomSheet.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    if (mobileTrigger) mobileTrigger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    if (!bottomSheet || !backdrop) return;
    bottomSheet.classList.remove('open');
    bottomSheet.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    if (mobileTrigger) mobileTrigger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (mobileTrigger) {
    mobileTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      openSheet();
    });
  }

  if (sheetClose) {
    sheetClose.addEventListener('click', (e) => {
      e.preventDefault();
      closeSheet();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeSheet();
    });
  }

  // Sheet radio options
  root.querySelectorAll('[data-sheet-period]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const periodKey = btn.dataset.sheetPeriod;

      if (periodKey === 'custom') {
        if (sheetCustomForm) {
          const isOpen = sheetCustomForm.style.display === 'block';
          sheetCustomForm.style.display = isOpen ? 'none' : 'block';
          if (!isOpen && sheetFromInput) sheetFromInput.focus();
        }
        return;
      }

      closeSheet();
      const newRange = getPeriodRange(periodKey);
      if (typeof onChange === 'function') {
        onChange(newRange);
      }
    });
  });

  // Sheet custom apply
  if (sheetApplyBtn && sheetFromInput && sheetToInput) {
    sheetApplyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const fromVal = sheetFromInput.value;
      const toVal = sheetToInput.value;
      if (!fromVal || !toVal || fromVal > toVal) return;

      closeSheet();
      const newRange = getPeriodRange('custom', { from: fromVal, to: toVal });
      if (typeof onChange === 'function') {
        onChange(newRange);
      }
    });
  }

  // Escape key closes sheet
  const handleKeydown = (e) => {
    if (e.key === 'Escape' && bottomSheet && bottomSheet.classList.contains('open')) {
      closeSheet();
    }
  };
  document.addEventListener('keydown', handleKeydown);
}

export default {
  getPeriodRange,
  formatPeriodRangeLabel,
  renderPeriodSelector,
  attachPeriodSelectorListeners,
};
