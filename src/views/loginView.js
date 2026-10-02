/**
 * @file loginView.js — Unified Glassmorphism Login & Register View.
 *
 * Provides:
 *   - Seamless animated switching between "Đăng nhập" (Sign in) and "Đăng ký" (Sign up) tabs
 *   - Official multicolored Google OAuth button with interactive loading state
 *   - Accessible password visibility toggle via PasswordField component
 *   - Real-time client-side validation with inline error alerts
 *   - i18n support and automated redirect resolution post-authentication
 */

import { signIn, signUp, signInWithGoogle, signInAsGuest } from '../services/authService.js';
import { navigateTo, getRedirectRoute } from '../router.js';
import { t } from '../utils/i18n.js';
import { renderPasswordField, initPasswordToggles } from '../components/ui/PasswordField.js';
import { MOCK_MODE } from '../config/env.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Renders the Login/Register DOM node into container.
 * @param {HTMLElement} container
 * @param {string} [initialTab='login'] - 'login' or 'register'
 * @returns {HTMLElement} The created view root element
 */
export function renderLoginView(container, initialTab = 'login') {
  container.innerHTML = '';

  const isMock = MOCK_MODE;
  const mockNoticeHtml = isMock
    ? `<div class="auth-mock-notice" role="status">
        <span aria-hidden="true">ℹ️</span> ${t('auth.mockNotice', 'Chế độ mô phỏng — nhập bất kỳ email/mật khẩu nào để tiếp tục')}
       </div>`
    : '';

  const viewEl = document.createElement('div');
  viewEl.className = 'auth-page';
  viewEl.setAttribute('role', 'main');

  viewEl.innerHTML = `
    <div class="auth-background">
      <div class="auth-glow auth-glow--1"></div>
      <div class="auth-glow auth-glow--2"></div>
      <div class="auth-glow auth-glow--3"></div>
      <div class="auth-grid"></div>
    </div>

    <div class="auth-container">
      <div class="auth-card">
        <header class="auth-header">
          <div class="brand-logo-auth">
            <span class="brand-icon-auth" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 18 L6 6 L14 6"/>
                <path d="M8 10 L16 14 M16 10 L8 14"/>
              </svg>
            </span>
            <span class="brand-text-auth">Luxe</span>
          </div>
          <h1 class="auth-title" id="auth-main-title">${t('auth.login.title', 'Chào mừng trở lại')}</h1>
          <p class="auth-subtitle" id="auth-main-subtitle">${t('auth.login.subtitle', 'Đăng nhập để quản lý tài chính cá nhân của bạn')}</p>
        </header>

        ${mockNoticeHtml}

        <!-- Tab Switcher -->
        <div class="auth-tabs" role="tablist" aria-label="Lựa chọn phương thức">
          <button type="button" class="auth-tab ${initialTab === 'login' ? 'active' : ''}" id="tab-login" role="tab" aria-selected="${initialTab === 'login'}" aria-controls="auth-form-panel">
            ${t('auth.login.submit', 'Đăng nhập')}
          </button>
          <button type="button" class="auth-tab ${initialTab === 'register' ? 'active' : ''}" id="tab-register" role="tab" aria-selected="${initialTab === 'register'}" aria-controls="auth-form-panel">
            ${t('auth.register.submit', 'Đăng ký')}
          </button>
        </div>

        <!-- Google OAuth Button -->
        <div class="oauth-section">
          <button type="button" class="btn-google" id="btn-google-oauth" aria-label="Tiếp tục với Google">
            <svg class="google-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
            </svg>
            <span class="btn-text">${t('auth.login.google', 'Tiếp tục với Google')}</span>
            <span class="btn-loading" style="display:none;" aria-hidden="true"><span class="spinner"></span></span>
          </button>
        </div>

        <div class="auth-divider">
          <span>${t('auth.login.or', 'Hoặc tiếp tục với email')}</span>
        </div>

        <!-- Main Form -->
        <form id="auth-main-form" class="auth-form" novalidate autocomplete="on">
          <!-- Name field (shown on register only) -->
          <div class="form-group" id="group-name" style="${initialTab === 'register' ? '' : 'display: none;'}">
            <label class="form-label" for="auth-name">${t('auth.register.nameLabel', 'Họ và tên')}</label>
            <input
              type="text"
              id="auth-name"
              name="name"
              class="form-input"
              placeholder="${t('auth.register.namePlaceholder', 'Nguyễn Văn A')}"
              autocomplete="name"
            />
            <span class="form-error" id="error-name" role="alert"></span>
          </div>

          <!-- Email field -->
          <div class="form-group">
            <label class="form-label" for="login-email">${t('auth.login.emailLabel', 'Email')}</label>
            <input
              type="email"
              id="login-email"
              name="email"
              class="form-input"
              placeholder="${t('auth.login.emailPlaceholder', 'you@example.com')}"
              autocomplete="email"
              required
            />
            <span class="form-error" id="error-email" role="alert"></span>
          </div>

          <!-- Password field -->
          <div class="form-group">
            ${renderPasswordField('login-password', t('auth.login.passwordLabel', 'Mật khẩu'), t('auth.login.passwordPlaceholder', 'Tối thiểu 6 ký tự'))}
            <span class="form-error" id="error-password" role="alert"></span>
          </div>

          <!-- Global Form Error Alert -->
          <div class="form-error auth-global-error" id="auth-global-error" role="alert" style="display:none;"></div>
          <div class="form-success" id="auth-global-success" role="status" style="display:none;"></div>

          <!-- Submit Button -->
          <button type="submit" class="btn-auth-submit" id="btn-auth-submit">
            <span class="btn-text" id="submit-btn-text">
              ${initialTab === 'register' ? t('auth.register.submit', 'Đăng ký') : t('auth.login.submit', 'Đăng nhập')}
            </span>
            <span class="btn-loading" id="submit-btn-loading" style="display:none;" aria-hidden="true">
              <span class="spinner"></span>
            </span>
          </button>
        </form>

        <!-- Guest Mode / Instant Demo -->
        <div class="auth-guest-section">
          <div class="auth-divider auth-divider--subtle">
            <span>${t('auth.login.orExplore', 'Hoặc trải nghiệm ngay')}</span>
          </div>
          <button type="button" class="btn-guest-mode" id="btn-guest-mode" aria-label="${t('auth.login.guestMode', 'Dùng thử với vai trò Khách (Offline Demo)')}">
            <svg class="guest-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span class="btn-text">${t('auth.login.guestMode', 'Dùng thử với vai trò Khách (Offline Demo)')}</span>
            <span class="btn-loading" style="display:none;" aria-hidden="true"><span class="spinner"></span></span>
          </button>
        </div>

        <!-- Footer Links -->
        <footer class="auth-footer" id="auth-footer">
          <div id="footer-login-links" style="${initialTab === 'login' ? '' : 'display:none;'}">
            <button type="button" class="auth-link" id="link-forgot-pw">${t('auth.login.forgot', 'Quên mật khẩu?')}</button>
          </div>
        </footer>
      </div>
    </div>
  `;

  container.appendChild(viewEl);

  // Wire up interactive events
  attachLoginViewEvents(viewEl, initialTab);

  return viewEl;
}

/**
 * Wire up all event handlers, client validations, and transitions.
 * @param {HTMLElement} root
 * @param {string} currentTab
 */
function attachLoginViewEvents(root, initialTab) {
  let activeTab = initialTab;

  // Initialize reusable password visibility toggle
  initPasswordToggles(root);

  const tabLogin = root.querySelector('#tab-login');
  const tabRegister = root.querySelector('#tab-register');
  const groupName = root.querySelector('#group-name');
  const titleEl = root.querySelector('#auth-main-title');
  const subtitleEl = root.querySelector('#auth-main-subtitle');
  const submitBtn = root.querySelector('#btn-auth-submit');
  const submitText = root.querySelector('#submit-btn-text');
  const submitLoading = root.querySelector('#submit-btn-loading');
  const googleBtn = root.querySelector('#btn-google-oauth');
  const form = root.querySelector('#auth-main-form');
  const footerLoginLinks = root.querySelector('#footer-login-links');

  const nameInput = root.querySelector('#auth-name');
  const emailInput = root.querySelector('#login-email');
  const passwordInput = root.querySelector('#login-password');

  const errorName = root.querySelector('#error-name');
  const errorEmail = root.querySelector('#error-email');
  const errorPassword = root.querySelector('#error-password');
  const globalError = root.querySelector('#auth-global-error');
  const globalSuccess = root.querySelector('#auth-global-success');
  const linkForgot = root.querySelector('#link-forgot-pw');

  // Reset errors
  function clearErrors() {
    [errorName, errorEmail, errorPassword, globalError].forEach(el => {
      if (el) {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
    if (globalSuccess) globalSuccess.style.display = 'none';
    root.querySelectorAll('.form-input.is-invalid').forEach(input => input.classList.remove('is-invalid'));
  }

  // Switch tab function
  function switchTab(tab) {
    activeTab = tab;
    clearErrors();

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabRegister.classList.remove('active');
      tabRegister.setAttribute('aria-selected', 'false');

      groupName.style.display = 'none';
      titleEl.textContent = t('auth.login.title', 'Chào mừng trở lại');
      subtitleEl.textContent = t('auth.login.subtitle', 'Đăng nhập để quản lý tài chính cá nhân của bạn');
      submitText.textContent = t('auth.login.submit', 'Đăng nhập');
      if (footerLoginLinks) footerLoginLinks.style.display = 'block';
    } else {
      tabRegister.classList.add('active');
      tabRegister.setAttribute('aria-selected', 'true');
      tabLogin.classList.remove('active');
      tabLogin.setAttribute('aria-selected', 'false');

      groupName.style.display = 'flex';
      titleEl.textContent = t('auth.register.title', 'Tạo tài khoản mới');
      subtitleEl.textContent = t('auth.register.subtitle', 'Bắt đầu quản lý tài chính thông minh cùng Luxe');
      submitText.textContent = t('auth.register.submit', 'Đăng ký');
      if (footerLoginLinks) footerLoginLinks.style.display = 'none';
    }
  }

  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  if (linkForgot) {
    linkForgot.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('forgot-password');
    });
  }

  // Client Validation
  function validate() {
    let isValid = true;
    clearErrors();

    const emailVal = emailInput.value.trim();
    const pwVal = passwordInput.value;

    if (!emailVal) {
      errorEmail.textContent = t('auth.login.validation.emailEmpty', 'Email không được để trống.');
      errorEmail.style.display = 'block';
      emailInput.classList.add('is-invalid');
      isValid = false;
    } else if (!EMAIL_REGEX.test(emailVal)) {
      errorEmail.textContent = t('auth.login.validation.emailInvalid', 'Email không hợp lệ.');
      errorEmail.style.display = 'block';
      emailInput.classList.add('is-invalid');
      isValid = false;
    }

    if (!pwVal) {
      errorPassword.textContent = t('auth.login.validation.passwordEmpty', 'Mật khẩu không được để trống.');
      errorPassword.style.display = 'block';
      passwordInput.classList.add('is-invalid');
      isValid = false;
    } else if (pwVal.length < 6) {
      errorPassword.textContent = t('auth.login.validation.passwordMin', 'Mật khẩu phải có ít nhất 6 ký tự.');
      errorPassword.style.display = 'block';
      passwordInput.classList.add('is-invalid');
      isValid = false;
    }

    if (activeTab === 'register') {
      const nameVal = nameInput.value.trim();
      if (!nameVal) {
        errorName.textContent = t('auth.register.validation.nameEmpty', 'Họ và tên không được để trống.');
        errorName.style.display = 'block';
        nameInput.classList.add('is-invalid');
        isValid = false;
      } else if (nameVal.length < 2) {
        errorName.textContent = t('auth.register.validation.nameMin', 'Họ và tên phải có ít nhất 2 ký tự.');
        errorName.style.display = 'block';
        nameInput.classList.add('is-invalid');
        isValid = false;
      }
    }

    return isValid;
  }

  // Toggle Loading state
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    googleBtn.disabled = isLoading;
    emailInput.disabled = isLoading;
    passwordInput.disabled = isLoading;
    nameInput.disabled = isLoading;

    submitText.style.display = isLoading ? 'none' : 'inline-block';
    submitLoading.style.display = isLoading ? 'inline-flex' : 'none';

    const googleText = googleBtn.querySelector('.btn-text');
    const googleLoading = googleBtn.querySelector('.btn-loading');
    if (googleText && googleLoading) {
      googleText.style.display = isLoading ? 'none' : 'inline-block';
      googleLoading.style.display = isLoading ? 'inline-flex' : 'none';
    }
  }

  // Google OAuth click
  googleBtn.addEventListener('click', async () => {
    clearErrors();
    setLoading(true);

    const { error } = await signInWithGoogle();
    if (error) {
      setLoading(false);
      globalError.textContent = error;
      globalError.style.display = 'block';
    }
  });

  // Form Submit (Email / Password)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (activeTab === 'login') {
      const { user, error } = await signIn(email, password);
      setLoading(false);

      if (error) {
        globalError.textContent = error;
        globalError.style.display = 'block';
      } else if (user) {
        const redirect = getRedirectRoute() || 'dashboard';
        navigateTo(redirect);
      }
    } else {
      const displayName = nameInput.value.trim();
      const { user, error, needsEmailVerification } = await signUp(email, password, { display_name: displayName });
      setLoading(false);

      if (error) {
        globalError.textContent = error;
        globalError.style.display = 'block';
      } else if (needsEmailVerification) {
        globalSuccess.textContent = t('auth.verifyEmail.subtitle', 'Chúng tôi đã gửi email xác minh đến hộp thư của bạn. Vui lòng kiểm tra email để hoàn tất.');
        globalSuccess.style.display = 'block';
      } else if (user) {
        const redirect = getRedirectRoute() || 'dashboard';
        navigateTo(redirect);
      }
    }
  });

  // Guest Mode / Instant Offline Demo Click
  const guestBtn = root.querySelector('#btn-guest-mode');
  if (guestBtn) {
    guestBtn.addEventListener('click', async () => {
      clearErrors();
      guestBtn.disabled = true;
      const guestText = guestBtn.querySelector('.btn-text');
      const guestLoading = guestBtn.querySelector('.btn-loading');
      if (guestText && guestLoading) {
        guestText.style.display = 'none';
        guestLoading.style.display = 'inline-flex';
      }
      await signInAsGuest();
      const redirect = getRedirectRoute() || 'dashboard';
      navigateTo(redirect);
    });
  }
}

/**
 * Feature view standard contract: render(container, page)
 */
export async function render(container, page = 'login') {
  renderLoginView(container, page === 'register' ? 'register' : 'login');
}

export default {
  render,
  renderLoginView,
};
