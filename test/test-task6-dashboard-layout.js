/**
 * Acceptance Verification for TASK 6 — Page Header + New Grid Layout
 * Viewport: 1920x1080
 */
import puppeteer from 'puppeteer';

(async () => {
  console.log('========================================');
  console.log('🧪 Verifying TASK 6 Dashboard Layout (1920x1080)');
  console.log('========================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('→ Loading application at http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => !window.location.hash.includes('loading'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));

    // Handle guest mode login if redirected to #login
    const currentUrl = page.url();
    if (currentUrl.includes('#login')) {
      console.log('→ Clicking Guest Mode button...');
      await page.waitForSelector('#btn-guest-mode', { timeout: 5000 });
      await page.click('#btn-guest-mode');
      await page.waitForSelector('.app-layout:not([style*="display: none"])', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 800));
    }

    await page.waitForSelector('#dashboard-page-header', { timeout: 10000 });

    // 1. Verify Page Header height <= 72px
    const headerInfo = await page.evaluate(() => {
      const header = document.querySelector('#dashboard-page-header');
      if (!header) return null;
      const rect = header.getBoundingClientRect();
      const title = header.querySelector('.dashboard-greeting-title')?.textContent?.trim() || '';
      const date = header.querySelector('.dashboard-header-date')?.textContent?.trim() || '';
      const periodSelector = header.querySelector('#dashboard-period-selector');

      return {
        height: rect.height,
        title,
        date,
        hasPeriodSelector: !!periodSelector,
      };
    });

    if (!headerInfo) {
      console.error('❌ #dashboard-page-header not found in DOM');
      process.exit(1);
    }

    console.log(`Page Header height: ${headerInfo.height.toFixed(1)}px (Requirement: <= 72px)`);
    if (headerInfo.height <= 72) {
      console.log('✅ PASS: Page header height <= 72px');
    } else {
      console.error(`❌ FAIL: Page header height ${headerInfo.height}px > 72px`);
      process.exit(1);
    }

    console.log(`Greeting: "${headerInfo.title}"`);
    if (headerInfo.title.startsWith('Xin chào')) {
      console.log('✅ PASS: Greeting title format is "Xin chào, {tên}"');
    } else {
      console.error(`❌ FAIL: Greeting title does not start with "Xin chào": ${headerInfo.title}`);
      process.exit(1);
    }

    console.log(`Date: "${headerInfo.date}"`);
    if (headerInfo.date.length > 0) {
      console.log('✅ PASS: Date text is present');
    } else {
      console.error('❌ FAIL: Date text is missing');
      process.exit(1);
    }

    if (headerInfo.hasPeriodSelector) {
      console.log('✅ PASS: PeriodSelector (Task 4) is present inside page header');
    } else {
      console.error('❌ FAIL: PeriodSelector is missing inside page header');
      process.exit(1);
    }

    // 2. Verify Hero headline ("Quản lý tài chính tinh tế...", badge "Danh mục sống động") is removed
    const heroRemoved = await page.evaluate(() => {
      const tagline = document.querySelector('.hero-tagline-wrapper');
      const oldHero = document.querySelector('.hero-overview');
      const bodyText = document.body.innerText;
      const hasOldSlogan = bodyText.includes('Quản lý tài chính tinh tế');
      const hasOldBadge = bodyText.includes('Danh mục sống động');
      return !tagline && !oldHero && !hasOldSlogan && !hasOldBadge;
    });

    if (heroRemoved) {
      console.log('✅ PASS: Old hero section and slogans completely removed');
    } else {
      console.error('❌ FAIL: Old hero elements or slogan still present in page');
      process.exit(1);
    }

    // 3. Verify Layout Grids
    const gridLayout = await page.evaluate(() => {
      const kpiGrid = document.querySelector('#kpi-grid');
      const row2 = document.querySelector('.dashboard-row-chart-budget');
      const row3 = document.querySelector('.dashboard-row-tx-sidebar');

      const chartCol = row2?.querySelector('.dashboard-col-chart');
      const budgetCol = row2?.querySelector('.dashboard-col-budget');
      const txCol = row3?.querySelector('.dashboard-col-tx');
      const sidebarCol = row3?.querySelector('.dashboard-col-sidebar');

      const monthlyOverview = sidebarCol?.querySelector('#quick-stats-panel');

      const kpiComputed = kpiGrid ? window.getComputedStyle(kpiGrid) : null;
      const row2Computed = row2 ? window.getComputedStyle(row2) : null;
      const row3Computed = row3 ? window.getComputedStyle(row3) : null;

      return {
        kpiColumns: kpiComputed?.gridTemplateColumns,
        row2Columns: row2Computed?.gridTemplateColumns,
        row3Columns: row3Computed?.gridTemplateColumns,
        chartWidth: chartCol?.getBoundingClientRect().width,
        budgetWidth: budgetCol?.getBoundingClientRect().width,
        txWidth: txCol?.getBoundingClientRect().width,
        sidebarWidth: sidebarCol?.getBoundingClientRect().width,
        hasMonthlyOverviewInSidebar: !!monthlyOverview,
      };
    });

    console.log(`KPI Grid columns: ${gridLayout.kpiColumns}`);
    console.log(`Row 2 columns: ${gridLayout.row2Columns}`);
    console.log(`Row 3 columns: ${gridLayout.row3Columns}`);

    // Check 2fr : 1fr ratio in row 2 (ratio ~2.0)
    const ratio2 = gridLayout.chartWidth / gridLayout.budgetWidth;
    console.log(`Row 2 ratio (chart / budget): ${ratio2.toFixed(2)} (Expected ~ 2.0)`);
    if (Math.abs(ratio2 - 2.0) < 0.2) {
      console.log('✅ PASS: Row 2 grid ratio is 2fr : 1fr');
    } else {
      console.error(`❌ FAIL: Row 2 ratio is not 2fr : 1fr (${ratio2})`);
      process.exit(1);
    }

    // Check 2fr : 1fr ratio in row 3 (ratio ~2.0)
    const ratio3 = gridLayout.txWidth / gridLayout.sidebarWidth;
    console.log(`Row 3 ratio (transactions / sidebar): ${ratio3.toFixed(2)} (Expected ~ 2.0)`);
    if (Math.abs(ratio3 - 2.0) < 0.2) {
      console.log('✅ PASS: Row 3 grid ratio is 2fr : 1fr');
    } else {
      console.error(`❌ FAIL: Row 3 ratio is not 2fr : 1fr (${ratio3})`);
      process.exit(1);
    }

    if (gridLayout.hasMonthlyOverviewInSidebar) {
      console.log('✅ PASS: "Tổng quan hàng tháng" card successfully moved to right sidebar block in row 3');
    } else {
      console.error('❌ FAIL: "Tổng quan hàng tháng" card not found in right column of row 3');
      process.exit(1);
    }

    // 4. Nghiệm thu: ở 1920×1080, KPI và biểu đồ thấy được không cần cuộn; không có cuộn ngang.
    const viewportCheck = await page.evaluate(() => {
      const kpiGrid = document.querySelector('#kpi-grid');
      const chartPanel = document.querySelector('#spending-overview-panel');

      const kpiRect = kpiGrid.getBoundingClientRect();
      const chartRect = chartPanel.getBoundingClientRect();

      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      const bodyClientWidth = document.body.clientWidth;

      const hasHorizontalScroll = scrollWidth > clientWidth || bodyScrollWidth > bodyClientWidth;

      return {
        viewportHeight: window.innerHeight,
        kpiTop: kpiRect.top,
        kpiBottom: kpiRect.bottom,
        chartTop: chartRect.top,
        chartBottom: chartRect.bottom,
        hasHorizontalScroll,
        scrollWidth,
        clientWidth,
      };
    });

    console.log(`\nViewport Height: ${viewportCheck.viewportHeight}px`);
    console.log(`KPI bottom: ${viewportCheck.kpiBottom.toFixed(1)}px (within 1080px: ${viewportCheck.kpiBottom <= viewportCheck.viewportHeight})`);
    console.log(`Chart bottom: ${viewportCheck.chartBottom.toFixed(1)}px (within 1080px: ${viewportCheck.chartBottom <= viewportCheck.viewportHeight})`);

    if (viewportCheck.kpiBottom <= viewportCheck.viewportHeight && viewportCheck.chartBottom <= viewportCheck.viewportHeight) {
      console.log('✅ PASS: Ở 1920×1080, cả KPI và biểu đồ đều thấy được hoàn toàn trong màn hình không cần cuộn!');
    } else {
      console.error(`❌ FAIL: Chart bottom ${viewportCheck.chartBottom} exceeds viewport height ${viewportCheck.viewportHeight}`);
      process.exit(1);
    }

    if (!viewportCheck.hasHorizontalScroll) {
      console.log('✅ PASS: Không có cuộn ngang (scrollWidth <= clientWidth)');
    } else {
      console.error(`❌ FAIL: Có cuộn ngang! scrollWidth: ${viewportCheck.scrollWidth}, clientWidth: ${viewportCheck.clientWidth}`);
      process.exit(1);
    }

    console.log('\n========================================');
    console.log('🎉 ALL TASK 6 ACCEPTANCE CRITERIA PASSED!');
    console.log('========================================\n');
  } finally {
    await browser.close();
  }
})();
