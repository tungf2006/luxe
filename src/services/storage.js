/**
 * @file Storage keys and localStorage wrapper.
 * Centralises all localStorage access so the rest of the app
 * never touches localStorage directly (makes Supabase swapping trivial).
 */

export const STORAGE_KEYS = {
  TRANSACTIONS: 'luxe_transactions',
  BUDGETS:     'luxe_budgets',
  SETTINGS:    'luxe_settings',
  ACCOUNTS:    'luxe_accounts',
  GOALS:       'luxe_goals',
  RECURRING:   'luxe_recurring',
};

/**
 * Load JSON data from localStorage, falling back to defaults.
 * @param {string} key
 * @param {*} defaults
 * @returns {*}
 */
export function load(key, defaults) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaults;
  } catch {
    return defaults;
  }
}

/**
 * Persist JSON data to localStorage.
 * @param {string} key
 * @param {*} data
 */
export function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* storage full / disabled — silently ignore */ }
}

/**
 * Remove a key from localStorage.
 * @param {string} key
 */
export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}
