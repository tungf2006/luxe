import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    // console.log('[BROWSER LOG]', msg.text());
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

    console.log('→ Navigating to Recurring (#recurring)...');
    await page.evaluate(() => {
      window.location.hash = '#recurring';
    });
    await page.waitForSelector('#recurring-tbody', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 800));

    // 1. Check initial recurring list
    const initialRows = await page.$$('#recurring-tbody tr');
    console.log(`✅ Found ${initialRows.length} initial recurring items in table`);
    if (initialRows.length === 0) {
      throw new Error('Expected initial recurring rows!');
    }

    // 2. Open Add Recurring modal via header button
    console.log('→ Clicking "Thêm giao dịch" button in Recurring header...');
    const hasAddBtn = await page.evaluate(() => Boolean(document.querySelector('[data-action="add-recurring"]')));
    if (!hasAddBtn) throw new Error('Button [data-action="add-recurring"] not found!');
    
    await page.evaluate(() => document.querySelector('[data-action="add-recurring"]').click());
    await new Promise(r => setTimeout(r, 500));

    const isModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('recurring-modal');
      return modal && modal.classList.contains('open');
    });
    console.log(isModalOpen ? '✅ Recurring modal opened successfully' : '❌ Modal failed to open');
    if (!isModalOpen) throw new Error('Recurring modal did not open!');

    // 3. Test presets
    console.log('→ Testing recurring preset click...');
    const hasPreset = await page.evaluate(() => {
      const p = document.querySelector('.recurring-preset-chip');
      if (p) {
        p.click();
        return true;
      }
      return false;
    });
    console.log(hasPreset ? '✅ Preset clicked and loaded' : '❌ Preset not found');
    await new Promise(r => setTimeout(r, 400));

    // 4. Fill custom recurring data
    console.log('→ Filling custom recurring transaction fields...');
    await page.evaluate(() => {
      const merchantInput = document.getElementById('recurring-merchant');
      merchantInput.value = 'Internet Viettel Fiber E2E';
      merchantInput.dispatchEvent(new Event('input', { bubbles: true }));

      const amountInput = document.getElementById('recurring-amount');
      amountInput.value = '220.000';
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));

      const nextDate = document.getElementById('recurring-next-date');
      nextDate.value = '2026-11-15';
      nextDate.dispatchEvent(new Event('input', { bubbles: true }));
      nextDate.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await new Promise(r => setTimeout(r, 300));

    // 5. Verify live preview and spelled-out amount
    const previewDetails = await page.evaluate(() => {
      const spelled = document.getElementById('recurring-amount-spelled')?.textContent;
      const previewTitle = document.querySelector('.recurring-preview-card .tx-card-title')?.textContent;
      const previewAmount = document.querySelector('.recurring-preview-card .tx-card-amount')?.textContent;
      const isSaveEnabled = !document.getElementById('confirm-save-recurring-btn')?.hasAttribute('disabled');
      return { spelled, previewTitle, previewAmount, isSaveEnabled };
    });

    console.log(`✅ Live preview title: "${previewDetails.previewTitle}"`);
    console.log(`✅ Spelled amount: "${previewDetails.spelled}"`);
    console.log(`✅ Save button enabled: ${previewDetails.isSaveEnabled}`);

    if (!previewDetails.isSaveEnabled) {
      throw new Error('Save button is disabled after entering valid data!');
    }

    // 6. Submit the form
    console.log('→ Submitting recurring form...');
    await page.evaluate(() => {
      document.getElementById('confirm-save-recurring-btn').click();
    });

    await new Promise(r => setTimeout(r, 1200));

    // 7. Verify modal is closed
    const isModalClosed = await page.evaluate(() => {
      const modal = document.getElementById('recurring-modal');
      return !modal || !modal.classList.contains('open');
    });
    console.log(isModalClosed ? '✅ Recurring modal closed after save' : '❌ Modal still open');

    // 8. Verify the new transaction exists in table
    const tableContainsNew = await page.evaluate(() => {
      const text = document.getElementById('recurring-tbody')?.textContent || '';
      return text.includes('Internet Viettel Fiber E2E');
    });
    console.log(tableContainsNew ? '✅ New recurring transaction found in table' : '❌ Not found in table');
    if (!tableContainsNew) throw new Error('New recurring transaction not found in table!');

    // 9. Test Edit mode via 3-dots action menu
    console.log('→ Testing Edit mode on existing recurring item...');
    await page.evaluate(() => {
      // Find row with Internet Viettel Fiber E2E
      const rows = Array.from(document.querySelectorAll('#recurring-tbody tr'));
      const targetRow = rows.find(r => r.textContent.includes('Internet Viettel Fiber E2E'));
      if (targetRow) {
        const trigger = targetRow.querySelector('.action-btn');
        if (trigger) trigger.click();
        const editItem = targetRow.querySelector('[data-action="edit-recurring"]');
        if (editItem) editItem.click();
      }
    });

    await new Promise(r => setTimeout(r, 600));

    const isEditModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('recurring-modal');
      const title = modal?.querySelector('#recurring-modal-title')?.textContent;
      const merchantVal = document.getElementById('recurring-merchant')?.value;
      return Boolean(modal && modal.classList.contains('open') && title.includes('Chỉnh sửa') && merchantVal.includes('Internet Viettel'));
    });

    console.log(isEditModalOpen ? '✅ Edit modal opened with pre-filled recurring data' : '❌ Edit modal failed to open');
    if (!isEditModalOpen) throw new Error('Edit recurring modal did not open properly!');

    // Close modal via close button
    await page.evaluate(() => {
      document.getElementById('close-recurring-modal-btn').click();
    });
    await new Promise(r => setTimeout(r, 500));

    console.log('\n========================================');
    console.log('🎉 ALL RECURRING E2E TESTS PASSED!');
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ E2E TEST FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
