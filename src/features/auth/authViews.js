/**
 * @file Auth views - login, register, verify, forgot, reset.
 *
 * Each view is a self-contained module that renders its form into the
 * page container and wires up event listeners.
 *
 * All user-facing text is in Vietnamese.
 */

import {
  renderAuthPage,
  renderPasswordField,
  renderInput,
} from '../../components/auth/authLayout.js';
import {
  signIn,
  signUp,
  sendPasswordReset,
  signInWithGoogle,
  resendVerification,
  updatePassword,
} from '../../services/authService.js';
import { navigateTo } from '../../router.js';
import { t } from '../../utils/i18n.js';
import { initPasswordToggles } from '../../components/ui/PasswordField.js';

/* ---------------------------------------------------------------- *
 * Validation helpers
 * ---------------------------------------------------------------- */
const VALIDATORS = {
  email: (val) => {
    if (!val) return 'Email không được để trống.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) return 'Email không hợp lệ.';
    return '';
  },

  password: (val) => {
    if (!val) return 'Mật khẩu không được để trống.';
    if (val.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
    return '';
  },

  fullName: (val) => {
    if (!val) return 'Họ và tên không được để trống.';
    if (val.trim().length < 2) return 'Họ và tên phải có ít nhất 2 ký tự.';
    return '';
  },

  confirmPassword: (val, original) => {
    if (!val) return 'Vui lòng nhập lại mật khẩu.';
    if (val !== original) return 'Mật khẩu xác nhận không khớp.';
    return '';
  },
};

function showError(input, message) {
  let errEl = input.closest('.form-group').querySelector('.form-error');
  if (!errEl) {
    errEl = document.createElement('span');
    errEl.className = 'form-error';
    input.closest('.form-group').appendChild(errEl);
  }
  errEl.textContent = message;
  errEl.style.display = message ? 'block' : 'none';
}

/* ---------------------------------------------------------------- *
 * Login View
 * ---------------------------------------------------------------- */

function loginHTML() {
  return renderAuthPage(
    t('auth.login.title'),
    t('auth.login.subtitle'),
    `
      <form id="login-form" class="auth-form" autocomplete="off">
        <div class="form-group">
          ${renderInput('login-email', t('auth.login.emailLabel'), t('auth.login.emailPlaceholder'), 'email', 'login-email', '', 'email')}
        </div>
        <div class="form-group">
          ${renderPasswordField('login-password', t('auth.login.passwordLabel'), t('auth.login.passwordPlaceholder'))}
        </div>
        <div class="form-error" id="login-error" style="display:none;"></div>
        <button type="submit" class="btn-auth-submit" id="login-submit" disabled>
          <span class="btn-text">${t('auth.login.submit')}</span>
          <span class="btn-loading" style="display:none;">
            <span class="spinner"></span>
          </span>
        </button>
<div class="auth-divider">
            <span>${t('auth.login.or')}</span>
          </div>
          <button type="button" class="btn-google" id="login-google">
            <span class="google-icon">G</span>
            <span>${t('auth.login.google')}</span>
          </button>
      </form>
        <div class="auth-footer">
        <button type="button" class="auth-link" data-auth-action="register">${t('auth.login.register')}</button>
          <button type="button" class="auth-link" data-auth-action="forgot">${t('auth.login.forgot')}</button>
        </div>
    `
  );
}

function attachLoginEvents(container) {
  initPasswordToggles(container);
  const form = container.querySelector('#login-form');
  const submitBtn = container.querySelector('#login-submit');
  const errorEl = container.querySelector('#login-error');
  const emailField = form.querySelector('#login-email');
  const passwordField = form.querySelector('#login-password');

  const validateForm = () => {
    const emailErr = VALIDATORS.email(emailField.value);
    const pwErr = VALIDATORS.password(passwordField.value);
    showError(emailField, emailErr);
    showError(passwordField, pwErr);
    const valid = !emailErr && !pwErr;
    submitBtn.disabled = !valid;
    return valid;
  };

  [emailField, passwordField].forEach(field => {
    field.addEventListener('input', validateForm);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline-flex';
    errorEl.style.display = 'none';

    const { user, error } = await signIn(emailField.value, passwordField.value);

    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = '';
    submitBtn.querySelector('.btn-loading').style.display = 'none';

    if (error) {
      errorEl.textContent = error;
      errorEl.style.display = 'block';
    } else {
      navigateTo('dashboard');
    }
  });

  const googleBtn = container.querySelector('#login-google');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      googleBtn.disabled = true;
      googleBtn.textContent = t('auth.redirecting');
      const { error } = await signInWithGoogle();
      if (error) {
        googleBtn.disabled = false;
        googleBtn.innerHTML = '<span class="google-icon">G</span><span>Tiếp tục với Google</span>';
        errorEl.textContent = error;
        errorEl.style.display = 'block';
      }
    });
  }

  container.querySelectorAll('[data-auth-action]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const action = link.dataset.authAction;
      if (action === 'register') navigateTo('register');
      if (action === 'forgot') navigateTo('forgot-password');
    });
  });
}

/* ---------------------------------------------------------------- *
 * Register View
 * ---------------------------------------------------------------- */

function registerHTML() {
  return renderAuthPage(
    t('auth.register.title'),
    t('auth.register.subtitle'),
    `
      <form id="register-form" class="auth-form" autocomplete="off">
        <div class="form-group">
          ${renderInput('register-name', t('auth.register.nameLabel'), t('auth.register.namePlaceholder'), 'text', 'register-name', '', 'email')}
        </div>
        <div class="form-group">
          ${renderInput('register-email', t('auth.register.emailLabel'), t('auth.register.emailPlaceholder'), 'email', 'register-email', '', 'email')}
        </div>
        <div class="form-group">
          ${renderPasswordField('register-password', t('auth.register.passwordLabel'), t('auth.register.passwordPlaceholder'))}
        </div>
        <div class="form-group">
          ${renderPasswordField('register-confirm', t('auth.register.confirmLabel'), t('auth.register.confirmPlaceholder'))}
        </div>
        <div class="form-row">
          <input type="checkbox" id="register-accept" class="checkbox" />
          <label class="checkbox-label" for="register-accept">
            ${t('auth.register.termsText')} <button type="button" class="auth-link-small btn-link" style="border: none; background: none; padding: 0; font: inherit; cursor: pointer;">${t('auth.register.termsLink')}</button> ${t('auth.register.and')} <button type="button" class="auth-link-small btn-link" style="border: none; background: none; padding: 0; font: inherit; cursor: pointer;">${t('auth.register.privacyLink')}</button>
          </label>
        </div>
        <div class="form-error" id="register-error" style="display:none;"></div>
        <button type="submit" class="btn-auth-submit" id="register-submit" disabled>
          <span class="btn-text">${t('auth.register.submit')}</span>
          <span class="btn-loading" style="display:none;">
            <span class="spinner"></span>
          </span>
        </button>
      </form>
<div class="auth-footer">
        ${t('auth.register.alreadyHave')}
        <button type="button" class="auth-link" data-auth-action="login">${t('auth.register.loginLink')}</button>
      </div>
    `
  );
}

function attachRegisterEvents(container) {
  initPasswordToggles(container);
  const form = container.querySelector('#register-form');
  const submitBtn = container.querySelector('#register-submit');
  const errorEl = container.querySelector('#register-error');
  const nameField = form.querySelector('#register-name');
  const emailField = form.querySelector('#register-email');
  const passwordField = form.querySelector('#register-password');
  const confirmField = form.querySelector('#register-confirm');
  const termsField = form.querySelector('#register-accept');

  const validateForm = () => {
    const validations = [
      { field: nameField, validator: VALIDATORS.fullName },
      { field: emailField, validator: VALIDATORS.email },
      { field: passwordField, validator: VALIDATORS.password },
    ];

    let valid = true;
    for (const { field, validator } of validations) {
      const err = validator(field.value);
      showError(field, err);
      if (err) valid = false;
    }

    const pwErr = VALIDATORS.confirmPassword(confirmField.value, passwordField.value);
    showError(confirmField, pwErr);
    if (pwErr) valid = false;

    valid = valid && termsField.checked;
    submitBtn.disabled = !valid;
    return valid;
  };

  [nameField, emailField, passwordField, confirmField].forEach(field => {
    field.addEventListener('input', validateForm);
  });
  termsField.addEventListener('change', validateForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline-flex';
    errorEl.style.display = 'none';

    const { user, error, needsEmailVerification } = await signUp(
      emailField.value,
      passwordField.value,
      nameField.value
    );

    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = '';
    submitBtn.querySelector('.btn-loading').style.display = 'none';

    if (error) {
      errorEl.textContent = error;
      errorEl.style.display = 'block';
    } else if (needsEmailVerification) {
      navigateTo('verify-email');
    } else {
      navigateTo('onboarding');
    }
  });

  container.querySelectorAll('[data-auth-action]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (link.dataset.authAction === 'login') navigateTo('login');
    });
  });
}

/* ---------------------------------------------------------------- *
 * Forgot Password View
 * ---------------------------------------------------------------- */

function forgotHTML() {
  return renderAuthPage(
    t('auth.forgot.title'),
    t('auth.forgot.subtitle'),
    `
      <form id="forgot-form" class="auth-form" autocomplete="off">
        <div class="form-group">
          ${renderInput('forgot-email', t('auth.forgot.emailLabel'), t('auth.forgot.emailPlaceholder'), 'email', 'forgot-email', '', 'email')}
        </div>
        <div class="form-error" id="forgot-error" style="display:none;"></div>
        <div class="form-success" id="forgot-success" style="display:none;">
          ✓ ${t('auth.forgot.success')}
        </div>
<button type="submit" class="btn-auth-submit" id="forgot-submit" disabled>
          <span class="btn-text">${t('auth.forgot.submit')}
          <span class="btn-loading" style="display:none;">
            <span class="spinner"></span>
          </span>
        </button>
      </form>
      <div class="auth-footer">
        <button type="button" class="auth-link" data-auth-action="login">Quay lại đăng nhập</button>
      </div>
     `
  );
}

function attachForgotEvents(container) {
  const form = container.querySelector('#forgot-form');
  const submitBtn = container.querySelector('#forgot-submit');
  const errorEl = container.querySelector('#forgot-error');
  const successEl = container.querySelector('#forgot-success');
  const emailField = form.querySelector('#forgot-email');

  const validateForm = () => {
    const err = VALIDATORS.email(emailField.value);
    showError(emailField, err);
    submitBtn.disabled = !!err;
    return !err;
  };

  emailField.addEventListener('input', validateForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline-flex';
    errorEl.style.display = 'none';

    const { error } = await sendPasswordReset(emailField.value);

    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = '';
    submitBtn.querySelector('.btn-loading').style.display = 'none';

    if (error) {
      errorEl.textContent = error;
      errorEl.style.display = 'block';
    } else {
      successEl.style.display = 'block';
      submitBtn.style.display = 'none';
    }
  });

  container.querySelector('[data-auth-action]').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('login');
  });
}

/* ---------------------------------------------------------------- *
 * Verify Email View
 * ---------------------------------------------------------------- */

function verifyEmailHTML() {
  return renderAuthPage(
    t('auth.verifyEmail.title'),
    t('auth.verifyEmail.subtitle'),
    `
      <div class="verify-email-content">
        <div class="verify-email-icon">📧</div>
        <p class="verify-email-text">${t('auth.verifyEmail.text')}</p>
        <div class="form-error" id="verify-error" style="display:none;"></div>
        <button class="btn-auth-submit" id="verify-resend">
          <span class="btn-text">${t('auth.verifyEmail.resend')}</span>
        </button>
        <div class="auth-footer">
          <button type="button" class="auth-link" data-auth-action="login">${t('auth.verifyEmail.back')}</button>
        </div>
      </div>
    `
  );
}

function attachVerifyEvents(container) {
  const resendBtn = container.querySelector('#verify-resend');
  const errorEl = container.querySelector('#verify-error');

  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    resendBtn.querySelector('.btn-text').textContent = t('auth.verifyEmail.resending');
    const { error } = await resendVerification();
    if (error) {
      errorEl.textContent = error;
      errorEl.style.display = 'block';
      resendBtn.disabled = false;
      resendBtn.querySelector('.btn-text').textContent = t('auth.verifyEmail.resend');
    } else {
      resendBtn.querySelector('.btn-text').textContent = t('auth.verifyEmail.sent');
      setTimeout(() => {
        resendBtn.disabled = false;
        resendBtn.querySelector('.btn-text').textContent = t('auth.verifyEmail.resend');
      }, 3000);
    }
  });

  container.querySelector('[data-auth-action]').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('login');
  });
}

/* ---------------------------------------------------------------- *
 * Reset Password View
 * ---------------------------------------------------------------- */

function resetPasswordHTML() {
  return renderAuthPage(
    t('auth.resetPassword.title'),
    t('auth.resetPassword.subtitle'),
    `
      <form id="reset-form" class="auth-form" autocomplete="off">
        <div class="form-group">
          ${renderPasswordField('reset-password', t('auth.resetPassword.newPasswordLabel'), t('auth.resetPassword.newPasswordPlaceholder'))}
        </div>
        <div class="form-group">
          ${renderPasswordField('reset-confirm', t('auth.resetPassword.confirmLabel'), t('auth.resetPassword.confirmPlaceholder'))}
        </div>
        <div class="form-error" id="reset-error" style="display:none;"></div>
        <div class="form-success" id="reset-success" style="display:none;">
          ✓ ${t('auth.resetPassword.success')}
        </div>
        <button type="submit" class="btn-auth-submit" id="reset-submit" disabled>
          <span class="btn-text">${t('auth.resetPassword.submit')}
          <span class="btn-loading" style="display:none;">
            <span class="spinner"></span>
          </span>
        </button>
      </form>
      <div class="auth-footer">
      <button type="button" class="auth-link" data-auth-action="login">Quay lại đăng nhập</button>
      </div>
     `
  );
}

function attachResetPasswordEvents(container) {
  initPasswordToggles(container);
  const form = container.querySelector('#reset-form');
  const submitBtn = container.querySelector('#reset-submit');
  const errorEl = container.querySelector('#reset-error');
  const successEl = container.querySelector('#reset-success');
  const passwordField = form.querySelector('#reset-password');
  const confirmField = form.querySelector('#reset-confirm');

  const validateForm = () => {
    const pwErr = VALIDATORS.password(passwordField.value);
    showError(passwordField, pwErr);

    const confirmErr = VALIDATORS.confirmPassword(confirmField.value, passwordField.value);
    showError(confirmField, confirmErr);

    const valid = !pwErr && !confirmErr;
    submitBtn.disabled = !valid;
    return valid;
  };

  [passwordField, confirmField].forEach(field => {
    field.addEventListener('input', validateForm);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline-flex';
    errorEl.style.display = 'none';

    const { error } = await updatePassword(passwordField.value);

    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = '';
    submitBtn.querySelector('.btn-loading').style.display = 'none';

    if (error) {
      errorEl.textContent = error;
      errorEl.style.display = 'block';
    } else {
      successEl.style.display = 'block';
      form.style.display = 'none';
      setTimeout(() => navigateTo('dashboard'), 2000);
    }
  });

  container.querySelector('[data-auth-action]')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('login');
  });
}

/* ---------------------------------------------------------------- *
 * Auth Loading View
 * ---------------------------------------------------------------- */

export function authLoadingHTML() {
  return `
    <div class="auth-loading" role="status" aria-live="polite">
      <div class="auth-loading-spinner">
        <div class="spinner spinner--large"></div>
      </div>
      <p class="auth-loading-text">${t('app.loading')}</p>
    </div>
  `;
}

/* ---------------------------------------------------------------- *
 * Export renderers
 * ---------------------------------------------------------------- */
export const authViews = {
  login: {
    html: loginHTML,
    attachEvents: attachLoginEvents,
  },
  register: {
    html: registerHTML,
    attachEvents: attachRegisterEvents,
  },
  'forgot-password': {
    html: forgotHTML,
    attachEvents: attachForgotEvents,
  },
  'verify-email': {
    html: verifyEmailHTML,
    attachEvents: attachVerifyEvents,
  },
  'reset-password': {
    html: resetPasswordHTML,
    attachEvents: attachResetPasswordEvents,
  },
};

export function getAuthView(name) {
  return authViews[name];
}

