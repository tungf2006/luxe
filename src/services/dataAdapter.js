/**
 * @file DataAdapter — facade that switches between localStorage/IndexedDB (scoped local/guest)
 * and Supabase PostgREST backends at runtime.
 *
 * Feature modules should import from this module instead of dataService.js
 * directly. The adapter transparently delegates calls to the appropriate
 * backend based on the current auth state.
 *
 * Reactive Event Integration:
 *   - Listens for 'USER_LOGGED_IN' on eventBus: switches active backend to Supabase PostgREST,
 *     updates storage scope to `user:{id}`, clears RAM cache, re-inits data, destroys open charts.
 *   - Listens for 'USER_LOGGED_OUT' on eventBus: resets active backend to Guest/Offline storage,
 *     resets scope to `guest`, clears RAM cache, re-inits data, destroys open charts.
 *
 * Data flow:
 *   UI → Feature → DataAdapter → (dataService | supabaseService) → (IndexedDB/localStorage | Supabase Cloud)
 */

import dataService from './dataService.js';
import supabaseDataService from './supabaseService.js';
import { HAS_SUPABASE, MOCK_MODE } from '../config/env.js';
import { on, emit } from '../utils/eventBus.js';
import { setStorageScope, clearStorageCache, getStorageScope } from './storage.js';
import { destroySpendingChart } from '../components/charts/spendingChart.js';

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
  _useSupabase = !!HAS_SUPABASE && !!userId && userId !== 'mock-user' && userId !== 'guest' && !MOCK_MODE;
  if (_useSupabase) {
    supabaseDataService.setUserId(userId);
    console.info('[dataAdapter] Switched active backend to Supabase Cloud for user:', userId);
  } else {
    console.info('[dataAdapter] Local client storage active for user:', userId);
  }
}

/**
 * Reset to localStorage / IndexedDB guest mode (called on sign-out).
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
  const isGuest = user?.id === 'guest' || user?.isGuest === true;
  const targetScope = isGuest ? 'guest' : (user?.id ? `user:${user.id}` : 'guest');

  // 1. Isolate storage scope
  setStorageScope(targetScope);

  // 2. Wipe RAM cache so previous user's data is never read
  clearStorageCache();

  // 3. Reset and warm local data structures for the new scope
  dataService.reinitData();

  // 4. Tear down Chart.js instances to avoid canvas/data ghosting
  destroySpendingChart();

  // 5. Select active backend
  if (user?.id && !isGuest) {
    useSupabase(user.id);
  } else {
    useLocalStorage();
  }

  // 6. Broadcast clean state
  emit('auth:changed', { user, scope: targetScope });
  emit('data:changed');
});

on('USER_LOGGED_OUT', () => {
  // 1. Reset storage scope to guest
  setStorageScope('guest');

  // 2. Wipe RAM cache
  clearStorageCache();

  // 3. Reset local data structures to guest
  dataService.reinitData();

  // 4. Destroy active Chart.js instances
  destroySpendingChart();

  // 5. Reset backend
  useLocalStorage();

  // 6. Broadcast clean state
  emit('auth:changed', { user: null, scope: 'guest' });
  emit('data:changed');
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
  ensureUserBootstrap,
  clearGuestSeedData,
} from './dataService.js';

/* ---------------------------------------------------------------- *
 * Proxy that delegates method calls to the active backend
 * ---------------------------------------------------------------- */
function _getActiveService() {
  return _useSupabase ? supabaseDataService : dataService;
}

// Data methods that must never fallback to local mock data when Supabase is active
const CLOUD_EXCLUSIVE_METHODS = new Set([
  'getTransactions',
  'addTransaction',
  'deleteTransaction',
  'updateTransaction',
  'getBudgets',
  'addBudget',
  'updateBudget',
  'deleteBudget',
  'resetBudgets',
  'getAccounts',
  'addAccount',
  'updateAccount',
  'deleteAccount',
  'getGoals',
  'addGoal',
  'updateGoal',
  'deleteGoal',
  'getRecurring',
  'addRecurring',
  'updateRecurring',
  'deleteRecurring',
  'getNotifications',
  'addNotification',
  'markNotificationRead',
  'markAllNotificationsRead',
  'deleteNotification',
  'clearAllNotifications',
  'getUnreadNotificationCount',
  'getProfile',
  'updateProfile',
  'getSettings',
  'updateSettings',
]);

const dataAdapter = new Proxy(dataService, {
  get(target, prop) {
    // If Supabase is active and the method is data-access, resolve directly on supabaseService
    if (_useSupabase && CLOUD_EXCLUSIVE_METHODS.has(prop)) {
      const val = supabaseDataService[prop];
      if (typeof val === 'function') {
        return val.bind(supabaseDataService);
      }
      return val;
    }

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
