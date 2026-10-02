/**
 * @file Storage abstraction layer — IndexedDB primary + localStorage fallback.
 *
 * Architecture:
 *   1. In-memory cache for instant synchronous reads (load)
 *   2. Write-through: save() writes to memory + localStorage (sync) + IndexedDB (async)
 *   3. initStorage() migrates existing localStorage data into IndexedDB on first run
 *   4. On subsequent loads, IndexedDB is the source of truth (larger capacity)
 *
 * Why not pure IndexedDB?
 *   - dataService.js calls initData() synchronously at module load time
 *   - localStorage provides the sync bootstrap, IndexedDB takes over after init
 *   - Fallback to localStorage when IndexedDB is unavailable (private browsing, etc.)
 *
 * Capacity:
 *   - localStorage: ~5 MB (browser limit)
 *   - IndexedDB: 50 MB+ (typically 50% of free disk space)
 */

/* ------------------------------------------------------------------ *
 * Storage Keys
 * ------------------------------------------------------------------ */
export const STORAGE_KEYS = {
  TRANSACTIONS: 'luxe_transactions',
  BUDGETS:      'luxe_budgets',
  SETTINGS:     'luxe_settings',
  ACCOUNTS:     'luxe_accounts',
  GOALS:        'luxe_goals',
  RECURRING:    'luxe_recurring',
  SEED_VERSION: 'luxe_seed_version',
};

/* ------------------------------------------------------------------ *
 * In-memory cache
 * ------------------------------------------------------------------ */
const _cache = new Map();

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

/**
 * Open (or create) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    try {
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

/**
 * Read a value from IndexedDB.
 * @param {IDBDatabase} db
 * @param {string} key
 * @returns {Promise<*>}
 */
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

/**
 * Write a value to IndexedDB.
 * @param {IDBDatabase} db
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
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

/**
 * Delete a value from IndexedDB.
 * @param {IDBDatabase} db
 * @param {string} key
 * @returns {Promise<void>}
 */
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

/**
 * Read from localStorage (sync).
 * @param {string} key
 * @returns {*}
 */
function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Write to localStorage (sync, best-effort).
 * @param {string} key
 * @param {*} data
 * @returns {boolean} true if successful
 */
function lsSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    // Storage full — this is exactly the problem IndexedDB solves
    return false;
  }
}

/**
 * Remove from localStorage.
 * @param {string} key
 */
function lsRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

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
 * @returns {*}
 */
export function load(key, defaults) {
  // 1. Check in-memory cache first
  if (_cache.has(key)) {
    return _cache.get(key);
  }

  // 2. Fall back to localStorage (sync)
  const val = lsGet(key);
  if (val !== undefined) {
    _cache.set(key, val);
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
 */
export function save(key, data) {
  // 1. Always update in-memory cache
  _cache.set(key, data);

  // 2. Write to localStorage (sync, best-effort)
  const lsOk = lsSet(key, data);

  // 3. Write to IndexedDB (async, fire-and-forget)
  if (_db && _idbAvailable) {
    idbPut(_db, key, data).catch(() => {
      /* IndexedDB write failed, localStorage is the fallback */
    });

    // If localStorage failed (full), we rely on IndexedDB only
    if (!lsOk) {
      // Try to free localStorage by removing this key — IndexedDB has it
      // This prevents the app from being stuck with a full localStorage
      lsRemove(key);
    }
  }
}

/**
 * Remove a key from all stores.
 * @param {string} key
 */
export function remove(key) {
  _cache.delete(key);
  lsRemove(key);

  if (_db && _idbAvailable) {
    idbDelete(_db, key).catch(() => { /* ignore */ });
  }
}

/**
 * Initialize IndexedDB and migrate localStorage data into it.
 * Should be called early in app bootstrap (non-blocking).
 *
 * After this resolves:
 *   - IndexedDB is the primary persistence layer
 *   - In-memory cache is warm from IndexedDB data
 *   - localStorage continues as sync write-through for fast bootstrap
 *
 * @returns {Promise<{engine:'indexeddb'|'localstorage', migrated: boolean}>}
 */
export function initStorage() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // Check IndexedDB availability
      if (typeof indexedDB === 'undefined') {
        return { engine: 'localstorage', migrated: false };
      }

      _db = await openDB();
      _idbAvailable = true;

      // Check if we've already migrated
      const migrationFlag = await idbGet(_db, '__luxe_idb_migrated');

      if (!migrationFlag) {
        // Migrate all STORAGE_KEYS from localStorage → IndexedDB
        const keys = Object.values(STORAGE_KEYS);
        const promises = [];

        for (const key of keys) {
          const val = lsGet(key);
          if (val !== undefined) {
            promises.push(idbPut(_db, key, val));
            // Keep in cache
            _cache.set(key, val);
          }
        }

        await Promise.all(promises);
        await idbPut(_db, '__luxe_idb_migrated', true);

        return { engine: 'indexeddb', migrated: true };
      }

      // Already migrated — load from IndexedDB into cache
      // (overrides any stale localStorage values)
      const keys = Object.values(STORAGE_KEYS);
      for (const key of keys) {
        try {
          const val = await idbGet(_db, key);
          if (val !== undefined) {
            _cache.set(key, val);
          }
        } catch { /* per-key failure — cache already has localStorage data */ }
      }

      return { engine: 'indexeddb', migrated: false };
    } catch {
      // IndexedDB not available (private browsing, security, etc.)
      _idbAvailable = false;
      return { engine: 'localstorage', migrated: false };
    }
  })();

  return _initPromise;
}

/**
 * Get storage diagnostics for debugging / settings UI.
 * @returns {Promise<{engine:string, idbAvailable:boolean, estimatedUsage:string}>}
 */
export async function getStorageInfo() {
  let estimatedUsage = 'N/A';

  try {
    if (navigator.storage && navigator.storage.estimate) {
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
  };
}
