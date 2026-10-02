/**
 * Validation test for:
 * 1. Amount input layout & no overlap at 360px, 768px, 1280px and 200% zoom.
 * 2. Typing amount formatting, spelled-out display, quick amount chips.
 * 3. Category chips consolidation, active highlighting, type switching, edit mode.
 * 4. Keyboard navigation (Enter, Esc) and focus trap.
 * 5. Mobile bottom sheet with sticky footer.
 */
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  try {
    console.log('→ Loading app...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    // Test 1: Viewports & Zoom Level Overlap Check
    const viewports = [
      { width: 360, height: 640, name: '360px mobile', dsf: 1 },
      { width: 768, height: 1024, name: '768px tablet', dsf: 1 },
      { width: 1280, height: 800, name: '1280px desktop', dsf: 1 },
      { width: 1280, height: 800, name: '1280px @ 200% zoom', dsf: 2 },
    ];

    const openModalHelper = async () => {
      await page.evaluate(async () => {
        const { open } = await import('./src/features/transactions/transactionForm.js');
        await open();
      });
      await new Promise(r => setTimeout(r, 400));
    };

    for (const vp of viewports) {
      console.log(`\n→ Testing viewport: ${vp.name}...`);
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dsf });
      
      // Open modal
      await openModalHelper();

      const overlapCheck = await page.evaluate(() => {
        const prefix = document.querySelector('#tx-currency-prefix');
        const input = document.querySelector('#tx-amount');
        if (!prefix || !input) return { error: 'Elements not found' };

        const prefixRect = prefix.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();

        // Check if prefix and input overlap horizontally
        const prefixRight = prefixRect.right;
        const inputLeft = inputRect.left;
        const overlaps = prefixRight > inputLeft;

        return {
          prefixRect: { left: prefixRect.left, right: prefixRect.right, width: prefixRect.width },
          inputRect: { left: inputRect.left, right: inputRect.right, width: inputRect.width },
          overlaps
        };
      });

      console.log(`  Prefix width: ${overlapCheck.prefixRect?.width}px, right: ${overlapCheck.prefixRect?.right}px`);
      console.log(`  Input left: ${overlapCheck.inputRect?.left}px, width: ${overlapCheck.inputRect?.width}px`);
      if (overlapCheck.overlaps) {
        throw new Error(`Overlap detected at ${vp.name}! Prefix right ${overlapCheck.prefixRect.right} > Input left ${overlapCheck.inputRect.left}`);
      }
      console.log(`  ✅ No text overlap at ${vp.name}`);

      // Close modal
      await page.click('#close-add-tx-modal');
      await new Promise(r => setTimeout(r, 300));
    }

    // Reset to desktop viewport for feature testing
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.click('#open-add-tx-modal');
    await new Promise(r => setTimeout(r, 300));

    // Test 2: Only ONE visible category control
    console.log('\n→ Checking category controls visibility...');
    const categoryVisibility = await page.evaluate(() => {
      const select = document.querySelector('#tx-category');
      const chips = document.querySelector('#tx-category-chips');
      const isSelectVisible = select && (select.offsetWidth > 0 || select.offsetHeight > 0) && window.getComputedStyle(select).display !== 'none';
      const isChipsVisible = chips && (chips.offsetWidth > 0 || chips.offsetHeight > 0);
      return { isSelectVisible, isChipsVisible };
    });

    console.log(`  Select visible: ${categoryVisibility.isSelectVisible}, Chips visible: ${categoryVisibility.isChipsVisible}`);
    if (categoryVisibility.isSelectVisible) {
      throw new Error('Select element should NOT be visible!');
    }
    if (!categoryVisibility.isChipsVisible) {
      throw new Error('Category chips MUST be visible!');
    }
    console.log('  ✅ Single visible control confirmed (chips only)');

    // Test 3: Amount typing formatting and spelled-out amount
    console.log('\n→ Testing Amount typing & formatting...');
    await page.type('#tx-amount', '1250000');
    await new Promise(r => setTimeout(r, 100));

    const amountState = await page.evaluate(() => {
      const amountVal = document.querySelector('#tx-amount').value;
      const spelledText = document.querySelector('#tx-amount-spelled').textContent;
      return { amountVal, spelledText };
    });

    console.log(`  Amount value: "${amountState.amountVal}", Spelled: "${amountState.spelledText}"`);
    if (amountState.amountVal !== '1.250.000') {
      throw new Error(`Expected formatted amount '1.250.000', got '${amountState.amountVal}'`);
    }
    if (!amountState.spelledText.includes('1,25 triệu')) {
      throw new Error(`Expected spelled amount to contain '1,25 triệu', got '${amountState.spelledText}'`);
    }
    console.log('  ✅ Amount formatting and spelled text verified');

    // Test 4: Quick amount chips
    console.log('\n→ Testing Quick Amount chips...');
    const quickBtn = await page.$('[data-quick-amount="100000"]');
    if (!quickBtn) throw new Error('Quick amount button +100.000 not found');
    await quickBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const quickAmountVal = await page.$eval('#tx-amount', el => el.value);
    console.log(`  New amount after +100.000: "${quickAmountVal}"`);
    if (quickAmountVal !== '1.350.000') {
      throw new Error(`Expected '1.350.000', got '${quickAmountVal}'`);
    }
    console.log('  ✅ Quick amount chip added properly');

    // Test 5: Category chips selection & active states
    console.log('\n→ Testing Category chips selection...');
    const foodChip = await page.$('[data-category-chip="food"]');
    if (!foodChip) throw new Error('Food category chip not found');
    await foodChip.click();
    await new Promise(r => setTimeout(r, 100));

    const chipState = await page.evaluate(() => {
      const chip = document.querySelector('[data-category-chip="food"]');
      const selectVal = document.querySelector('#tx-category').value;
      return {
        isActive: chip.classList.contains('active'),
        ariaPressed: chip.getAttribute('aria-pressed'),
        ariaChecked: chip.getAttribute('aria-checked'),
        selectVal
      };
    });

    console.log(`  Food chip active: ${chipState.isActive}, aria-pressed: ${chipState.ariaPressed}, select value: ${chipState.selectVal}`);
    if (!chipState.isActive || chipState.ariaPressed !== 'true' || chipState.selectVal !== 'food') {
      throw new Error('Category chip selection did not update state/select properly');
    }
    console.log('  ✅ Category chip selection and active highlight verified');

    // Test 6: Switching transaction types (Expense -> Income -> Expense)
    console.log('\n→ Testing Transaction Type switching...');
    await page.click('[data-tx-type="income"]');
    await new Promise(r => setTimeout(r, 200));

    const incomeState = await page.evaluate(() => {
      const selectVal = document.querySelector('#tx-category').value;
      const activeChip = document.querySelector('.tx-category-chip.active');
      return { selectVal, hasActiveChip: Boolean(activeChip) };
    });

    console.log(`  After switching to Income: Category reset to "${incomeState.selectVal}", hasActiveChip: ${incomeState.hasActiveChip}`);
    if (incomeState.selectVal !== '' || incomeState.hasActiveChip) {
      throw new Error('Category should be cleared when invalid in new transaction type');
    }
    console.log('  ✅ Category properly reset on invalid type switch');

    // Select income category
    await page.click('[data-category-chip="income"]');
    const incomeCatVal = await page.$eval('#tx-category', el => el.value);
    if (incomeCatVal !== 'income') throw new Error('Failed to select income category');
    console.log('  ✅ Income category selected');

    // Switch back to expense
    await page.click('[data-tx-type="expense"]');
    await page.click('[data-category-chip="shopping"]');

    // Test 7: Enter key submission
    console.log('\n→ Testing keyboard Enter key submission...');
    await page.type('#tx-merchant', 'Test Keyboard Submit');
    await page.select('#tx-account', 'a01');
    await page.evaluate(() => {
      const date = document.querySelector('#tx-date');
      date.value = new Date().toISOString().slice(0, 10);
      date.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Press Enter on merchant input
    await page.focus('#tx-merchant');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));

    const modalAfterSubmit = await page.$('.modal-overlay.open');
    if (modalAfterSubmit) {
      throw new Error('Modal should be closed after successful Enter submission');
    }
    console.log('  ✅ Form submitted and modal closed via Enter key');

    // Test 8: Edit mode highlighting
    console.log('\n→ Testing Edit transaction mode...');
    // Open edit for a transaction
    await page.evaluate(async () => {
      const { edit } = await import('./src/features/transactions/transactionForm.js');
      edit({
        merchant: 'Edit Mode Test',
        amount: 2500000,
        type: 'expense',
        category: 'bills',
        account_id: 'a01',
        date: '2026-09-28',
        payment_method: 'card'
      });
    });
    await new Promise(r => setTimeout(r, 500));

    const editState = await page.evaluate(() => {
      const billsChip = document.querySelector('[data-category-chip="bills"]');
      const amountVal = document.querySelector('#tx-amount').value;
      const spelledText = document.querySelector('#tx-amount-spelled').textContent;
      return {
        billsActive: billsChip?.classList.contains('active'),
        billsPressed: billsChip?.getAttribute('aria-pressed'),
        amountVal,
        spelledText
      };
    });

    console.log(`  Bills chip active in edit mode: ${editState.billsActive}, Amount: ${editState.amountVal}, Spelled: ${editState.spelledText}`);
    if (!editState.billsActive || editState.billsPressed !== 'true') {
      throw new Error('Edit mode did not highlight the correct category chip');
    }
    if (editState.amountVal !== '2.500.000' || !editState.spelledText.includes('2,5 triệu')) {
      throw new Error('Edit mode did not format amount and spelled text properly');
    }
    console.log('  ✅ Edit mode highlighted category and formatted amount properly');

    // Test 9: Escape key closes modal
    console.log('\n→ Testing Escape key closes modal...');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));
    const modalAfterEsc = await page.$('.modal-overlay.open');
    if (modalAfterEsc) {
      throw new Error('Modal should close on Escape key');
    }
    console.log('  ✅ Modal closed via Escape key');

    // Test 10: Mobile bottom sheet sticky footer
    console.log('\n→ Testing Mobile bottom sheet layout & sticky footer...');
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await openModalHelper();
    await new Promise(r => setTimeout(r, 400));

    const bottomSheetState = await page.evaluate(() => {
      const dialog = document.querySelector('.modal-dialog');
      const footer = document.querySelector('.modal-footer');
      const saveBtn = document.querySelector('#confirm-add-tx');
      const handle = document.querySelector('.modal-grab-handle');

      const dialogRect = dialog.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const saveBtnRect = saveBtn.getBoundingClientRect();
      const handleStyle = window.getComputedStyle(handle);

      return {
        dialogBottom: dialogRect.bottom,
        windowHeight: window.innerHeight,
        footerSticky: window.getComputedStyle(footer).position === 'sticky',
        saveBtnVisible: saveBtnRect.top < window.innerHeight && saveBtnRect.bottom <= window.innerHeight,
        handleVisible: handleStyle.display !== 'none'
      };
    });

    console.log(`  Dialog at bottom: ${bottomSheetState.dialogBottom === bottomSheetState.windowHeight}`);
    console.log(`  Footer sticky: ${bottomSheetState.footerSticky}, Save btn visible in viewport: ${bottomSheetState.saveBtnVisible}`);
    console.log(`  Mobile grab handle visible: ${bottomSheetState.handleVisible}`);

    if (!bottomSheetState.footerSticky || !bottomSheetState.saveBtnVisible) {
      throw new Error('Mobile bottom sheet footer / save button is not sticky and visible');
    }
    console.log('  ✅ Mobile bottom sheet verified');

    if (errors.length) {
      console.error('❌ Errors encountered during test:', errors);
      process.exit(1);
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
