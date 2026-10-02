/**
 * Comprehensive test for PasswordField, Security tab, and Auth views.
 */
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  try {
    console.log('1. Loading Luxe app...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    console.log('1b. Navigating to Settings...');
    await page.click('#nav-settings');
    await new Promise(r => setTimeout(r, 1000));

    // Click on Security tab
    console.log('2. Switching to Security tab...');
    await page.waitForSelector('#stab-security', { timeout: 5000 });
    await page.click('#stab-security');
    await new Promise(r => setTimeout(r, 500));

    const isSecurityVisible = await page.$eval('#panel-security', el => !el.hidden && getComputedStyle(el).display !== 'none');
    console.log(isSecurityVisible ? '✅ Security panel is active and visible' : '❌ Security panel is hidden');

    // Verify all 3 password fields exist
    console.log('3. Checking all 3 password fields and toggle buttons in Settings...');
    const fieldIds = ['s-pw-current', 's-pw-new', 's-pw-confirm'];
    for (const id of fieldIds) {
      const input = await page.$(`#${id}`);
      const btn = await page.$(`[data-pw-toggle="${id}"]`);
      if (!input || !btn) {
        throw new Error(`Missing input or toggle button for #${id}`);
      }
      const isBtnVisible = await page.$eval(`[data-pw-toggle="${id}"]`, b => {
        const rect = b.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(b).visibility !== 'hidden';
      });
      const btnAriaLabel = await page.$eval(`[data-pw-toggle="${id}"]`, b => b.getAttribute('aria-label'));
      const btnAriaPressed = await page.$eval(`[data-pw-toggle="${id}"]`, b => b.getAttribute('aria-pressed'));
      console.log(`✅ #${id}: toggle button visible (${isBtnVisible}), aria-label="${btnAriaLabel}", aria-pressed="${btnAriaPressed}"`);
    }

    // 4. Test toggle click functionality
    console.log('4. Testing toggle click on #s-pw-new...');
    let inputType = await page.$eval('#s-pw-new', el => el.type);
    console.log(`Initial type: ${inputType} (expected: password)`);

    await page.click('[data-pw-toggle="s-pw-new"]');
    await new Promise(r => setTimeout(r, 200));

    inputType = await page.$eval('#s-pw-new', el => el.type);
    let ariaPressed = await page.$eval('[data-pw-toggle="s-pw-new"]', b => b.getAttribute('aria-pressed'));
    let ariaLabel = await page.$eval('[data-pw-toggle="s-pw-new"]', b => b.getAttribute('aria-label'));
    console.log(`After 1st click: type=${inputType}, aria-pressed=${ariaPressed}, aria-label="${ariaLabel}"`);
    if (inputType !== 'text' || ariaPressed !== 'true') {
      throw new Error('Toggle button failed to switch to type="text"');
    }

    await page.click('[data-pw-toggle="s-pw-new"]');
    await new Promise(r => setTimeout(r, 200));

    inputType = await page.$eval('#s-pw-new', el => el.type);
    ariaPressed = await page.$eval('[data-pw-toggle="s-pw-new"]', b => b.getAttribute('aria-pressed'));
    console.log(`After 2nd click: type=${inputType}, aria-pressed=${ariaPressed}`);
    if (inputType !== 'password' || ariaPressed !== 'false') {
      throw new Error('Toggle button failed to switch back to type="password"');
    }

    // 5. Test Password strength and checklist
    console.log('5. Testing password strength and checklist...');
    await page.type('#s-pw-new', 'secret');
    await new Promise(r => setTimeout(r, 300));

    let score = await page.$eval('#pw-strength-meter', el => el.getAttribute('data-score'));
    let label = await page.$eval('#pw-strength-label', el => el.textContent.trim());
    console.log(`Typed "secret" -> score=${score}, label="${label}"`);

    // Type full strong password: 'StrongPass123!'
    await page.evaluate(() => {
      const el = document.querySelector('#s-pw-new');
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.type('#s-pw-new', 'StrongPass123!');
    await new Promise(r => setTimeout(r, 300));

    score = await page.$eval('#pw-strength-meter', el => el.getAttribute('data-score'));
    label = await page.$eval('#pw-strength-label', el => el.textContent.trim());
    const passedItems = await page.$$eval('#pw-strength-checklist .checklist-item.passed', items => items.length);
    console.log(`Typed "StrongPass123!" -> score=${score} (expected 4), label="${label}", passed checklist items: ${passedItems}/4`);
    if (score !== '4' || passedItems !== 4) {
      throw new Error(`Password strength checklist failed! Expected 4 rules passed, got ${passedItems}`);
    }

    // 6. Test confirm password mismatch alert
    console.log('6. Testing confirm password mismatch alert...');
    await page.type('#s-pw-confirm', 'MismatchPass123!');
    await new Promise(r => setTimeout(r, 300));

    let isErrorVisible = await page.$eval('#s-pw-confirm-error', el => el.style.display !== 'none' && el.textContent.length > 0);
    let isInvalidClass = await page.$eval('#s-pw-confirm', el => el.classList.contains('is-invalid'));
    let btnDisabled = await page.$eval('#btn-change-password', b => b.disabled);
    console.log(`Mismatch state: error visible=${isErrorVisible}, is-invalid=${isInvalidClass}, button disabled=${btnDisabled}`);
    if (!isErrorVisible || !isInvalidClass || !btnDisabled) {
      throw new Error('Mismatch alert did not show or button was not disabled!');
    }

    // Match confirm password
    await page.evaluate(() => {
      const el = document.querySelector('#s-pw-confirm');
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.type('#s-pw-confirm', 'StrongPass123!');

    // Enter current password
    await page.evaluate(() => {
      const el = document.querySelector('#s-pw-current');
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.type('#s-pw-current', 'CurrentPass123!');
    await new Promise(r => setTimeout(r, 300));

    const confirmVal = await page.$eval('#s-pw-confirm', el => el.value);
    const newVal = await page.$eval('#s-pw-new', el => el.value);
    const currVal = await page.$eval('#s-pw-current', el => el.value);
    console.log(`Debug values: current="${currVal}", new="${newVal}", confirm="${confirmVal}"`);

    isErrorVisible = await page.$eval('#s-pw-confirm-error', el => el.style.display !== 'none');
    btnDisabled = await page.$eval('#btn-change-password', b => b.disabled);
    console.log(`Matching state: error visible=${isErrorVisible}, button disabled=${btnDisabled} (expected false)`);
    if (isErrorVisible || btnDisabled) {
      throw new Error('Valid matching form did not enable "Đổi mật khẩu" button!');
    }

    // 7. Click change password
    console.log('7. Testing submit change password...');
    await page.click('#btn-change-password');
    await new Promise(r => setTimeout(r, 500));

    const toast = await page.$eval('.toast-container .toast', el => el.textContent);
    console.log(`Toast message: "${toast}"`);

    // Verify fields reset
    const newPwVal = await page.$eval('#s-pw-new', el => el.value);
    console.log(`Form reset after change: pw field value = "${newPwVal}" (expected empty)`);

    // 8. Test Sessions list & revocation
    console.log('8. Testing Sessions list & revocation...');
    const sessionCountBefore = await page.$$eval('.settings-session-row', rows => rows.length);
    console.log(`Initial session count: ${sessionCountBefore}`);

    await page.click('[data-action="revoke-all"]');
    await new Promise(r => setTimeout(r, 500));

    const sessionCountAfter = await page.$$eval('.settings-session-row', rows => rows.length);
    console.log(`After revoke all: session count = ${sessionCountAfter} (expected 1 current session)`);

    // 9. Test Mobile Responsive Viewport (360px)
    console.log('9. Testing 360px mobile layout...');
    await page.setViewport({ width: 360, height: 640 });
    await new Promise(r => setTimeout(r, 500));

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    console.log(`360px viewport: windowWidth=${windowWidth}, bodyScrollWidth=${bodyScrollWidth}`);
    if (bodyScrollWidth > windowWidth) {
      throw new Error(`Horizontal scroll detected at 360px: scrollWidth ${bodyScrollWidth} > innerWidth ${windowWidth}`);
    }

    // 10. Test Auth Login Page password toggle
    console.log('10. Testing Auth Login Page password toggle...');
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(async () => {
      const { navigateTo } = await import('./src/router.js');
      navigateTo('login');
    });
    await new Promise(r => setTimeout(r, 800));

    const loginToggle = await page.waitForSelector('[data-pw-toggle="login-password"]', { timeout: 5000 });
    if (!loginToggle) {
      throw new Error('Missing toggle on login page!');
    }

    let loginPwType = await page.$eval('#login-password', el => el.type);
    console.log(`Login initial type: ${loginPwType}`);

    await page.evaluate(() => {
      const btn = document.querySelector('[data-pw-toggle="login-password"]');
      if (btn) btn.scrollIntoView();
    });
    await page.click('[data-pw-toggle="login-password"]');
    await new Promise(r => setTimeout(r, 200));

    loginPwType = await page.$eval('#login-password', el => el.type);
    console.log(`Login type after toggle click: ${loginPwType} (expected text)`);
    if (loginPwType !== 'text') {
      throw new Error('Login password toggle failed to toggle to text!');
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (e) {
    console.error('❌ Test failed:', e);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
