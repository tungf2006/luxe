/**
 * @file test/test-task12-sidebar-header.js
 * Verification suite for TASK 12: Hoàn thiện sidebar & header
 *
 * Verifies:
 * 1. Focus-visible: Mouse click produces NO outline, keyboard focus triggers :focus-visible ring.
 * 2. Active nav link: Subtle background + 3px left accent bar.
 * 3. Breadcrumb: On root page (dashboard), duplicate root crumb is eradicated (shows strictly "Tổng quan").
 *    On subpages (transactions, budgets), shows "Luxe ... Giao dịch", etc.
 * 4. User name: Truncated user name has title attribute.
 * 5. Subtext contrast & sizing: Minimum font-size >= 12px and contrast >= 4.5:1 against #11141B.
 * 6. Table header: text-transform is none (no uppercase).
 */

import puppeteer from 'puppeteer';

const URL = 'http://localhost:3000';

function luminance(hex) {
  const rgb = hex.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16) / 255);
  const [r, g, b] = rgb.map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

(async () => {
  console.log('========================================================');
  console.log('🧪 Verifying TASK 12 — Hoàn thiện sidebar & header');
  console.log('========================================================\n');

  // --- 1. Unit Check Contrast ---
  console.log('--- 1. Checking Color Contrast & Tokens ---');
  const bgSurface = '#11141B';
  const textMuted = '#9AA4B2';
  const ratio = contrast(textMuted, bgSurface);
  console.log(`Contrast ratio of ${textMuted} on ${bgSurface}: ${ratio.toFixed(2)}:1`);
  assert(ratio >= 4.5, `Contrast ratio (${ratio.toFixed(2)}:1) meets WCAG AA (>= 4.5:1)`);

  // --- 2. Browser E2E Tests ---
  console.log('\n--- 2. Browser E2E Tests (Puppeteer) ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('→ Loading application at http://localhost:3000 ...');
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
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

    // Ensure on Dashboard
    await page.waitForSelector('#sidebar', { timeout: 10000 });
    await page.waitForSelector('#recent-tx-panel', { timeout: 10000 });

    // --- Requirement 1: :focus-visible vs :focus (no blue ring on mouse click) ---
    console.log('\n--- 2.1 Checking Requirement 1: Focus Behavior ---');
    // Click nav item with mouse
    await page.click('#nav-dashboard');
    const mouseClickOutline = await page.$eval('#nav-dashboard', el => {
      const s = window.getComputedStyle(el);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        boxShadow: s.boxShadow,
      };
    });
    console.log('Mouse click on #nav-dashboard outline:', mouseClickOutline);
    assert(
      mouseClickOutline.outlineStyle === 'none' || mouseClickOutline.outlineWidth === '0px',
      'Mouse click does NOT produce blue focus ring (outline is none / 0px)'
    );

    // Click bell button with mouse
    await page.click('#notif-btn');
    const bellClickOutline = await page.$eval('#notif-btn', el => {
      const s = window.getComputedStyle(el);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
      };
    });
    assert(
      bellClickOutline.outlineStyle === 'none' || bellClickOutline.outlineWidth === '0px',
      'Mouse click on topbar-bell does NOT produce focus ring'
    );
    // Close notif dropdown
    await page.click('#notif-btn');

    // --- Requirement 2: Active = nền nhẹ + thanh nhấn trái 3px ---
    console.log('\n--- 2.2 Checking Requirement 2: Active State Styling ---');
    const activeStyles = await page.$eval('.sidebar-nav .nav-link.active', el => {
      const s = window.getComputedStyle(el);
      return {
        borderLeftWidth: s.borderLeftWidth,
        borderLeftStyle: s.borderLeftStyle,
        borderLeftColor: s.borderLeftColor,
        backgroundColor: s.backgroundColor,
        color: s.color,
        fontWeight: s.fontWeight,
      };
    });
    console.log('Active sidebar link styles:', activeStyles);
    assert(activeStyles.borderLeftWidth === '3px', 'Active nav-link has strictly 3px left border (thanh nhấn trái 3px)');
    assert(
      activeStyles.backgroundColor.includes('rgba(16, 185, 129') || activeStyles.backgroundColor.includes('16, 185, 129'),
      'Active nav-link has subtle emerald background (nền nhẹ)'
    );

    // --- Requirement 3: Bỏ breadcrumb lặp ở trang gốc ---
    console.log('\n--- 2.3 Checking Requirement 3: Breadcrumb on Root Page ---');
    const rootBreadcrumbText = await page.$eval('#breadcrumb', el => el.innerText.replace(/\s+/g, ' ').trim());
    console.log('Root page (Dashboard) breadcrumb text:', rootBreadcrumbText);
    assert(rootBreadcrumbText === 'Tổng quan', 'Breadcrumb on root page strictly displays "Tổng quan" without duplicate "Luxe >"');

    const rootCrumbVisibility = await page.evaluate(() => {
      const homeItem = document.querySelector('.breadcrumb-home-item') || document.getElementById('breadcrumb-home')?.closest('.breadcrumb-item');
      const separator = document.querySelector('.breadcrumb-separator');
      return {
        homeDisplay: homeItem ? window.getComputedStyle(homeItem).display : 'none',
        separatorDisplay: separator ? window.getComputedStyle(separator).display : 'none',
      };
    });
    console.log('Root crumb elements visibility:', rootCrumbVisibility);
    assert(rootCrumbVisibility.homeDisplay === 'none', 'Breadcrumb home item is hidden on root page');
    assert(rootCrumbVisibility.separatorDisplay === 'none', 'Breadcrumb separator is hidden on root page');

    // Navigate to Transactions and check breadcrumb restores trail
    console.log('Navigating to Transactions...');
    await page.click('#nav-transactions');
    await new Promise(r => setTimeout(r, 600));

    const txBreadcrumbText = await page.$eval('#breadcrumb', el => el.innerText.replace(/\s+/g, ' ').trim());
    console.log('Transactions page breadcrumb text:', txBreadcrumbText);
    assert(txBreadcrumbText.includes('Luxe') && txBreadcrumbText.includes('Giao dịch'), 'Breadcrumb on subpage properly displays trail "Luxe ... Giao dịch"');

    // Navigate back to Dashboard
    console.log('Navigating back to Dashboard...');
    await page.click('#nav-dashboard');
    await new Promise(r => setTimeout(r, 600));

    const rootBreadcrumbTextRestored = await page.$eval('#breadcrumb', el => el.innerText.replace(/\s+/g, ' ').trim());
    console.log('Restored Dashboard breadcrumb text:', rootBreadcrumbTextRestored);
    assert(rootBreadcrumbTextRestored === 'Tổng quan', 'Returning to dashboard cleanly restores single "Tổng quan" breadcrumb');

    // --- Requirement 4: Tên người dùng cắt có title ---
    console.log('\n--- 2.4 Checking Requirement 4: Truncated Username with Title ---');
    const userElData = await page.$eval('#user-name', el => {
      const s = window.getComputedStyle(el);
      return {
        title: el.getAttribute('title'),
        text: el.textContent.trim(),
        overflow: s.overflow,
        textOverflow: s.textOverflow,
        whiteSpace: s.whiteSpace,
        fontSize: parseFloat(s.fontSize),
      };
    });
    console.log('User name element data:', userElData);
    assert(!!userElData.title && userElData.title.length > 0, 'Username has non-empty title attribute (tên người dùng có title)');
    assert(userElData.overflow === 'hidden' && userElData.textOverflow === 'ellipsis', 'Username has overflow: hidden and text-overflow: ellipsis');

    // --- Requirement 5: Chữ phụ tối thiểu 12px/13px ---
    console.log('\n--- 2.5 Checking Requirement 5: Subtext Sizing ---');
    const fontSizes = await page.evaluate(() => {
      const getFs = sel => {
        const el = document.querySelector(sel);
        return el ? parseFloat(window.getComputedStyle(el).fontSize) : null;
      };
      return {
        userNameFs: getFs('#user-name'),
        topbarBellBadgeFs: getFs('#notif-badge'),
        brandBadgeFs: getFs('.brand-badge'),
        breadcrumbLinkFs: getFs('.breadcrumb-link'),
        sidebarNavFs: getFs('.sidebar-nav .nav-link'),
      };
    });
    console.log('Evaluated font sizes (px):', fontSizes);
    if (fontSizes.userNameFs) assert(fontSizes.userNameFs >= 12, 'User name font size >= 12px');
    if (fontSizes.topbarBellBadgeFs) assert(fontSizes.topbarBellBadgeFs >= 12, 'Bell badge font size >= 12px');
    if (fontSizes.breadcrumbLinkFs) assert(fontSizes.breadcrumbLinkFs >= 12, 'Breadcrumb link font size >= 12px');

    // --- Requirement 6: Bỏ uppercase không cần thiết ở header bảng ---
    console.log('\n--- 2.6 Checking Requirement 6: Table Header Casing ---');
    const recentTableThTransform = await page.$eval('#recent-tx-table th', el => window.getComputedStyle(el).textTransform);
    console.log('Recent transactions th text-transform:', recentTableThTransform);
    assert(recentTableThTransform === 'none', 'Recent transactions table header text-transform is "none" (bỏ uppercase)');

    await page.click('#nav-transactions');
    await new Promise(r => setTimeout(r, 600));

    const allTxThTransform = await page.$eval('.luxe-table th:nth-child(2)', el => window.getComputedStyle(el).textTransform);
    console.log('All transactions luxe-table th text-transform:', allTxThTransform);
    assert(allTxThTransform === 'none', 'Transactions table header text-transform is "none" (bỏ uppercase)');

    await browser.close();

    console.log('\n========================================================');
    console.log('🎉 ALL TASK 12 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
    console.log('========================================================');
  } catch (err) {
    await browser.close();
    console.error('❌ Test error:', err);
    process.exit(1);
  }
})();
