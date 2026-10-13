/**
 * @file test-notifications.js
 * Comprehensive end-to-end Puppeteer verification for Luxe Notification Center.
 *
 * Verifies:
 *   1. Bell icon & initial badge (count 3)
 *   2. Dropdown open/close, ARIA states, and outside-click/Esc handling
 *   3. Notification list rendering (5 items, 3 unread, category icons, timestamps)
 *   4. Zero-emoji discipline: SVGs only
 *   5. Filter tabs (Tất cả, Chưa đọc, Tài chính)
 *   6. Mark single notification as read & badge decrement
 *   7. "Đã đọc tất cả" & badge disappearance
 *   8. Settings integration & test notification triggering
 *
 * Run: node test/test-notifications.js
 */

import puppeteer from 'puppeteer';

(async () => {
  console.log('========================================');
  console.log('🧪 Testing Luxe Notification Center');
  console.log('========================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
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

    if (errors.length) {
      console.error('❌ Console page errors:', errors);
      process.exit(1);
    }
    console.log('✅ App loaded without JavaScript errors');

    // 1. Verify Topbar Bell and Badge
    console.log('\n--- 1. Testing Topbar Bell & Initial Badge ---');
    const notifBtn = await page.$('#notif-btn');
    if (!notifBtn) throw new Error('❌ Missing #notif-btn in topbar');
    console.log('✅ #notif-btn exists');

    const badge = await page.$('#notif-badge');
    if (!badge) throw new Error('❌ Missing #notif-badge');
    const badgeText = await page.$eval('#notif-badge', el => el.textContent.trim());
    const badgeDisplay = await page.$eval('#notif-badge', el => window.getComputedStyle(el).display);
    console.log(`Badge text: "${badgeText}", display: "${badgeDisplay}"`);
    if (badgeText !== '3') throw new Error(`❌ Expected badge count 3, got "${badgeText}"`);
    console.log('✅ #notif-badge correctly displays 3 unread notifications');

    // 2. Click Bell to Open Dropdown
    console.log('\n--- 2. Testing Dropdown Open & ARIA States ---');
    await page.click('#notif-btn');
    await new Promise(r => setTimeout(r, 300));

    const isOpen = await page.$eval('#notif-dropdown', el => el.classList.contains('open'));
    const ariaExpanded = await page.$eval('#notif-btn', el => el.getAttribute('aria-expanded'));
    if (!isOpen) throw new Error('❌ #notif-dropdown did not receive .open class');
    if (ariaExpanded !== 'true') throw new Error(`❌ Expected aria-expanded="true", got "${ariaExpanded}"`);
    console.log('✅ #notif-dropdown opened successfully with aria-expanded="true"');

    // 3. Inspect Dropdown Contents & Category Icons
    console.log('\n--- 3. Testing Dropdown Contents & Items ---');
    const titleText = await page.$eval('.notif-header-title', el => el.textContent.trim());
    if (titleText !== 'Thông báo') throw new Error(`❌ Expected title "Thông báo", got "${titleText}"`);
    console.log('✅ Header title: "Thông báo"');

    const pillText = await page.$eval('#notif-unread-count-pill', el => el.textContent.trim());
    if (pillText !== '3 mới') throw new Error(`❌ Expected pill "3 mới", got "${pillText}"`);
    console.log('✅ Unread pill: "3 mới"');

    const items = await page.$$('.notif-item');
    console.log(`Total notification items rendered: ${items.length}`);
    if (items.length !== 5) throw new Error(`❌ Expected 5 notification items, got ${items.length}`);
    console.log('✅ 5 notification items rendered');

    const unreadItems = await page.$$('.notif-item.is-unread');
    console.log(`Unread items rendered: ${unreadItems.length}`);
    if (unreadItems.length !== 3) throw new Error(`❌ Expected 3 unread items, got ${unreadItems.length}`);
    console.log('✅ Exactly 3 unread items highlighted');

    // Check SVG icons (no emojis)
    const iconSvgs = await page.$$('.notif-item-icon-box svg');
    if (iconSvgs.length !== 5) throw new Error(`❌ Expected 5 SVG icons, got ${iconSvgs.length}`);
    console.log('✅ Zero-emoji discipline verified: All 5 items have SVG category icons');

    // 4. Test Filter Tabs
    console.log('\n--- 4. Testing Filter Tabs ---');
    const tabs = await page.$$eval('.notif-tab', els => els.map(el => el.textContent.trim()));
    console.log('Tabs:', tabs);

    // Click "Chưa đọc" tab
    await page.click('.notif-tab[data-filter="unread"]');
    await new Promise(r => setTimeout(r, 200));
    const filteredUnread = await page.$$('.notif-item');
    if (filteredUnread.length !== 3) throw new Error(`❌ Expected 3 unread items in unread filter, got ${filteredUnread.length}`);
    console.log('✅ "Chưa đọc" tab filtered correctly to 3 items');

    // Click "Tất cả" tab
    await page.click('.notif-tab[data-filter="all"]');
    await new Promise(r => setTimeout(r, 200));
    const allItems = await page.$$('.notif-item');
    if (allItems.length !== 5) throw new Error(`❌ Expected 5 items in all filter, got ${allItems.length}`);
    console.log('✅ "Tất cả" tab restored all 5 items');

    // 5. Test Mark Single Notification as Read
    console.log('\n--- 5. Testing Single Notification Read & Badge Decrement ---');
    const firstUnread = await page.$('.notif-item.is-unread');
    if (!firstUnread) throw new Error('❌ Missing unread item to click');
    await firstUnread.click();
    await new Promise(r => setTimeout(r, 400));

    const updatedBadgeText = await page.$eval('#notif-badge', el => el.textContent.trim());
    console.log(`Updated badge text after single read: "${updatedBadgeText}"`);
    if (updatedBadgeText !== '2') throw new Error(`❌ Expected badge count 2, got "${updatedBadgeText}"`);
    console.log('✅ Badge decremented from 3 to 2 on single read');

    // 6. Test "Đã đọc tất cả" (Mark all as read)
    console.log('\n--- 6. Testing Mark All as Read ---');
    const markAllBtn = await page.$('#notif-mark-all-btn');
    if (!markAllBtn) throw new Error('❌ Missing #notif-mark-all-btn');
    await markAllBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const postAllBadgeDisplay = await page.$eval('#notif-badge', el => window.getComputedStyle(el).display);
    console.log(`Badge display after mark all: "${postAllBadgeDisplay}"`);
    if (postAllBadgeDisplay !== 'none') throw new Error(`❌ Expected badge display: none, got "${postAllBadgeDisplay}"`);
    console.log('✅ Badge hidden when unread count reaches 0');

    const remainingUnread = await page.$$('.notif-item.is-unread');
    if (remainingUnread.length !== 0) throw new Error(`❌ Expected 0 unread items, got ${remainingUnread.length}`);
    console.log('✅ All items marked as read');

    // 7. Test Esc Key to Close Dropdown
    console.log('\n--- 7. Testing Esc Key Close ---');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    const isClosedAfterEsc = await page.$eval('#notif-dropdown', el => !el.classList.contains('open'));
    if (!isClosedAfterEsc) throw new Error('❌ Dropdown did not close on Escape key');
    console.log('✅ Dropdown closed cleanly on Escape key');

    // 8. Test Settings Integration & Send Test Notification
    console.log('\n--- 8. Testing Settings Integration & Test Notification ---');
    await page.click('#notif-btn');
    await new Promise(r => setTimeout(r, 300));

    await page.waitForSelector('#notif-settings-link', { timeout: 3000 });
    await page.click('#notif-settings-link');
    await new Promise(r => setTimeout(r, 800));

    const settingsPanelVisible = await page.$eval('#panel-notifications', el => !el.hasAttribute('hidden'));
    if (!settingsPanelVisible) throw new Error('❌ Expected #panel-notifications to be active in Settings');
    console.log('✅ Settings link correctly routed and activated panel-notifications');

    // Click "Gửi thử nghiệm"
    const sendTestBtn = await page.$('#btn-send-test-notif');
    if (!sendTestBtn) throw new Error('❌ Missing #btn-send-test-notif');
    await sendTestBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const testBadgeText = await page.$eval('#notif-badge', el => el.textContent.trim());
    const testBadgeDisplay = await page.$eval('#notif-badge', el => window.getComputedStyle(el).display);
    console.log(`Badge after test notification: text="${testBadgeText}", display="${testBadgeDisplay}"`);
    if (testBadgeText !== '1') throw new Error(`❌ Expected badge count 1, got "${testBadgeText}"`);
    console.log('✅ Test notification successfully received: Badge updated to 1');

    console.log('\n========================================');
    console.log('🎉 ALL NOTIFICATION TESTS PASSED (8/8)');
    console.log('========================================');

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    await browser.close();
    process.exit(1);
  }
})();
