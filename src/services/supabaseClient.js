/**
 * @file Supabase client singleton.
 *
 * Imports `@supabase/supabase-js` natively via browser ESM CDN (https://esm.sh).
 * If Supabase is unavailable (offline, mock mode, or missing keys), exports null
 * so the application falls back safely to client-side storage (IndexedDB/localStorage).
 */

import { HAS_SUPABASE, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env.js';

let _client = null;

/**
 * Dynamically resolves createClient from ESM CDN with fallback to window.supabase.
 * Ensures zero-build compatibility across native browsers.
 */
async function resolveCreateClient() {
  if (window.supabase?.createClient) {
    return window.supabase.createClient;
  }
  try {
    const module = await import('https://esm.sh/@supabase/supabase-js@2');
    return module.createClient;
  } catch (err) {
    console.warn('[supabaseClient] Could not load createClient from ESM CDN:', err);
    return null;
  }
}

/**
 * Initialise the Supabase client singleton.
 * @returns {Promise<object|null>} The Supabase client or null in mock mode.
 */
export async function initSupabase() {
  if (_client) return _client;
  if (!HAS_SUPABASE) return null;

  try {
    const createClient = await resolveCreateClient();
    if (!createClient) {
      console.warn('[supabaseClient] Supabase SDK not available in current environment.');
      _client = null;
      return null;
    }

    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storageKey: 'luxe-auth-token',
        flowType: 'pkce',
        detectSessionInUrl: true,
      },
      db: { schema: 'public' },
    });
  } catch (err) {
    console.warn('[supabaseClient] Failed to initialise Supabase client:', err);
    _client = null;
  }

  return _client;
}

/**
 * Get the current Supabase client instance synchronously if already initialized,
 * or attempt quick fallback initialization.
 * @returns {object|null}
 */
export function getSupabase() {
  if (!_client && HAS_SUPABASE && window.supabase?.createClient) {
    try {
      _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          storageKey: 'luxe-auth-token',
          flowType: 'pkce',
          detectSessionInUrl: true,
        },
        db: { schema: 'public' },
      });
    } catch (e) {
      _client = null;
    }
  }
  return _client;
}

export { _client as supabaseClient };
