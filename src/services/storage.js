/**
 * @file Storage abstraction layer — Scoped IndexedDB primary + localStorage fallback.
 *
 * Architecture:
 *   1. Scoped storage namespace: `luxe:{scope}:{key}` where scope is 'guest' or 'user:{userId}'.
 *   2. In-memory cache for instant synchronous reads (load), keyed by scopedKey.
 *   3. Write-through: save() writes to memory + localStorage (sync) + IndexedDB (async).
 *   4. Clear cache on scope change: no stale data in memory when logging in/out.
 *   5. One-time idempotent migration of legacy un-scoped data into 'guest' scope with backup.
 *
 * Capacity:
 *   - localStorage: ~5 MB (browser limit)
 *   - IndexedDB: 50 MB+ (typically 50% of free disk space)
 */

/* ------------------------------------------------------------------ *
 * Storage Scope Management (Single Source of Truth)
 * ------------------------------------------------------------------ */
let _currentScope = 'guest';

/**
 * Get the active storage scope ('guest' or 'user:{userId}').
 * @returns {string}
 */
export function getStorageScope() {
  return _currentScope;
}

/**
 * Set the active storage scope ('guest' or 'user:{userId}').
 * @param {string} scope
 */
export function setStorageScope(scope) {
  if (!scope || scope === 'guest') {
    _currentScope = 'guest';
  } else if (scope.startsWith('user:')) {
    _currentScope = scope;
  } else {
    _currentScope = `user:${scope}`;
  }
}

/* ------------------------------------------------------------------ *
 * Storage Keys (Canonical names)
 * ------------------------------------------------------------------ */
export const STORAGE_KEYS = {
  TRANSACTIONS: 'transactions',
  BUDGETS:      'budgets',
  SETTINGS:     'settings',
  ACCOUNTS:     'accounts',
  GOALS:        'goals',
  RECURRING:    'recurring',
  NOTIFICATIONS:'notifications',
  SEED_VERSION: 'seed_version',
  AMOUNT_UNIT_MIGRATED: 'amount_unit_migrated',
  BACKUP_BEFORE_UNIT_MIGRATION: 'backup_before_unit_migration',
  USER_BOOTSTRAPPED: 'user_bootstrapped',
};

/**
 * Map legacy un-namespaced keys for migration and backward-compatibility.
 */
const LEGACY_KEYS_MAP = {
  'luxe_transactions': 'transactions',
  'luxe_budgets': 'budgets',
  'luxe_settings': 'settings',
  'luxe_accounts': 'accounts',
  'luxe_goals': 'goals',
  'luxe_recurring': 'recurring',
  'luxe_notifications': 'notifications',
  'luxe_seed_version': 'seed_version',
  'luxe_amount_unit_migrated': 'amount_unit_migrated',
  'luxe_backup_before_unit_migration': 'backup_before_unit_migration',
};

/**
 * Build scoped storage key. Format: luxe:{scope}:{key}
 * e.g., luxe:guest:transactions or luxe:user:123:transactions
 * Handles legacy un-namespaced keys like 'luxe_transactions'.
 *
 * @param {string} key
 * @param {string} [scope]
 * @returns {string}
 */
export function getScopedKey(key, scope = getStorageScope()) {
  if (!key) return `luxe:${scope}:default`;
  if (key.startsWith('luxe:')) return key;
  const stripped = key.startsWith('luxe_') ? key.slice(5) : key;
  return `luxe:${scope}:${stripped}`;
}

/* ------------------------------------------------------------------ *
 * In-memory cache (keyed by full scoped key: luxe:{scope}:{key})
 * ------------------------------------------------------------------ */
const _cache = new Map();

/**
 * Clear in-memory cache completely (called on login/logout/scope change).
 */
export function clearStorageCache() {
  _cache.clear();
}

/* ------------------------------------------------------------------ *
 * IndexedDB Constants
 * ------------------------------------------------------------------ */
const DB_NAME = 'luxe_finance';
const DB_VERSION = 1;
const STORE_NAME = 'kv_store';

/** @type {IDBDatabase|null} */
let _db = null;
let _idbAvailable = false;
let _initPromise = null;

/* ------------------------------------------------------------------ *
 * IndexedDB helpers
 * ------------------------------------------------------------------ */

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported'));
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (e) {
      reject(e);
    }
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

/* ------------------------------------------------------------------ *
 * localStorage helpers (sync fallback)
 * ------------------------------------------------------------------ */

function lsGet(key) {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function lsSet(key, data) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function lsRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ *
 * Legacy Unnamespaced Key Migration (One-time, Idempotent)
 * ------------------------------------------------------------------ */

/**
 * Migrate legacy un-namespaced localStorage keys to guest scope.
 * Idempotent: runs once, creates a backup snapshot, NEVER merges into user scopes.
 */
export function migrateLegacyKeysToGuestScope() {
  try {
    if (typeof localStorage === 'undefined') return;
    const migrationFlag = localStorage.getItem('luxe:scope_migrated_v1');
    if (migrationFlag === 'true') return;

    const legacyBackup = {};
    let hasLegacy = false;

    for (const [legacyKey, normKey] of Object.entries(LEGACY_KEYS_MAP)) {
      const raw = localStorage.getItem(legacyKey);
      if (raw !== null) {
        hasLegacy = true;
        try {
          legacyBackup[normKey] = JSON.parse(raw);
        } catch {
          legacyBackup[normKey] = raw;
        }

        const guestKey = `luxe:guest:${normKey}`;
        // Only set guest key if it doesn't already exist
        if (localStorage.getItem(guestKey) === null) {
          localStorage.setItem(guestKey, raw);
        }
      }
    }

    if (hasLegacy) {
      localStorage.setItem(
        'luxe:legacy_backup:before_scope_migration',
        JSON.stringify({
          timestamp: new Date().toISOString(),
          data: legacyBackup,
        })
      );
    }

    localStorage.setItem('luxe:scope_migrated_v1', 'true');
  } catch (err) {
    console.warn('[storage] Legacy key migration warning:', err);
  }
}

// Run legacy migration immediately at script evaluation
migrateLegacyKeysToGuestScope();

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Load JSON data, falling back to defaults.
 * Reads from in-memory cache → localStorage fallback.
 * Synchronous for backward compatibility with dataService.initData().
 *
 * @param {string} key
 * @param {*} defaults
 * @param {string} [scope] Optional scope override, defaults to getStorageScope()
 * @returns {*}
 */
export function load(key, defaults, scope = getStorageScope()) {
  const scopedKey = getScopedKey(key, scope);

  // 1. Check in-memory cache first
  if (_cache.has(scopedKey)) {
    return _cache.get(scopedKey);
  }

  // 2. Fall back to localStorage (sync)
  const val = lsGet(scopedKey);
  if (val !== undefined) {
    _cache.set(scopedKey, val);
    return val;
  }

  return defaults;
}

/**
 * Persist JSON data.
 * Write-through: memory → localStorage (sync) → IndexedDB (async, fire-and-forget).
 *
 * @param {string} key
 * @param {*} data
 * @param {string} [scope] Optional scope override, defaults to getStorageScope()
 */
export function save(key, data, scope = getStorageScope()) {
  const scopedKey = getScopedKey(key, scope);

  // 1. Always update in-memory cache
  _cache.set(scopedKey, data);

  // 2. Write to localStorage (sync, best-effort)
  const lsOk = lsSet(scopedKey, data);

  // 3. Write to IndexedDB (async, fire-and-forget)
  if (_db && _idbAvailable) {
    idbPut(_db, scopedKey, data).catch(() => {
      /* IndexedDB write failed, localStorage is the fallback */
    });

    if (!lsOk) {
      lsRemove(scopedKey);
    }
  }
}

/**
 * Remove a key from all stores for current scope.
 * @param {string} key
 * @param {string} [scope] Optional scope override, defaults to getStorageScope()
 */
export function remove(key, scope = getStorageScope()) {
  const scopedKey = getScopedKey(key, scope);
  _cache.delete(scopedKey);
  lsRemove(scopedKey);

  if (_db && _idbAvailable) {
    idbDelete(_db, scopedKey).catch(() => { /* ignore */ });
  }
}

/**
 * Initialize IndexedDB and migrate localStorage data into it.
 * Should be called early in app bootstrap (non-blocking).
 *
 * @returns {Promise<{engine:'indexeddb'|'localstorage', migrated: boolean}>}
 */
export function initStorage() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      if (typeof indexedDB === 'undefined') {
        return { engine: 'localstorage', migrated: false };
      }

      _db = await openDB();
      _idbAvailable = true;

      // Migrate any luxe:* keys from localStorage into IndexedDB
      if (typeof localStorage !== 'undefined') {
        const promises = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('luxe:')) {
            const val = lsGet(k);
            if (val !== undefined) {
              promises.push(idbPut(_db, k, val));
              _cache.set(k, val);
            }
          }
        }
        if (promises.length > 0) {
          await Promise.all(promises);
        }
      }

      // Also warm up cache for current scope from IndexedDB
      const scope = getStorageScope();
      for (const canonicalKey of Object.values(STORAGE_KEYS)) {
        const scopedKey = getScopedKey(canonicalKey, scope);
        try {
          const val = await idbGet(_db, scopedKey);
          if (val !== undefined) {
            _cache.set(scopedKey, val);
          }
        } catch { /* per-key failure */ }
      }

      return { engine: 'indexeddb', migrated: true };
    } catch {
      _idbAvailable = false;
      return { engine: 'localstorage', migrated: false };
    }
  })();

  return _initPromise;
}

/**
 * Get storage diagnostics for debugging / settings UI.
 * @returns {Promise<{engine:string, idbAvailable:boolean, estimatedUsage:string, scope:string}>}
 */
export async function getStorageInfo() {
  let estimatedUsage = 'N/A';

  try {
    if (navigator?.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const usedMB = ((est.usage || 0) / (1024 * 1024)).toFixed(2);
      const quotaMB = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
      estimatedUsage = `${usedMB} MB / ${quotaMB} MB`;
    }
  } catch { /* not supported */ }

  return {
    engine: _idbAvailable ? 'IndexedDB' : 'localStorage',
    idbAvailable: _idbAvailable,
    estimatedUsage,
    scope: getStorageScope(),
  };
}
