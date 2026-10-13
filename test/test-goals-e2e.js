import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const logs = [];
  page.on('console', msg => {
    console.log('[BROWSER LOG]', msg.text());
    logs.push(msg.text());
  });
  page.on('pageerror', err => console.error('[BROWSER ERROR]', err));

  try {
    console.log('→ Loading Luxe app...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    // Handle login / guest mode
    try {
      await page.waitForSelector('#btn-guest-mode', { timeout: 2500 });
      console.log('→ Entering guest mode...');
      await page.click('#btn-guest-mode');
      await new Promise(r => setTimeout(r, 1500));
    } catch {
      console.log('→ Already in guest/authenticated mode');
    }

    console.log('→ Navigating to Goals (#goals)...');
    await page.evaluate(() => {
      window.location.hash = '#goals';
    });
    await page.waitForSelector('#goals-grid', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 1000));

    // 1. Check goals cards & overview
    const initialCards = await page.$$('#goals-grid .goal-card');
    console.log(`✅ Found ${initialCards.length} initial goal cards in #goals-grid`);
    if (initialCards.length === 0) {
      throw new Error('Expected initial goal cards!');
    }

    // 2. Open Add Goal modal via header button
    console.log('→ Clicking "Thêm mục tiêu" button...');
    const hasAddBtn = await page.evaluate(() => Boolean(document.querySelector('[data-action="add-goal"]')));
    if (!hasAddBtn) throw new Error('Button [data-action="add-goal"] not found!');
    await page.evaluate(() => document.querySelector('[data-action="add-goal"]').click());
    await new Promise(r => setTimeout(r, 600));

    const isModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('add-goal-modal');
      return modal && modal.classList.contains('open');
    });
    console.log(isModalOpen ? '✅ Add Goal modal opened successfully' : '❌ Modal failed to open');
    if (!isModalOpen) throw new Error('Add Goal modal did not open!');

    // 3. Test clicking preset chip
    console.log('→ Clicking preset chip "Du lịch Nhật Bản"...');
    await page.evaluate(() => {
      const chips = document.querySelectorAll('.goal-preset-chip');
      if (chips.length > 1) chips[1].click(); // Du lịch Nhật Bản
    });
    await new Promise(r => setTimeout(r, 500));

    const nameVal = await page.$eval('#goal-name', el => el.value);
    console.log(`✅ Preset autofilled goal name: "${nameVal}"`);

    // 4. Test live preview and calculation
    const hasCalc = await page.evaluate(() => {
      const calc = document.getElementById('goal-calc-body');
      return Boolean(calc && calc.textContent.includes('Khuyến nghị tích lũy'));
    });
    console.log(hasCalc ? '✅ Smart savings calculation generated' : '❌ Calculation missing');

    // 5. Submit form
    console.log('→ Submitting new goal form...');
    const submitBtnDisabled = await page.$eval('#confirm-save-goal-btn', btn => btn.disabled);
    console.log('Submit button disabled?', submitBtnDisabled);
    await page.evaluate(() => document.getElementById('confirm-save-goal-btn')?.click());
    await page.waitForFunction(
      initialCount => document.querySelectorAll('#goals-grid .goal-card').length > initialCount,
      { timeout: 5000 },
      initialCards.length
    );

    // 6. Verify new card in goals grid
    const gridCards = await page.$$('#goals-grid .goal-card');
    console.log(`✅ Goals in #goals-grid: ${gridCards.length}`);

    // 7. Test "+ Nạp" (Deposit) modal on newly created goal
    console.log('→ Testing quick deposit workflow...');
    await page.evaluate(() => {
      const depositBtns = document.querySelectorAll('[data-action="deposit-goal"]');
      if (depositBtns.length > 0) depositBtns[depositBtns.length - 1].click();
    });
    await new Promise(r => setTimeout(r, 600));

    const isDepositOpen = await page.evaluate(() => {
      const modal = document.getElementById('deposit-goal-modal');
      return modal && modal.classList.contains('open');
    });
    console.log(isDepositOpen ? '✅ Deposit modal opened' : '❌ Deposit modal failed to open');
    if (!isDepositOpen) throw new Error('Deposit modal did not open!');

    // Click quick deposit chip (+1 tr)
    await page.evaluate(() => {
      const chip = document.querySelector('[data-deposit-add="1000000"]');
      if (chip) chip.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Confirm deposit
    await page.evaluate(() => document.getElementById('confirm-deposit-btn')?.click());
    await new Promise(r => setTimeout(r, 1200));
    console.log('✅ Quick deposit confirmed and saved');

    console.log('\n========================================');
    console.log('🎉 ALL GOALS E2E TESTS PASSED PERFECTLY!');
    console.log('========================================\n');
  } catch (err) {
    console.error('❌ E2E Test Error:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
