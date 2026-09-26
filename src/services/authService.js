/**
 * @file AuthService - authentication and session management wrapper.
 *
 * Wraps Supabase Auth with a clean API for the feature layer.
 * Falls back to mock mode (localStorage) when Supabase is unavailable.
 *
 * All methods return `{ data, error }` where `error` is null on success.
 * This allows the UI to handle auth states uniformly.
 */

import { getSupabase } from './supabaseClient.js';
import { HAS_SUPABASE, MOCK_MODE } from '../config/env.js';

/* ---------------------------------------------------------------- *
 * State
 * ---------------------------------------------------------------- */
let _user = null;
let _session = null;
let _isInitialized = false;

/**
 * Check if the user is authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!_session?.user || !!_user;
}

/**
 * Get the current user.
 * @returns {object|null}
 */
export function getCurrentUser() {
  return _user || _session?.user || null;
}

/**
 * Get the current session.
 * @returns {object|null}
 */
export function getSession() {
  return _session || null;
}

/**
 * Check if auth is still initializing (no session determined yet).
 * @returns {boolean}
 */
export function isInitializing() {
  return !_isInitialized;
}

/* ---------------------------------------------------------------- *
 * Initialisation - called once on app load
 * ---------------------------------------------------------------- */

/**
 * Initialise supabase auth. Resolves once the session is known.
 * @returns {Promise<{user: object|null, session: object|null}>}
 */
export async function initAuth() {
  if (_isInitialized) {
    return { user: _user, session: _session };
  }

  const supabase = getSupabase();

  if (!supabase) {
    // Mock mode - try to read from localStorage
    const mockSession = localStorage.getItem("luxe-mock-session");
      if (mockSession) {
        _session = { user: JSON.parse(mockSession) };
        _user = _session.user;
      } else {
        const mockUser = { id: "mock-user", email: "user@luxe.dev", user_metadata: { full_name: "Luxe User" } };
        _session = { user: mockUser };
        _user = mockUser;
        localStorage.setItem("luxe-mock-session", JSON.stringify(mockUser));
      }
    _isInitialized = true;
    return { user: _user, session: _session };
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[authService] Failed to get session:', error.message);
  }

  _session = session;
  _user = session?.user ?? null;
  _isInitialized = true;

  // Listen for auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    _session = session;
    _user = session?.user ?? null;
    _isInitialized = true;

    if (event === 'SIGNED_IN') {
      window.dispatchEvent(new CustomEvent('auth:signed_in', { detail: { user: _user } }));
    } else if (event === 'SIGNED_OUT') {
      _user = null;
      _session = null;
      window.dispatchEvent(new CustomEvent('auth:signed_out'));
    } else if (event === 'USER_UPDATED') {
      _user = session?.user ?? null;
      window.dispatchEvent(new CustomEvent('auth:user_updated', { detail: { user: _user } }));
    }
  });

  return { user: _user, session: _session };
}

/* ---------------------------------------------------------------- *
 * Authentication methods
 * ---------------------------------------------------------------- */

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function signIn(email, password) {
  const supabase = getSupabase();

  if (!supabase) {
    // Mock mode
    const mockUser = { id: 'mock-user', email, user_metadata: { full_name: email.split('@')[0] } };
    _session = { user: mockUser };
    _user = mockUser;
    _isInitialized = true;
    localStorage.setItem('luxe-mock-session', JSON.stringify(mockUser));
    return { user: mockUser, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { user: null, error: _translateAuthError(error.message) };
  }

  _session = data.session;
  _user = data.user;
  return { user: data.user, error: null };
}

/**
 * Sign up with email, password, and full name.
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function signUp(email, password, fullName) {
  const supabase = getSupabase();

  if (!supabase) {
    const mockUser = {
      id: 'mock-user',
      email,
      user_metadata: { full_name: fullName },
    };
    _session = { user: mockUser };
    _user = mockUser;
    _isInitialized = true;
    localStorage.setItem('luxe-mock-session', JSON.stringify(mockUser));
    return { user: mockUser, error: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      email_redirect_to: window.location.origin,
    },
  });

  if (error) {
    return { user: null, error: _translateAuthError(error.message) };
  }

  _session = data.session;
  _user = data.user;
  _isInitialized = true;

  // If email confirmation is required, session may be null
  if (!data.session) {
    return { user: data.user, error: null, needsEmailVerification: true };
  }

  return { user: data.user, error: null };
}

/**
 * Send password reset email.
 * @param {string} email
 * @returns {Promise<{error: string|null}>}
 */
export async function sendPasswordReset(email) {
  const supabase = getSupabase();

  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/#reset-password`,
  });

  if (error) {
    return { error: _translateAuthError(error.message) };
  }
  return { error: null };
}

/**
 * Reset password with a token (from URL hash or code).
 * @param {string} tokenOrCode
 * @param {string} newPassword
 * @param {string} [type='token']  'token' for PKCE code, 'code' for email OTP
 * @returns {Promise<{error: string|null}>}
 */
export async function resetPassword(tokenOrCode, newPassword) {
  const supabase = getSupabase();

  if (!supabase) return { error: null };

  const { error } = await supabase.auth.exchangeCodeForSession(tokenOrCode);

  if (error) {
    return { error: _translateAuthError(error.message) };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: _translateAuthError(updateError.message) };
  }

  return { error: null };
}

/**
 * Update the current user's password directly (used when the recovery
 * session has already been captured by the auth client).
 * @param {string} newPassword
 * @returns {Promise<{error: string|null}>}
 */
export async function updatePassword(newPassword) {
  const supabase = getSupabase();

  if (!supabase) return { error: null };

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: _translateAuthError(error.message) };
  }
  return { error: null };
}

/**
 * Sign in or sign up with Google.
 * @returns {Promise<{error: string|null}>}
 */
export async function signInWithGoogle() {
  const supabase = getSupabase();

  if (!supabase) {
    return { error: 'Chức năng đăng nhập Google chưa được hỗ trợ trong chế độ mô phỏng.' };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    return { error: _translateAuthError(error.message) };
  }
  return { error: null };
}

/**
 * Sign out the current user.
 * @returns {Promise<{error: string|null}>}
 */
export async function signOut() {
  const supabase = getSupabase();

  if (!supabase) {
    localStorage.removeItem('luxe-mock-session');
    _user = null;
    _session = null;
    return { error: null };
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: _translateAuthError(error.message) };
  }

  _user = null;
  _session = null;
  localStorage.removeItem('luxe-mock-session');
  return { error: null };
}

/**
 * Resend email verification.
 * @param {string} email
 * @returns {Promise<{error: string|null}>}
 */
export async function resendVerification(email) {
  const supabase = getSupabase();

  if (!supabase) return { error: null };

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });

  if (error) {
    return { error: _translateAuthError(error.message) };
  }
  return { error: null };
}

/* ---------------------------------------------------------------- *
 * Error translation - maps Supabase errors to Vietnamese
 * ---------------------------------------------------------------- */
function _translateAuthError(message) {
  const msg = message?.toLowerCase() || '';

  if (msg.includes('invalid') || msg.includes('wrong') || msg.includes('incorrect')) {
  return 'Email hoặc mật khẩu không chính xác.';
  }
  if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
    return 'Email này đã được đăng ký. Vui lòng đăng nhập.';
  }
  if (msg.includes('weak') || msg.includes('password') && msg.includes('6')) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
  }
  if (msg.includes('email')) {
    return 'Email không hợp lệ. Vui lòng kiểm tra lại.';
  }
  if (msg.includes('user') && msg.includes('not found')) {
    return 'Tài khoản không tồn tại. Vui lòng đăng ký.';
  }
  if (msg.includes('rate') || msg.includes('limit')) {
    return 'Quá nhiều yêu cầu. Vui lòng thử lại sau vài phút.';
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/* ---------------------------------------------------------------- *
 * Profile helpers
 * ---------------------------------------------------------------- */

/**
 * Get the full profile for the current user.
 * @returns {Promise<{profile: object|null, error: string|null}>}
 */
export async function getProfile() {
  const supabase = getSupabase();
  if (!supabase || !_user) {
    return { profile: null, error: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', _user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return { profile: null, error: 'Không thể tải hồ sơ người dùng.' };
  }
  return { profile: data, error: null };
}

/**
 * Create or update the user's profile.
 * @param {object} updates
 * @returns {Promise<{profile: object|null, error: string|null}>}
 */
export async function upsertProfile(updates) {
  const supabase = getSupabase();
  if (!supabase || !_user) {
    return { profile: updates, error: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: _user.id, ...updates })
    .select()
    .single();

  if (error) {
    return { profile: null, error: 'Không thể cập nhật hồ sơ.' };
  }
  return { profile: data, error: null };
}

/* ---------------------------------------------------------------- *
 * Onboarding state helpers
 * ---------------------------------------------------------------- */

/**
 * Check if the user has completed onboarding.
 * @param {object|null} profile
 * @returns {boolean}
 */
export function hasCompletedOnboarding(profile) {
  if (!profile) return false;
  return !!profile.full_name &&
         profile.currency &&
         profile.payday &&
         profile.budget_period &&
         profile.onboarding_complete !== false;
}

/**
 * Mark onboarding as complete for the current user.
 * @param {object} profileUpdates
 * @returns {Promise<{error: string|null}>}
 */
export async function completeOnboarding(profileUpdates) {
  const supabase = getSupabase();
  if (!supabase || !_user) {
    localStorage.setItem('luxe-onboarding-complete', 'true');
    return { error: null };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ...profileUpdates, onboarding_complete: true })
    .eq('id', _user.id);

  if (error) {
    return { error: 'Không thể hoàn tất hoạt động. Vui lòng thử lại.' };
  }
  return { error: null };
}


