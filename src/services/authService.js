/**
 * @file AuthService — authentication, OAuth, and session management wrapper.
 *
 * Wraps Supabase Auth with a clean API for the feature layer and hash router.
 * Emits decoupled events via EventBus (`AUTH_STATE_CHANGED`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`).
 * Falls back to mock mode (IndexedDB/localStorage) when Supabase is unconfigured or offline.
 *
 * All public auth methods return `{ user, data, error }` where `error` is null on success.
 */

import { getSupabase, initSupabase } from './supabaseClient.js';
import { emit } from '../utils/eventBus.js';
import { HAS_SUPABASE } from '../config/env.js';

/* ---------------------------------------------------------------- *
 * Internal State
 * ---------------------------------------------------------------- */
let _user = null;
let _session = null;
let _isInitialized = false;
let _authListenerBound = false;

/**
 * Check if the user is authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!_session?.user || !!_user;
}

/**
 * Get the current authenticated user object.
 * @returns {object|null}
 */
export function getCurrentUser() {
  return _user || _session?.user || null;
}

/**
 * Alias for getCurrentUser()
 * @returns {object|null}
 */
export function getUser() {
  return getCurrentUser();
}

/**
 * Get the current Supabase session.
 * @returns {object|null}
 */
export function getSession() {
  return _session || null;
}

/**
 * Check if auth is still initializing.
 * @returns {boolean}
 */
export function isInitializing() {
  return !_isInitialized;
}

/* ---------------------------------------------------------------- *
 * Initialisation
 * ---------------------------------------------------------------- */

/**
 * Initialise Supabase auth session and attach onAuthStateChange listeners.
 * @returns {Promise<{user: object|null, session: object|null}>}
 */
export async function initAuth() {
  if (_isInitialized) {
    return { user: _user, session: _session };
  }

  let supabase = getSupabase();
  if (!supabase && HAS_SUPABASE) {
    supabase = await initSupabase();
  }

  if (!supabase) {
    // Mock / Offline Guest Mode
    const isExplicitlyLoggedOut = localStorage.getItem('luxe-logged-out') === 'true';
    const mockSession = localStorage.getItem('luxe-mock-session');

    if (isExplicitlyLoggedOut) {
      _user = null;
      _session = null;
    } else if (mockSession) {
      try {
        _user = JSON.parse(mockSession);
        _session = { user: _user };
      } catch (e) {
        _user = null;
        _session = null;
      }
    } else {
      const mockUser = {
        id: 'mock-user',
        email: 'user@luxe.dev',
        user_metadata: { full_name: 'Luxe User', display_name: 'Luxe User' },
      };
      _session = { user: mockUser };
      _user = mockUser;
      localStorage.setItem('luxe-mock-session', JSON.stringify(mockUser));
    }

    _isInitialized = true;
    if (_user) {
      emit('USER_LOGGED_IN', { session: _session, user: _user });
    }
    return { user: _user, session: _session };
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[authService] Failed to retrieve session:', error.message);
    }

    _session = session;
    _user = session?.user ?? null;
  } catch (err) {
    console.warn('[authService] Error during getSession:', err);
    _session = null;
    _user = null;
  }

  // Bind auth state listener once
  if (!_authListenerBound && supabase?.auth?.onAuthStateChange) {
    _authListenerBound = true;
    supabase.auth.onAuthStateChange((event, session) => {
      _session = session;
      _user = session?.user ?? null;
      _isInitialized = true;

      // 1. Emit generic state change
      emit('AUTH_STATE_CHANGED', { event, session, user: _user });

      // 2. Handle specific auth events (including immediate return from Google OAuth)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || (event === 'INITIAL_SESSION' && session)) {
        if (_user) {
          emit('USER_LOGGED_IN', { session, user: _user });
          window.dispatchEvent(new CustomEvent('auth:signed_in', { detail: { user: _user } }));
        }
      } else if (event === 'SIGNED_OUT') {
        _user = null;
        _session = null;
        localStorage.removeItem('luxe-mock-session');
        emit('USER_LOGGED_OUT');
        window.dispatchEvent(new CustomEvent('auth:signed_out'));
      } else if (event === 'USER_UPDATED') {
        _user = session?.user ?? null;
        window.dispatchEvent(new CustomEvent('auth:user_updated', { detail: { user: _user } }));
      }
    });
  }

  _isInitialized = true;
  return { user: _user, session: _session };
}

/* ---------------------------------------------------------------- *
 * Authentication Operations
 * ---------------------------------------------------------------- */

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function signIn(email, password) {
  let supabase = getSupabase();
  if (!supabase && HAS_SUPABASE) {
    supabase = await initSupabase();
  }

  if (!supabase) {
    // Mock mode
    const mockUser = {
      id: 'mock-user',
      email,
      user_metadata: {
        display_name: email.split('@')[0],
        full_name: email.split('@')[0],
      },
    };
    _session = { user: mockUser };
    _user = mockUser;
    _isInitialized = true;
    localStorage.removeItem('luxe-logged-out');
    localStorage.setItem('luxe-mock-session', JSON.stringify(mockUser));
    emit('USER_LOGGED_IN', { session: _session, user: mockUser });
    window.dispatchEvent(new CustomEvent('auth:signed_in', { detail: { user: mockUser } }));
    return { user: mockUser, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { user: null, error: _translateAuthError(error.message) };
  }

  localStorage.removeItem('luxe-logged-out');
  _session = data.session;
  _user = data.user;
  _isInitialized = true;
  emit('USER_LOGGED_IN', { session: data.session, user: data.user });
  window.dispatchEvent(new CustomEvent('auth:signed_in', { detail: { user: data.user } }));

  return { user: data.user, error: null };
}

/**
 * Sign in as Guest (Offline Demo mode).
 * Allows users to explore all features instantly without creating an account.
 * Uses local client storage and realistic seed data.
 * @returns {Promise<{user: object, error: null}>}
 */
export async function signInAsGuest() {
  const mockUser = {
    id: 'mock-user',
    email: 'guest@luxe.dev',
    user_metadata: {
      display_name: 'Khách Trải Nghiệm',
      full_name: 'Khách Trải Nghiệm',
    },
  };
  _session = { user: mockUser };
  _user = mockUser;
  _isInitialized = true;
  localStorage.removeItem('luxe-logged-out');
  localStorage.setItem('luxe-mock-session', JSON.stringify(mockUser));
  emit('USER_LOGGED_IN', { session: _session, user: mockUser });
  window.dispatchEvent(new CustomEvent('auth:signed_in', { detail: { user: mockUser } }));
  return { user: mockUser, error: null };
}

/**
 * Sign up with email, password, and metadata (display_name / full_name).
 * @param {string} email
 * @param {string} password
 * @param {object|string} metadataOrFullName - object { display_name } or string fullName
 * @returns {Promise<{user: object|null, error: string|null, needsEmailVerification?: boolean}>}
 */
export async function signUp(email, password, metadataOrFullName) {
  let supabase = getSupabase();
  if (!supabase && HAS_SUPABASE) {
    supabase = await initSupabase();
  }

  const metadata = typeof metadataOrFullName === 'object' && metadataOrFullName !== null
    ? metadataOrFullName
    : { display_name: metadataOrFullName, full_name: metadataOrFullName };

  const displayName = metadata.display_name || metadata.full_name || email.split('@')[0];

  if (!supabase) {
    const mockUser = {
      id: 'mock-user',
      email,
      user_metadata: {
        display_name: displayName,
        full_name: displayName,
        ...metadata,
      },
    };
    _session = { user: mockUser };
    _user = mockUser;
    _isInitialized = true;
    localStorage.setItem('luxe-mock-session', JSON.stringify(mockUser));
    emit('USER_LOGGED_IN', { session: _session, user: mockUser });
    window.dispatchEvent(new CustomEvent('auth:signed_in', { detail: { user: mockUser } }));
    return { user: mockUser, error: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        full_name: displayName,
        ...metadata,
      },
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });

  if (error) {
    return { user: null, error: _translateAuthError(error.message) };
  }

  _session = data.session;
  _user = data.user;
  _isInitialized = true;

  if (data.session && data.user) {
    emit('USER_LOGGED_IN', { session: data.session, user: data.user });
    window.dispatchEvent(new CustomEvent('auth:signed_in', { detail: { user: data.user } }));
  }

  if (!data.session) {
    return { user: data.user, error: null, needsEmailVerification: true };
  }

  return { user: data.user, error: null };
}

/**
 * Sign in or sign up with Google OAuth.
 *
 * CRITICAL FOR HASH ROUTER:
 * Redirect to the origin + pathname WITHOUT any hash fragment (e.g. `http://localhost:3000/`).
 * OAuth specs do not guarantee fragment retention across 302 redirects.
 * Passing clean pathname allows Supabase to append query params `?code=...` (PKCE) or `#access_token=...`
 * cleanly, which the router's OAuth resolver then absorbs without route conflicts.
 *
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function signInWithGoogle() {
  let supabase = getSupabase();
  if (!supabase && HAS_SUPABASE) {
    supabase = await initSupabase();
  }

  if (!supabase) {
    return { data: null, error: 'Chức năng đăng nhập Google chưa khả dụng trong chế độ mô phỏng.' };
  }

  // Strip any existing hash (e.g., #login, #/login) to prevent double-hash mangling
  const cleanRedirectUrl = `${window.location.origin}${window.location.pathname}`;

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: cleanRedirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      return { data: null, error: _translateAuthError(error.message) };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err?.message || 'Không thể bắt đầu đăng nhập với Google.' };
  }
}

/**
 * Sign out the current user and clear sessions.
 * @returns {Promise<{error: string|null}>}
 */
export async function signOut() {
  let supabase = getSupabase();
  if (!supabase && HAS_SUPABASE) {
    supabase = await initSupabase();
  }

  localStorage.removeItem('luxe-mock-session');
  localStorage.setItem('luxe-logged-out', 'true');

  if (!supabase) {
    _user = null;
    _session = null;
    emit('USER_LOGGED_OUT');
    window.dispatchEvent(new CustomEvent('auth:signed_out'));
    return { error: null };
  }

  try {
    const { error } = await supabase.auth.signOut();
    _user = null;
    _session = null;
    emit('USER_LOGGED_OUT');
    window.dispatchEvent(new CustomEvent('auth:signed_out'));

    if (error) {
      return { error: _translateAuthError(error.message) };
    }
    return { error: null };
  } catch (err) {
    _user = null;
    _session = null;
    emit('USER_LOGGED_OUT');
    return { error: null };
  }
}

/**
 * Send password reset email.
 * @param {string} email
 * @returns {Promise<{error: string|null}>}
 */
export async function sendPasswordReset(email) {
  let supabase = getSupabase();
  if (!supabase && HAS_SUPABASE) supabase = await initSupabase();

  if (!supabase) return { error: null };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`,
  });

  if (error) {
    return { error: _translateAuthError(error.message) };
  }
  return { error: null };
}

/**
 * Update current user password.
 * @param {string} newPassword
 * @returns {Promise<{error: string|null}>}
 */
export async function updatePassword(newPassword) {
  let supabase = getSupabase();
  if (!supabase && HAS_SUPABASE) supabase = await initSupabase();

  if (!supabase) return { error: null };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: _translateAuthError(error.message) };
  }
  return { error: null };
}

/**
 * Resend email verification.
 * @param {string} email
 * @returns {Promise<{error: string|null}>}
 */
export async function resendVerification(email) {
  let supabase = getSupabase();
  if (!supabase && HAS_SUPABASE) supabase = await initSupabase();

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
 * Profile helpers
 * ---------------------------------------------------------------- */

/**
 * Get profile for current user from public.profiles.
 * @returns {Promise<{profile: object|null, error: string|null}>}
 */
export async function getProfile() {
  let supabase = getSupabase();
  if (!supabase || !_user) {
    return { profile: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', _user.id)
      .maybeSingle();

    if (error) {
      return { profile: null, error: 'Không thể tải hồ sơ người dùng.' };
    }
    return { profile: data, error: null };
  } catch (err) {
    return { profile: null, error: err?.message || 'Lỗi khi tải hồ sơ.' };
  }
}

/**
 * Upsert profile updates into public.profiles.
 * @param {object} updates
 * @returns {Promise<{profile: object|null, error: string|null}>}
 */
export async function upsertProfile(updates) {
  let supabase = getSupabase();
  if (!supabase || !_user) {
    return { profile: updates, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: _user.id, ...updates, updated_at: new Date().toISOString() })
      .select()
      .maybeSingle();

    if (error) {
      return { profile: null, error: 'Không thể cập nhật hồ sơ.' };
    }
    return { profile: data, error: null };
  } catch (err) {
    return { profile: null, error: err?.message || 'Lỗi cập nhật hồ sơ.' };
  }
}

/**
 * Check if onboarding is complete.
 * @param {object|null} profile
 * @returns {boolean}
 */
export function hasCompletedOnboarding(profile) {
  if (!profile) return false;
  return !!(profile.display_name || profile.full_name) &&
         profile.currency &&
         profile.payday &&
         profile.budget_period &&
         profile.onboarding_complete !== false;
}

/**
 * Mark onboarding as complete.
 * @param {object} profileUpdates
 * @returns {Promise<{error: string|null}>}
 */
export async function completeOnboarding(profileUpdates) {
  let supabase = getSupabase();
  if (!supabase || !_user) {
    localStorage.setItem('luxe-onboarding-complete', 'true');
    return { error: null };
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ ...profileUpdates, onboarding_complete: true, updated_at: new Date().toISOString() })
      .eq('id', _user.id);

    if (error) {
      return { error: 'Không thể hoàn tất hoạt động. Vui lòng thử lại.' };
    }
    return { error: null };
  } catch (err) {
    return { error: err?.message || 'Lỗi lưu thông tin.' };
  }
}

/* ---------------------------------------------------------------- *
 * Error Translation Helper
 * ---------------------------------------------------------------- */
function _translateAuthError(message) {
  const msg = String(message || '').toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid_grant') || msg.includes('wrong') || msg.includes('incorrect')) {
    return 'Email hoặc mật khẩu không chính xác.';
  }
  if (msg.includes('already registered') || msg.includes('user already exists') || msg.includes('unique constraint')) {
    return 'Email này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.';
  }
  if (msg.includes('weak') || (msg.includes('password') && (msg.includes('6') || msg.includes('least')))) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
  }
  if (msg.includes('invalid email') || msg.includes('valid email')) {
    return 'Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.';
  }
  if (msg.includes('user not found')) {
    return 'Tài khoản không tồn tại. Vui lòng đăng ký.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Quá nhiều yêu cầu. Vui lòng thử lại sau vài phút.';
  }
  return message || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}
