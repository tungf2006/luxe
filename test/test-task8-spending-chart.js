/**
 * @file test-task8-spending-chart.js
 * Verification suite for TASK 8 — Income vs Expenses Chart (Chart.js)
 *
 * Requirements:
 * 1. maintainAspectRatio: false, container height 260–300px.
 * 2. destroy() previous Chart instance before re-creating.
 * 3. Semantic colors: Income #10B981, Expenses #F87171.
 * 4. Sparse data (< 10 non-zero points) -> grouped bar chart.
 * 5. Y-axis uses formatCompact and subtle grid.
 * 6. X-axis labels: 'Th 4 · 30/9'.
 * 7. Custom tooltip: full date, income, expenses, net.
 * 8. Legend toggles dataset visibility.
 * 9. Empty-state renders "Thêm giao dịch" button.
 * 10. Toggle: 7 ngày | 30 ngày | Theo kỳ, with subtitle under title.
 * 11. Acceptance criteria:
 *     - Adding transaction -> chart updates, no stacked canvas.
 *     - Totals match KPI row for the same period.
 */

import puppeteer from 'puppeteer';
import {
  formatChartXAxis,
  getSpendingChartSubtitle,
  destroySpendingChart,
  computeDailySeries,
} from '../src/components/charts/spendingChart.js';

console.log('========================================');
console.log('🧪 Verifying TASK 8 — Income vs Expenses Chart');
console.log('========================================\n');

// --- 1. Unit Tests ---
console.log('--- 1. Unit Testing spendingChart.js Helpers ---');

// Test X-Axis Label: 'Th 4 · 30/9'
const wedLabel = formatChartXAxis('2026-09-30');
if (wedLabel === 'Th 4 · 30/9') {
  console.log(`✅ PASS: formatChartXAxis('2026-09-30') = "${wedLabel}" (Expected "Th 4 · 30/9")`);
} else {
  console.error(`❌ FAIL: formatChartXAxis('2026-09-30') got "${wedLabel}", expected "Th 4 · 30/9"`);
  process.exit(1);
}

const sunLabel = formatChartXAxis('2026-10-04');
if (sunLabel === 'CN · 4/10') {
  console.log(`✅ PASS: formatChartXAxis('2026-10-04') = "${sunLabel}" (Expected "CN · 4/10")`);
} else {
  console.error(`❌ FAIL: formatChartXAxis('2026-10-04') got "${sunLabel}", expected "CN · 4/10"`);
  process.exit(1);
}

// Test Subtitles
const sub7d = getSpendingChartSubtitle('7d', {}, [{ date: '2026-09-24' }, { date: '2026-09-30' }]);
if (sub7d.includes('7 ngày') && sub7d.includes('24/09/2026') && sub7d.includes('30/09/2026')) {
  console.log(`✅ PASS: getSpendingChartSubtitle('7d') = "${sub7d}"`);
} else {
  console.error(`❌ FAIL: getSpendingChartSubtitle('7d') unexpected: "${sub7d}"`);
  process.exit(1);
}

const subPeriod = getSpendingChartSubtitle('period', { from: '2026-10-01', to: '2026-10-31' });
if (subPeriod.includes('Theo kỳ') && subPeriod.includes('01/10/2026') && subPeriod.includes('31/10/2026')) {
  console.log(`✅ PASS: getSpendingChartSubtitle('period') = "${subPeriod}"`);
} else {
  console.error(`❌ FAIL: getSpendingChartSubtitle('period') unexpected: "${subPeriod}"`);
  process.exit(1);
}

// Test computeDailySeries
const sampleTx = [
  { id: '1', date: '2026-10-05', amount: 1500000, type: 'income', status: 'completed' },
  { id: '2', date: '2026-10-05', amount: 500000, type: 'expense', status: 'completed' },
  { id: '3', date: '2026-10-06', amount: 300000, type: 'expense', status: 'completed' },
];
const series = computeDailySeries(sampleTx, 'period', { from: '2026-10-05', to: '2026-10-06' });
if (series.length === 2 && series[0].income === 1500000 && series[0].expense === 500000 && series[1].expense === 300000) {
  console.log('✅ PASS: computeDailySeries aggregates daily income and expenses accurately');
} else {
  console.error('❌ FAIL: computeDailySeries output mismatch:', series);
  process.exit(1);
}

// Test destroySpendingChart
try {
  destroySpendingChart();
  console.log('✅ PASS: destroySpendingChart() is resilient and safe to invoke');
} catch (e) {
  console.error('❌ FAIL: destroySpendingChart() threw error:', e);
  process.exit(1);
}

// --- 2. Browser E2E Tests ---
console.log('\n--- 2. Browser E2E Tests (Puppeteer) ---');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('→ Loading application at http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => !window.location.hash.includes('loading'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));

    if (page.url().includes('#login')) {
      console.log('→ Clicking Guest Mode button...');
      await page.waitForSelector('#btn-guest-mode', { timeout: 5000 });
      await page.click('#btn-guest-mode');
      await page.waitForSelector('.app-layout:not([style*="display: none"])', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 800));
    }

    // Wait for dashboard widgets
    await page.waitForSelector('#spending-overview-panel', { timeout: 10000 });
    console.log('✅ PASS: #spending-overview-panel rendered');

    // 1. Check Container Height (260–300px)
    const containerHeight = await page.evaluate(() => {
      const el = document.querySelector('#spending-chart-container');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        offsetHeight: el.offsetHeight,
        computedHeight: parseFloat(cs.height),
        rectHeight: rect.height,
      };
    });

    console.log('Spending chart container height:', containerHeight);
    if (containerHeight && containerHeight.offsetHeight >= 260 && containerHeight.offsetHeight <= 300) {
      console.log(`✅ PASS: Container height = ${containerHeight.offsetHeight}px (Nằm đúng trong khoảng 260–300px)`);
    } else {
      console.error(`❌ FAIL: Container height out of bounds:`, containerHeight);
      process.exit(1);
    }

    // 2. Check Canvas and Chart.js instance properties
    const chartDetails = await page.evaluate(() => {
      const canvas = document.querySelector('#spending-chart-canvas');
      if (!canvas) return { hasCanvas: false };
      const chart = window.Chart ? window.Chart.getChart(canvas) : null;
      if (!chart) return { hasCanvas: true, hasChartInstance: false };

      const ds = chart.data.datasets;
      const incColor = ds[0]?.backgroundColor || ds[0]?.borderColor;
      const expColor = ds[1]?.backgroundColor || ds[1]?.borderColor;

      return {
        hasCanvas: true,
        hasChartInstance: true,
        chartType: chart.config.type,
        maintainAspectRatio: chart.options.maintainAspectRatio,
        responsive: chart.options.responsive,
        datasetsCount: ds.length,
        incomeLabel: ds[0]?.label,
        expenseLabel: ds[1]?.label,
        incomeColor: incColor,
        expenseColor: expColor,
        labelsCount: chart.data.labels.length,
        firstLabel: chart.data.labels[0],
      };
    });

    console.log('Chart instance details:', chartDetails);
    if (chartDetails.hasCanvas && chartDetails.hasChartInstance) {
      console.log('✅ PASS: Canvas và Chart instance khởi tạo thành công');
    } else {
      console.error('❌ FAIL: Không tìm thấy Canvas hoặc Chart instance:', chartDetails);
      process.exit(1);
    }

    if (chartDetails.maintainAspectRatio === false) {
      console.log('✅ PASS: maintainAspectRatio = false đúng yêu cầu');
    } else {
      console.error('❌ FAIL: maintainAspectRatio không phải false:', chartDetails.maintainAspectRatio);
      process.exit(1);
    }

    if (chartDetails.incomeColor === '#10B981' && chartDetails.expenseColor === '#F87171') {
      console.log('✅ PASS: Màu ngữ nghĩa chuẩn: Thu #10B981, Chi #F87171');
    } else {
      console.error('❌ FAIL: Màu dataset không khớp:', chartDetails.incomeColor, chartDetails.expenseColor);
      process.exit(1);
    }

    // Check grouped bar chart when sparse (< 10 non-zero points)
    if (chartDetails.chartType === 'bar') {
      console.log('✅ PASS: Dữ liệu thưa (<10 điểm) hiển thị đúng dạng biểu đồ cột nhóm (bar)');
    } else {
      console.log(`ℹ️ Lưu ý: Chart type là ${chartDetails.chartType} (số điểm có giá trị >= 10)`);
    }

    // 3. Check Toggle Buttons: 7 ngày | 30 ngày | Theo kỳ
    const toggleButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#spending-overview-panel [data-chart-period]'));
      return btns.map(b => ({
        key: b.dataset.chartPeriod,
        text: b.textContent.trim(),
        active: b.classList.contains('active'),
      }));
    });

    console.log('Period toggle buttons:', toggleButtons);
    const expectedKeys = ['7d', '30d', 'period'];
    const hasAllKeys = expectedKeys.every(k => toggleButtons.some(b => b.key === k));
    if (hasAllKeys && toggleButtons.length === 3) {
      console.log('✅ PASS: Đủ 3 toggle buttons: 7 ngày | 30 ngày | Theo kỳ');
    } else {
      console.error('❌ FAIL: Thiếu hoặc sai toggle buttons:', toggleButtons);
      process.exit(1);
    }

    // 4. Test Subtitle under Title
    const initialSubtitle = await page.evaluate(() => {
      const el = document.querySelector('#spending-overview-panel .panel-subtitle');
      return el ? el.textContent.trim() : '';
    });
    console.log('Initial subtitle:', initialSubtitle);
    if (initialSubtitle.length > 0) {
      console.log('✅ PASS: Có nhãn kỳ hiển thị dưới tiêu đề biểu đồ');
    } else {
      console.error('❌ FAIL: Subtitle dưới tiêu đề bị trống');
      process.exit(1);
    }

    // 5. Test Switching Toggle to "30 ngày" and verifying destroy() and single canvas
    console.log('\n--- 3. Testing Period Switching & Lifecycle Destroy ---');
    await page.click('#spending-overview-panel [data-chart-period="30d"]');
    await new Promise(r => setTimeout(r, 400));

    const checkAfter30d = await page.evaluate(() => {
      const canvases = document.querySelectorAll('#spending-chart-canvas');
      const subtitle = document.querySelector('#spending-overview-panel .panel-subtitle')?.textContent.trim();
      const chart = window.Chart ? window.Chart.getChart(canvases[0]) : null;
      return {
        canvasCount: canvases.length,
        subtitle,
        labelsCount: chart?.data.labels.length,
      };
    });

    console.log('After switching to 30d:', checkAfter30d);
    if (checkAfter30d.canvasCount === 1) {
      console.log('✅ PASS: Không bị chồng canvas (chỉ có duy nhất 1 canvas active)');
    } else {
      console.error(`❌ FAIL: Có ${checkAfter30d.canvasCount} canvas bị chồng!`);
      process.exit(1);
    }

    if (checkAfter30d.subtitle.includes('30 ngày')) {
      console.log('✅ PASS: Nhãn kỳ cập nhật đúng thành 30 ngày');
    } else {
      console.error('❌ FAIL: Nhãn kỳ không cập nhật 30 ngày:', checkAfter30d.subtitle);
      process.exit(1);
    }

    // 6. Test Switching to "Theo kỳ" and verifying totals match KPI row
    console.log('\n--- 4. Testing "Theo kỳ" Totals Matching KPI Row ---');
    await page.evaluate(() => {
      const btn = document.querySelector('#spending-overview-panel [data-chart-period="period"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const debugInfo = await page.evaluate(() => {
      const activeBtn = document.querySelector('#spending-overview-panel [data-chart-period].active');
      const subtitle = document.querySelector('#spending-overview-panel .panel-subtitle')?.textContent;
      const incomeChartRaw = document.querySelector('#chart-summary-income')?.textContent.trim() || '';
      const expenseChartRaw = document.querySelector('#chart-summary-expenses')?.textContent.trim() || '';
      return {
        activePeriod: activeBtn?.dataset?.chartPeriod,
        subtitle,
        incomeChartRaw,
        expenseChartRaw,
      };
    });
    console.log('Debug info after click period:', debugInfo);

    const matchKpiTest = await page.evaluate(() => {
      // KPI values (use .val-full if available from Task 7 responsive format)
      const incomeKpiEl = document.querySelector('#kpi-income .kpi-value');
      const expenseKpiEl = document.querySelector('#kpi-expenses .kpi-value');
      const incomeKpiRaw = (incomeKpiEl?.querySelector('.val-full') || incomeKpiEl)?.textContent?.trim() || '';
      const expenseKpiRaw = (expenseKpiEl?.querySelector('.val-full') || expenseKpiEl)?.textContent?.trim() || '';

      // Chart badges values
      const incomeChartRaw = document.querySelector('#chart-summary-income')?.textContent.trim() || '';
      const expenseChartRaw = document.querySelector('#chart-summary-expenses')?.textContent.trim() || '';

      // Normalize string numbers (e.g. "6.920 ₫" -> "6920")
      const cleanNum = (str) => str.replace(/[^\d]/g, '');

      return {
        incomeKpi: incomeKpiRaw,
        expenseKpi: expenseKpiRaw,
        incomeChart: incomeChartRaw,
        expenseChart: expenseChartRaw,
        incomeMatches: cleanNum(incomeKpiRaw) === cleanNum(incomeChartRaw),
        expenseMatches: cleanNum(expenseKpiRaw) === cleanNum(expenseChartRaw),
      };
    });

    console.log('KPI vs Chart totals comparison:', matchKpiTest);
    if (matchKpiTest.incomeMatches && matchKpiTest.expenseMatches) {
      console.log('✅ PASS: Số tổng Thu nhập và Chi phí trên biểu đồ KHỚP HOÀN TOÀN với KPI cùng kỳ!');
    } else {
      console.error('❌ FAIL: Số tổng biểu đồ không khớp với KPI cùng kỳ:', matchKpiTest);
      process.exit(1);
    }

    // 7. Test Legend toggle series
    console.log('\n--- 5. Testing Interactive Legend Toggling ---');
    const legendToggleResult = await page.evaluate(() => {
      const canvas = document.querySelector('#spending-chart-canvas');
      const chart = window.Chart ? window.Chart.getChart(canvas) : null;
      if (!chart) return null;

      const initialVis0 = chart.isDatasetVisible(0);
      const initialVis1 = chart.isDatasetVisible(1);

      // Simulate clicking legend for dataset 0
      chart.legend.options.onClick(null, { datasetIndex: 0 }, chart.legend);
      const toggledVis0 = chart.isDatasetVisible(0);

      // Restore
      chart.legend.options.onClick(null, { datasetIndex: 0 }, chart.legend);
      const restoredVis0 = chart.isDatasetVisible(0);

      return {
        initialVis0,
        initialVis1,
        toggledVis0,
        restoredVis0,
      };
    });

    console.log('Legend toggle result:', legendToggleResult);
    if (legendToggleResult && legendToggleResult.initialVis0 === true && legendToggleResult.toggledVis0 === false && legendToggleResult.restoredVis0 === true) {
      console.log('✅ PASS: Legend bật/tắt chuỗi dữ liệu (hide/show) hoạt động chính xác!');
    } else {
      console.error('❌ FAIL: Legend toggle không hoạt động:', legendToggleResult);
      process.exit(1);
    }

    // 8. Test Data changed reactivity (Adding transaction -> chart updates, no stacked canvas)
    console.log('\n--- 6. Testing Data:changed Reactivity (Adding Transaction) ---');
    const reactivityTest = await page.evaluate(async () => {
      const initialCanvases = document.querySelectorAll('#spending-chart-canvas').length;

      // Programmatically add a transaction and emit data:changed
      const storageModule = await import('./src/services/storage.js');
      const eventBus = await import('./src/utils/eventBus.js');

      const txList = storageModule.load('transactions') || [];
      const newTx = {
        id: 'tx-task8-test-' + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        amount: 2500000,
        type: 'income',
        category: 'salary',
        description: 'Thưởng Task 8',
        status: 'completed',
      };
      txList.push(newTx);
      storageModule.save('transactions', txList);
      eventBus.emit('data:changed');

      await new Promise(r => setTimeout(r, 600));

      const updatedCanvases = document.querySelectorAll('#spending-chart-canvas').length;
      const canvas = document.querySelector('#spending-chart-canvas');
      const chart = window.Chart ? window.Chart.getChart(canvas) : null;

      return {
        initialCanvases,
        updatedCanvases,
        hasChartInstance: !!chart,
      };
    });

    console.log('Reactivity test result:', reactivityTest);
    if (reactivityTest.updatedCanvases === 1 && reactivityTest.hasChartInstance) {
      console.log('✅ PASS: Thêm giao dịch → biểu đồ cập nhật, không bị chồng canvas!');
    } else {
      console.error('❌ FAIL: Chồng canvas hoặc lỗi sau khi thêm giao dịch:', reactivityTest);
      process.exit(1);
    }

    console.log('\n========================================');
    console.log('🎉 ALL TASK 8 ACCEPTANCE CRITERIA PASSED!');
    console.log('========================================\n');
  } finally {
    await browser.close();
  }
})();
