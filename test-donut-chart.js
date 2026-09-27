/**
 * @file Unit tests for DonutChart percentage calculation and edge case handling.
 * Run: node test-donut-chart.js
 */

import { calculatePercentages, computeSegments, DonutChart } from './src/components/charts/DonutChart.js';
import { parseNumber, formatCurrency } from './src/utils/format.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}\n     Actual: ${JSON.stringify(actual)}\n   Expected: ${JSON.stringify(expected)}`);
}

console.log('\n========================================');
console.log('🧪 DonutChart & Percentage Unit Tests');
console.log('========================================\n');

// 1. Test case: Empty array
console.log('Test Group 1: Empty Array');
{
  const result = calculatePercentages([]);
  assertEqual(result, [], 'calculatePercentages([]) returns an empty array');

  const segments = computeSegments([]);
  assertEqual(segments, null, 'computeSegments([]) returns null');

  const html = DonutChart({ data: [] });
  assert(html.includes('Chưa có chi tiêu trong tháng này'), 'DonutChart([]) renders empty state');
}

// 2. Test case: Total sum equal to 0
console.log('\nTest Group 2: Total Sum Equal to 0');
{
  const zeroData = [
    { label: 'Ăn uống', value: 0 },
    { label: 'Di chuyển', value: 0 },
    { label: 'Giải trí', value: '0' },
  ];
  const result = calculatePercentages(zeroData);
  assertEqual(result, [], 'calculatePercentages with total sum = 0 returns an empty array');

  const segments = computeSegments(zeroData);
  assertEqual(segments, null, 'computeSegments with total sum = 0 returns null');

  const html = DonutChart({ data: zeroData });
  assert(html.includes('Chưa có chi tiêu trong tháng này'), 'DonutChart with total = 0 renders empty state');
}

// 3. Test case: Null / undefined / invalid values mixed in array
console.log('\nTest Group 3: Null / Undefined Values Mixed in Array');
{
  const mixedData = [
    { label: 'Ăn uống', value: 100 },
    null,
    { label: 'Giải trí', value: undefined },
    { label: 'Di chuyển', value: '200' },
    { label: 'Hóa đơn', value: null },
    undefined,
    { label: 'Tiết kiệm', value: NaN },
  ];
  const result = calculatePercentages(mixedData);
  assert(result.length === 2, 'Returns only valid items (2 items)');
  assertEqual(result[0].label, 'Ăn uống', 'First valid item label');
  assertEqual(result[0].value, 100, 'First valid item parsed value');
  assertEqual(result[0].pct, 33.3, 'First valid item percentage (33.3%)');

  assertEqual(result[1].label, 'Di chuyển', 'Second valid item label');
  assertEqual(result[1].value, 200, 'Second valid item parsed value');
  assertEqual(result[1].pct, 66.7, 'Second valid item percentage (66.7%)');
}

// 4. Test case: Strings with thousand separators
console.log('\nTest Group 4: String Numbers with Thousand Separators');
{
  const formattedData = [
    { label: 'Ăn uống', value: '1.500.000' },
    { label: 'Nhà cửa', value: '3,500,000' },
  ];
  const result = calculatePercentages(formattedData);
  assert(result.length === 2, 'Parses thousand-separated strings into numbers');
  assertEqual(result[0].value, 1500000, 'Parsed 1.500.000 to 1500000');
  assertEqual(result[0].pct, 30, 'Percentage calculation for item 1 (30%)');
  assertEqual(result[1].value, 3500000, 'Parsed 3,500,000 to 3500000');
  assertEqual(result[1].pct, 70, 'Percentage calculation for item 2 (70%)');
}

// 5. Test case: SVG circle stroke-dasharray and stroke-dashoffset calculation
console.log('\nTest Group 5: SVG Geometry & Center Label');
{
  const testData = [
    { label: 'Ăn uống', value: 50, color: '#FF0000' },
    { label: 'Di chuyển', value: 50, color: '#00FF00' },
  ];
  const segments = computeSegments(testData, 180);
  assert(segments !== null && segments.length === 2, 'Returns 2 calculated segments');
  assert(segments[0].dashoffset === 0, 'First segment dashoffset is 0');
  assert(Math.abs(segments[1].dashoffset + segments[0].dashArray) < 0.001, 'Second segment dashoffset equals negative of first segment dashArray');
  assert(segments[0].dashArray > 0, 'First segment dashArray > 0');
  assert(Math.abs(segments[0].dashArray - segments[1].dashArray) < 0.001, 'Equal values produce equal dashArrays');

  const html = DonutChart({ data: testData, totalSub: 'TỔNG CHI', currency: 'VND' });
  assert(html.includes('<circle'), 'HTML contains SVG circle elements');
  assert(html.includes('stroke-linecap="butt"'), 'HTML contains stroke-linecap="butt"');
  assert(html.includes('stroke-width="22"'), 'HTML contains stroke-width="22"');
  assert(html.includes('TỔNG CHI'), 'HTML contains center subline "TỔNG CHI"');
  assert(html.includes('letter-spacing="0.08em"'), 'HTML contains letter-spacing="0.08em"');
}

console.log('\n========================================');
console.log(`📊 Result: ${passedTests}/${totalTests} tests passed.`);
console.log('========================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
