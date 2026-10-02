/**
 * @file PasswordField.js
 * Reusable password field component and helper utilities.
 *
 * Provides accessible password visibility toggle (mouse & keyboard),
 * 30-second auto-hide timeout, page leave reset, 4-tier strength meter,
 * and rule checklist.
 */

import { escapeHtml } from '../../utils/format.js';
import { t } from '../../utils/i18n.js';

/* --------------------------------------------------------------- *
 * SVGs & Icons
 * --------------------------------------------------------------- */
export const PASSWORD_ICONS = {
  eye: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88A3 3 0 1 0 14.12 14.12"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  circle: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>`,
};

/* --------------------------------------------------------------- *
 * Password Strength Evaluator
 * --------------------------------------------------------------- */
export const PASSWORD_RULES = [
  { key: 'length', test: (pw) => pw.length >= 8, labelKey: 'settings.security.reqLength', defaultLabel: 'Tối thiểu 8 ký tự' },
  { key: 'upper',  test: (pw) => /[A-Z]/.test(pw), labelKey: 'settings.security.reqUpper',  defaultLabel: 'Có chữ viết hoa (A-Z)' },
  { key: 'number', test: (pw) => /[0-9]/.test(pw), labelKey: 'settings.security.reqNumber', defaultLabel: 'Có chữ số (0-9)' },
  { key: 'special',test: (pw) => /[^a-zA-Z0-9]/.test(pw), labelKey: 'settings.security.reqSpecial', defaultLabel: 'Có ký tự đặc biệt (!@#$...)' },
];

/**
 * Evaluate password strength against 4 rules.
 * @param {string} pw
 * @returns {{
 *   score: number,
 *   level: 'none'|'weak'|'fair'|'good'|'strong',
 *   label: string,
 *   color: string,
 *   rules: { length: boolean, upper: boolean, number: boolean, special: boolean },
 *   isValid: boolean
 * }}
 */
export function evaluatePasswordStrength(pw = '') {
  if (!pw) {
    return {
      score: 0,
      level: 'none',
      label: '',
      color: '',
      rules: { length: false, upper: false, number: false, special: false },
      isValid: false,
    };
  }

  const rules = {
    length: PASSWORD_RULES[0].test(pw),
    upper: PASSWORD_RULES[1].test(pw),
    number: PASSWORD_RULES[2].test(pw),
    special: PASSWORD_RULES[3].test(pw),
  };

  const score = Object.values(rules).filter(Boolean).length;

  let level = 'weak';
  let label = t('settings.security.strengthWeak', 'Yếu');
  let color = '#EF4444'; // Red

  if (score === 2) {
    level = 'fair';
    label = t('settings.security.strengthFair', 'Trung bình');
    color = '#F59E0B'; // Amber
  } else if (score === 3) {
    level = 'good';
    label = t('settings.security.strengthGood', 'Khá');
    color = '#3B82F6'; // Blue
  } else if (score === 4) {
    level = 'strong';
    label = t('settings.security.strengthStrong', 'Mạnh');
    color = '#22C55E'; // Emerald
  }

  return {
    score,
    level,
    label,
    color,
    rules,
    isValid: score === 4,
  };
}

/* --------------------------------------------------------------- *
 * HTML Renderers
 * --------------------------------------------------------------- */

/**
 * Render a complete password field HTML with label, input, toggle button, and error.
 * Supports both options object and positional arguments:
 * - renderPasswordField({ id, label, placeholder, ... })
 * - renderPasswordField(id, label, placeholder, name, error)
 * @param {Object|string} optionsOrId
 * @param {string} [posLabel='']
 * @param {string} [posPlaceholder='••••••••']
 * @param {string} [posName]
 * @param {string} [posError='']
 * @returns {string}
 */
export function renderPasswordField(
  optionsOrId,
  posLabel = '',
  posPlaceholder = '••••••••',
  posName,
  posError = ''
) {
  let opts = {};
  if (typeof optionsOrId === 'string') {
    opts = {
      id: optionsOrId,
      label: posLabel,
      placeholder: posPlaceholder,
      name: posName || optionsOrId,
      error: posError,
    };
  } else {
    opts = optionsOrId || {};
  }

  const {
    id,
    label = '',
    placeholder = '••••••••',
    name = id,
    value = '',
    autocomplete = 'current-password',
    error = '',
    showLabel = true,
    inputClass = '',
    required = false,
    ariaDescribedby = '',
  } = opts;
  const showLabelText = t('common.showPassword', 'Hiện mật khẩu');
  const labelHtml = showLabel && label
    ? `<label class="form-label" for="${id}">${escapeHtml(label)}</label>`
    : '';

  const errorHtml = `
    <span class="form-error" id="${id}-error" role="alert" style="${error ? 'display:block;' : 'display:none;'}">
      ${escapeHtml(error)}
    </span>`;

  return `
    <div class="form-group password-form-group" data-pw-field-wrapper="${id}">
      ${labelHtml}
      <div class="password-input-wrapper">
        <input
          class="form-input password-input ${inputClass}"
          type="password"
          id="${id}"
          name="${name}"
          placeholder="${escapeHtml(placeholder)}"
          value="${escapeHtml(value)}"
          autocomplete="${autocomplete}"
          ${required ? 'required' : ''}
          ${ariaDescribedby ? `aria-describedby="${ariaDescribedby}"` : ''}
        />
        <button
          type="button"
          class="password-toggle"
          data-pw-toggle="${id}"
          aria-label="${showLabelText}"
          aria-pressed="false"
          title="${showLabelText}"
        >
          <span class="password-toggle-icon" aria-hidden="true">${PASSWORD_ICONS.eye}</span>
        </button>
      </div>
      ${errorHtml}
    </div>
  `;
}

/**
 * Render 4-segment strength meter and rule checklist HTML.
 * @param {Object} options
 * @param {string} [options.id='pw-strength']
 * @returns {string}
 */
export function renderPasswordStrengthMeter({ id = 'pw-strength' } = {}) {
  const titleText = t('settings.security.strengthTitle', 'Độ mạnh mật khẩu:');
  const rulesList = PASSWORD_RULES.map(rule => `
    <li class="checklist-item" data-rule="${rule.key}">
      <span class="checklist-icon" aria-hidden="true">${PASSWORD_ICONS.circle}</span>
      <span class="checklist-text">${t(rule.labelKey, rule.defaultLabel)}</span>
    </li>
  `).join('');

  return `
    <div class="password-strength-container" id="${id}-container" style="display:none;">
      <div class="password-strength-header">
        <span class="password-strength-title">${titleText}</span>
        <span class="password-strength-label" id="${id}-label" aria-live="polite"></span>
      </div>
      <div class="password-strength-meter" id="${id}-meter" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0" data-score="0">
        <div class="strength-segment" data-segment="1"></div>
        <div class="strength-segment" data-segment="2"></div>
        <div class="strength-segment" data-segment="3"></div>
        <div class="strength-segment" data-segment="4"></div>
      </div>
      <ul class="password-checklist" id="${id}-checklist" aria-label="Yêu cầu mật khẩu">
        ${rulesList}
      </ul>
    </div>
  `;
}

/* --------------------------------------------------------------- *
 * Dynamic UI & Event Management
 * --------------------------------------------------------------- */

/** Map to track auto-hide timer IDs per input element */
const activeTimers = new WeakMap();
/** Map to track activity listeners for cleanup per input */
const activityListeners = new WeakMap();

/**
 * Reset a single password input back to hidden type="password".
 * @param {HTMLInputElement} input
 * @param {HTMLButtonElement} [btn]
 */
export function hidePasswordInput(input, btn) {
  if (!input) return;
  input.type = 'password';

  if (!btn) {
    const container = input.closest('.password-input-wrapper') || input.parentElement;
    btn = container?.querySelector(`[data-pw-toggle="${input.id}"]`);
  }

  if (btn) {
    const showLabel = t('common.showPassword', 'Hiện mật khẩu');
    btn.setAttribute('aria-label', showLabel);
    btn.setAttribute('title', showLabel);
    btn.setAttribute('aria-pressed', 'false');
    const iconSpan = btn.querySelector('.password-toggle-icon');
    if (iconSpan) iconSpan.innerHTML = PASSWORD_ICONS.eye;
  }

  // Clear auto-hide timer
  if (activeTimers.has(input)) {
    clearTimeout(activeTimers.get(input));
    activeTimers.delete(input);
  }

  // Remove activity listeners
  if (activityListeners.has(input)) {
    const { handler, events } = activityListeners.get(input);
    events.forEach(evt => input.removeEventListener(evt, handler));
    activityListeners.delete(input);
  }
}

/**
 * Initialize all password toggles inside a container element.
 * Handles mouse clicks, keyboard activation, activity-aware auto-hide, and page leave resets.
 *
 * Activity-aware auto-hide:
 *   - Timer starts at `autoHideDelay` ms (default 30s) when password is revealed
 *   - Any keystroke, mouse click, or focus inside the input resets the timer
 *   - This prevents the password from hiding while the user is actively typing
 *   - Especially important on mobile where users type slower
 *
 * @param {HTMLElement} container
 * @param {Object} [options]
 * @param {number} [options.autoHideDelay=30000] - Auto-hide delay in ms (reset on activity)
 * @returns {() => void} Cleanup function to remove listeners & clear timers
 */
export function initPasswordToggles(container, { autoHideDelay = 30000 } = {}) {
  if (!container) return () => {};

  const toggles = container.querySelectorAll('[data-pw-toggle]');
  const boundInputs = [];

  toggles.forEach(btn => {
    const inputId = btn.dataset.pwToggle;
    const input = container.querySelector('#' + inputId);
    if (!input) return;
    boundInputs.push({ input, btn });

    const toggleHandler = () => {
      const isCurrentlyPassword = input.type === 'password';
      const showLabel = t('common.showPassword', 'Hiện mật khẩu');
      const hideLabel = t('common.hidePassword', 'Ẩn mật khẩu');
      const iconSpan = btn.querySelector('.password-toggle-icon');

      if (isCurrentlyPassword) {
        // Show password
        input.type = 'text';
        btn.setAttribute('aria-label', hideLabel);
        btn.setAttribute('title', hideLabel);
        btn.setAttribute('aria-pressed', 'true');
        if (iconSpan) iconSpan.innerHTML = PASSWORD_ICONS.eyeOff;

        // --- Activity-aware auto-hide ---
        const startAutoHideTimer = () => {
          // Clear any existing timer
          if (activeTimers.has(input)) {
            clearTimeout(activeTimers.get(input));
          }

          // Only set timer if password is still visible
          if (input.type === 'text') {
            const timerId = setTimeout(() => {
              hidePasswordInput(input, btn);
            }, autoHideDelay);
            activeTimers.set(input, timerId);
          }
        };

        // Activity events that reset the timer
        const activityEvents = ['keydown', 'mousedown', 'touchstart', 'focus', 'input'];

        // Create a single handler that resets the timer on any activity
        const activityHandler = () => {
          if (input.type === 'text') {
            startAutoHideTimer();
          }
        };

        // Remove any previous activity listeners
        if (activityListeners.has(input)) {
          const prev = activityListeners.get(input);
          prev.events.forEach(evt => input.removeEventListener(evt, prev.handler));
        }

        // Attach activity listeners
        activityEvents.forEach(evt => input.addEventListener(evt, activityHandler));
        activityListeners.set(input, { handler: activityHandler, events: activityEvents });

        // Start the initial timer
        startAutoHideTimer();
      } else {
        // Hide password immediately
        hidePasswordInput(input, btn);
      }
    };

    btn.addEventListener('click', toggleHandler);
  });

  // Reset passwords when user leaves the page / changes route
  const handlePageLeave = () => {
    boundInputs.forEach(({ input, btn }) => {
      hidePasswordInput(input, btn);
    });
  };

  window.addEventListener('beforeunload', handlePageLeave);
  window.addEventListener('hashchange', handlePageLeave);

  return () => {
    handlePageLeave();
    window.removeEventListener('beforeunload', handlePageLeave);
    window.removeEventListener('hashchange', handlePageLeave);
  };
}

/**
 * Update the password strength meter and checklist UI.
 * @param {HTMLElement} container
 * @param {string} password
 * @param {string} [id='pw-strength']
 * @returns {ReturnType<typeof evaluatePasswordStrength>}
 */
export function updatePasswordStrengthUI(container, password, id = 'pw-strength') {
  if (!container) return evaluatePasswordStrength('');

  const strengthContainer = container.querySelector(`#${id}-container`);
  const strengthLabel = container.querySelector(`#${id}-label`);
  const strengthMeter = container.querySelector(`#${id}-meter`);
  const checklist = container.querySelector(`#${id}-checklist`);

  const result = evaluatePasswordStrength(password);

  if (!password) {
    if (strengthContainer) strengthContainer.style.display = 'none';
    if (strengthMeter) strengthMeter.dataset.score = '0';
    return result;
  }

  if (strengthContainer) strengthContainer.style.display = 'flex';
  if (strengthLabel) {
    strengthLabel.textContent = result.label;
    strengthLabel.style.color = result.color;
  }
  if (strengthMeter) {
    strengthMeter.dataset.score = String(result.score);
    strengthMeter.setAttribute('aria-valuenow', String(result.score));
  }

  if (checklist) {
    PASSWORD_RULES.forEach(rule => {
      const item = checklist.querySelector(`[data-rule="${rule.key}"]`);
      if (item) {
        const passed = result.rules[rule.key];
        item.classList.toggle('passed', passed);
        const iconEl = item.querySelector('.checklist-icon');
        if (iconEl) {
          iconEl.innerHTML = passed ? PASSWORD_ICONS.check : PASSWORD_ICONS.circle;
        }
      }
    });
  }

  return result;
}

/**
 * Helper to display/hide an error message under an input.
 * @param {HTMLElement} container
 * @param {string} fieldId
 * @param {string} message
 */
export function setFieldError(container, fieldId, message = '') {
  const errorEl = container.querySelector(`#${fieldId}-error`) || container.querySelector(`#${fieldId}`)?.closest('.form-group')?.querySelector('.form-error');
  const inputEl = container.querySelector(`#${fieldId}`);

  if (inputEl) {
    inputEl.classList.toggle('is-invalid', Boolean(message));
  }

  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = message ? 'block' : 'none';
  }
}
