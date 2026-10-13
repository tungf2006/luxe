/**
 * @file Unit & Integration tests for Recurring Transactions & Add/Edit feature.
 */

import {
  RECURRING_FREQUENCIES,
  RECURRING_FREQUENCY_MAP,
  RECURRING_PRESETS,
  calculateNextDueDate,
  calculateMonthlyEquivalent,
  calculateAnnualEquivalent,
} from '../src/constants/recurring.js';
import dataService from '../src/services/dataService.js';
import { on } from '../src/utils/eventBus.js';
import { getCategoryAvatarHtml } from '../src/constants/categories.js';

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

console.log('\n========================================');
console.log('🧪 Recurring Transactions Feature Tests');
console.log('========================================\n');

// Group 1: Frequency definitions
console.log('Test Group 1: Recurring Frequencies & Map');
assert(Array.isArray(RECURRING_FREQUENCIES) && RECURRING_FREQUENCIES.length === 4, `Contains exactly 4 frequencies (got ${RECURRING_FREQUENCIES.length})`);
assert(RECURRING_FREQUENCY_MAP.monthly && RECURRING_FREQUENCY_MAP.monthly.factor === 1, 'Monthly frequency factor is 1');
assert(RECURRING_FREQUENCY_MAP.weekly && RECURRING_FREQUENCY_MAP.weekly.factor > 4, 'Weekly frequency factor is ~4.345');
assert(RECURRING_FREQUENCY_MAP.yearly && RECURRING_FREQUENCY_MAP.yearly.factor === 1 / 12, 'Yearly frequency factor is 1/12');
assert(RECURRING_FREQUENCY_MAP.daily && RECURRING_FREQUENCY_MAP.daily.factor > 30, 'Daily frequency factor is ~30.4');

// Group 2: Presets
console.log('\nTest Group 2: Recurring Presets & Templates');
assert(Array.isArray(RECURRING_PRESETS) && RECURRING_PRESETS.length >= 6, `Has at least 6 presets (got ${RECURRING_PRESETS.length})`);
RECURRING_PRESETS.forEach(p => {
  assert(p.name && p.amount > 0 && p.category && p.frequency && p.type, `Preset "${p.name}" has valid amount (${p.amount}), category (${p.category}) and type (${p.type})`);
});

// Group 3: Schedule calculations
console.log('\nTest Group 3: Schedule & Equivalent Calculations');
const base = new Date('2026-10-06T12:00:00'); // Tuesday Oct 6, 2026

// Monthly due date: if day is 15th, next is Oct 15
const next15 = calculateNextDueDate('monthly', 15, null, base);
assert(next15 === '2026-10-15', `calculateNextDueDate for day 15 on Oct 6 returns 2026-10-15 (got ${next15})`);

// Monthly due date: if day is 1st (passed this month), next is Nov 1
const next1st = calculateNextDueDate('monthly', 1, null, base);
assert(next1st === '2026-11-01', `calculateNextDueDate for day 1 on Oct 6 returns 2026-11-01 (got ${next1st})`);

// Weekly due date: next Wednesday (day 3) from Tuesday (day 2) is Oct 7
const nextWed = calculateNextDueDate('weekly', null, 3, base);
assert(nextWed === '2026-10-07', `calculateNextDueDate for Wednesday returns 2026-10-07 (got ${nextWed})`);

// Daily due date: Oct 7
const nextDaily = calculateNextDueDate('daily', null, null, base);
assert(nextDaily === '2026-10-07', `calculateNextDueDate for daily returns 2026-10-07 (got ${nextDaily})`);

// Yearly due date: Oct 6, 2027
const nextYearly = calculateNextDueDate('yearly', null, null, base);
assert(nextYearly === '2027-10-06', `calculateNextDueDate for yearly returns 2027-10-06 (got ${nextYearly})`);

// Monthly equivalent calculations
const monthlyEq1 = calculateMonthlyEquivalent(250000, 'monthly');
assert(monthlyEq1 === 250000, `Monthly of 250,000 is 250,000 (got ${monthlyEq1})`);

const monthlyEqYearly = calculateMonthlyEquivalent(1200000, 'yearly');
assert(monthlyEqYearly === 100000, `Yearly 1,200,000 equals monthly 100,000 (got ${monthlyEqYearly})`);

const annualEq = calculateAnnualEquivalent(50000, 'monthly');
assert(annualEq === 600000, `Annual of 50,000 monthly equals 600,000 (got ${annualEq})`);

// Group 4: DataService CRUD & Reactivity
console.log('\nTest Group 4: DataService CRUD & Reactivity');
let eventCount = 0;
on('data:changed', () => {
  eventCount++;
});

// Initial list
const initialList = await dataService.getRecurring();
assert(Array.isArray(initialList), `getRecurring returns an array (length: ${initialList.length})`);

// Add Recurring
const newRecData = {
  merchant: 'Kiểm thử Dịch vụ Netflix Premium 4K',
  category: 'entertainment',
  type: 'expense',
  amount: 260000,
  frequency: 'monthly',
  day_of_month: 1,
  nextDate: '2026-11-01',
  status: 'active',
  is_active: true,
};
const created = await dataService.addRecurring(newRecData);
assert(created && created.id && created.merchant === newRecData.merchant, `addRecurring creates item with id "${created.id}"`);
assert(eventCount === 1, `addRecurring emitted 'data:changed' event (count: ${eventCount})`);

// Verify exists
const afterAdd = await dataService.getRecurring();
const found = afterAdd.find(r => r.id === created.id);
assert(Boolean(found), 'New recurring item found in dataService.getRecurring()');

// Update Recurring
const updated = await dataService.updateRecurring(created.id, {
  amount: 299000,
  status: 'inactive',
  is_active: false,
});
assert(updated.amount === 299000 && updated.status === 'inactive', `updateRecurring updated amount to 299,000 and status to inactive`);
assert(eventCount === 2, `updateRecurring emitted 'data:changed' event (count: ${eventCount})`);

// Delete Recurring
const deleted = await dataService.deleteRecurring(created.id);
assert(deleted === true, 'deleteRecurring returned true');
assert(eventCount === 3, `deleteRecurring emitted 'data:changed' event (count: ${eventCount})`);

const afterDelete = await dataService.getRecurring();
assert(!afterDelete.some(r => r.id === created.id), 'Deleted recurring item no longer in dataService.getRecurring()');

// Group 5: Zero-Emoji SVG Avatars
console.log('\nTest Group 5: Zero-Emoji SVG Discipline');
const avatarHtml = getCategoryAvatarHtml('entertainment', 'sm');
assert(avatarHtml.includes('<svg') && !avatarHtml.includes('🎬'), 'Category avatar renders SVG without emoji');

console.log(`\n========================================`);
console.log(`📊 Result: ${passed}/${passed + failed} tests passed.`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
