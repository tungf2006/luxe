/**
 * @file DataAdapter — facade that switches between localStorage/IndexedDB (mock/guest)
 * and Supabase PostgREST backends at runtime.
 *
 * Feature modules should import from this module instead of dataService.js
 * directly. The adapter transparently delegates calls to the appropriate
 * backend based on the current auth state.
 *
 * Reactive Event Integration:
 *   - Listens for 'USER_LOGGED_IN' on eventBus: switches active backend to Supabase PostgREST
 *   - Listens for 'USER_LOGGED_OUT' on eventBus: resets active backend to Guest/Offline storage
 *
 * Data flow:
 *   UI → Feature → DataAdapter → (dataService | supabaseService) → (IndexedDB/localStorage | Supabase Cloud)
 *
 * Compute helpers (computeTotals, generateInsight, etc.) are re-exported
 * from dataService.js since they are pure functions with no backend dependency.
 */

import dataService from './dataService.js';
import supabaseDataService from './supabaseService.js';
import { HAS_SUPABASE, MOCK_MODE } from '../config/env.js';
import { on } from '../utils/eventBus.js';

/* ---------------------------------------------------------------- *
 * Backend state
 * ---------------------------------------------------------------- */
let _userId = null;
let _useSupabase = false;

/**
 * Switch the data backend to Supabase for the given user.
 * Must be called after successful authentication.
 * @param {string} userId
 */
export function useSupabase(userId) {
  _userId = userId;
  _useSupabase = !!HAS_SUPABASE && !!userId && !MOCK_MODE;
  if (_useSupabase) {
    supabaseDataService.setUserId(userId);
    console.info('[dataAdapter] Switched active backend to Supabase Cloud for user:', userId);
  } else {
    console.info('[dataAdapter] Mock/Offline mode active. Using local client storage.');
  }
}

/**
 * Reset to localStorage / IndexedDB mock mode (called on sign-out).
 */
export function useLocalStorage() {
  _useSupabase = false;
  _userId = null;
  console.info('[dataAdapter] Switched active backend to Local Storage (Guest mode).');
}

/**
 * Check which backend is currently active.
 * @returns {boolean}
 */
export function isUsingSupabase() {
  return _useSupabase;
}

/* ---------------------------------------------------------------- *
 * Reactive EventBus Listeners
 * ---------------------------------------------------------------- */
on('USER_LOGGED_IN', (e) => {
  const user = e?.detail?.user || e?.detail?.session?.user;
  if (user?.id) {
    useSupabase(user.id);
  }
});

on('USER_LOGGED_OUT', () => {
  useLocalStorage();
});

/* ---------------------------------------------------------------- *
 * Re-export pure compute functions (no backend needed)
 * ---------------------------------------------------------------- */
export {
  computeTotals,
  getTotalBalance,
  computeSavingsRate,
  getSpendingByCategory,
  getBudgetProgress,
  getMonthlyCashFlow,
  getWeeklySeries,
  generateInsight,
} from './dataService.js';

/* ---------------------------------------------------------------- *
 * Proxy that delegates method calls to the active backend
 * ---------------------------------------------------------------- */
function _getActiveService() {
  return _useSupabase ? supabaseDataService : dataService;
}

const dataAdapter = new Proxy(dataService, {
  get(target, prop) {
    const active = _getActiveService();
    const value = active && active[prop] !== undefined ? active[prop] : target[prop];
    return typeof value === 'function' ? value.bind(active) : value;
  },
  set(target, prop, value) {
    const active = _getActiveService();
    if (active) active[prop] = value;
    target[prop] = value;
    return true;
  },
});

export default dataAdapter;
