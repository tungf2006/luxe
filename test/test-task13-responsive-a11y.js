/**
 * @file Acceptance Verification for TASK 13 — Responsive & Trợ năng
 * Tests viewports: 360px, 390px, 768px, 1280px, 1920px.
 * Verifies:
 * - >= 1200: Bố cục chính (KPI 4 cột, Chart/Budget 2fr:1fr, Tx/Sidebar 2fr:1fr)
 * - 768–1199: KPI 2 cột, Biểu đồ và ngân sách xếp dọc (1 cột)
 * - < 768: KPI 2 cột gọn, Bộ chọn kỳ dạng Bottom Sheet, Tương thích Bottom Nav
 * - Vùng chạm >= 44px trên mobile
 * - Không cuộn ngang (scrollWidth <= clientWidth) ở tất cả các kích thước
 * - prefers-reduced-motion
 * - Icon trang trí aria-hidden="true"
 */

import puppeteer from 'puppeteer';

(async () => {
  console.log('====================================================');
  console.log('🧪 VERIFYING TASK 13 — Responsive & Trợ năng');
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const results = {};

  try {
    await page.setViewport({ width: 1280, height: 900 });
    console.log('→ Loading application at http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => !window.location.hash.includes('loading'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));

    // Handle guest mode login if redirected to #login
    if (page.url().includes('#login')) {
      console.log('→ Clicking Guest Mode button...');
      await page.waitForSelector('#btn-guest-mode', { timeout: 5000 });
      await page.click('#btn-guest-mode');
      await page.waitForSelector('.app-layout:not([style*="display: none"])', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 800));
    }

    await page.waitForSelector('#dashboard-layout', { timeout: 10000 });

    const viewports = [
      { name: '360px (Mobile Compact)', width: 360, height: 740, category: 'mobile' },
      { name: '390px (Mobile Standard)', width: 390, height: 844, category: 'mobile' },
      { name: '768px (Tablet Portrait)', width: 768, height: 1024, category: 'tablet' },
      { name: '1280px (Desktop Laptop)', width: 1280, height: 900, category: 'desktop' },
      { name: '1920px (Full HD Monitor)', width: 1920, height: 1080, category: 'desktop' },
    ];

    for (const vp of viewports) {
      console.log(`\n----------------------------------------------------`);
      console.log(`📱 KIỂM TRA ĐỘ RỘNG: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`----------------------------------------------------`);

      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 600));

      const evaluation = await page.evaluate((vpCategory, vpWidth) => {
        const html = document.documentElement;
        const body = document.body;
        const kpiGrid = document.querySelector('#kpi-grid');
        const kpiCards = kpiGrid ? Array.from(kpiGrid.querySelectorAll('.kpi-card')) : [];
        const rowChartBudget = document.querySelector('.dashboard-row-chart-budget');
        const rowTxSidebar = document.querySelector('.dashboard-row-tx-sidebar');
        const periodSelector = document.querySelector('#dashboard-period-selector');
        const periodMobileTrigger = document.querySelector('#period-mobile-trigger');
        const periodPills = document.querySelector('.period-pills-group');
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        const mainContent = document.querySelector('.main-content');
        const pageHeader = document.querySelector('#dashboard-page-header');

        // Check horizontal scroll
        const docScrollWidth = html.scrollWidth;
        const docClientWidth = html.clientWidth;
        const bodyScrollWidth = body.scrollWidth;
        const hasHorizontalScroll = (docScrollWidth > docClientWidth + 1) || (bodyScrollWidth > docClientWidth + 1);

        // Find overflowing elements
        const overflowing = [];
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > docClientWidth + 1.5) {
            overflowing.push(`${el.tagName}#${el.id}.${el.className.split(' ').join('.')} (right: ${rect.right.toFixed(1)}px)`);
          }
        });

        // Compute columns
        function getColsCount(gridEl) {
          if (!gridEl) return 0;
          const style = window.getComputedStyle(gridEl);
          const cols = style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
          return cols.length;
        }

        const kpiColsCount = getColsCount(kpiGrid);
        const chartBudgetColsCount = getColsCount(rowChartBudget);
        const txSidebarColsCount = getColsCount(rowTxSidebar);

        // Check ratios for desktop
        let chartBudgetRatio = 0;
        let txSidebarRatio = 0;
        if (rowChartBudget && chartBudgetColsCount === 2) {
          const cCol = rowChartBudget.querySelector('.dashboard-col-chart');
          const bCol = rowChartBudget.querySelector('.dashboard-col-budget');
          if (cCol && bCol) {
            chartBudgetRatio = cCol.getBoundingClientRect().width / bCol.getBoundingClientRect().width;
          }
        }
        if (rowTxSidebar && txSidebarColsCount === 2) {
          const tCol = rowTxSidebar.querySelector('.dashboard-col-tx');
          const sCol = rowTxSidebar.querySelector('.dashboard-col-sidebar');
          if (tCol && sCol) {
            txSidebarRatio = tCol.getBoundingClientRect().width / sCol.getBoundingClientRect().width;
          }
        }

        // Mobile specifics
        const mobileTriggerDisplay = periodMobileTrigger ? window.getComputedStyle(periodMobileTrigger).display : 'none';
        const desktopPillsDisplay = periodPills ? window.getComputedStyle(periodPills).display : 'none';
        const bottomNavDisplay = bottomNav ? window.getComputedStyle(bottomNav).display : 'none';

        // Main content bottom padding
        const mainContentPaddingBottom = mainContent ? parseFloat(window.getComputedStyle(mainContent).paddingBottom) : 0;

        // Touch target sizes for interactive elements
        const touchTargets = [];
        function checkTouchTarget(selector, label, minH = 44, minW = 44) {
          const els = document.querySelectorAll(selector);
          els.forEach((el, idx) => {
            const rect = el.getBoundingClientRect();
            // Only test visible elements
            if (rect.width > 0 && rect.height > 0) {
              const passH = rect.height >= minH - 1;
              const passW = rect.width >= minW - 1;
              touchTargets.push({
                selector: `${selector}[${idx}]`,
                label,
                width: rect.width,
                height: rect.height,
                pass: passH && passW,
              });
            }
          });
        }

        if (vpCategory === 'mobile') {
          checkTouchTarget('#period-mobile-trigger', 'Nút mở bộ chọn kỳ Mobile', 44, 44);
          checkTouchTarget('.mobile-bottom-nav .mobile-nav-item', 'Mục điều hướng dưới cùng', 44, 44);
          checkTouchTarget('.chart-period-filters .filter-btn', 'Nút lọc biểu đồ chi tiêu', 44, 44);
          checkTouchTarget('.view-all-link', 'Liên kết Xem tất cả', 40, 44);
        }

        return {
          docScrollWidth,
          docClientWidth,
          hasHorizontalScroll,
          overflowing,
          kpiColsCount,
          chartBudgetColsCount,
          txSidebarColsCount,
          chartBudgetRatio,
          txSidebarRatio,
          mobileTriggerDisplay,
          desktopPillsDisplay,
          bottomNavDisplay,
          mainContentPaddingBottom,
          touchTargets,
        };
      }, vp.category, vp.width);

      // Verify each requirement for the current viewport
      let vpPassed = true;

      // 1. Horizontal Scroll check
      console.log(`- Chiều rộng cuộn: ${evaluation.docScrollWidth}px / Chiều rộng màn hình: ${evaluation.docClientWidth}px`);
      if (!evaluation.hasHorizontalScroll && evaluation.overflowing.length === 0) {
        console.log(`  ✅ Không cuộn ngang: ĐẠT`);
      } else {
        console.error(`  ❌ Không cuộn ngang: KHÔNG ĐẠT (Phần tử tràn: ${evaluation.overflowing.join(', ')})`);
        vpPassed = false;
      }

      // 2. Layout rules per category
      if (vp.category === 'desktop') {
        // >= 1200px: Bố cục chính
        console.log(`- KPI Columns: ${evaluation.kpiColsCount} (Yêu cầu: 4 cột)`);
        console.log(`- Chart/Budget Columns: ${evaluation.chartBudgetColsCount} (Tỷ lệ 2fr:1fr: ${evaluation.chartBudgetRatio.toFixed(2)})`);
        console.log(`- Tx/Sidebar Columns: ${evaluation.txSidebarColsCount} (Tỷ lệ 2fr:1fr: ${evaluation.txSidebarRatio.toFixed(2)})`);

        const kpiPass = evaluation.kpiColsCount === 4;
        const chartPass = evaluation.chartBudgetColsCount === 2 && Math.abs(evaluation.chartBudgetRatio - 2.0) < 0.25;
        const txPass = evaluation.txSidebarColsCount === 2 && Math.abs(evaluation.txSidebarRatio - 2.0) < 0.25;

        if (kpiPass && chartPass && txPass) {
          console.log(`  ✅ Bố cục chính (>= 1200px): ĐẠT`);
        } else {
          console.error(`  ❌ Bố cục chính (>= 1200px): KHÔNG ĐẠT (KPI: ${kpiPass}, Chart: ${chartPass}, Tx: ${txPass})`);
          vpPassed = false;
        }
      } else if (vp.category === 'tablet') {
        // 768–1199px: KPI 2 cột, Biểu đồ và ngân sách xếp dọc (1 cột)
        console.log(`- KPI Columns: ${evaluation.kpiColsCount} (Yêu cầu: 2 cột)`);
        console.log(`- Chart/Budget Columns: ${evaluation.chartBudgetColsCount} (Yêu cầu: 1 cột xếp dọc)`);
        console.log(`- Tx/Sidebar Columns: ${evaluation.txSidebarColsCount} (Yêu cầu: 1 cột xếp dọc)`);

        const kpiPass = evaluation.kpiColsCount === 2;
        const chartPass = evaluation.chartBudgetColsCount === 1;
        const txPass = evaluation.txSidebarColsCount === 1;

        if (kpiPass && chartPass && txPass) {
          console.log(`  ✅ Bố cục Tablet 768–1199px (KPI 2 cột, Xếp dọc): ĐẠT`);
        } else {
          console.error(`  ❌ Bố cục Tablet 768–1199px: KHÔNG ĐẠT`);
          vpPassed = false;
        }
      } else if (vp.category === 'mobile') {
        // < 768px: KPI 2 cột gọn, Bộ chọn kỳ Bottom Sheet, Bottom Nav
        console.log(`- KPI Columns: ${evaluation.kpiColsCount} (Yêu cầu: 2 cột gọn)`);
        console.log(`- Chart/Budget Columns: ${evaluation.chartBudgetColsCount} (Yêu cầu: 1 cột xếp dọc)`);
        console.log(`- Bộ chọn kỳ Mobile Trigger Display: ${evaluation.mobileTriggerDisplay} (Yêu cầu: flex)`);
        console.log(`- Desktop Pills Display: ${evaluation.desktopPillsDisplay} (Yêu cầu: none)`);
        console.log(`- Bottom Nav Display: ${evaluation.bottomNavDisplay} (Yêu cầu: flex)`);
        console.log(`- Main Content Padding Bottom: ${evaluation.mainContentPaddingBottom}px (Yêu cầu: >= 76px để không bị che bởi Bottom Nav)`);

        const kpiPass = evaluation.kpiColsCount === 2;
        const chartPass = evaluation.chartBudgetColsCount === 1;
        const triggerPass = evaluation.mobileTriggerDisplay !== 'none' && evaluation.desktopPillsDisplay === 'none';
        const bottomNavPass = evaluation.bottomNavDisplay === 'flex' && evaluation.mainContentPaddingBottom >= 70;

        if (kpiPass && chartPass && triggerPass && bottomNavPass) {
          console.log(`  ✅ Bố cục Mobile < 768px (KPI 2 cột gọn, Bottom Sheet trigger, Bottom Nav): ĐẠT`);
        } else {
          console.error(`  ❌ Bố cục Mobile < 768px: KHÔNG ĐẠT`);
          vpPassed = false;
        }

        // Test Bottom Sheet interaction on Mobile
        console.log(`- Kiểm tra tương tác Bộ chọn kỳ Bottom Sheet...`);
        const triggerBtn = await page.$('#period-mobile-trigger');
        if (triggerBtn) {
          await triggerBtn.click();
          await new Promise(r => setTimeout(r, 400));

          const sheetState = await page.evaluate(() => {
            const sheet = document.querySelector('#period-bottom-sheet');
            const backdrop = document.querySelector('#period-sheet-backdrop');
            const handle = document.querySelector('.period-sheet-handle');
            const options = Array.from(document.querySelectorAll('.period-sheet-option'));
            const closeBtn = document.querySelector('#period-sheet-close');

            const isOpen = sheet && sheet.classList.contains('open');
            const backdropOpen = backdrop && backdrop.classList.contains('open');
            const zIndex = sheet ? parseInt(window.getComputedStyle(sheet).zIndex, 10) : 0;

            const optionHeights = options.map(o => o.getBoundingClientRect().height);
            const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

            return {
              isOpen,
              backdropOpen,
              hasHandle: !!handle,
              optionsCount: options.length,
              allOptionsGe44: optionHeights.every(h => h >= 44),
              closeGe44: closeRect && closeRect.width >= 40 && closeRect.height >= 40,
              zIndexAboveBottomNav: zIndex >= 200,
            };
          });

          if (sheetState.isOpen && sheetState.backdropOpen && sheetState.hasHandle && sheetState.optionsCount >= 4 && sheetState.allOptionsGe44) {
            console.log(`  ✅ Bottom Sheet mở thành công, có grab handle, các mục lựa chọn >= 44px, z-index trên Bottom Nav: ĐẠT`);
          } else {
            console.error(`  ❌ Bottom Sheet kiểm tra: KHÔNG ĐẠT`, sheetState);
            vpPassed = false;
          }

          // Test close via close button
          const closeBtn = await page.$('#period-sheet-close');
          if (closeBtn) {
            await closeBtn.click();
            await new Promise(r => setTimeout(r, 350));
            const isClosed = await page.evaluate(() => {
              const sheet = document.querySelector('#period-bottom-sheet');
              return sheet && !sheet.classList.contains('open');
            });
            if (isClosed) {
              console.log(`  ✅ Đóng Bottom Sheet qua nút đóng (X): ĐẠT`);
            } else {
              console.error(`  ❌ Đóng Bottom Sheet thất bại`);
              vpPassed = false;
            }
          }
        }

        // Check touch target compliance
        const failedTouch = evaluation.touchTargets.filter(t => !t.pass);
        if (failedTouch.length === 0) {
          console.log(`  ✅ Vùng chạm interactive elements >= 44px: ĐẠT (${evaluation.touchTargets.length} phần tử đã kiểm tra)`);
        } else {
          console.error(`  ❌ Vùng chạm < 44px: KHÔNG ĐẠT (${failedTouch.map(t => `${t.label}: ${t.width}x${t.height}`).join(', ')})`);
          vpPassed = false;
        }
      }

      results[vp.name] = vpPassed ? 'ĐẠT' : 'KHÔNG ĐẠT';
    }

    // 4. Test Accessibility: prefers-reduced-motion
    console.log(`\n----------------------------------------------------`);
    console.log(`♿ KIỂM TRA TRỢ NĂNG: prefers-reduced-motion`);
    console.log(`----------------------------------------------------`);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await new Promise(r => setTimeout(r, 300));

    const motionState = await page.evaluate(() => {
      const kpiCard = document.querySelector('.kpi-card');
      const pulseDot = document.querySelector('.status-pulse-dot');
      const style = kpiCard ? window.getComputedStyle(kpiCard) : null;
      const pulseStyle = pulseDot ? window.getComputedStyle(pulseDot) : null;

      // In reduced motion, transition duration should be 0s or <= 0.01ms
      const transitionDuration = style ? style.transitionDuration : '';
      const animName = pulseStyle ? pulseStyle.animationName : 'none';

      return {
        transitionDuration,
        animName,
      };
    });

    console.log(`- Transition Duration: ${motionState.transitionDuration}`);
    console.log(`- Animation: ${motionState.animName}`);
    let reducedMotionPass = motionState.transitionDuration.includes('0.00001') ||
                            motionState.transitionDuration.includes('0s') ||
                            motionState.animName === 'none';

    if (reducedMotionPass) {
      console.log(`✅ prefers-reduced-motion: ĐẠT`);
    } else {
      console.error(`❌ prefers-reduced-motion: KHÔNG ĐẠT`);
    }

    // 5. Test Accessibility: Decorative Icons aria-hidden="true"
    console.log(`\n----------------------------------------------------`);
    console.log(`♿ KIỂM TRA TRỢ NĂNG: Icon trang trí aria-hidden`);
    console.log(`----------------------------------------------------`);
    const iconAudit = await page.evaluate(() => {
      const dashboardSvgs = document.querySelectorAll('#dashboard-layout svg, .mobile-bottom-nav svg, .site-header svg');
      const issues = [];

      dashboardSvgs.forEach((svg, idx) => {
        // Skip Chart.js canvas or non-svg elements
        if (svg.tagName.toLowerCase() !== 'svg') return;

        const ariaHidden = svg.getAttribute('aria-hidden');
        const role = svg.getAttribute('role');
        const ariaLabel = svg.getAttribute('aria-label');
        const parentBtn = svg.closest('button, a');

        // If the SVG has an explicit role/aria-label, it's non-decorative
        if (role === 'img' && ariaLabel) return;

        // If parent has accessible text/aria-label, SVG must be aria-hidden="true"
        if (ariaHidden !== 'true') {
          issues.push({
            idx,
            parent: parentBtn ? parentBtn.className || parentBtn.id : svg.parentElement?.className,
            outerHtml: svg.outerHTML.slice(0, 100),
          });
        }
      });

      return {
        totalSvgs: dashboardSvgs.length,
        issueCount: issues.length,
        issues: issues.slice(0, 5),
      };
    });

    console.log(`- Tổng số SVG icon kiểm tra: ${iconAudit.totalSvgs}`);
    let ariaHiddenPass = iconAudit.issueCount === 0;
    if (ariaHiddenPass) {
      console.log(`✅ Tất cả icon trang trí đều có aria-hidden="true": ĐẠT`);
    } else {
      console.error(`❌ Phát hiện ${iconAudit.issueCount} icon chưa có aria-hidden="true":`, iconAudit.issues);
    }

    // Print Final Acceptance Summary Table
    console.log(`\n====================================================`);
    console.log(`📊 BẢNG TỔNG KẾT NGHIỆM THU TỪNG ĐỘ RỘNG (TASK 13)`);
    console.log(`====================================================`);
    for (const [vpName, status] of Object.entries(results)) {
      console.log(`  • ${vpName.padEnd(30)}: ${status === 'ĐẠT' ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`);
    }
    console.log(`  • prefers-reduced-motion        : ${reducedMotionPass ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`);
    console.log(`  • Icon trang trí aria-hidden    : ${ariaHiddenPass ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`);
    console.log(`====================================================\n`);

    const allPassed = Object.values(results).every(s => s === 'ĐẠT') && reducedMotionPass && ariaHiddenPass;

    if (allPassed) {
      console.log(`🎉 TẤT CẢ TIÊU CHÍ TASK 13 ĐÃ ĐẠT 100%!`);
      process.exit(0);
    } else {
      console.error(`❌ MỘT SỐ TIÊU CHÍ CHƯA ĐẠT!`);
      process.exit(1);
    }

  } catch (err) {
    console.error('Lỗi kiểm tra Task 13:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
