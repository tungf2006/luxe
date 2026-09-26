/**
 * Typography / Vietnamese-diactritic verification test for Luxe.
 * Requires the dev server running on :3000 (node server.js).
 *
 * Google Fonts CSS2 with `&subset=vietnamese` implements the Vietnamese
 * subset via FILE-LEVEL subsetting: each weight yields a single .ttf that
 * contains only the Vietnamese glyph set, and `font-display: swap` is emitted.
 * It does NOT emit `unicode-range` descriptors (those appear only for multi-
 * subset requests). The `subset=vietnamese` URL param is therefore the scoping
 * signal, and a glyph-level width check confirms the glyphs live in the font.
 */
const puppeteer = require('puppeteer');

const URL = 'http://localhost:3000';
const RESULTS = [];

function check(name, ok, detail) {
  RESULTS.push({ name, ok, detail });
  console.log(`${ok ? '\u2705' : '\u274c'} ${name}${detail ? ' \u2014 ' + detail : ''}`);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  let fontUrl = null;
  page.on('request', (req) => {
    const u = req.url();
    if (!fontUrl && u.includes('fonts.googleapis.com/css2') && u.includes('subset=vietnamese')) {
      fontUrl = u;
    }
  });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    // Authoritatively fetch the Google Fonts CSS text via a dedicated page.
    let fontCssText = '';
    if (fontUrl) {
      const cssPage = await browser.newPage();
      const resp = await cssPage.goto(fontUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      fontCssText = await resp.text();
      await cssPage.close();
      console.log(`[debug] fontCssText length=${fontCssText.length}`);
    }

    // Req 1 — proper Vietnamese-subset font loading.
    check(
      'R1.1 URL requests Vietnamese subset + swap + Be Vietnam Pro',
      !!(fontUrl &&
        fontUrl.includes('subset=vietnamese') &&
        fontUrl.includes('display=swap') &&
        fontUrl.includes('family=Be+Vietnam+Pro')),
      fontUrl || '(no font request captured)'
    );
    check('R1.2 @font-face uses font-display: swap', /font-display\s*:\s*swap/.test(fontCssText));
    check(
      'R1.3 @font-face emits unicode-range covering Vietnamese glyphs (+ woff2 src)',
      fontCssText.includes('unicode-range') &&
        fontCssText.includes('U+0102-0103') &&
        fontCssText.includes('U+0300') &&
        fontCssText.includes('U+1EA0-1EF9') &&
        /src:\s*url\([^)]+\)\s*format\(['"]woff2['"]\)/.test(fontCssText),
      fontCssText
        ? `ranges ok (${fontCssText.length} chars)`
        : '(css not retrieved)'
    );

    // R1.4 glyph-level proof: Vietnamese glyphs render in Be Vietnam Pro, not a fallback.
    // Compare canvas measureText width with the web font family list vs a pure fallback.
    const proof = await page.evaluate(async () => {
      try { await document.fonts.ready; } catch (e) {}
      await new Promise((r) => setTimeout(r, 600));
      const s = 'Ng\u00e2n s\u1ecbch \u0111\u01b0\u1ee3c qu\u1ea3n l\u00fd \u0111\u1eb9p m\u1eaft \u2014 T\u1ed7 l\u1ec7 ti\u1ebf\u1ea1t ki\u1ec7m \u0111\u1ea1t 66,9%';
      const mk = (fam) => {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        ctx.font = '400 48px ' + fam;
        return ctx.measureText(s).width;
      };
      const wBVP = mk('"Be Vietnam Pro", "Inter", sans-serif');
      const wInter = mk('"Inter", sans-serif');
      return { wBVP: Math.round(wBVP), wInter: Math.round(wInter) };
    });
    check(
      'R1.4 Vietnamese glyphs render in Be Vietnam Pro (not fallback)',
      Math.abs(proof.wBVP - proof.wInter) > 3,
      `BVP=${proof.wBVP} Inter=${proof.wInter} diff=${Math.round(Math.abs(proof.wBVP - proof.wInter))}`
    );

    const readHeading = (sel) =>
      page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          family: cs.fontFamily,
          fs: parseFloat(cs.fontSize),
          lh: parseFloat(cs.lineHeight),
          pt: parseFloat(cs.paddingTop),
        };
      }, sel);

    const hero = await readHeading('.hero-headline');
    const panel = await readHeading('.panel-title');

    // Req 2 & 3 — scale applied to real headings (no scattered font-size overrides).
    const ratioOk = (label, el) => {
      if (!el) {
        check(`${label}: element found`, false, 'not in DOM');
        return false;
      }
      check(`${label} font-family includes Be Vietnam Pro`, /Be Vietnam Pro/.test(el.family), el.family);
      check(
        `${label} line-height >= 1.25 \u00d7 font-size`,
        el.lh >= el.fs * 1.25,
        `lh=${el.lh.toFixed(1)} vs fs=${el.fs.toFixed(1)} (req>=${(el.fs * 1.25).toFixed(1)})`
      );
      return /Be Vietnam Pro/.test(el.family) && el.lh >= el.fs * 1.25;
    };

    const okHero = ratioOk('hero-headline', hero);
    if (okHero && hero) {
      check('R2 hero-headline padding-top > 0 (clip-text diacritic safety)', hero.pt > 0, `pt=${hero.pt.toFixed(3)}em`);
    }
    ratioOk('panel-title', panel);

    // page-header-title lives on subpages — navigate to Budgets.
    const navBudgets = await page.$('#nav-budgets');
    if (navBudgets) {
      await Promise.all([page.click('#nav-budgets'), new Promise((r) => setTimeout(r, 1200))]);
    }
    const pageTitle = await readHeading('.page-header-title');
    ratioOk('page-header-title', pageTitle);

    // Req 4 — inject the target test string into a .hero-headline and assert it
    // renders with the web font at the correct line-height. Snapshot computed
    // values into locals BEFORE detaching the element (computed style is live).
    const injected = await page.evaluate(() => {
      const el = document.createElement('h1');
      el.className = 'hero-headline';
      el.style.cssText = 'position:fixed;top:-9999px;left:0;';
      el.textContent =
        'Ng\u00e2n s\u1ecbch \u0111\u01b0\u1ee3c qu\u1ea3n l\u00fd \u0111\u1eb9p m\u1eaft \u2014 T\u1ed7 l\u1ec7 ti\u1ebfu\u1ea1t ki\u1ec7m \u0111\u1ea1t 66,9%';
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      // Snapshot before detach — getComputedStyle is a LIVE reference.
      const family = cs.fontFamily;
      const fs = parseFloat(cs.fontSize);
      const lh = parseFloat(cs.lineHeight);
      const ok = /Be Vietnam Pro/.test(family) && lh >= fs * 1.25;
      document.body.removeChild(el);
      return { family, fs, lh, ok };
    });
    check(
      'R4 injected test string renders with Be Vietnam Pro + line-height >=1.25',
      injected ? injected.ok : false,
      injected
        ? `family=${JSON.stringify(injected.family)} lh=${injected.lh.toFixed(1)} fs=${injected.fs.toFixed(1)}`
        : 'not returned'
    );

    const pass = RESULTS.reduce((n, r) => n + (r.ok ? 1 : 0), 0);
    console.log(`\n=== ${pass}/${RESULTS.length} assertions passed ===`);
    process.exit(pass === RESULTS.length ? 0 : 1);
  } catch (e) {
    console.error('\u274c Test error:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
