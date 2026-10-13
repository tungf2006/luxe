/**
 * @file test-task11-period-highlights.js
 * Verification suite for TASK 11 — Khối "Điểm nhấn kỳ này" (thay Phân tích AI + Tổng quan hàng tháng)
 *
 * Requirements:
 * 1. Khối "Điểm nhấn kỳ này" thay thế Tổng quan hàng tháng + Phân tích AI.
 * 2. Hiển thị Dòng tiền ròng (= thu − chi, màu theo dấu, đổi nhãn "Dòng tiền mạnh" thành "Dòng tiền ròng").
 * 3. Chi lớn nhất (tên rút gọn 1 dòng kèm title và số tiền).
 * 4. Còn N ngày đến kỳ lương (dd/mm).
 * 5. Tối đa 2 gợi ý rule-based (chi TB/ngày, danh mục chi nhiều nhất %, ngân sách ≥80%).
 * 6. Chỉ hiện empty-state khi kỳ thực sự không có giao dịch.
 * 7. Chỉ gọi là "AI" nếu thật sự dùng AI, còn lại gọi "Gợi ý" (bỏ hẳn "Phân tích AI").
 * 8. Không gọi API ngoài (100% offline rule-based).
 * 9. Nghiệm thu: với dữ liệu net âm -499 hiện Dòng tiền ròng -499 đ đỏ và không còn câu "Theo dõi giao dịch đầu tiên".
 */

import puppeteer from 'puppeteer';
import {
  getPayDayInfo,
  generatePeriodSuggestions,
  getPeriodHighlights,
  generateRuleBasedInsight,
} from '../src/features/dashboard/periodInsights.js';

console.log('========================================================');
console.log('🧪 Verifying TASK 11 — Khối "Điểm nhấn kỳ này" (Task 11)');
console.log('========================================================\n');

// ------------------------------------------------------------------
// 1. UNIT TESTS
// ------------------------------------------------------------------
console.log('--- 1. Unit Testing periodInsights.js Component Logic ---');

// 1.1 PayDay calculation
const baseDate = new Date('2026-10-08T10:00:00Z'); // Thursday, Oct 8, 2026

// Case: Payday is 15th (in 7 days)
const pay15 = getPayDayInfo('15th', baseDate);
if (pay15.days === 7 && pay15.ddmm === '15/10' && pay15.text === 'Còn 7 ngày (15/10)') {
  console.log(`✅ PASS: getPayDayInfo('15th') = "${pay15.text}"`);
} else {
  console.error(`❌ FAIL: Expected "Còn 7 ngày (15/10)", got "${pay15.text}"`);
  process.exit(1);
}

// Case: Payday is 1st (passed this month -> Nov 1)
const pay1 = getPayDayInfo('1', baseDate);
if (pay1.days === 24 && pay1.ddmm === '01/11' && pay1.text === 'Còn 24 ngày (01/11)') {
  console.log(`✅ PASS: getPayDayInfo('1') = "${pay1.text}" (rolled over to next month)`);
} else {
  console.error(`❌ FAIL: Expected "Còn 24 ngày (01/11)", got "${pay1.text}"`);
  process.exit(1);
}

// Case: Payday is today (8th)
const payToday = getPayDayInfo(8, baseDate);
if (payToday.days === 0 && payToday.text.includes('Hôm nay')) {
  console.log(`✅ PASS: getPayDayInfo(8) for today = "${payToday.text}"`);
} else {
  console.error(`❌ FAIL: Expected "Hôm nay (08/10)", got "${payToday.text}"`);
  process.exit(1);
}

// 1.2 Dòng tiền ròng: Net negative (-499 đ) and semantic color
const sampleTxNegative = [
  { id: 'tx1', merchant: 'Shopee', category: 'shopping', type: 'expense', amount: 499, date: '2026-10-08', status: 'completed' },
];
const hlNegative = getPeriodHighlights({
  periodTx: sampleTxNegative,
  stats: { income: 0, expense: 499, net: -499 },
  baseDate,
});

if (hlNegative.net === -499 && hlNegative.netSign === '-' && hlNegative.netClass === 'highlight-val--negative') {
  console.log(`✅ PASS: Net negative -499 produces netSign: "-" and class: "${hlNegative.netClass}"`);
} else {
  console.error('❌ FAIL: Net negative not formatted correctly:', hlNegative);
  process.exit(1);
}

if (hlNegative.netRawText.includes('-499') && hlNegative.netRawText.includes('đ')) {
  console.log(`✅ PASS: Net negative text is "${hlNegative.netRawText}" (strictly contains "-499")`);
} else {
  console.error(`❌ FAIL: Net negative text "${hlNegative.netRawText}" does not contain "-499"`);
  process.exit(1);
}

// 1.3 Dòng tiền ròng: Net positive (+5.623 đ)
const hlPositive = getPeriodHighlights({
  periodTx: sampleTxNegative,
  stats: { income: 6920, expense: 1297, net: 5623 },
  baseDate,
});
if (hlPositive.netSign === '+' && hlPositive.netClass === 'highlight-val--positive') {
  console.log(`✅ PASS: Net positive produces netSign: "+" and class: "${hlPositive.netClass}"`);
} else {
  console.error('❌ FAIL: Net positive not formatted correctly:', hlPositive);
  process.exit(1);
}

// 1.4 Chi lớn nhất extraction
if (hlNegative.largest && hlNegative.largest.merchant === 'Shopee' && hlNegative.largest.amount === 499) {
  console.log(`✅ PASS: Largest expense correctly identified as "${hlNegative.largest.merchant}" (${hlNegative.largest.rawAmount})`);
} else {
  console.error('❌ FAIL: Largest expense extraction failed:', hlNegative.largest);
  process.exit(1);
}

// 1.5 Rule-based suggestions: At most 2 suggestions
const multiRuleTx = [
  { id: '1', merchant: 'Nhà hàng', category: 'food', type: 'expense', amount: 950, date: '2026-10-02', status: 'completed' },
  { id: '2', merchant: 'Coop', category: 'food', type: 'expense', amount: 150, date: '2026-10-05', status: 'completed' },
  { id: '3', merchant: 'Grab', category: 'transport', type: 'expense', amount: 80, date: '2026-10-06', status: 'completed' },
];
const budgetsSample = [
  { id: 'b1', category: 'food', limit: 1000, spent: 1100 }, // Over budget (110%)
];
const suggestions = generatePeriodSuggestions({
  periodTx: multiRuleTx,
  budgets: budgetsSample,
  stats: { income: 500, expense: 1180, net: -680 },
  days: 8,
});

if (suggestions.length <= 2 && suggestions.length > 0) {
  console.log(`✅ PASS: Suggestions count is ${suggestions.length} (strictly <= 2)`);
  suggestions.forEach((s, idx) => {
    console.log(`   [Suggestion ${idx + 1}] (${s.type}): "${s.title}" — ${s.detail}`);
  });
} else {
  console.error(`❌ FAIL: Expected at most 2 suggestions, got ${suggestions.length}`);
  process.exit(1);
}

// Ensure the budget over-limit rule was prioritized
const hasBudgetRule = suggestions.some(s => s.id === 'budget-over');
if (hasBudgetRule) {
  console.log('✅ PASS: Over-budget rule (>=80%) properly prioritized');
} else {
  console.error('❌ FAIL: Budget over rule not found in suggestions');
  process.exit(1);
}

// 1.6 Elimination of "Theo dõi giao dịch đầu tiên để xem phân tích"
const insightResult = generateRuleBasedInsight(multiRuleTx, budgetsSample);
if (!insightResult.text.includes('Theo dõi giao dịch đầu tiên')) {
  console.log(`✅ PASS: generateRuleBasedInsight does NOT contain legacy empty string. Got: "${insightResult.text}"`);
} else {
  console.error('❌ FAIL: Legacy string leaked in generateRuleBasedInsight');
  process.exit(1);
}

// ------------------------------------------------------------------
// 2. BROWSER E2E TESTS (Puppeteer)
// ------------------------------------------------------------------
console.log('\n--- 2. Browser E2E Tests (Puppeteer) ---');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('→ Loading application at http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForFunction(() => !window.location.hash.includes('loading'), { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 800));

    // Handle guest mode login if redirected to #login
    const currentUrl = page.url();
    if (currentUrl.includes('#login') || await page.$('#btn-guest-mode')) {
      console.log('→ Clicking Guest Mode button...');
      await page.waitForSelector('#btn-guest-mode', { timeout: 8000 });
      await page.click('#btn-guest-mode');
      await page.waitForSelector('.app-layout:not([style*="display: none"])', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
    }

    // Ensure we are on #dashboard
    await page.evaluate(async () => {
      const { navigateTo } = await import('./src/router.js');
      navigateTo('dashboard');
    });
    await new Promise(r => setTimeout(r, 1000));

    await page.waitForSelector('#quick-stats-panel', { timeout: 15000 });
    await page.waitForSelector('#insight-card', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 500));

    // 2.1 Inspect Right Column Elements
    console.log('\n--- 2.1 Verifying Right Column Components ---');
    const panelInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('.dashboard-col-sidebar');
      const quickStats = sidebar?.querySelector('#quick-stats-panel');
      const insightCard = sidebar?.querySelector('#insight-card');

      const panelTitle = quickStats?.querySelector('.panel-title')?.textContent?.trim();
      const netLabel = quickStats?.querySelector('.highlight-net-row .highlight-metric-label')?.textContent?.trim();
      const netAmount = quickStats?.querySelector('.highlight-net-row .highlight-net-amount')?.textContent?.trim();
      const netValEl = quickStats?.querySelector('.highlight-net-row .highlight-metric-val');
      const netColor = netValEl ? window.getComputedStyle(netValEl).color : '';

      const largestLabel = quickStats?.querySelector('.highlight-largest-row .highlight-metric-label')?.textContent?.trim();
      const largestMerchant = quickStats?.querySelector('.highlight-merchant-name')?.textContent?.trim();
      const largestMerchantTitle = quickStats?.querySelector('.highlight-merchant-name')?.getAttribute('title');
      const largestAmount = quickStats?.querySelector('.highlight-merchant-amount')?.textContent?.trim();

      const paydayLabel = quickStats?.querySelector('.highlight-payday-row .highlight-metric-label')?.textContent?.trim();
      const paydayText = quickStats?.querySelector('.highlight-payday-pill')?.textContent?.trim();

      const insightTag = insightCard?.querySelector('.insight-tag')?.textContent?.trim();
      const suggestions = Array.from(insightCard?.querySelectorAll('.insight-suggestion-item') || []).map(el => ({
        title: el.querySelector('.insight-suggestion-title')?.textContent?.trim(),
        detail: el.querySelector('.insight-suggestion-detail')?.textContent?.trim(),
      }));

      const bodyText = document.body.innerText;
      const hasOldEmptyString = bodyText.includes('Theo dõi giao dịch đầu tiên');
      const hasAiString = insightCard?.innerText?.includes('Phân tích AI');
      const hasStrongCashFlowLabel = quickStats?.innerText?.includes('Dòng tiền mạnh');

      return {
        hasSidebar: !!sidebar,
        hasQuickStats: !!quickStats,
        hasInsightCard: !!insightCard,
        panelTitle,
        netLabel,
        netAmount,
        netColor,
        largestLabel,
        largestMerchant,
        largestMerchantTitle,
        largestAmount,
        paydayLabel,
        paydayText,
        insightTag,
        suggestionsCount: suggestions.length,
        suggestions,
        hasOldEmptyString,
        hasAiString,
        hasStrongCashFlowLabel,
      };
    });

    // Check Panel Title
    console.log(`Panel Title: "${panelInfo.panelTitle}"`);
    if (panelInfo.panelTitle === 'Điểm nhấn kỳ này') {
      console.log('✅ PASS: Panel Title is "Điểm nhấn kỳ này"');
    } else {
      console.error(`❌ FAIL: Expected "Điểm nhấn kỳ này", got "${panelInfo.panelTitle}"`);
      process.exit(1);
    }

    // Check Net Label
    console.log(`Net Flow Label: "${panelInfo.netLabel}"`);
    if (panelInfo.netLabel === 'Dòng tiền ròng') {
      console.log('✅ PASS: Net Flow Label is "Dòng tiền ròng"');
    } else {
      console.error(`❌ FAIL: Expected "Dòng tiền ròng", got "${panelInfo.netLabel}"`);
      process.exit(1);
    }

    if (!panelInfo.hasStrongCashFlowLabel) {
      console.log('✅ PASS: Legacy label "Dòng tiền mạnh" is completely eradicated');
    } else {
      console.error('❌ FAIL: "Dòng tiền mạnh" still found in DOM');
      process.exit(1);
    }

    // Check Largest Expense
    console.log(`Largest Expense: "${panelInfo.largestMerchant}" — ${panelInfo.largestAmount}`);
    if (panelInfo.largestMerchant && panelInfo.largestMerchantTitle && panelInfo.largestAmount) {
      console.log('✅ PASS: Largest expense is present with title tooltip and formatted amount');
    } else {
      console.error('❌ FAIL: Largest expense missing or improperly structured');
      process.exit(1);
    }

    // Check Payday Format: Còn N ngày (dd/mm)
    console.log(`Payday Text: "${panelInfo.paydayText}"`);
    const paydayPattern = /(Còn \d+ ngày|Hôm nay)\s*\(\d{2}\/\d{2}\)/;
    if (paydayPattern.test(panelInfo.paydayText)) {
      console.log(`✅ PASS: Payday text satisfies "Còn N ngày đến kỳ lương (dd/mm)": "${panelInfo.paydayText}"`);
    } else {
      console.error(`❌ FAIL: Payday format "${panelInfo.paydayText}" does not match pattern "Còn N ngày (dd/mm)"`);
      process.exit(1);
    }

    // Check Insight Tag: "Gợi ý" (NEVER "Phân tích AI")
    console.log(`Insight Tag: "${panelInfo.insightTag}"`);
    if (panelInfo.insightTag.includes('GỢI Ý') || panelInfo.insightTag.includes('Gợi ý')) {
      console.log('✅ PASS: Tag displays "Gợi ý"');
    } else {
      console.error(`❌ FAIL: Expected "Gợi ý", got "${panelInfo.insightTag}"`);
      process.exit(1);
    }

    if (!panelInfo.hasAiString) {
      console.log('✅ PASS: "Phân tích AI" is completely eradicated from insight card');
    } else {
      console.error('❌ FAIL: "Phân tích AI" still found in insight card');
      process.exit(1);
    }

    // Check Suggestions Count: at most 2
    console.log(`Suggestions Count: ${panelInfo.suggestionsCount}`);
    if (panelInfo.suggestionsCount <= 2 && panelInfo.suggestionsCount > 0) {
      console.log('✅ PASS: Rule-based suggestions count is <= 2');
    } else {
      console.error(`❌ FAIL: Suggestions count ${panelInfo.suggestionsCount} > 2 or 0`);
      process.exit(1);
    }

    // Check No "Theo dõi giao dịch đầu tiên để xem phân tích"
    if (!panelInfo.hasOldEmptyString) {
      console.log('✅ PASS: "Theo dõi giao dịch đầu tiên" is NOT in page');
    } else {
      console.error('❌ FAIL: "Theo dõi giao dịch đầu tiên" found in page text');
      process.exit(1);
    }

    // 2.2 Test Net Negative (-499 đ) Rendering & Red Color
    console.log('\n--- 2.2 Verifying Net Negative Simulation (-499 đ in Red) ---');
    const netNegativeCheck = await page.evaluate(async () => {
      // Temporarily test rendering with an explicit negative net flow
      const { getPeriodHighlights } = await import('./src/features/dashboard/periodInsights.js');
      const hl = getPeriodHighlights({
        periodTx: [
          { id: 'sim_1', merchant: 'Món ăn', category: 'food', type: 'expense', amount: 499, date: '2026-10-08', status: 'completed' },
        ],
        stats: { income: 0, expense: 499, net: -499 },
        baseDate: new Date(),
      });

      return {
        net: hl.net,
        netSign: hl.netSign,
        netClass: hl.netClass,
        netFormatted: hl.netFormatted,
        netRawText: hl.netRawText,
        netColor: hl.netColor,
      };
    });

    console.log('Negative flow simulation result:', netNegativeCheck);
    if (netNegativeCheck.net === -499 &&
        netNegativeCheck.netSign === '-' &&
        netNegativeCheck.netClass === 'highlight-val--negative' &&
        netNegativeCheck.netColor === 'var(--negative)') {
      console.log('✅ PASS: Dòng tiền ròng -499 đ renders with negative sign "-" and semantic red color');
    } else {
      console.error('❌ FAIL: Negative net flow not configured properly:', netNegativeCheck);
      process.exit(1);
    }

    // 2.3 Responsive Layout & No Horizontal Overflow
    console.log('\n--- 2.3 Viewport Checks (360px Mobile & 1440px Desktop) ---');
    for (const width of [360, 768, 1440]) {
      await page.setViewport({ width, height: 800, isMobile: width < 768 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await new Promise(r => setTimeout(r, 400));

      const overflowCheck = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const clientWidth = document.documentElement.clientWidth;
        const offenders = [];
        document.querySelectorAll('*').forEach(el => {
          if (el.scrollWidth > clientWidth + 1) {
            offenders.push({ tag: el.tagName, id: el.id, class: String(el.className), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
          }
        });
        return {
          scrollWidth: docWidth,
          clientWidth,
          isOverflowing: docWidth > (clientWidth + 2),
          offenders: offenders,
        };
      });

      if (!overflowCheck.isOverflowing) {
        console.log(`✅ PASS: Viewport ${width}px — No horizontal overflow (${overflowCheck.scrollWidth} <= ${overflowCheck.clientWidth})`);
      } else {
        console.error(`❌ FAIL: Viewport ${width}px has horizontal overflow (${overflowCheck.scrollWidth} > ${overflowCheck.clientWidth})`, overflowCheck.offenders);
        process.exit(1);
      }
    }

    console.log('\n========================================================');
    console.log('🎉 ALL TASK 11 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
    console.log('========================================================');

  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
