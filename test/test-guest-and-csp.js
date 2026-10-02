/**
 * Test Guest Mode flow & CSP security headers
 * Run: node test/test-guest-and-csp.js
 */
import puppeteer from 'puppeteer';
import http from 'http';

function checkHttpHeaders() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/', (res) => {
      resolve({
        status: res.statusCode,
        headers: res.headers,
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('========================================');
  console.log('🧪 Testing CSP Security Headers & Guest Mode');
  console.log('========================================\n');

  // 1. Verify HTTP Response Headers
  console.log('--- 1. Testing HTTP Security Headers ---');
  const httpRes = await checkHttpHeaders();
  console.log('HTTP Status:', httpRes.status);

  const csp = httpRes.headers['content-security-policy'];
  if (!csp) {
    throw new Error('❌ Missing Content-Security-Policy HTTP header');
  }
  console.log('✅ Content-Security-Policy present');

  const xfo = httpRes.headers['x-frame-options'];
  if (xfo !== 'DENY') {
    throw new Error(`❌ Expected X-Frame-Options: DENY, got: ${xfo}`);
  }
  console.log('✅ X-Frame-Options: DENY present');

  const xcto = httpRes.headers['x-content-type-options'];
  if (xcto !== 'nosniff') {
    throw new Error(`❌ Expected X-Content-Type-Options: nosniff, got: ${xcto}`);
  }
  console.log('✅ X-Content-Type-Options: nosniff present');

  const rp = httpRes.headers['referrer-policy'];
  if (!rp) {
    throw new Error('❌ Missing Referrer-Policy header');
  }
  console.log('✅ Referrer-Policy present');

  // 2. Browser Puppeteer Test
  console.log('\n--- 2. Testing Guest Mode Flow & Browser CSP ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('[Console error] ' + msg.text());
    }
  });
  page.on('pageerror', err => errors.push('[Page error] ' + err.message));

  // Navigate to app and sign out to test Login view and Guest Mode
  console.log('→ Loading http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 600));

  console.log('→ Navigating to #login screen...');
  await page.evaluate(async () => {
    const { signOut } = await import('./src/services/authService.js');
    const { navigateTo } = await import('./src/router.js');
    await signOut();
    navigateTo('login');
  });
  await new Promise(r => setTimeout(r, 600));

  // Check CSP meta tag in HTML
  const hasMetaCsp = await page.evaluate(() => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return !!meta && meta.content.includes('default-src');
  });
  if (!hasMetaCsp) {
    throw new Error('❌ Missing CSP meta tag in document head');
  }
  console.log('✅ Document head contains valid Content-Security-Policy meta tag');

  // Check Guest Button presence
  const guestBtn = await page.$('#btn-guest-mode');
  if (!guestBtn) {
    throw new Error('❌ #btn-guest-mode button not found in Login view');
  }
  console.log('✅ #btn-guest-mode button rendered in Login view');

  const guestBtnText = await page.$eval('#btn-guest-mode .btn-text', el => el.textContent.trim());
  console.log(`  Button label: "${guestBtnText}"`);

  const hasSvg = await page.$eval('#btn-guest-mode svg', el => !!el);
  console.log('✅ Guest button has accessible SVG icon:', hasSvg);

  // Click Guest Mode Button
  console.log('→ Clicking #btn-guest-mode (Continue as Guest)...');
  await page.click('#btn-guest-mode');
  await new Promise(r => setTimeout(r, 1200));

  // Check navigation to dashboard
  const currentHash = await page.evaluate(() => window.location.hash);
  console.log('  Current URL hash:', currentHash);
  if (currentHash !== '#dashboard') {
    throw new Error(`❌ Expected redirect to #dashboard, got: ${currentHash}`);
  }
  console.log('✅ Successfully navigated to #dashboard');

  // Verify dashboard content is visible
  const hasKpiGrid = await page.$('#kpi-grid') !== null;
  if (!hasKpiGrid) {
    throw new Error('❌ Dashboard KPI grid missing after Guest login');
  }
  console.log('✅ Dashboard KPI grid loaded in Guest session');

  const hasSpendingChart = await page.$('#spending-chart-container') !== null;
  console.log(hasSpendingChart ? '✅ Spending chart visible' : '❌ Spending chart missing');

  const hasRecentTx = await page.$('#recent-tx-tbody') !== null;
  console.log(hasRecentTx ? '✅ Recent transactions table visible' : '❌ Recent transactions table missing');

  // Check for console errors or CSP violations
  const cspViolations = errors.filter(e => e.includes('Content Security Policy') || e.includes('refused to'));
  if (cspViolations.length > 0) {
    console.error('❌ CSP Violations detected:', cspViolations);
    throw new Error('CSP violations found');
  }
  console.log('✅ Zero CSP violations detected');

  await browser.close();

  console.log('\n========================================');
  console.log('🎉 ALL GUEST MODE & CSP TESTS PASSED!');
  console.log('========================================');
})();
