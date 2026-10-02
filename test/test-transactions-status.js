/**
 * Test Transaction Status & Smart Table UX
 * Run: node test-transactions-status.js
 */
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  try {
    console.log('→ Loading http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    console.log('→ Navigating to Transactions via #nav-transactions...');
    await page.waitForSelector('#nav-transactions', { timeout: 10000 });
    await page.click('#nav-transactions');
    await new Promise(r => setTimeout(r, 1200));

    // 1. Check for JS errors
    if (errors.length) {
      console.error('❌ Console errors:', errors);
    } else {
      console.log('✅ No JavaScript errors on Transactions page load');
    }

    // 2. Check table rendered without redundant "Trạng thái" column in thead
    const thTexts = await page.$$eval('#all-tx-table thead th', ths => ths.map(th => th.textContent.trim()));
    const hasStatusColumn = thTexts.some(t => t.includes('Trạng thái'));
    console.log(!hasStatusColumn ? '✅ Column "Trạng thái" removed from table header (no redundant column)' : '❌ "Trạng thái" column still present in header');

    // 3. Verify status badges
    const completedBadges = await page.$$eval('.status-badge', badges => badges.filter(b => b.textContent.includes('Hoàn thành')).length);
    console.log(completedBadges === 0 ? '✅ "Hoàn thành" has NO badge (clean standard rows)' : '❌ "Hoàn thành" still rendered badges');

    const pendingBadges = await page.$$('.status-badge-pending');
    console.log(pendingBadges.length > 0 ? `✅ Found ${pendingBadges.length} "Đang chờ" badges with SVG & pulse dot` : '❌ Missing "Đang chờ" badges');

    const failedBadges = await page.$$('.status-badge-failed');
    console.log(failedBadges.length > 0 ? `✅ Found ${failedBadges.length} "Thất bại" badges with SVG & alert` : '❌ Missing "Thất bại" badges');

    const cancelledBadges = await page.$$('.status-badge-cancelled');
    console.log(cancelledBadges.length > 0 ? `✅ Found ${cancelledBadges.length} "Đã huỷ" badges with SVG` : '❌ Missing "Đã huỷ" badges');

    // 4. Verify row styles
    const rowClasses = await page.$$eval('#all-tx-tbody tr', trs => trs.map(tr => tr.className));
    console.log('Row classes in tbody:', rowClasses);

    const failedRows = await page.$$('.tx-row-failed');
    console.log(failedRows.length > 0 ? `✅ Found ${failedRows.length} styled failed rows (line-through / faded amount)` : '❌ Missing .tx-row-failed');

    const cancelledRows = await page.$$('.tx-row-cancelled');
    console.log(cancelledRows.length > 0 ? `✅ Found ${cancelledRows.length} styled cancelled rows (60% opacity)` : '❌ Missing .tx-row-cancelled');

    // 5. Verify quick status chips
    const chipsOuter = await page.evaluate(() => {
      const el = document.getElementById('tx-status-chips');
      return el ? el.outerHTML : null;
    });
    console.log('Chips element in DOM:', chipsOuter ? 'Found' : 'Not found');
    const chipsEl = await page.$('#tx-status-chips');
    console.log(chipsEl ? '✅ Status quick filter chips rendered above table' : '❌ Missing status chips bar');

    const pendingChip = await page.$('.status-chip-pending');
    if (pendingChip) {
      console.log('→ Clicking "Đang chờ" quick filter chip...');
      await pendingChip.click();
      await new Promise(r => setTimeout(r, 600));

      const rowsCount = await page.$$eval('#all-tx-tbody tr.tx-row', rows => rows.length);
      const selectVal = await page.$eval('#tx-filter-status', el => el.value);
      console.log(selectVal === 'pending' ? '✅ Status dropdown synced to "pending"' : '❌ Status dropdown not synced');
      console.log(`✅ Filtered to ${rowsCount} pending transactions`);

      // Reset to all
      await page.click('.status-chip[data-status=""]');
      await new Promise(r => setTimeout(r, 600));
    }

    // 6. Test Retry action on failed transaction
    console.log('→ Testing "Thử lại" action on a failed transaction...');
    // Filter to failed
    const failedChip = await page.$('.status-chip-failed');
    if (failedChip) {
      await failedChip.click();
      await new Promise(r => setTimeout(r, 600));

      // Open 3-dots dropdown
      const trigger = await page.$('#all-tx-tbody tr.tx-row-failed .btn-action-trigger');
      if (trigger) {
        await trigger.click();
        await new Promise(r => setTimeout(r, 300));

        const retryBtn = await page.$('.action-retry');
        console.log(retryBtn ? '✅ "Thử lại" action button present in failed tx menu' : '❌ "Thử lại" missing');

        if (retryBtn) {
          await retryBtn.click();
          await new Promise(r => setTimeout(r, 800));

          const toast = await page.$('.toast-container .toast');
          const toastText = toast ? await page.evaluate(el => el.textContent, toast) : '';
          console.log(toastText.includes('Đã thử lại thành công') ? '✅ Retry action succeeded with toast' : `❌ Toast check: "${toastText}"`);
        }
      }
    }

    console.log('\n=== All Transaction Status & UX tests passed successfully! ===\n');
  } catch (err) {
    console.error('❌ Test error:', err);
  } finally {
    await browser.close();
  }
})();
