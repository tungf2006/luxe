/**
 * Smoke test — verifies the Luxe app loads and navigation works.
 * Run: node test-app.js
 */
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Capture console errors
  const errors = [];
  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(msg.text()));
  page.on('pageerror', err => errors.push(err.message));
  page.on('requestfailed', req => errors.push(`Request failed: ${req.url()}`));

  // Log all requests
  page.on('request', req => console.log(`→ Request: ${req.url()}`));
  page.on('response', res => console.log(`← Response: ${res.url()} ${res.status()}`));

  try {
    // 1. Load the homepage
    console.log('→ Loading http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 2. Check for errors
    await new Promise(r => setTimeout(r, 2000));
    if (errors.length) {
      console.error('❌ Console errors:', errors);
    } else {
      console.log('✅ No JavaScript errors on load');
    }

    // 3. Check that the dashboard rendered
    const hasKpiGrid = await page.$('#kpi-grid') !== null;
    console.log(hasKpiGrid ? '✅ Dashboard KPI grid rendered' : '❌ Dashboard KPI grid missing');

    const hasChart = await page.$('#spending-chart-container') !== null;
    console.log(hasChart ? '✅ Spending chart rendered' : '❌ Spending chart missing');

    const hasTxTable = await page.$('#recent-tx-tbody') !== null;
    console.log(hasTxTable ? '✅ Recent transactions rendered' : '❌ Recent transactions missing');

    // 4. Navigate to Transactions
    console.log('→ Navigating to Transactions...');
    await page.click('#nav-transactions');
    await new Promise(r => setTimeout(r, 1000));

    const hasTxPage = await page.$('#all-tx-tbody') !== null;
    console.log(hasTxPage ? '✅ Transactions page rendered' : '❌ Transactions page missing');

    const hasFilters = await page.$('.tx-filter-bar') !== null;
    console.log(hasFilters ? '✅ Transaction filters rendered' : '❌ Transaction filters missing');

    // 5. Navigate to Budgets
    console.log('→ Navigating to Budgets...');
    await page.click('#nav-budgets');
    await new Promise(r => setTimeout(r, 1000));

    const hasBudgetSummary = await page.$('#budget-kpi-grid') !== null;
    console.log(hasBudgetSummary ? '✅ Budget summary rendered' : '❌ Budget summary missing');

    // 6. Navigate to Reports
    console.log('→ Navigating to Reports...');
    await page.click('#nav-reports');
    await new Promise(r => setTimeout(r, 1000));

    const hasCashflow = await page.$('#cashflow-panel') !== null;
    console.log(hasCashflow ? '✅ Reports page rendered' : '❌ Reports page missing');

    // 7. Navigate to Settings
    console.log('→ Navigating to Settings...');
    await page.click('#nav-settings');
    await new Promise(r => setTimeout(r, 1000));

    const hasSettings = await page.$('.settings-shell') !== null;
    console.log(hasSettings ? '✅ Settings page rendered' : '❌ Settings page missing');

    // 8. Navigate to Goals
    console.log('→ Navigating to Goals...');
    await page.click('#nav-goals');
    await new Promise(r => setTimeout(r, 2000));

    const hasGoalsGrid = await page.$('#goals-grid') !== null;
    console.log(hasGoalsGrid ? '✅ Goals grid rendered' : '❌ Goals grid missing');

    const goalCards = await page.$$('.goal-card');
    console.log(`→ Found ${goalCards.length} goal cards`);
    const hasGoalCards = goalCards.length > 0;
    console.log(hasGoalCards ? '✅ Goal cards rendered' : '❌ Goal cards missing');

    // 9. Navigate to Accounts
    console.log('→ Navigating to Accounts...');
    await page.click('#nav-accounts');
    await new Promise(r => setTimeout(r, 2000));

    const hasAccountsGrid = await page.$('#accounts-grid') !== null;
    console.log(hasAccountsGrid ? '✅ Accounts grid rendered' : '❌ Accounts grid missing');

    const accountCards = await page.$$('.account-card');
    console.log(`→ Found ${accountCards.length} account cards`);
    const hasAccountCards = accountCards.length > 0;
    console.log(hasAccountCards ? '✅ Account cards rendered' : '❌ Account cards missing');

    // 10. Navigate to Recurring
    console.log('→ Navigating to Recurring...');
    await page.click('#nav-recurring');
    await new Promise(r => setTimeout(r, 1000));

    const hasMonthlyTotal = await page.$('#recurring-monthly-cost') !== null;
    console.log(hasMonthlyTotal ? '✅ Recurring monthly total KPI rendered' : '❌ Recurring monthly total missing');

    const hasUpcomingPanel = await page.$('#recurring-upcoming-panel') !== null;
    console.log(hasUpcomingPanel ? '✅ Recurring upcoming panel rendered' : '❌ Recurring upcoming panel missing');

    const hasRecurringTable = await page.$('#recurring-tbody') !== null;
    console.log(hasRecurringTable ? '✅ Recurring table rendered' : '❌ Recurring table missing');

    // 11. Test Add Transaction modal
    console.log('→ Testing Add Transaction modal...');
    await page.click('#open-add-tx-modal');
    await new Promise(r => setTimeout(r, 500));

    const modalOpen = await page.$('.modal-overlay.open') !== null;
    console.log(modalOpen ? '✅ Modal opens' : '❌ Modal did not open');

    await page.click('#close-add-tx-modal');
    await new Promise(r => setTimeout(r, 500));

    // 9. Test Add Transaction flow
    console.log('→ Testing Add Transaction flow...');
    await page.click('#open-add-tx-modal');
    await new Promise(r => setTimeout(r, 300));

    await page.type('#tx-merchant', 'Test Merchant');
    await page.type('#tx-amount', '42.50');
    await page.select('#tx-account', 'a01');
    await page.select('#tx-category', 'food');
    await page.evaluate(() => {
      const date = document.querySelector('#tx-date');
      date.value = new Date().toISOString().slice(0, 10);
      date.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForSelector('#confirm-add-tx:not([disabled])', { timeout: 5000 });
    await page.click('#confirm-add-tx');
    await new Promise(r => setTimeout(r, 1000));

    // Check toast appeared
    // Check the DOM for the toast (not console)
    await new Promise(r => setTimeout(r, 500));
    const toastElement = await page.$('.toast-container .toast');
    const toastText = toastElement ? await page.evaluate(el => el.textContent, toastElement) : '';
    const toastAppeared = toastText.includes('Giao dịch đã thêm') || toastText.includes('42.50');
    console.log(toastAppeared ? '✅ Transaction added and toast shown' : '❌ Transaction add failed');

    // 10. Verify data persisted
    console.log('→ Verifying data persistence...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    const txCount = await page.$$eval('#recent-tx-tbody tr', rows => rows.length);
    console.log(txCount > 0 ? `✅ Recent transactions visible (${txCount} rows)` : '❌ No transactions visible');

    console.log('\n=== All smoke tests complete ===\n');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await browser.close();
  }
})();
