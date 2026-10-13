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

  console.log('==============================================');
  console.log('🔍 LUXE SEARCH FUNCTIONALITY AUDIT & VERIFICATION');
  console.log('==============================================');

  try {
    console.log('\n[1] Loading http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    // Handle guest mode if on login screen
    const guestBtn = await page.$('#btn-guest-mode');
    if (guestBtn) {
      console.log('→ Clicking guest mode button...');
      await guestBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('→ Navigating to Transactions via #nav-transactions...');
    await page.waitForSelector('#nav-transactions', { timeout: 10000 });
    await page.click('#nav-transactions');
    await new Promise(r => setTimeout(r, 1000));

    const searchInput = await page.$('#tx-search');
    if (!searchInput) {
      console.error('❌ Element #tx-search not found!');
      process.exit(1);
    }
    console.log('✅ #tx-search element is present in DOM');

    const initialRowCount = await page.$$eval('#all-tx-tbody tr.tx-row', rows => rows.length);
    console.log(`→ Initial transactions on current page: ${initialRowCount} rows`);

    // Helper to run search
    async function executeSearch(query) {
      await page.evaluate(q => {
        const input = document.querySelector('#tx-search');
        input.value = q;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, query);
      await new Promise(r => setTimeout(r, 400)); // wait for 250ms debounce + render
      const rows = await page.$$eval('#all-tx-tbody tr.tx-row', rows => {
        return rows.map(r => {
          const merchant = r.querySelector('td:nth-child(2)')?.textContent?.trim() || '';
          const category = r.querySelector('td:nth-child(3)')?.textContent?.trim() || '';
          const amount = r.querySelector('td.table-amount')?.textContent?.trim() || '';
          return { merchant, category, amount };
        });
      });
      const url = await page.url();
      const emptyVisible = await page.$eval('#tx-empty-state', el => window.getComputedStyle(el).display !== 'none');
      return { rows, url, emptyVisible };
    }

    // TEST 1: Exact merchant brand English
    console.log('\n--- Test 1: Search by English merchant "Grab" ---');
    const resGrab = await executeSearch('Grab');
    console.log(`Results found: ${resGrab.rows.length}`);
    resGrab.rows.forEach(r => console.log(`   - ${r.merchant} | ${r.category} | ${r.amount}`));
    const grabMatches = resGrab.rows.every(r => r.merchant.toLowerCase().includes('grab'));
    console.log(resGrab.rows.length > 0 && grabMatches ? '✅ PASS: Search "Grab" found matching transactions' : '❌ FAIL: Search "Grab" failed');

    // TEST 2: Lowercase merchant "highlands"
    console.log('\n--- Test 2: Search by lowercase merchant "highlands" ---');
    const resHighlands = await executeSearch('highlands');
    console.log(`Results found: ${resHighlands.rows.length}`);
    resHighlands.rows.forEach(r => console.log(`   - ${r.merchant} | ${r.category}`));
    console.log(resHighlands.rows.length > 0 ? '✅ PASS: Search "highlands" found matching transactions' : '❌ FAIL: Search "highlands" failed');

    // TEST 3: Search by Vietnamese category label (e.g. "ăn uống" or "Ăn uống")
    console.log('\n--- Test 3: Search by Vietnamese category label "ăn uống" ---');
    const resFoodVi = await executeSearch('ăn uống');
    console.log(`Results found: ${resFoodVi.rows.length}`);
    resFoodVi.rows.forEach(r => console.log(`   - ${r.merchant} | ${r.category}`));
    if (resFoodVi.rows.length > 0) {
      console.log('✅ PASS: Search "ăn uống" found food category transactions');
    } else {
      console.log('⚠️ ISSUE DETECTED: Search "ăn uống" returned 0 transactions! (Category display label not searchable in transactions)');
    }

    // TEST 4: Search by Vietnamese category label "mua sắm"
    console.log('\n--- Test 4: Search by Vietnamese category label "mua sắm" ---');
    const resShopVi = await executeSearch('mua sắm');
    console.log(`Results found: ${resShopVi.rows.length}`);
    resShopVi.rows.forEach(r => console.log(`   - ${r.merchant} | ${r.category}`));
    if (resShopVi.rows.length > 0) {
      console.log('✅ PASS: Search "mua sắm" found shopping category transactions');
    } else {
      console.log('⚠️ ISSUE DETECTED: Search "mua sắm" returned 0 transactions!');
    }

    // TEST 5: Search without Vietnamese diacritics "ca phe" (should find "Cà phê Highlands")
    console.log('\n--- Test 5: Search without diacritics "ca phe" (for "Cà phê Highlands") ---');
    const resNoAccent = await executeSearch('ca phe');
    console.log(`Results found: ${resNoAccent.rows.length}`);
    resNoAccent.rows.forEach(r => console.log(`   - ${r.merchant}`));
    if (resNoAccent.rows.length > 0) {
      console.log('✅ PASS: Accent-insensitive search works');
    } else {
      console.log('⚠️ ISSUE DETECTED: Accent-insensitive search ("ca phe") returned 0! User cannot search unaccented Vietnamese.');
    }

    // TEST 6: Search without diacritics "sieu thi" (for "Siêu thị Co.opmart")
    console.log('\n--- Test 6: Search without diacritics "sieu thi" ---');
    const resSieuThi = await executeSearch('sieu thi');
    console.log(`Results found: ${resSieuThi.rows.length}`);
    resSieuThi.rows.forEach(r => console.log(`   - ${r.merchant}`));
    if (resSieuThi.rows.length > 0) {
      console.log('✅ PASS: Accent-insensitive search "sieu thi" works');
    } else {
      console.log('⚠️ ISSUE DETECTED: "sieu thi" returned 0 transactions!');
    }

    // TEST 7: Search by Category ID slug 'food'
    console.log('\n--- Test 7: Search by category slug "food" ---');
    const resFoodSlug = await executeSearch('food');
    console.log(`Results found: ${resFoodSlug.rows.length}`);
    console.log(resFoodSlug.rows.length > 0 ? '✅ PASS: Search "food" slug works' : '❌ FAIL: Search "food" slug failed');

    // TEST 8: Non-existent term → Empty state
    console.log('\n--- Test 8: Non-existent search term "xyz999abc" ---');
    const resEmpty = await executeSearch('xyz999abc');
    console.log(`Results found: ${resEmpty.rows.length}, Empty state visible: ${resEmpty.emptyVisible}`);
    console.log(resEmpty.rows.length === 0 && resEmpty.emptyVisible ? '✅ PASS: Correct empty state displayed' : '❌ FAIL: Empty state not shown properly');

    // TEST 9: Clear search → full list restored
    console.log('\n--- Test 9: Clearing search input ---');
    const resClear = await executeSearch('');
    console.log(`Restored rows: ${resClear.rows.length}`);
    console.log(resClear.rows.length === initialRowCount ? '✅ PASS: Full list restored after clearing search' : '❌ FAIL: List not restored');

    // TEST 10: URL Query Synchronization
    console.log('\n--- Test 10: URL Query Synchronization ---');
    await executeSearch('Grab');
    const currentUrl = page.url();
    console.log('Current URL after search "Grab":', currentUrl);
    const hasSearchInUrl = currentUrl.includes('search=grab') || currentUrl.includes('search=Grab');
    console.log(hasSearchInUrl ? '✅ PASS: URL query parameter correctly synchronized' : '❌ FAIL: URL did not sync search param');

    // TEST 11: Recurring transactions search
    console.log('\n--- Test 11: Testing #/recurring search ---');
    await page.goto('http://localhost:3000/#recurring', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    const recSearchInput = await page.$('#recurring-search');
    if (recSearchInput) {
      console.log('✅ #recurring-search found on #/recurring page');
      await page.evaluate(() => {
        const inp = document.querySelector('#recurring-search');
        inp.value = 'Internet';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await new Promise(r => setTimeout(r, 400));
      const recRows = await page.$$eval('#recurring-tbody tr', rows => rows.map(r => r.textContent.trim()));
      console.log(`Recurring search results for "Internet": ${recRows.length} rows`);
    } else {
      console.log('ℹ️ #recurring-search not found or not rendered');
    }

  } catch (err) {
    console.error('Fatal error during test:', err);
  } finally {
    await browser.close();
  }
})();
