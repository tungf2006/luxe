import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  try {
    console.log('→ Loading Luxe app...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    console.log('→ Navigating to Budgets via #nav-budgets...');
    await page.click('#nav-budgets');
    await new Promise(r => setTimeout(r, 1000));

    // 1. Check budget cards
    const cards = await page.$$('.budget-overview-card');
    console.log(`✅ Found ${cards.length} budget cards`);

    if (cards.length === 0) {
      throw new Error('No budget cards found on Budgets page!');
    }

    // 2. Check sparkline in each card
    const cardDetails = await page.evaluate(() => {
      const cardEls = document.querySelectorAll('.budget-overview-card');
      return Array.from(cardEls).map(card => {
        const title = card.querySelector('.budget-card-title')?.textContent?.trim();
        const status = card.querySelector('.budget-status-pill')?.textContent?.trim();
        const spent = card.querySelector('.budget-spent-val')?.textContent?.trim();
        const sparkSvg = card.querySelector('svg.budget-sparkline');
        const sparkPolyline = card.querySelector('svg.budget-sparkline polyline');
        const pts = sparkPolyline?.getAttribute('points');
        const pointsCount = card.querySelectorAll('svg.budget-sparkline circle').length;
        const emptyMsg = card.querySelector('.budget-sparkline-empty')?.textContent?.trim();
        const axisText = card.querySelector('.budget-sparkline-axis')?.textContent?.trim();
        const stats = card.querySelector('.budget-stats-grid')?.textContent?.trim();
        const warning = card.querySelector('.budget-insight-warning')?.textContent?.trim();

        return {
          title,
          status,
          spent,
          hasSparkline: Boolean(sparkSvg),
          hasPolyline: Boolean(sparkPolyline),
          pointsStr: pts,
          pointsCount,
          emptyMsg,
          axisText,
          stats,
          warning,
        };
      });
    });

    console.log('\n--- Card Inspection Results ---');
    let allHaveData = true;
    for (const c of cardDetails) {
      console.log(`\nCard: ${c.title}`);
      console.log(`  - Status: ${c.status}`);
      console.log(`  - Spent: ${c.spent}`);
      console.log(`  - Has SVG sparkline: ${c.hasSparkline}`);
      console.log(`  - Has polyline: ${c.hasPolyline}`);
      console.log(`  - Polyline Points: ${c.pointsStr}`);
      console.log(`  - Points count: ${c.pointsCount}`);
      console.log(`  - Axis: ${c.axisText}`);
      console.log(`  - Stats: ${c.stats}`);
      if (c.warning) console.log(`  - Projection warning: ${c.warning}`);
      if (c.emptyMsg) {
        console.log(`  - Note: ${c.emptyMsg}`);
        allHaveData = false;
      }
    }

    if (allHaveData) {
      console.log('\n✅ ALL budget cards have active 7-day sparklines with data!');
    } else {
      console.log('\n⚠️ Some cards have no 7-day data.');
    }

    // 3. Test shifting system date +30 days by injecting date override
    console.log('\n→ Testing dynamic mock date behavior with future date (+30 days)...');
    await page.evaluate(() => {
      // Clear localStorage to simulate fresh visit in the future
      localStorage.clear();
    });

    // Mock Date 30 days ahead on new document
    await page.evaluateOnNewDocument(() => {
      const OriginalDate = Date;
      const shiftMs = 30 * 24 * 60 * 60 * 1000;
      function MockDate(...args) {
        if (args.length === 0) {
          return new OriginalDate(OriginalDate.now() + shiftMs);
        }
        return new OriginalDate(...args);
      }
      MockDate.prototype = OriginalDate.prototype;
      MockDate.now = () => OriginalDate.now() + shiftMs;
      MockDate.parse = OriginalDate.parse;
      MockDate.UTC = OriginalDate.UTC;
      window.Date = MockDate;
    });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await page.click('#nav-budgets');
    await new Promise(r => setTimeout(r, 1000));

    const futureCards = await page.evaluate(() => {
      const cardEls = document.querySelectorAll('.budget-overview-card');
      return Array.from(cardEls).map(card => {
        const title = card.querySelector('.budget-card-title')?.textContent?.trim();
        const polyline = card.querySelector('svg.budget-sparkline polyline');
        return {
          title,
          hasPolyline: Boolean(polyline),
          pts: polyline?.getAttribute('points'),
        };
      });
    });

    console.log('\nFuture Date (+30 days) Results:');
    for (const fc of futureCards) {
      console.log(`  - ${fc.title}: hasPolyline=${fc.hasPolyline}, points=${fc.pts}`);
    }

    const allFutureHaveData = futureCards.length > 0 && futureCards.every(fc => fc.hasPolyline);
    console.log(allFutureHaveData ? '✅ Sparkline works seamlessly +30 days in the future!' : '❌ Future sparkline failed');

    // 4. Check for console.log spam
    const debugLogs = logs.filter(l => l.includes('[sparkline]'));
    console.log(`\nDebug logs count: ${debugLogs.length}`);
    if (debugLogs.length === 0) {
      console.log('✅ No [sparkline] debug logs found.');
    } else {
      console.log('❌ Debug logs still present:', debugLogs);
    }

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
})();
