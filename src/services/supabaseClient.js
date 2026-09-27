/**
 * @file Supabase client singleton.
 *
 * Creates a single Supabase client instance from the CDN-loaded
 * `window.supabase` module. If Supabase is not available (no network,
 * no config, or mock mode), this module exports `null` so the service
 * layer can fall back to mock data.
 */

import { HAS_SUPABASE, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env.js';

let _client = null;

/**
 * Initialise the Supabase client.
 * @returns {object|null}  The supabase client or null in mock mode.
 */
export function initSupabase() {
  if (_client) return _client;
  if (!HAS_SUPABASE) return null;

  try {
    const { createClient } = window.supabase;
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storageKey: 'luxe-auth-token',
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
 * Get the current Supabase client (or null if not initialised).
 * @returns {object|null}
 */
export function getSupabase() {
  if (!_client) initSupabase();
  return _client;
}

export { _client as supabaseClient };
