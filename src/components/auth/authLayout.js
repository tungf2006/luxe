/**
 * @file AuthLayout — shared layout for all authentication pages.
 *
 * Renders the premium dark fintech styling around auth forms,
 * keeping forms clean and focused.
 */

import { MOCK_MODE } from '../../config/env.js';

/**
 * Render the auth page container with a premium dark background.
 * @param {string} title
 * @param {string} subtitle
 * @param {string} formHTML
 * @returns {string}
 */
export function renderAuthPage(title, subtitle, formHTML) {
  const isMock = MOCK_MODE;
  const mockNotice = isMock
    ? '<div class="auth-mock-notice">Chế độ mô phỏng — nhập bất kỳ email/mật khẩu nào để tiếp tục</div>'
    : '';

  return `
    <div class="auth-page" role="main">
      <div class="auth-background">
        <div class="auth-glow auth-glow--1"></div>
        <div class="auth-glow auth-glow--2"></div>
        <div class="auth-glow auth-glow--3"></div>
        <div class="auth-grid"></div>
      </div>
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="brand-logo-auth">
              <span class="brand-icon-auth" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 18 L6 6 L14 6"/>
                  <path d="M8 10 L16 14 M16 10 L8 14"/>
                </svg>
              </span>
              <span class="brand-text-auth">Luxe</span>
            </div>
            <h1 class="auth-title">${title}</h1>
            <p class="auth-subtitle">${subtitle}</p>
          </div>
          ${mockNotice}
          ${formHTML}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a password field with visibility toggle.
 * @param {string} id
 * @param {string} label
 * @param {string} placeholder
 * @param {string} [name=id]
 * @param {string} [error='']
 * @returns {string}
 */
export function renderPasswordField(id, label, placeholder, name = id, error = '') {
  const errorHtml = error
    ? `<span class="form-error">${error}</span>`
    : '';

  return `
    <div class="form-group">
      <label class="form-label" for="${id}">${label}</label>
      <div class="password-input-wrapper">
        <input type="password" id="${id}" name="${name}" class="form-input password-input" placeholder="${placeholder}" autocomplete="new-password" />
        <button type="button" class="password-toggle" aria-label="${error ? '' : 'Hiện/ẩn mật khẩu'}" tabindex="-1">
          <span class="password-toggle-icon" aria-hidden="true">👁️</span>
        </button>
      </div>
      ${errorHtml}
    </div>
  `;
}

/**
 * Render a standard text/email input with error.
 * @param {string} id
 * @param {string} label
 * @param {string} placeholder
 * @param {string} [type='email']
 * @param {string} [name=id]
 * @param {string} [error='']
 * @param {string} [autocomplete='']
 * @returns {string}
 */
export function renderInput(id, label, placeholder, type = 'email', name = id, error = '', autocomplete = '') {
  const errorHtml = error
    ? `<span class="form-error">${error}</span>`
    : '';

  return `
    <div class="form-group">
      <label class="form-label" for="${id}">${label}</label>
      <input type="${type}" id="${id}" name="${name}" class="form-input" placeholder="${placeholder}" ${autocomplete} />
      ${errorHtml}
    </div>
  `;
}
