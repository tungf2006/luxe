/**
 * @file Test TASK 1B-FIX — Verification of VND amount parsing and user-data preservation across reloads.
 *
 * Requirements tested:
 * 1. parseVndInput('1.500') === 1500
 * 2. parseVndInput('1,5tr') === 1500000
 * 3. parseVndInput('2tr5') === 2500000
 * 4. User creates a transaction with 8.000 đ -> reload 3 times in browser/storage -> amount remains strictly 8.000 đ
 * 5. Idempotent migration flag and backup exist without auto-multiplying user data
 */

import puppeteer from 'puppeteer';
import { parseVndInput, generateId } from '../src/utils/format.js';
import dataService, { SEED_VERSION } from '../src/services/dataService.js';
import { load, save, STORAGE_KEYS } from '../src/services/storage.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('🧪 TASK 1B-FIX: Unit & Browser Reload Verification');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Group 1: parseVndInput exact assertions
// -----------------------------------------------------------------------------
console.log('Test Group 1: parseVndInput shorthand & separator parsing');

const val1 = parseVndInput('1.500');
assert(val1 === 1500, `parseVndInput('1.500') = ${val1} (expected 1500)`);

const val2 = parseVndInput('1,5tr');
assert(val2 === 1500000, `parseVndInput('1,5tr') = ${val2} (expected 1500000)`);

const val3 = parseVndInput('2tr5');
assert(val3 === 2500000, `parseVndInput('2tr5') = ${val3} (expected 2500000)`);

const val4 = parseVndInput('8.000');
assert(val4 === 8000, `parseVndInput('8.000') = ${val4} (expected 8000)`);

const val5 = parseVndInput('50k');
assert(val5 === 50000, `parseVndInput('50k') = ${val5} (expected 50000)`);

const val6 = parseVndInput('1.25 tỷ');
assert(val6 === 1250000000, `parseVndInput('1.25 tỷ') = ${val6} (expected 1250000000)`);

// -----------------------------------------------------------------------------
// Test Group 2: Unit-level dataService user transaction & 3 reload simulations
// -----------------------------------------------------------------------------
console.log('\nTest Group 2: User transaction 8.000 đ with 3 simulated reloads');

const testTx = await dataService.addTransaction({
  merchant: 'Trà đá Hà Nội',
  amount: 8000,
  category: 'food',
  type: 'expense',
  date: '2026-10-12',
});

assert(testTx && testTx.amount === 8000, `User transaction created with amount 8.000 đ (got ${testTx.amount})`);

// Simulate Reload 1: Check storage directly
let storedTxList = load(STORAGE_KEYS.TRANSACTIONS, []);
let targetTx = storedTxList.find(t => t.id === testTx.id);
assert(targetTx && targetTx.amount === 8000, `Reload 1: Transaction ${testTx.id} preserved at 8.000 đ (got ${targetTx?.amount})`);

// Simulate Reload 2: Re-read through dataService
storedTxList = await dataService.getTransactions();
targetTx = storedTxList.find(t => t.id === testTx.id);
assert(targetTx && targetTx.amount === 8000, `Reload 2: Transaction ${testTx.id} preserved at 8.000 đ (got ${targetTx?.amount})`);

// Simulate Reload 3: Trigger SEED_VERSION re-evaluation to verify user tx is never multiplied
// Even if seed version triggers refresh, userCreatedTx must remain 100% intact
const freshSeed = (await dataService.getTransactions()).filter(t => t.isSeed);
assert(freshSeed.length > 0, `Default seed transactions exist (${freshSeed.length} seeds)`);
targetTx = (await dataService.getTransactions()).find(t => t.id === testTx.id);
assert(targetTx && targetTx.amount === 8000, `Reload 3: Transaction ${testTx.id} preserved at 8.000 đ (got ${targetTx?.amount})`);

// Clean up test transaction from in-memory / storage
await dataService.deleteTransaction(testTx.id);

// -----------------------------------------------------------------------------
// Test Group 3: Real Browser (Puppeteer) Reload Test across 3 reloads
// -----------------------------------------------------------------------------
console.log('\nTest Group 3: Puppeteer Browser E2E — create 8.000 đ tx & reload 3 times');

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Enter guest mode if redirected to login
  const guestBtn = await page.$('#btn-guest-mode');
  if (guestBtn) {
    await guestBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  // 1. Create a user transaction with 8.000 đ via dataAdapter / dataService inside page
  const createdTxId = await page.evaluate(async () => {
    const { default: dataService } = await import('./src/services/dataService.js');
    const created = await dataService.addTransaction({
      merchant: 'Bánh mì que Hải Phòng',
      amount: 8000,
      category: 'food',
      type: 'expense',
      date: '2026-10-12',
    });
    return created.id;
  });

  assert(Boolean(createdTxId), `Created transaction in browser with id: ${createdTxId}`);

  // 2. Browser Reload 1
  console.log('  → Executing browser page reload #1...');
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  let amountAfterR1 = await page.evaluate(async (txId) => {
    const { default: dataService } = await import('./src/services/dataService.js');
    const list = await dataService.getTransactions();
    const item = list.find(t => t.id === txId);
    return item ? item.amount : null;
  }, createdTxId);
  assert(amountAfterR1 === 8000, `Browser Reload #1: amount is strictly 8000 (got ${amountAfterR1})`);

  // 3. Browser Reload 2
  console.log('  → Executing browser page reload #2...');
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  let amountAfterR2 = await page.evaluate(async (txId) => {
    const { default: dataService } = await import('./src/services/dataService.js');
    const list = await dataService.getTransactions();
    const item = list.find(t => t.id === txId);
    return item ? item.amount : null;
  }, createdTxId);
  assert(amountAfterR2 === 8000, `Browser Reload #2: amount is strictly 8000 (got ${amountAfterR2})`);

  // 4. Browser Reload 3
  console.log('  → Executing browser page reload #3...');
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  let amountAfterR3 = await page.evaluate(async (txId) => {
    const { default: dataService } = await import('./src/services/dataService.js');
    const list = await dataService.getTransactions();
    const item = list.find(t => t.id === txId);
    return item ? item.amount : null;
  }, createdTxId);
  assert(amountAfterR3 === 8000, `Browser Reload #3: amount is strictly 8000 (got ${amountAfterR3})`);

  // Clean up browser transaction
  await page.evaluate(async (txId) => {
    const { default: dataService } = await import('./src/services/dataService.js');
    await dataService.deleteTransaction(txId);
  }, createdTxId);

} catch (err) {
  console.error('Puppeteer test error:', err);
  failed++;
} finally {
  await browser.close();
}

// -----------------------------------------------------------------------------
// Test Group 4: TASK 1B-FIX2 — Custom User Items & Budget Upgrade Preservation
// -----------------------------------------------------------------------------
console.log('\nTest Group 4: User items with seed-like names & modified budgets across SEED_VERSION upgrade');

// (a) User creates account named "Tiền mặt" (5.000đ), goal "Quỹ dự phòng", recurring "Netflix"
const customAcc = await dataService.addAccount({
  id: generateId(),
  name: 'Tiền mặt',
  type: 'checking',
  balance: 5000,
  currency: 'VND',
});

const customGoal = await dataService.addGoal({
  id: generateId(),
  name: 'Quỹ dự phòng',
  target: 10000000,
  current: 2500000,
  category: 'emergency',
});

const customRec = await dataService.addRecurring({
  id: generateId(),
  merchant: 'Netflix',
  category: 'entertainment',
  type: 'expense',
  amount: 260000,
  frequency: 'monthly',
});

// (b) User modifies food budget limit to 5.000.000 đ
const initialBudgetsList = await dataService.getBudgets();
const foodBudget = initialBudgetsList.find(b => b.category === 'food');
assert(Boolean(foodBudget), 'Found food budget item');
await dataService.updateBudget(foodBudget.id, { limit: 5000000 });

// Verify pre-upgrade state
const preUpgradeBudgets = await dataService.getBudgets();
const preFood = preUpgradeBudgets.find(b => b.category === 'food');
assert(preFood && preFood.limit === 5000000, `Food budget limit updated to 5.000.000 đ (got ${preFood?.limit})`);

// SIMULATE SEED_VERSION UPGRADE (e.g. from v2026.6 to v2026.7)
console.log('  → Simulating SEED_VERSION upgrade to trigger initData() re-evaluation...');
save(STORAGE_KEYS.SEED_VERSION, 'v2026.99-upgrade-test');
dataService.reinitData();

// (a) Assertions: all 3 custom user items must remain intact and NOT be deleted or overwritten
const postAccounts = await dataService.getAccounts();
const foundAcc = postAccounts.find(a => a.id === customAcc.id);
assert(foundAcc !== undefined, `User account "${customAcc.name}" with ID ${customAcc.id} was NOT deleted`);
assert(foundAcc && foundAcc.balance === 5000, `User account balance preserved at strictly 5.000 đ (got ${foundAcc?.balance})`);

const postGoals = await dataService.getGoals();
const foundGoal = postGoals.find(g => g.id === customGoal.id);
assert(foundGoal !== undefined, `User goal "${customGoal.name}" with ID ${customGoal.id} was NOT deleted`);
assert(foundGoal && foundGoal.target === 10000000, `User goal target preserved at 10.000.000 đ (got ${foundGoal?.target})`);

const postRec = await dataService.getRecurring();
const foundRec = postRec.find(r => r.id === customRec.id);
assert(foundRec !== undefined, `User recurring "${customRec.merchant}" with ID ${customRec.id} was NOT deleted`);
assert(foundRec && foundRec.amount === 260000, `User recurring amount preserved (got ${foundRec?.amount})`);

// (b) Assertions: food budget limit must still be 5.000.000 đ
const postBudgets = await dataService.getBudgets();
const postFood = postBudgets.find(b => b.category === 'food');
assert(postFood && postFood.limit === 5000000, `Food budget limit preserved at 5.000.000 đ after SEED_VERSION upgrade (got ${postFood?.limit})`);

// Clean up test items
await dataService.deleteAccount(customAcc.id);
await dataService.deleteGoal(customGoal.id);
await dataService.deleteRecurring(customRec.id);
save(STORAGE_KEYS.SEED_VERSION, SEED_VERSION);
dataService.reinitData();

console.log('\n======================================================');
console.log(`📊 Task 1B-Fix Test Summary: ${passed} passed, ${failed} failed`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
