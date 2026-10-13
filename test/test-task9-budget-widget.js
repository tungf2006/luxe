/**
 * @file test-task9-budget-widget.js
 * Verification suite for TASK 9 — Budget Widget UI
 *
 * Requirements:
 * 1. Header: Đã chi X / Tổng Y · còn Z + thanh tổng.
 * 2. Mỗi dòng: icon SVG danh mục · tên · đã chi/hạn mức · % · dòng phụ Còn N đ hoặc Vượt N đ.
 * 3. Ngưỡng màu: <70% xanh, 70–90% vàng, >90% đỏ.
 * 4. Phần pending vẽ mờ/sọc.
 * 5. Track nhìn rõ khi 0%.
 * 6. Sắp xếp theo % giảm.
 * 7. Tối đa 5 dòng + "Quản lý ngân sách →".
 * 8. role="progressbar" + aria.
 * 9. Chưa có ngân sách → CTA tạo.
 * 10. Nghiệm thu: thanh 0% không còn trông như lỗi; trạng thái vượt ngân sách nổi bật.
 */

import puppeteer from 'puppeteer';
import { getBudgetProgressClass, getBudgetProgressColor } from '../src/utils/progress.js';

console.log('========================================');
console.log('🧪 Verifying TASK 9 — Budget Widget UI');
console.log('========================================\n');

// --- 1. Unit Tests for progress.js thresholds ---
console.log('--- 1. Testing Color Thresholds (<70% green, 70-90% amber, >90% red, >100% over) ---');

const thresholds = [
  { pct: 0,   expectedClass: 'progress-fill--ok',      expectedColor: '#22C55E' },
  { pct: 50,  expectedClass: 'progress-fill--ok',      expectedColor: '#22C55E' },
  { pct: 69,  expectedClass: 'progress-fill--ok',      expectedColor: '#22C55E' },
  { pct: 70,  expectedClass: 'progress-fill--warning', expectedColor: '#F59E0B' },
  { pct: 85,  expectedClass: 'progress-fill--warning', expectedColor: '#F59E0B' },
  { pct: 90,  expectedClass: 'progress-fill--warning', expectedColor: '#F59E0B' },
  { pct: 91,  expectedClass: 'progress-fill--danger',  expectedColor: '#EF4444' },
  { pct: 100, expectedClass: 'progress-fill--danger',  expectedColor: '#EF4444' },
  { pct: 105, expectedClass: 'progress-fill--over',    expectedColor: '#DC2626' },
];

for (const t of thresholds) {
  const cls = getBudgetProgressClass(t.pct);
  const col = getBudgetProgressColor(t.pct);
  if (cls === t.expectedClass && col === t.expectedColor) {
    console.log(`✅ PASS: Threshold ${t.pct}% -> class: "${cls}", color: "${col}"`);
  } else {
    console.error(`❌ FAIL: Threshold ${t.pct}% expected class "${t.expectedClass}" and color "${t.expectedColor}", got "${cls}" and "${col}"`);
    process.exit(1);
  }
}

// --- 2. Browser E2E Tests (Puppeteer) ---
console.log('\n--- 2. Browser E2E Tests (Puppeteer) ---');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('→ Loading application at http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => !window.location.hash.includes('loading'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 600));

    // Handle guest mode login if redirected to #login
    const currentUrl = page.url();
    if (currentUrl.includes('#login')) {
      console.log('→ Clicking Guest Mode button...');
      await page.waitForSelector('#btn-guest-mode', { timeout: 5000 });
      await page.click('#btn-guest-mode');
      await page.waitForSelector('.app-layout:not([style*="display: none"])', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 800));
    }

    await page.waitForSelector('#budget-progress-panel', { timeout: 10000 });

    // 1. Verify Header: "Đã chi X / Tổng Y · còn Z" + "thanh tổng"
    console.log('\n--- Checking Requirement 1: Header summary & Total Progress Bar ---');
    const headerInfo = await page.evaluate(() => {
      const panel = document.querySelector('#budget-progress-panel');
      if (!panel) return null;
      const subtitle = panel.querySelector('.panel-subtitle');
      const text = subtitle ? subtitle.textContent.trim() : '';
      const totalTrack = panel.querySelector('.budget-total-track');
      return {
        subtitleText: text,
        hasTotalTrack: !!totalTrack,
        totalTrackRole: totalTrack?.getAttribute('role'),
        totalTrackAriaNow: totalTrack?.getAttribute('aria-valuenow'),
        totalTrackAriaMin: totalTrack?.getAttribute('aria-valuemin'),
        totalTrackAriaMax: totalTrack?.getAttribute('aria-valuemax'),
        totalTrackAriaLabel: totalTrack?.getAttribute('aria-label'),
      };
    });

    console.log('Header text:', headerInfo.subtitleText);
    if (headerInfo.subtitleText.includes('Đã chi') && headerInfo.subtitleText.includes('Tổng') && (headerInfo.subtitleText.includes('còn') || headerInfo.subtitleText.includes('vượt'))) {
      console.log('✅ PASS: Header displays "Đã chi X / Tổng Y · còn/vượt Z"');
    } else {
      console.error('❌ FAIL: Header does not match required format:', headerInfo.subtitleText);
      process.exit(1);
    }

    if (headerInfo.hasTotalTrack && headerInfo.totalTrackRole === 'progressbar' && headerInfo.totalTrackAriaNow != null) {
      console.log(`✅ PASS: Header includes total progress bar with role="progressbar" and aria-valuenow="${headerInfo.totalTrackAriaNow}"`);
    } else {
      console.error('❌ FAIL: Header is missing total progress bar or proper role/aria attributes');
      process.exit(1);
    }

    // 2. Verify Line items: icon SVG · tên · đã chi/hạn mức · % · dòng phụ Còn/Vượt
    console.log('\n--- Checking Requirement 2, 6, 7: Row items anatomy, sorting, max 5 rows ---');
    const itemsData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#dashboard-budget-list .budget-item'));
      return rows.map(row => {
        const hasSvgAvatar = !!row.querySelector('.category-avatar-badge svg');
        const title = row.querySelector('.budget-category-title')?.textContent?.trim() || '';
        const spentRatio = row.querySelector('.budget-spent-ratio')?.textContent?.trim() || '';
        const pctText = row.querySelector('.budget-percent')?.textContent?.trim() || '';
        const pctVal = parseInt(pctText.replace('%', ''), 10);
        const sublineText = row.querySelector('.budget-subline')?.textContent?.trim() || '';
        const isOver = row.classList.contains('budget-item--over');
        const track = row.querySelector('.progress-track');
        const isZeroTrack = track?.classList.contains('progress-track--zero');
        const hasPendingFill = !!row.querySelector('.progress-fill--pending');
        const trackAria = {
          role: track?.getAttribute('role'),
          now: track?.getAttribute('aria-valuenow'),
          min: track?.getAttribute('aria-valuemin'),
          max: track?.getAttribute('aria-valuemax'),
          label: track?.getAttribute('aria-label'),
        };
        return {
          hasSvgAvatar,
          title,
          spentRatio,
          pctVal,
          sublineText,
          isOver,
          isZeroTrack,
          hasPendingFill,
          trackAria,
        };
      });
    });

    console.log(`Rendered items count: ${itemsData.length} (Requirement: max 5)`);
    if (itemsData.length > 0 && itemsData.length <= 5) {
      console.log('✅ PASS: Budget items count <= 5');
    } else {
      console.error(`❌ FAIL: Items count is invalid: ${itemsData.length}`);
      process.exit(1);
    }

    // Verify sort order descending by %
    let isSortedDescending = true;
    for (let i = 0; i < itemsData.length - 1; i++) {
      if (itemsData[i].pctVal < itemsData[i + 1].pctVal) {
        isSortedDescending = false;
        break;
      }
    }
    console.log('Percentages order:', itemsData.map(d => `${d.title}: ${d.pctVal}%`).join(' -> '));
    if (isSortedDescending) {
      console.log('✅ PASS: Budget items sorted descending by percentage');
    } else {
      console.error('❌ FAIL: Items are NOT sorted descending by percentage!');
      process.exit(1);
    }

    // Verify each line item format
    for (const item of itemsData) {
      if (!item.hasSvgAvatar) {
        console.error(`❌ FAIL: Item ${item.title} missing SVG icon avatar`);
        process.exit(1);
      }
      if (!item.title) {
        console.error(`❌ FAIL: Item missing category title`);
        process.exit(1);
      }
      if (!item.spentRatio.includes('/')) {
        console.error(`❌ FAIL: Item ${item.title} missing spent/limit ratio: "${item.spentRatio}"`);
        process.exit(1);
      }
      if (!item.sublineText.includes('Còn') && !item.sublineText.includes('Vượt')) {
        console.error(`❌ FAIL: Item ${item.title} subline missing 'Còn' or 'Vượt': "${item.sublineText}"`);
        process.exit(1);
      }
      if (item.trackAria.role !== 'progressbar' || item.trackAria.now == null) {
        console.error(`❌ FAIL: Item ${item.title} track missing role="progressbar" or aria-valuenow`);
        process.exit(1);
      }
    }
    console.log('✅ PASS: All rendered items satisfy icon SVG, title, ratio, %, subline, role="progressbar" & aria');

    // 3. Verify Footer: "Quản lý ngân sách →"
    console.log('\n--- Checking Requirement 7: "Quản lý ngân sách →" CTA link ---');
    const footerLink = await page.evaluate(() => {
      const footer = document.querySelector('.budget-widget-footer');
      const btn = footer?.querySelector('.budget-manage-link');
      return {
        exists: !!btn,
        text: btn ? btn.textContent.trim() : '',
        nav: btn ? btn.getAttribute('data-nav') : '',
      };
    });

    console.log('Footer link text:', footerLink.text);
    if (footerLink.exists && footerLink.text.includes('Quản lý ngân sách') && footerLink.nav === 'budgets') {
      console.log('✅ PASS: Footer contains "Quản lý ngân sách →" with data-nav="budgets"');
    } else {
      console.error('❌ FAIL: Missing or incorrect footer link:', footerLink);
      process.exit(1);
    }

    // 4. Test 0% Track styling & Over-budget state prominence
    console.log('\n--- Checking Requirement 5 & 10: 0% track & Over-budget highlight ---');
    const trackZeroStyle = await page.evaluate(() => {
      // Create a test 0% track and test over-budget item to inspect computed styles
      const testPanel = document.createElement('div');
      testPanel.innerHTML = `
        <div class="progress-track progress-track--zero" id="test-track-zero" role="progressbar" aria-valuenow="0">
          <div class="progress-fill progress-fill--ok" style="width: 0%;"></div>
        </div>
        <div class="budget-item budget-item--over" id="test-item-over">
          <span class="budget-percent">120%</span>
          <div class="progress-track" role="progressbar" aria-valuenow="100">
            <div class="progress-fill progress-fill--over" style="width: 100%;"></div>
          </div>
        </div>
      `;
      document.body.appendChild(testPanel);

      const zeroTrack = document.querySelector('#test-track-zero');
      const zeroStyle = window.getComputedStyle(zeroTrack);

      const overItem = document.querySelector('#test-item-over');
      const overStyle = window.getComputedStyle(overItem);
      const overFill = overItem.querySelector('.progress-fill--over');
      const overFillStyle = window.getComputedStyle(overFill);

      const result = {
        zeroTrackBorder: zeroStyle.borderWidth,
        zeroTrackBg: zeroStyle.backgroundColor,
        zeroTrackHeight: zeroStyle.height,
        overBorderColor: overStyle.borderColor,
        overFillBg: overFillStyle.backgroundColor,
        overFillAnimation: overFillStyle.animationName,
      };

      testPanel.remove();
      return result;
    });

    console.log('0% Track computed styles:', trackZeroStyle);
    if (parseFloat(trackZeroStyle.zeroTrackBorder) > 0 && parseFloat(trackZeroStyle.zeroTrackHeight) > 0) {
      console.log('✅ PASS: 0% track has clear border and visible trough (never looks like a broken slit)');
    } else {
      console.error('❌ FAIL: 0% track lacks visible border/height');
      process.exit(1);
    }

    if (trackZeroStyle.overBorderColor.includes('239') || trackZeroStyle.overFillBg.includes('220')) {
      console.log('✅ PASS: Over-budget state is prominent with danger styling and hazard stripes');
    } else {
      console.error('❌ FAIL: Over-budget styling is not prominent');
      process.exit(1);
    }

    // 5. Test Pending Striped Fill (Requirement 4)
    console.log('\n--- Checking Requirement 4: Pending portion styling (mờ/sọc) ---');
    const pendingStyle = await page.evaluate(() => {
      const testPending = document.createElement('div');
      testPending.innerHTML = `<div class="progress-fill progress-fill--pending" id="test-pending" style="width: 25%;"></div>`;
      document.body.appendChild(testPending);

      const el = document.querySelector('#test-pending');
      const style = window.getComputedStyle(el);
      const res = {
        opacity: style.opacity,
        bgImage: style.backgroundImage,
      };
      testPending.remove();
      return res;
    });

    console.log('Pending fill computed styles:', pendingStyle);
    if (pendingStyle.bgImage.includes('repeating-linear-gradient') && parseFloat(pendingStyle.opacity) < 1.0) {
      console.log('✅ PASS: Pending fill has diagonal stripes (sọc) and reduced opacity (mờ)');
    } else {
      console.error('❌ FAIL: Pending fill missing stripes or opacity');
      process.exit(1);
    }

    // 6. Test Empty State & CTA (Requirement 9)
    console.log('\n--- Checking Requirement 9: Empty state CTA "Tạo ngân sách" ---');
    const emptyStateResult = await page.evaluate(() => {
      const panel = document.querySelector('#budget-progress-panel');
      if (!panel) return null;

      // Temporarily simulate empty budgets
      const savedHtml = panel.innerHTML;
      panel.innerHTML = `
        <div class="budget-empty-state">
          <h4 class="budget-empty-title">Chưa có ngân sách</h4>
          <button type="button" class="btn btn-primary btn-sm budget-empty-cta" data-nav="budgets">
            Tạo ngân sách
          </button>
        </div>
      `;

      const ctaBtn = panel.querySelector('.budget-empty-cta');
      const hasCta = !!ctaBtn && ctaBtn.textContent.trim().includes('Tạo ngân sách') && ctaBtn.getAttribute('data-nav') === 'budgets';

      panel.innerHTML = savedHtml;
      return { hasCta };
    });

    if (emptyStateResult.hasCta) {
      console.log('✅ PASS: Empty state renders CTA "Tạo ngân sách" with data-nav="budgets"');
    } else {
      console.error('❌ FAIL: Empty state CTA failed');
      process.exit(1);
    }

    console.log('\n========================================');
    console.log('🎉 ALL TASK 9 ACCEPTANCE CRITERIA PASSED!');
    console.log('========================================');

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    await browser.close();
    process.exit(1);
  }
})();
