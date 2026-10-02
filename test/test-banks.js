/**
 * @file Unit tests for bank avatar resolver.
 * Tests matching, accents, word boundaries, and deterministic hash fallback.
 */

import { getBankAvatarInfo, getBankAvatarHtml, removeDiacritics, toBankInitial, BANK_DEFINITIONS } from '../src/constants/banks.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n--- Running Bank Avatar Resolver Tests ---\n');

// 1. Mock account names matching
const vcb = getBankAvatarInfo('Vietcombank – Thanh toán');
assert(vcb.initial === 'VCB' && vcb.bg === '#005B38', `Vietcombank – Thanh toán resolves to VCB (#005B38), got ${vcb.initial} (${vcb.bg})`);

const tcb = getBankAvatarInfo('Techcombank – Tiết kiệm');
assert(tcb.initial === 'TCB' && tcb.bg === '#D62828', `Techcombank – Tiết kiệm resolves to TCB (#D62828), got ${tcb.initial} (${tcb.bg})`);

// 2. Exact and variations of bank names
const mb1 = getBankAvatarInfo('MB Bank');
assert(mb1.initial === 'MB' && mb1.bg === '#002B7F', `MB Bank resolves to MB (#002B7F), got ${mb1.initial} (${mb1.bg})`);

const mb2 = getBankAvatarInfo('Tài khoản MB cá nhân');
assert(mb2.initial === 'MB' && mb2.bg === '#002B7F', `Tài khoản MB cá nhân resolves to MB, got ${mb2.initial}`);

const acb = getBankAvatarInfo('Ngân hàng Á Châu (ACB)');
assert(acb.initial === 'ACB' && acb.bg === '#005BAB', `Ngân hàng Á Châu (ACB) resolves to ACB, got ${acb.initial}`);

const vib = getBankAvatarInfo('VIB Online Plus');
assert(vib.initial === 'VIB' && vib.bg === '#0066B2', `VIB Online Plus resolves to VIB, got ${vib.initial}`);

const bidv = getBankAvatarInfo('BIDV SmartBanking');
assert(bidv.initial === 'BIDV' && bidv.bg === '#00685E', `BIDV SmartBanking resolves to BIDV, got ${bidv.initial}`);

const ctg = getBankAvatarInfo('VietinBank iPay');
assert(ctg.initial === 'CTG' && ctg.bg === '#0055A5', `VietinBank iPay resolves to CTG, got ${ctg.initial}`);

const agri = getBankAvatarInfo('Agribank Nông Nghiệp');
assert(agri.initial === 'VBA' && agri.bg === '#800000', `Agribank Nông Nghiệp resolves to VBA, got ${agri.initial}`);

const stb = getBankAvatarInfo('Sacombank Pay');
assert(stb.initial === 'STB' && stb.bg === '#00529C', `Sacombank Pay resolves to STB, got ${stb.initial}`);

const vpb = getBankAvatarInfo('VPBank NEO');
assert(vpb.initial === 'VPB' && vpb.bg === '#00B050', `VPBank NEO resolves to VPB, got ${vpb.initial}`);

const tpb = getBankAvatarInfo('TPBank LiveBank');
assert(tpb.initial === 'TPB' && tpb.bg === '#7B2CBF', `TPBank LiveBank resolves to TPB, got ${tpb.initial}`);

const hdb = getBankAvatarInfo('HDBank M-Banking');
assert(hdb.initial === 'HDB' && hdb.bg === '#E41E26', `HDBank M-Banking resolves to HDB, got ${hdb.initial}`);

// 3. Wallets and Cash
const momo = getBankAvatarInfo('Ví MoMo thanh toán');
assert(momo.initial === 'MOMO' && momo.bg === '#A50064', `Ví MoMo resolves to MOMO (#A50064), got ${momo.initial} (${momo.bg})`);

const zalo = getBankAvatarInfo('Ví ZaloPay');
assert(zalo.initial === 'ZLP' && zalo.bg === '#0068FF', `Ví ZaloPay resolves to ZLP (#0068FF), got ${zalo.initial} (${zalo.bg})`);

const shopee = getBankAvatarInfo('ShopeePay');
assert(shopee.initial === 'SPP' && shopee.bg === '#EE4D2D', `ShopeePay resolves to SPP (#EE4D2D), got ${shopee.initial} (${shopee.bg})`);

const cash = getBankAvatarInfo('Tiền mặt trong ví');
assert(cash.initial === 'TM' && cash.bg === '#16A34A', `Tiền mặt trong ví resolves to TM (#16A34A), got ${cash.initial} (${cash.bg})`);

// 4. Word boundary test: avoid false positive short matching
const notVib = getBankAvatarInfo('Vibration Sensor Fund');
assert(notVib.initial !== 'VIB', `Vibration Sensor Fund does not false-match VIB, got ${notVib.initial}`);

const notAcb = getBankAvatarInfo('Action Camera Budget');
assert(notAcb.initial !== 'ACB', `Action Camera Budget does not false-match ACB, got ${notAcb.initial}`);

// 5. Deterministic fallback for custom/unknown accounts
const custom1 = getBankAvatarInfo('Revolut Personal');
const custom2 = getBankAvatarInfo('Revolut Personal');
assert(custom1.initial === 'RP', `Revolut Personal initial is RP, got ${custom1.initial}`);
assert(custom1.bg === custom2.bg, `Deterministic hash produces consistent color: ${custom1.bg}`);
assert(custom1.bg !== '#64748b' && custom1.bg !== '#64748B', `Deterministic fallback is not generic gray, got ${custom1.bg}`);

// 6. getBankAvatarHtml generation
const htmlSm = getBankAvatarHtml('MB Bank', 'sm', 'custom-class');
assert(htmlSm.includes('account-avatar-sm') && htmlSm.includes('custom-class') && htmlSm.includes('MB'), `getBankAvatarHtml renders valid HTML: ${htmlSm}`);

const htmlMd = getBankAvatarHtml('Techcombank', 'md');
assert(htmlMd.includes('account-avatar-md') && htmlMd.includes('TCB'), `getBankAvatarHtml with size md renders correctly: ${htmlMd}`);

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
