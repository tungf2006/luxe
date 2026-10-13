/**
 * @file test-task1c-isolation.js
 * Comprehensive automated verification for TASK 1C:
 * 1. Storage key namespacing: luxe:guest:... and luxe:user:{id}:...
 * 2. Legacy migration: unnamespaced keys migrate to luxe:guest:... only; never to user scopes.
 * 3. Clean user bootstrap: new accounts have 0 transactions, 1 Cash account with 0 VND,
 *    suggested budgets, and zero isSeed records.
 * 4. Multi-user isolation: User A and User B have separate stores; no data leaks.
 * 5. RAM cache clearance: storage cache purged on auth transitions.
 * 6. Idempotency: multiple re-inits or reloads do not duplicate records.
 * 7. Cloud isolation: cloud backend never falls back to local demo mock data.
 * 8. Guest demo controls: Guest mode has demo data; clear guest seed data resets cleanly.
 */

import {
  load,
  save,
  remove,
  STORAGE_KEYS,
  getStorageScope,
  setStorageScope,
  getScopedKey,
  clearStorageCache,
  migrateLegacyKeysToGuestScope,
} from '../src/services/storage.js';

import dataService, {
  initData,
  reinitData,
  ensureUserBootstrap,
  clearGuestSeedData,
  SEED_VERSION,
} from '../src/services/dataService.js';

import { useSupabase, useLocalStorage, isUsingSupabase } from '../src/services/dataAdapter.js';
import supabaseDataService from '../src/services/supabaseService.js';
import { emit } from '../src/utils/eventBus.js';

// Test harness
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, extra = {}) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
    if (Object.keys(extra).length) console.error('     Details:', extra);
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 TASK 1C: User Data Isolation & Bootstrap Verification');
  console.log('======================================================\n');

  // -------------------------------------------------------------------------
  // Test Group 1: Storage Key Namespacing & getStorageScope
  // -------------------------------------------------------------------------
  console.log('Test Group 1: Storage Key Namespacing & getStorageScope()');

  setStorageScope('guest');
  assert(getStorageScope() === 'guest', 'Default scope is guest');
  assert(getScopedKey('transactions') === 'luxe:guest:transactions', 'Scoped key format for guest: luxe:guest:transactions');
  assert(getScopedKey('luxe_accounts') === 'luxe:guest:accounts', 'Normalizes legacy prefix luxe_accounts -> luxe:guest:accounts');

  setStorageScope('user:usr_123');
  assert(getStorageScope() === 'user:usr_123', 'Scope correctly updated to user:usr_123');
  assert(getScopedKey('transactions') === 'luxe:user:usr_123:transactions', 'Scoped key format for user: luxe:user:usr_123:transactions');

  setStorageScope('usr_456'); // helper normalizes bare id to user:usr_456
  assert(getStorageScope() === 'user:usr_456', 'Normalizes bare id to user:usr_456');

  // Reset to guest
  setStorageScope('guest');

  // -------------------------------------------------------------------------
  // Test Group 2: Legacy Migration Isolation (Never into User Scope)
  // -------------------------------------------------------------------------
  console.log('\nTest Group 2: Legacy Migration Idempotency & Isolation');

  // Simulate legacy unnamespaced key in localStorage
  localStorage.setItem('luxe_transactions', JSON.stringify([{ id: 'legacy_tx_1', amount: 50000, merchant: 'Legacy Shop' }]));
  localStorage.removeItem('luxe:scope_migrated_v1');
  localStorage.removeItem('luxe:guest:transactions');

  migrateLegacyKeysToGuestScope();

  const migratedGuestTx = JSON.parse(localStorage.getItem('luxe:guest:transactions') || '[]');
  assert(Array.isArray(migratedGuestTx) && migratedGuestTx.length === 1, 'Legacy transactions migrated to luxe:guest:transactions');
  assert(migratedGuestTx[0].id === 'legacy_tx_1', 'Preserved legacy item in guest scope');

  // Verify user scope was NOT polluted by migration
  const userTx = JSON.parse(localStorage.getItem('luxe:user:new_user_999:transactions') || 'null');
  assert(userTx === null, 'User scope luxe:user:new_user_999:transactions remains completely untouched');

  // Backup snapshot created
  const backup = JSON.parse(localStorage.getItem('luxe:legacy_backup:before_scope_migration') || 'null');
  assert(backup !== null && backup.data !== undefined, 'Backup snapshot created before migration');

  // Clean up simulated legacy key
  localStorage.removeItem('luxe_transactions');

  // -------------------------------------------------------------------------
  // Test Group 3: Clean New User Bootstrap (Zero Demo Tx, 1 Cash Account 0 đ)
  // -------------------------------------------------------------------------
  console.log('\nTest Group 3: Clean New User Bootstrap (ensureUserBootstrap)');

  const newUserId = 'test_user_alpha';
  setStorageScope(`user:${newUserId}`);
  clearStorageCache();

  // Run bootstrap for new user
  const bootstrapData = ensureUserBootstrap(`user:${newUserId}`, true);

  assert(Array.isArray(bootstrapData.transactions) && bootstrapData.transactions.length === 0, 'New user has exactly 0 transactions (empty)');
  assert(Array.isArray(bootstrapData.goals) && bootstrapData.goals.length === 0, 'New user has exactly 0 goals');
  assert(Array.isArray(bootstrapData.recurring) && bootstrapData.recurring.length === 0, 'New user has exactly 0 recurring items');
  assert(Array.isArray(bootstrapData.notifications) && bootstrapData.notifications.length === 0, 'New user has exactly 0 fake notifications');

  assert(Array.isArray(bootstrapData.accounts) && bootstrapData.accounts.length === 1, 'New user has exactly 1 default account');
  const defaultAcc = bootstrapData.accounts[0];
  assert(defaultAcc.name === 'Tiền mặt', 'Default account name is "Tiền mặt"');
  assert(defaultAcc.balance === 0, 'Default account balance is strictly 0 VND');
  assert(defaultAcc.is_default === true, 'Default account is marked is_default: true');
  assert(defaultAcc.isSeed === false, 'Default account is marked isSeed: false (User Data)');

  // Verify suggested budgets
  assert(Array.isArray(bootstrapData.budgets) && bootstrapData.budgets.length === 6, 'New user has suggested budgets (6 categories)');
  const allSuggested = bootstrapData.budgets.every(b => b.isSuggested === true && b.isSeed === false && b.spent === 0);
  assert(allSuggested, 'All suggested budgets are marked isSuggested: true, isSeed: false, spent: 0');

  // Check VND standard limits
  const foodBudget = bootstrapData.budgets.find(b => b.category === 'food');
  assert(foodBudget && foodBudget.limit === 5000000, 'Food suggested budget limit is 5.000.000 đ');

  // Verify zero isSeed records exist in user scope
  const anySeedInUser = [
    ...bootstrapData.transactions,
    ...bootstrapData.accounts,
    ...bootstrapData.budgets,
    ...bootstrapData.goals,
    ...bootstrapData.recurring,
  ].some(item => item && item.isSeed === true);
  assert(!anySeedInUser, 'Strictly zero isSeed === true records in new user scope');

  // -------------------------------------------------------------------------
  // Test Group 4: Multi-User Isolation (User A vs User B vs Guest)
  // -------------------------------------------------------------------------
  console.log('\nTest Group 4: Multi-User Data Isolation (User A vs User B)');

  // User A adds a transaction
  setStorageScope('user:user_A');
  clearStorageCache();
  reinitData();
  await dataService.addTransaction({
    merchant: 'User A Secret Purchase',
    amount: 150000,
    type: 'expense',
    category: 'shopping',
    date: '2026-10-12',
  });
  const userATransactions = await dataService.getTransactions();
  assert(userATransactions.length === 1, 'User A has 1 transaction');
  assert(userATransactions[0].merchant === 'User A Secret Purchase', 'User A transaction saved');

  // Switch to User B
  setStorageScope('user:user_B');
  clearStorageCache();
  reinitData();
  const userBTransactions = await dataService.getTransactions();
  assert(userBTransactions.length === 0, 'User B sees 0 transactions (does NOT see User A data)');

  // User B adds their own transaction
  await dataService.addTransaction({
    merchant: 'User B Coffee',
    amount: 35000,
    type: 'expense',
    category: 'food',
    date: '2026-10-12',
  });
  const userBUpdated = await dataService.getTransactions();
  assert(userBUpdated.length === 1, 'User B has 1 transaction');
  assert(userBUpdated[0].merchant === 'User B Coffee', 'User B transaction saved');

  // Switch back to User A
  setStorageScope('user:user_A');
  clearStorageCache();
  reinitData();
  const userAReloaded = await dataService.getTransactions();
  assert(userAReloaded.length === 1, 'User A still has 1 transaction (unaltered by User B)');
  assert(userAReloaded[0].merchant === 'User A Secret Purchase', 'User A data preserved 100%');

  // Switch to Guest mode
  setStorageScope('guest');
  clearStorageCache();
  reinitData();
  const guestTransactions = await dataService.getTransactions();
  assert(guestTransactions.length > 50, 'Guest mode retains full realistic demo seed transactions (67 items)');
  const guestHasUserA = guestTransactions.some(t => t.merchant === 'User A Secret Purchase');
  assert(!guestHasUserA, 'Guest mode does NOT leak User A transaction');

  // -------------------------------------------------------------------------
  // Test Group 5: RAM Cache Clearance on Auth Transitions
  // -------------------------------------------------------------------------
  console.log('\nTest Group 5: RAM Cache Clearance & Scope Transition Events');

  // Save something in guest cache
  save('temp_key', 'guest_val', 'guest');
  assert(load('temp_key', null, 'guest') === 'guest_val', 'Value saved and cached in guest scope');

  // Simulate USER_LOGGED_IN event
  emit('USER_LOGGED_IN', {
    user: {
      id: 'session_user_42',
      email: 'member42@luxe.dev',
    },
  });

  // Verify scope switched to session_user_42
  assert(getStorageScope() === 'user:session_user_42', 'Scope automatically updated to user:session_user_42 via event');

  // Verify memory cache does not leak temp_key from guest
  assert(load('temp_key', null, 'user:session_user_42') === null, 'Cache cleared: new user does not read guest temp_key');

  // Simulate USER_LOGGED_OUT event
  emit('USER_LOGGED_OUT');
  assert(getStorageScope() === 'guest', 'Scope automatically reset to guest via USER_LOGGED_OUT');

  // -------------------------------------------------------------------------
  // Test Group 6: Idempotency Across Multiple Boots / Reloads
  // -------------------------------------------------------------------------
  console.log('\nTest Group 6: Idempotency Across Multiple Inits / Reloads');

  const idempotentUserId = 'idempotent_user';
  setStorageScope(`user:${idempotentUserId}`);
  clearStorageCache();

  // First boot
  const boot1 = reinitData();
  assert(boot1.accounts.length === 1, 'Boot 1: exactly 1 Cash account');

  // Second boot (simulating F5 page reload)
  clearStorageCache();
  const boot2 = reinitData();
  assert(boot2.accounts.length === 1, 'Boot 2: still exactly 1 Cash account (no duplicate)');
  assert(boot2.budgets.length === 6, 'Boot 2: exactly 6 suggested budgets (no duplicates)');
  assert(boot2.transactions.length === 0, 'Boot 2: still 0 transactions');

  // User edits their Cash account name and balance
  await dataService.updateAccount(boot2.accounts[0].id, {
    name: 'Ví tiền mặt hàng ngày',
    balance: 500000,
  });

  // Third boot (simulating another reload)
  clearStorageCache();
  const boot3 = reinitData();
  assert(boot3.accounts.length === 1, 'Boot 3: account count remains 1');
  assert(boot3.accounts[0].name === 'Ví tiền mặt hàng ngày', 'User-modified account name preserved intact');
  assert(boot3.accounts[0].balance === 500000, 'User-modified balance 500.000 đ preserved intact');

  // -------------------------------------------------------------------------
  // Test Group 7: Cloud Backend Isolation (Zero Mock Seed Fallback)
  // -------------------------------------------------------------------------
  console.log('\nTest Group 7: Cloud Backend Isolation (Zero Fallback to Demo Data)');

  // Activate Cloud mode for supabaseDataService
  useSupabase('cloud_user_uuid_123');
  supabaseDataService.setUserId('cloud_user_uuid_123');

  // Test supabaseDataService.getAccounts when cloud is unconfigured or returns empty
  // (Previously it returned dataService.getAccounts() with 3 fake demo accounts)
  const cloudAccounts = await supabaseDataService.getAccounts();
  assert(Array.isArray(cloudAccounts), 'Cloud getAccounts returns an array');
  const containsDemoVietcombank = cloudAccounts.some(a => a.name === 'Vietcombank – Thanh toán');
  assert(!containsDemoVietcombank, 'Cloud getAccounts does NOT return demo Vietcombank account');

  // Reset adapter to local guest mode
  useLocalStorage();
  assert(!isUsingSupabase(), 'Backend successfully restored to local storage');

  // -------------------------------------------------------------------------
  // Test Group 8: Guest Mode Demo Controls (clearGuestSeedData)
  // -------------------------------------------------------------------------
  console.log('\nTest Group 8: Guest Mode Demo Controls');

  setStorageScope('guest');
  clearStorageCache();
  reinitData();

  const initialGuestTxCount = (await dataService.getTransactions()).length;
  assert(initialGuestTxCount > 50, 'Guest mode initially has realistic demo transactions');

  // User clicks "Xoá dữ liệu mẫu"
  clearGuestSeedData();

  const clearedGuestTx = await dataService.getTransactions();
  assert(clearedGuestTx.length === 0, 'After clearGuestSeedData: exactly 0 transactions (clean state)');

  const clearedGuestAccounts = await dataService.getAccounts();
  assert(clearedGuestAccounts.length === 1 && clearedGuestAccounts[0].balance === 0, 'After clearGuestSeedData: 1 Cash account with 0 VND balance');

  // Reset guest mode back to fresh seed for normal exploration
  await dataService.resetToDefaults();
  const restoredGuestTx = await dataService.getTransactions();
  assert(restoredGuestTx.length > 50, 'Reset to defaults restores realistic demo data in Guest mode');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`📊 Result: ${passedTests}/${totalTests} tests passed (${failedTests} failed).`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
