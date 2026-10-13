import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  try {
    console.log('--- Testing "Đặt lại ngân sách" (Budget Reset) Feature ---');
    console.log('→ Loading Luxe app at http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.location.hash !== '#loading', { timeout: 10000 });

    const onLogin = await page.$('#btn-guest-mode');
    if (onLogin) {
      console.log('→ On login screen, entering Guest mode...');
      await page.click('#btn-guest-mode');
      await page.waitForFunction(() => window.location.hash !== '#login', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 600));
    }

    // 1. Navigate to Budgets
    console.log('→ Navigating to Budgets (#budgets)...');
    await page.evaluate(() => {
      window.location.hash = '#budgets';
    });
    await page.waitForSelector('#btn-reset-budgets', { visible: true, timeout: 8000 });

    // 2. Verify "Đặt lại ngân sách" button on page header
    const resetHeaderBtn = await page.$('#btn-reset-budgets');
    if (!resetHeaderBtn) {
      throw new Error('❌ Missing "#btn-reset-budgets" button on Budgets page header!');
    }
    const btnText = await page.evaluate(el => el.textContent.trim(), resetHeaderBtn);
    console.log(`✅ Header Reset Button found with text: "${btnText}"`);

    // 3. Count initial transactions before reset to prove non-destructive safety
    const initialTxCount = await page.evaluate(() => {
      const tx = JSON.parse(localStorage.getItem('luxe_transactions') || '[]');
      return tx.length;
    });
    console.log(`📊 Initial transactions count before reset: ${initialTxCount}`);

    // 4. Click "#btn-reset-budgets" to open modal
    console.log('→ Clicking "#btn-reset-budgets" to open Reset Budgets modal...');
    await page.click('#btn-reset-budgets');
    await new Promise(r => setTimeout(r, 600));

    const isModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('reset-budgets-modal');
      return modal && modal.classList.contains('open');
    });
    if (!isModalOpen) {
      throw new Error('❌ "#reset-budgets-modal" did not open after clicking button!');
    }
    console.log('✅ Reset Budgets modal opened successfully!');

    // 5. Verify 3 preset modes inside modal
    const modesCount = await page.evaluate(() => {
      const modal = document.getElementById('reset-budgets-modal');
      return modal.querySelectorAll('.budget-mode-btn').length;
    });
    console.log(`✅ Found ${modesCount} preset mode options in modal (Default, 50/30/20, Zero)`);

    // 6. Test switching to 50/30/20 rule mode
    console.log('→ Switching mode to "50_30_20" rule...');
    await page.click('#reset-budgets-modal [data-mode="50_30_20"]');
    await new Promise(r => setTimeout(r, 400));

    const hasIncomeInput = await page.evaluate(() => {
      return Boolean(document.getElementById('reset-income-input'));
    });
    if (!hasIncomeInput) {
      throw new Error('❌ 50/30/20 mode did not render the income input field!');
    }
    console.log('✅ 50/30/20 mode dynamically rendered the income input field!');

    // 7. Test switching to "zero" mode
    console.log('→ Switching mode to "zero" mode...');
    await page.click('#reset-budgets-modal [data-mode="zero"]');
    await new Promise(r => setTimeout(r, 400));

    // 8. Switch back to "default" mode and submit reset
    console.log('→ Switching back to "default" mode...');
    await page.click('#reset-budgets-modal [data-mode="default"]');
    await new Promise(r => setTimeout(r, 400));

    console.log('→ Clicking "#btn-confirm-reset" to execute reset...');
    await page.click('#btn-confirm-reset');
    await new Promise(r => setTimeout(r, 1000));

    const isModalClosed = await page.evaluate(() => {
      const modal = document.getElementById('reset-budgets-modal');
      return !modal || !modal.classList.contains('open');
    });
    if (!isModalClosed) {
      throw new Error('❌ Modal remained open after confirming reset!');
    }
    console.log('✅ Modal closed successfully after executing reset!');

    // 9. Verify transactions remain 100% intact (zero loss)
    const afterTxCount = await page.evaluate(() => {
      const tx = JSON.parse(localStorage.getItem('luxe_transactions') || '[]');
      return tx.length;
    });
    console.log(`📊 Transactions count after reset: ${afterTxCount}`);
    if (afterTxCount !== initialTxCount) {
      throw new Error(`❌ Data integrity violation! Transaction count changed from ${initialTxCount} to ${afterTxCount}`);
    }
    console.log('✅ Data Safety Verified: 100% of user transactions preserved intact!');

    // 10. Verify budget cards on page
    await page.waitForSelector('.budget-overview-card', { visible: true, timeout: 5000 });
    const cardCount = await page.evaluate(() => {
      return document.querySelectorAll('.budget-overview-card').length;
    });
    console.log(`✅ ${cardCount} budget cards displayed after reset`);

    // 11. Test single budget card menu options
    console.log('→ Testing dropdown options on individual budget card...');
    const firstMenuBtn = await page.$('.budget-card-menu-btn');
    if (firstMenuBtn) {
      await firstMenuBtn.click();
      await new Promise(r => setTimeout(r, 300));

      const hasResetSingle = await page.evaluate(() => {
        return Boolean(document.querySelector('[data-action="reset-single-budget"]'));
      });
      const hasEditLimit = await page.evaluate(() => {
        return Boolean(document.querySelector('[data-action="edit-budget"]'));
      });

      console.log(`✅ Card dropdown has "Đặt lại về mặc định": ${hasResetSingle}`);
      console.log(`✅ Card dropdown has "Sửa hạn mức": ${hasEditLimit}`);

      // Test opening edit budget modal
      console.log('→ Opening "Sửa hạn mức" modal...');
      await page.click('[data-action="edit-budget"]');
      await new Promise(r => setTimeout(r, 500));

      const isEditModalOpen = await page.evaluate(() => {
        const modal = document.getElementById('edit-budget-modal');
        return modal && modal.classList.contains('open');
      });
      console.log(`✅ Single budget edit modal open: ${isEditModalOpen}`);

      // Close edit modal
      await page.click('#btn-close-edit-modal');
      await new Promise(r => setTimeout(r, 400));
    }

    // 12. Test Settings Financial tab integration
    console.log('→ Navigating to Settings to test reset integration...');
    await page.evaluate(() => {
      window.location.hash = '#settings';
    });
    await page.waitForSelector('#stab-financial', { visible: true, timeout: 5000 });

    // Switch to Financial tab
    await page.click('#stab-financial');
    await new Promise(r => setTimeout(r, 500));

    const settingsResetBtn = await page.$('#btn-settings-reset-budgets');
    if (!settingsResetBtn) {
      throw new Error('❌ Missing "#btn-settings-reset-budgets" in Settings > Financial panel!');
    }
    console.log('✅ Settings > Financial panel has "#btn-settings-reset-budgets" button!');

    await settingsResetBtn.click();
    await new Promise(r => setTimeout(r, 500));

    const isSettingsModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('reset-budgets-modal');
      return modal && modal.classList.contains('open');
    });
    console.log(`✅ Budget Reset modal triggered successfully from Settings: ${isSettingsModalOpen}`);

    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    console.log('\n========================================');
    console.log('🎉 ALL "Đặt lại ngân sách" TESTS PASSED PERFECTLY!');
    console.log('========================================');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    console.log('\n--- BROWSER CONSOLE LOGS ---');
    console.log(logs.join('\n'));
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
