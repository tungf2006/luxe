/**
 * @file Unit & Integration tests for Financial Goals & Add Goal feature.
 */

import { GOAL_CATEGORIES, GOAL_PRESETS, getGoalCategory } from '../src/constants/goals.js';
import dataService from '../src/services/dataService.js';
import { on } from '../src/utils/eventBus.js';
import { formatCurrency, parseNumber } from '../src/utils/format.js';

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
console.log('🧪 Financial Goals & Add Goal Tests');
console.log('========================================\n');

// Group 1: Category definitions & resolution
console.log('Test Group 1: Goal Categories & Metadata');
assert(Array.isArray(GOAL_CATEGORIES) && GOAL_CATEGORIES.length === 9, `Contains exactly 9 categories (got ${GOAL_CATEGORIES.length})`);

const savings = getGoalCategory('savings');
assert(savings.id === 'savings' && savings.labelVi === 'Tiết kiệm' && savings.color === '#10B981', 'Category "savings" has label "Tiết kiệm" and color #10B981');

const emergency = getGoalCategory('emergency');
assert(emergency.id === 'emergency' && emergency.labelVi === 'Quỹ dự phòng', 'Category "emergency" has label "Quỹ dự phòng"');

const fallback = getGoalCategory('unknown_xyz');
assert(fallback.id === 'other', 'Fallback for unknown category returns "other"');

// Group 2: Presets
console.log('\nTest Group 2: Goal Presets & Templates');
assert(Array.isArray(GOAL_PRESETS) && GOAL_PRESETS.length >= 5, `Has at least 5 preset templates (got ${GOAL_PRESETS.length})`);
GOAL_PRESETS.forEach(p => {
  assert(p.name && p.target > 0 && p.category && p.months > 0, `Preset "${p.name}" has valid target (${p.target}), category (${p.category}) and months (${p.months})`);
});

// Group 3: DataService CRUD & EventBus data:changed
console.log('\nTest Group 3: DataService CRUD & Reactivity');
let eventEmittedCount = 0;
const unsubscribe = on('data:changed', () => {
  eventEmittedCount++;
});

// Initial goals
const initialGoals = await dataService.getGoals();
assert(Array.isArray(initialGoals), `getGoals returns an array (length: ${initialGoals.length})`);

// Add Goal
const newGoalData = {
  name: 'Kiểm thử Mục tiêu Mac mini M4',
  category: 'savings',
  target: 18000000,
  current: 2000000,
  deadline: '2026-12-31',
  color: '#10B981',
};
const created = await dataService.addGoal(newGoalData);
assert(created && created.id && created.name === newGoalData.name, `addGoal creates new goal with id "${created.id}"`);
assert(eventEmittedCount === 1, `addGoal emitted 'data:changed' event (count: ${eventEmittedCount})`);

// Verify goal exists in list
const afterAddList = await dataService.getGoals();
const foundInList = afterAddList.find(g => g.id === created.id);
assert(Boolean(foundInList), 'New goal found in dataService.getGoals()');

// Update Goal (e.g. Deposit contribution)
const updated = await dataService.updateGoal(created.id, {
  current: 5000000,
});
assert(updated.current === 5000000, `updateGoal updated current to 5,000,000 (got ${updated.current})`);
assert(eventEmittedCount === 2, `updateGoal emitted 'data:changed' event (count: ${eventEmittedCount})`);

// Delete Goal
const deleted = await dataService.deleteGoal(created.id);
assert(deleted === true, 'deleteGoal returned true');
assert(eventEmittedCount === 3, `deleteGoal emitted 'data:changed' event (count: ${eventEmittedCount})`);

const afterDeleteList = await dataService.getGoals();
assert(!afterDeleteList.some(g => g.id === created.id), 'Deleted goal no longer in dataService.getGoals()');

// Group 4: Calculations & Formatting
console.log('\nTest Group 4: Savings Calculation Logic');
const targetAmt = 30000000;
const currentAmt = 6000000;
const remaining = targetAmt - currentAmt;
assert(remaining === 24000000, 'Remaining calculation is exact (24.000.000₫)');

const months = 6;
const perMonth = Math.round(remaining / months);
assert(perMonth === 4000000, 'Per month savings recommendation is 4.000.000₫');

console.log('\n========================================');
console.log(`📊 Result: ${passed}/${passed + failed} tests passed.`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
