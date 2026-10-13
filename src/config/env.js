/**
 * @file Environment configuration loader.
 *
 * In a no-build-step vanilla JS app, environment variables are injected via
 * a <script> tag in index.html before the app boots. This module reads the
 * global SUPABASE_CONFIG object set in index.html, or falls back to mock mode.
 *
 * The global object is expected to look like:
 *   window.SUPABASE_CONFIG = { url: "...", anonKey: "..." }
 */

const globalObj = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
const config = globalObj.SUPABASE_CONFIG || {
  url: null,
  anonKey: null,
  mockMode: false,
};

export const SUPABASE_URL = config.url || null;
export const SUPABASE_ANON_KEY = config.anonKey || null;
export const MOCK_MODE = config.mockMode ?? false;
export const HAS_SUPABASE = !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !MOCK_MODE;
