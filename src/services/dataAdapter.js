/**
 * @file DataAdapter — facade that switches between localStorage (mock)
 * and Supabase backends at runtime.
 *
 * Feature modules should import from this module instead of dataService.js
 * directly. The adapter transparently delegates calls to the appropriate
 * backend based on the current auth state.
 *
 * Data flow:
 *   UI → Feature → DataAdapter → (dataService | supabaseService) → (localStorage | Supabase)
 *
 * Compute helpers (computeTotals, generateInsight, etc.) are re-exported
 * from dataService.js since they are pure functions with no backend dependency.
 */

import dataService from './dataService.js';
import supabaseDataService from './supabaseService.js';
import { HAS_SUPABASE, MOCK_MODE } from '../config/env.js';

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
  }
}

/**
 * Reset to localStorage mock mode (called on sign-out).
 */
export function useLocalStorage() {
  _useSupabase = false;
  _userId = null;
}

/**
 * Check which backend is currently active.
 * @returns {boolean}
 */
export function isUsingSupabase() {
  return _useSupabase;
}

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
    if (typeof target[prop] === 'function') {
      const active = _getActiveService();
      const value = active[prop];
      return typeof value === 'function' ? value.bind(active) : value;
    }
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
});

export default dataAdapter;
