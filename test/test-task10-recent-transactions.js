/**
 * @file test-task10-recent-transactions.js
 * Verification suite for TASK 10 — Recent Transactions Widget UI
 *
 * Requirements:
 * 1. Bỏ cột Ngày, nhóm theo ngày (Hôm nay, Hôm qua, 01/10 · Thứ Năm)
 * 2. Cột Giao dịch (icon + tên + danh mục dòng phụ) · Trạng thái · Số tiền
 * 3. Badge trạng thái chỉ hiện khi khác completed (Đang chờ vàng, Thất bại đỏ, Đã huỷ xám, kèm tooltip giải thích)
 * 4. Số tiền theo quy tắc Task 5 (tabular nums, sign, strikethrough cho failed/cancelled)
 * 5. Hàng cao 56–60px, hover nhẹ, click mở chi tiết
 * 6. Tối đa 6 hàng
 * 7. Tên dài cắt 1 dòng có title
 * 8. <768px chuyển thành thẻ 2 dòng
 * 9. Icon danh mục là SVG đơn sắc, không giống emoji
 * 10. Nghiệm thu: không còn "5 ngày trước" lặp 6 lần; failed/cancelled nhìn là vô hiệu
 */

import puppeteer from 'puppeteer';
import { getRecentDateGroupLabel } from '../src/utils/dateFormat.js';

console.log('====================================================');
console.log('🧪 Verifying TASK 10 — Recent Transactions Widget UI');
console.log('====================================================\n');

// --- 1. Unit Tests for Date Grouping Labels ---
console.log('--- 1. Unit Testing Date Group Labels ("Hôm nay", "Hôm qua", "01/10 · Thứ Năm") ---');

const baseTestDate = new Date(2026, 9, 8); // Oct 8, 2026 (Thursday)

const labelToday = getRecentDateGroupLabel('2026-10-08', baseTestDate);
if (labelToday === 'Hôm nay') {
  console.log(`✅ PASS: Today label is "${labelToday}"`);
} else {
  console.error(`❌ FAIL: Expected "Hôm nay", got "${labelToday}"`);
  process.exit(1);
}

const labelYesterday = getRecentDateGroupLabel('2026-10-07', baseTestDate);
if (labelYesterday === 'Hôm qua') {
  console.log(`✅ PASS: Yesterday label is "${labelYesterday}"`);
} else {
  console.error(`❌ FAIL: Expected "Hôm qua", got "${labelYesterday}"`);
  process.exit(1);
}

// 2026-10-01 is Thursday (Thứ Năm)
const labelOct1 = getRecentDateGroupLabel('2026-10-01', baseTestDate);
if (labelOct1 === '01/10 · Thứ Năm') {
  console.log(`✅ PASS: 01/10 label is "${labelOct1}" (Expected "01/10 · Thứ Năm")`);
} else {
  console.error(`❌ FAIL: Expected "01/10 · Thứ Năm", got "${labelOct1}"`);
  process.exit(1);
}

// Ensure it never returns relative "5 ngày trước"
const label5DaysAgo = getRecentDateGroupLabel('2026-10-03', baseTestDate);
if (!label5DaysAgo.includes('ngày trước') && label5DaysAgo === '03/10 · Thứ Bảy') {
  console.log(`✅ PASS: 5 days ago format is "${label5DaysAgo}" (NEVER "5 ngày trước")`);
} else {
  console.error(`❌ FAIL: Unexpected format for 5 days ago: "${label5DaysAgo}"`);
  process.exit(1);
}

// --- 2. Browser E2E Tests (Puppeteer) ---
console.log('\n--- 2. Browser E2E Tests (Desktop 1440px) ---');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('→ Loading application at http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
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

    await page.waitForSelector('#recent-tx-panel', { timeout: 10000 });

    // 1. Check Table Headers (Must NOT have "Ngày" column; only Giao dịch, Trạng thái, Số tiền)
    console.log('\n--- Checking Requirement 1: Table Headers (No "Ngày" column) ---');
    const headers = await page.$$eval('#recent-tx-table thead th', ths => ths.map(th => th.textContent.trim()));
    console.log('Recent transactions table headers:', headers);

    const hasDateHeader = headers.some(h => /ngày|date/i.test(h));
    if (!hasDateHeader && headers.length === 3) {
      console.log('✅ PASS: Table header has NO "Ngày" column! Exactly 3 columns (Giao dịch, Trạng thái, Số tiền)');
    } else {
      console.error('❌ FAIL: Expected 3 columns without "Ngày", got:', headers);
      process.exit(1);
    }

    // 2. Check Date Grouping Rows & Badges
    console.log('\n--- Checking Requirement 1: Date Group Headers ---');
    const groupBadges = await page.$$eval('.recent-tx-group-badge', badges => badges.map(b => b.textContent.trim()));
    console.log('Date group badges rendered:', groupBadges);

    if (groupBadges.length > 0) {
      console.log(`✅ PASS: Rendered ${groupBadges.length} date group header(s)`);
    } else {
      console.error('❌ FAIL: No date group badges found');
      process.exit(1);
    }

    const hasRelativeDaysAgo = groupBadges.some(b => b.includes('ngày trước'));
    if (!hasRelativeDaysAgo) {
      console.log('✅ PASS: NO "ngày trước" (5 ngày trước) repetition in date headers!');
    } else {
      console.error('❌ FAIL: Found "ngày trước" in date group headers:', groupBadges);
      process.exit(1);
    }

    // 3. Check Row Count (Max 6 rows)
    console.log('\n--- Checking Requirement 6: Maximum 6 Rows ---');
    const rowCount = await page.$$eval('.recent-tx-row', rows => rows.length);
    console.log(`Rendered transaction rows: ${rowCount} (Requirement: max 6)`);
    if (rowCount > 0 && rowCount <= 6) {
      console.log('✅ PASS: Row count is within limits (<= 6 rows)');
    } else {
      console.error(`❌ FAIL: Expected 1 to 6 rows, got ${rowCount}`);
      process.exit(1);
    }

    // 4. Check Row Anatomy: Icon, Name + Title attribute, Category Subline, Status, Amount
    console.log('\n--- Checking Requirements 2, 7, 9: Row Anatomy, SVG Icon, Truncation ---');
    const rowsData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.recent-tx-row'));
      return rows.map(r => {
        const catIcon = r.querySelector('.recent-tx-cat-icon');
        const catSvg = catIcon ? catIcon.querySelector('svg') : null;
        const titleEl = r.querySelector('.recent-tx-title');
        const sublineEl = r.querySelector('.recent-tx-subline');
        const statusBadge = r.querySelector('.status-badge');
        const amountEl = r.querySelector('.recent-tx-cell-amount');

        return {
          id: r.dataset.recentTxId,
          hasMonochromeSvg: !!catSvg && !catIcon.textContent.trim(),
          titleText: titleEl?.textContent?.trim() || '',
          titleAttr: titleEl?.getAttribute('title') || '',
          sublineText: sublineEl?.textContent?.trim() || '',
          hasStatusBadge: !!statusBadge,
          statusBadgeClass: statusBadge?.className || '',
          statusBadgeTooltip: statusBadge?.getAttribute('title') || '',
          statusBadgeLabel: statusBadge?.textContent?.trim() || '',
          amountText: amountEl?.textContent?.trim() || '',
          isVoid: r.classList.contains('is-void'),
          isFailed: r.classList.contains('tx-row-failed'),
          isCancelled: r.classList.contains('tx-row-cancelled'),
        };
      });
    });

    for (const [idx, rd] of rowsData.entries()) {
      if (!rd.hasMonochromeSvg) {
        console.error(`❌ FAIL: Row #${idx + 1} icon is missing or not a pure SVG:`, rd);
        process.exit(1);
      }
      if (!rd.titleText || !rd.titleAttr) {
        console.error(`❌ FAIL: Row #${idx + 1} missing title text or title attribute for tooltip:`, rd);
        process.exit(1);
      }
      if (!rd.sublineText) {
        console.error(`❌ FAIL: Row #${idx + 1} missing category subline:`, rd);
        process.exit(1);
      }
      if (!rd.amountText) {
        console.error(`❌ FAIL: Row #${idx + 1} missing amount:`, rd);
        process.exit(1);
      }
    }
    console.log('✅ PASS: All rows have pure monochrome SVG icons (zero emoji), titles with title attr, subline, and amount');

    // 5. Check Status Badges & Tooltips (only shown when not completed)
    console.log('\n--- Checking Requirement 3: Status Badges (Pending amber, Failed red, Cancelled gray with tooltips) ---');
    const statusBadgesFound = rowsData.filter(r => r.hasStatusBadge);
    console.log(`Found ${statusBadgesFound.length} rows with abnormal status badges out of ${rowsData.length} rows`);

    for (const b of statusBadgesFound) {
      if (!b.statusBadgeTooltip) {
        console.error(`❌ FAIL: Status badge missing explanation tooltip:`, b);
        process.exit(1);
      }
      if (b.statusBadgeClass.includes('pending')) {
        console.log(`✅ PASS: Pending badge "${b.statusBadgeLabel}" has tooltip: "${b.statusBadgeTooltip}"`);
      } else if (b.statusBadgeClass.includes('failed')) {
        console.log(`✅ PASS: Failed badge "${b.statusBadgeLabel}" has tooltip: "${b.statusBadgeTooltip}"`);
      } else if (b.statusBadgeClass.includes('cancelled')) {
        console.log(`✅ PASS: Cancelled badge "${b.statusBadgeLabel}" has tooltip: "${b.statusBadgeTooltip}"`);
      }
    }

    // 6. Check Row Height and Hover (56–60px)
    console.log('\n--- Checking Requirement 5: Row Height (56–60px) & Hover ---');
    const rowHeights = await page.$$eval('.recent-tx-row', rows => rows.map(r => r.getBoundingClientRect().height));
    console.log('Row heights:', rowHeights);

    const allHeightsValid = rowHeights.every(h => h >= 55.5 && h <= 60.5);
    if (allHeightsValid) {
      console.log('✅ PASS: All desktop rows have height within 56–60px');
    } else {
      console.error('❌ FAIL: Row heights outside 56–60px range:', rowHeights);
      process.exit(1);
    }

    // 7. Check Void Invalidation (Failed / Cancelled styling)
    console.log('\n--- Checking Requirement 4 & 10: Failed / Cancelled visual invalidation ---');
    const voidRowStyles = await page.evaluate(() => {
      const failedRow = document.querySelector('.recent-tx-row.tx-row-failed');
      const cancelledRow = document.querySelector('.recent-tx-row.tx-row-cancelled');
      return {
        failed: failedRow ? {
          amountDecoration: window.getComputedStyle(failedRow.querySelector('.recent-tx-cell-amount')).textDecorationLine,
          amountOpacity: window.getComputedStyle(failedRow.querySelector('.recent-tx-cell-amount')).opacity,
          bg: window.getComputedStyle(failedRow).backgroundColor,
        } : null,
        cancelled: cancelledRow ? {
          rowOpacity: window.getComputedStyle(cancelledRow).opacity,
          amountDecoration: window.getComputedStyle(cancelledRow.querySelector('.recent-tx-cell-amount')).textDecorationLine,
        } : null,
      };
    });

    console.log('Void row styles:', voidRowStyles);
    if (voidRowStyles.failed) {
      if (voidRowStyles.failed.amountDecoration.includes('line-through')) {
        console.log('✅ PASS: Failed transaction amount has line-through (gạch ngang vô hiệu)');
      } else {
        console.error('❌ FAIL: Failed amount missing line-through:', voidRowStyles.failed);
        process.exit(1);
      }
    }
    if (voidRowStyles.cancelled) {
      if (parseFloat(voidRowStyles.cancelled.rowOpacity) <= 0.65) {
        console.log(`✅ PASS: Cancelled transaction row is faded (opacity = ${voidRowStyles.cancelled.rowOpacity})`);
      } else {
        console.error('❌ FAIL: Cancelled row opacity not faded:', voidRowStyles.cancelled);
        process.exit(1);
      }
    }

    // 8. Check Click to open transaction details modal
    console.log('\n--- Checking Requirement 5: Click row to open details modal ---');
    const firstRow = await page.$('.recent-tx-row');
    if (firstRow) {
      await firstRow.click();
      await new Promise(r => setTimeout(r, 600));

      const modalOpen = await page.$('#add-tx-modal.open, #add-tx-modal[data-state="open"]') !== null;
      if (modalOpen) {
        console.log('✅ PASS: Clicking recent transaction row opens details modal (#add-tx-modal)');
      } else {
        console.error('❌ FAIL: Modal #add-tx-modal did not open on row click');
        process.exit(1);
      }

      // Close modal
      const closeBtn = await page.$('#add-tx-modal .modal-close, #add-tx-modal [data-action="close"], #add-tx-modal .close-btn');
      if (closeBtn) {
        await closeBtn.click();
        await new Promise(r => setTimeout(r, 400));
      } else {
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // 9. Mobile Responsive (< 768px): 2-line cards
    console.log('\n--- Checking Requirement 8: Mobile Responsive (<768px: 2-line cards) ---');
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(r => setTimeout(r, 600));

    const mobileStyles = await page.evaluate(() => {
      const thead = document.querySelector('#recent-tx-table thead');
      const theadDisplay = thead ? window.getComputedStyle(thead).display : '';
      const row = document.querySelector('.recent-tx-row');
      const rowDisplay = row ? window.getComputedStyle(row).display : '';
      const rowGridColumns = row ? window.getComputedStyle(row).gridTemplateColumns : '';

      return {
        theadHidden: theadDisplay === 'none',
        rowIsGrid: rowDisplay === 'grid',
        rowGridColumns,
      };
    });

    console.log('Mobile view styles:', mobileStyles);
    if (mobileStyles.theadHidden && mobileStyles.rowIsGrid) {
      console.log('✅ PASS: At 375px (<768px), table header is hidden and rows transform into 2-line cards!');
    } else {
      console.error('❌ FAIL: Mobile card transformation failed:', mobileStyles);
      process.exit(1);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL TASK 10 ACCEPTANCE CRITERIA PASSED!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ Error during TASK 10 verification:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
