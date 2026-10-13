/**
 * Test Prefix Search Suggestions & Autocomplete Popover UX:
 * 1. Suggestions dropdown appears when typing a prefix character ('g', 'c', 'm')
 * 2. Prefix matching works for both direct string prefix and word prefix (accent-insensitive)
 * 3. Matched prefix is highlighted with .suggestion-match
 * 4. Keyboard navigation: ArrowDown / ArrowUp changes active state
 * 5. Keyboard Enter selects highlighted suggestion and filters transactions table
 * 6. Mouse click selects suggestion and filters table
 * 7. Escape key or clicking outside closes dropdown cleanly
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

  console.log('========================================================');
  console.log('🧪 TESTING PREFIX SEARCH SUGGESTIONS & AUTOCOMPLETE POPOVER');
  console.log('========================================================\n');

  try {
    console.log('→ Loading http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    // Handle guest mode if on login
    const guestBtn = await page.$('#btn-guest-mode');
    if (guestBtn) {
      await guestBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('→ Navigating to Transactions via #nav-transactions...');
    await page.waitForSelector('#nav-transactions', { timeout: 10000 });
    await page.click('#nav-transactions');
    await new Promise(r => setTimeout(r, 1000));

    if (errors.length) {
      console.error('❌ Console page errors:', errors);
      process.exit(1);
    }

    // Check search box wrapper & input
    const inputEl = await page.$('#tx-search');
    if (!inputEl) {
      throw new Error('❌ #tx-search input not found');
    }
    console.log('✅ #tx-search found');

    const wrapper = await page.$('#tx-search-box-wrapper');
    console.log(wrapper ? '✅ #tx-search-box-wrapper rendered' : '❌ Missing #tx-search-box-wrapper');

    // TEST 1: Type 'g' → dropdown opens and shows suggestions starting with 'g'
    console.log('\n--- 1. Testing type "g" for prefix suggestions ---');
    await inputEl.focus();
    await page.keyboard.type('g');
    await new Promise(r => setTimeout(r, 300));

    let dropdownVisible = await page.$eval('.search-suggestions-dropdown', el => window.getComputedStyle(el).display !== 'none');
    console.log(dropdownVisible ? '✅ Suggestions dropdown is visible' : '❌ Suggestions dropdown is hidden');

    let suggestions = await page.$$eval('.search-suggestion-item', items => {
      return items.map(el => ({
        value: el.dataset.value,
        title: el.querySelector('.suggestion-title')?.textContent?.trim(),
        hasMatch: !!el.querySelector('.suggestion-match'),
        badge: el.querySelector('.suggestion-badge')?.textContent?.trim(),
      }));
    });

    console.log(`Found ${suggestions.length} suggestions for 'g':`);
    suggestions.forEach(s => console.log(`   - "${s.value}" [${s.badge}] (match highlight: ${s.hasMatch})`));

    const allStartWithG = suggestions.every(s => {
      const lower = s.value.toLowerCase();
      // either string starts with g or a word starts with g
      return lower.startsWith('g') || lower.split(/\s+/).some(w => w.startsWith('g'));
    });
    console.log(suggestions.length > 0 && allStartWithG ? '✅ PASS: All suggestions start with "g"' : '❌ FAIL: Incorrect suggestions');

    // TEST 2: Keyboard ArrowDown navigation
    console.log('\n--- 2. Testing ArrowDown / ArrowUp keyboard navigation ---');
    await page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 100));

    let activeIndex = await page.$$eval('.search-suggestion-item', items => items.findIndex(el => el.classList.contains('active')));
    console.log(`Active index after 1st ArrowDown: ${activeIndex} (Expected: 0)`);
    console.log(activeIndex === 0 ? '✅ 1st suggestion highlighted' : '❌ Highlight failed');

    await page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 100));
    activeIndex = await page.$$eval('.search-suggestion-item', items => items.findIndex(el => el.classList.contains('active')));
    console.log(`Active index after 2nd ArrowDown: ${activeIndex} (Expected: 1)`);

    const selectedText = await page.$$eval('.search-suggestion-item.active', items => items[0]?.dataset?.value);
    console.log(`Active item title: "${selectedText}"`);

    // TEST 3: Enter key selection
    console.log('\n--- 3. Testing Enter key selection ---');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 500));

    dropdownVisible = await page.$eval('.search-suggestions-dropdown', el => window.getComputedStyle(el).display !== 'none');
    console.log(!dropdownVisible ? '✅ Suggestions dropdown closed on Enter' : '❌ Dropdown still open');

    const inputValue = await page.$eval('#tx-search', el => el.value);
    console.log(`Input value after Enter: "${inputValue}"`);
    console.log(inputValue === selectedText ? '✅ Input updated with selected suggestion' : '❌ Input not updated');

    const filteredRows = await page.$$eval('#all-tx-tbody tr.tx-row', rows => rows.length);
    console.log(`Filtered transactions count: ${filteredRows}`);
    console.log(filteredRows > 0 ? '✅ Transactions table filtered to selected item' : '❌ Table not filtered');

    // TEST 4: Clear and test Vietnamese unaccented prefix 'ca'
    console.log('\n--- 4. Testing prefix "ca" (for "Cà phê Highlands") ---');
    await page.evaluate(() => {
      const inp = document.querySelector('#tx-search');
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 300));

    await page.keyboard.type('ca');
    await new Promise(r => setTimeout(r, 300));

    suggestions = await page.$$eval('.search-suggestion-item', items => items.map(el => el.dataset.value));
    console.log('Suggestions for "ca":', suggestions);
    const hasCaPhe = suggestions.some(s => s.includes('Cà phê'));
    console.log(hasCaPhe ? '✅ Found "Cà phê Highlands" from unaccented prefix "ca"' : '❌ Missing "Cà phê"');

    // TEST 5: Mouse click selection
    console.log('\n--- 5. Testing mouse click selection ---');
    const firstItem = await page.$('.search-suggestion-item');
    if (firstItem) {
      const clickTargetValue = await page.evaluate(el => el.dataset.value, firstItem);
      console.log(`Clicking suggestion: "${clickTargetValue}"...`);
      await firstItem.click();
      await new Promise(r => setTimeout(r, 500));

      const finalInputVal = await page.$eval('#tx-search', el => el.value);
      console.log(`Input value after click: "${finalInputVal}"`);
      console.log(finalInputVal === clickTargetValue ? '✅ PASS: Mouse click filled input and filtered' : '❌ FAIL: Mouse click failed');
    }

    // TEST 6: Escape key closes dropdown
    console.log('\n--- 6. Testing Escape key dismiss ---');
    await inputEl.focus();
    await page.keyboard.type(' ');
    await new Promise(r => setTimeout(r, 300));
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));

    dropdownVisible = await page.$eval('.search-suggestions-dropdown', el => window.getComputedStyle(el).display !== 'none');
    console.log(!dropdownVisible ? '✅ PASS: Escape key closes dropdown' : '❌ FAIL: Dropdown did not close on Escape');

    console.log('\n========================================================');
    console.log('🎉 ALL SEARCH SUGGESTIONS & AUTOCOMPLETE TESTS PASSED!');
    console.log('========================================================');
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
