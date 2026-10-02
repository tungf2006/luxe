/**
 * @file Bank avatar definitions and resolver for account cards, dropdowns, and legends.
 * Provides instant brand recognition with authentic colors, initials, and safe deterministic fallbacks.
 */

import { escapeHtml } from '../utils/format.js';

export const BANK_DEFINITIONS = [
  // 1. Vietcombank
  {
    name: 'Vietcombank',
    keywords: ['vietcombank', 'vcb'],
    initial: 'VCB',
    bg: '#005B38',
    textColor: '#FFFFFF',
  },
  // 2. Techcombank
  {
    name: 'Techcombank',
    keywords: ['techcombank', 'tcb'],
    initial: 'TCB',
    bg: '#D62828',
    textColor: '#FFFFFF',
  },
  // 3. VietinBank
  {
    name: 'VietinBank',
    keywords: ['vietinbank', 'vietin', 'ctg'],
    initial: 'CTG',
    bg: '#0055A5',
    textColor: '#FFFFFF',
  },
  // 4. BIDV
  {
    name: 'BIDV',
    keywords: ['bidv'],
    initial: 'BIDV',
    bg: '#00685E',
    textColor: '#FFFFFF',
  },
  // 5. Agribank
  {
    name: 'Agribank',
    keywords: ['agribank', 'vba'],
    initial: 'VBA',
    bg: '#800000',
    textColor: '#FFFFFF',
  },
  // 6. MB Bank
  {
    name: 'MB Bank',
    keywords: ['mbbank', 'mb bank', 'mb'],
    initial: 'MB',
    bg: '#002B7F',
    textColor: '#FFFFFF',
  },
  // 7. ACB
  {
    name: 'ACB',
    keywords: ['acb', 'a chau'],
    initial: 'ACB',
    bg: '#005BAB',
    textColor: '#FFFFFF',
  },
  // 8. Sacombank
  {
    name: 'Sacombank',
    keywords: ['sacombank', 'stb'],
    initial: 'STB',
    bg: '#00529C',
    textColor: '#FFFFFF',
  },
  // 9. VPBank
  {
    name: 'VPBank',
    keywords: ['vpbank', 'vpb'],
    initial: 'VPB',
    bg: '#00B050',
    textColor: '#FFFFFF',
  },
  // 10. TPBank
  {
    name: 'TPBank',
    keywords: ['tpbank', 'tp bank', 'tpb', 'tien phong'],
    initial: 'TPB',
    bg: '#7B2CBF',
    textColor: '#FFFFFF',
  },
  // 11. VIB
  {
    name: 'VIB',
    keywords: ['vib', 'quoc te'],
    initial: 'VIB',
    bg: '#0066B2',
    textColor: '#FFFFFF',
  },
  // 12. HDBank
  {
    name: 'HDBank',
    keywords: ['hdbank', 'hdb'],
    initial: 'HDB',
    bg: '#E41E26',
    textColor: '#FFFFFF',
  },
  // 13. SHB
  {
    name: 'SHB',
    keywords: ['shb'],
    initial: 'SHB',
    bg: '#F26F21',
    textColor: '#FFFFFF',
  },
  // 14. MSB
  {
    name: 'MSB',
    keywords: ['msb', 'maritime'],
    initial: 'MSB',
    bg: '#EB2227',
    textColor: '#FFFFFF',
  },
  // 15. SeABank
  {
    name: 'SeABank',
    keywords: ['seabank', 'ssb'],
    initial: 'SSB',
    bg: '#DF192A',
    textColor: '#FFFFFF',
  },
  // 16. OCB
  {
    name: 'OCB',
    keywords: ['ocb'],
    initial: 'OCB',
    bg: '#008751',
    textColor: '#FFFFFF',
  },
  // 17. Eximbank
  {
    name: 'Eximbank',
    keywords: ['eximbank', 'eib'],
    initial: 'EIB',
    bg: '#0066B3',
    textColor: '#FFFFFF',
  },
  // 18. LPBank
  {
    name: 'LPBank',
    keywords: ['lpbank', 'lpb', 'lienvietpostbank', 'lienviet'],
    initial: 'LPB',
    bg: '#A71A19',
    textColor: '#FFFFFF',
  },
  // 19. Timo
  {
    name: 'Timo',
    keywords: ['timo'],
    initial: 'TIMO',
    bg: '#673AB7',
    textColor: '#FFFFFF',
  },
  // 20. Cake by VPBank
  {
    name: 'Cake',
    keywords: ['cake'],
    initial: 'CAKE',
    bg: '#FF4275',
    textColor: '#FFFFFF',
  },
  // 21. MoMo
  {
    name: 'MoMo',
    keywords: ['momo', 'vi momo'],
    initial: 'MOMO',
    bg: '#A50064',
    textColor: '#FFFFFF',
  },
  // 22. ZaloPay
  {
    name: 'ZaloPay',
    keywords: ['zalopay', 'zalo pay', 'zalo', 'vi zalo'],
    initial: 'ZLP',
    bg: '#0068FF',
    textColor: '#FFFFFF',
  },
  // 23. ShopeePay
  {
    name: 'ShopeePay',
    keywords: ['shopeepay', 'shopee pay', 'shopee', 'airpay'],
    initial: 'SPP',
    bg: '#EE4D2D',
    textColor: '#FFFFFF',
  },
  // 24. VNPay
  {
    name: 'VNPay',
    keywords: ['vnpay', 'vn pay', 'vnp'],
    initial: 'VNP',
    bg: '#005BAA',
    textColor: '#FFFFFF',
  },
  // 25. Viettel Money
  {
    name: 'Viettel Money',
    keywords: ['viettelpay', 'viettel pay', 'viettel money', 'viettel'],
    initial: 'VTM',
    bg: '#EE0033',
    textColor: '#FFFFFF',
  },
  // 26. Tiền mặt / Cash
  {
    name: 'Tiền mặt',
    keywords: ['tien mat', 'tienmat', 'cash', 'vi tien'],
    initial: 'TM',
    bg: '#16A34A',
    textColor: '#FFFFFF',
  },
];

// Curated high-contrast palette for deterministic fallback
const FALLBACK_PALETTE = [
  '#0EA5E9', // Ocean Blue
  '#8B5CF6', // Vivid Purple
  '#EC4899', // Pink
  '#F97316', // Orange
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#84CC16', // Lime Green
  '#A855F7', // Violet
  '#06B6D4', // Cyan
  '#E11D48', // Red
];

/**
 * Remove Vietnamese accents and convert to lowercase for robust fuzzy matching.
 * @param {string} str
 * @returns {string}
 */
export function removeDiacritics(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Deterministic string hash (DJB2) for stable fallback colors.
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate 1-2 uppercase initials from an arbitrary account name.
 * @param {string} name
 * @returns {string}
 */
export function toBankInitial(name) {
  if (!name) return '?';
  const clean = removeDiacritics(name).trim();
  const words = clean.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return '?';
}

/**
 * Resolve bank visual avatar information (initials, brand bg, text color) from account name.
 * Handles case-insensitivity, accent removal, word boundary protection for short codes,
 * and deterministic fallback for unknown accounts.
 *
 * @param {string} name - The account name (e.g. "Vietcombank – Thanh toán", "MB Bank", "Tài khoản lạ")
 * @returns {{initial: string, bg: string, textColor: string}}
 */
export function getBankAvatarInfo(name) {
  if (!name) {
    return { initial: '?', bg: '#64748B', textColor: '#FFFFFF' };
  }
  const norm = removeDiacritics(name);

  // 1. Check against predefined banks with word-boundary awareness
  for (const bank of BANK_DEFINITIONS) {
    for (const kw of bank.keywords) {
      if (kw.length <= 4 && !kw.includes(' ')) {
        const regex = new RegExp(`(?:^|[^a-z0-9])${kw}(?:[^a-z0-9]|$)`, 'i');
        if (regex.test(norm)) {
          return { initial: bank.initial, bg: bank.bg, textColor: bank.textColor };
        }
      } else {
        if (norm.includes(kw)) {
          return { initial: bank.initial, bg: bank.bg, textColor: bank.textColor };
        }
      }
    }
  }

  // 2. Stable fallback: hash-based curated color + 1-2 initials
  const colorIndex = hashString(name) % FALLBACK_PALETTE.length;
  return {
    initial: toBankInitial(name),
    bg: FALLBACK_PALETTE[colorIndex],
    textColor: '#FFFFFF',
  };
}

/**
 * Generate reusable account avatar HTML.
 * @param {string} name - Account or bank name
 * @param {'sm'|'md'|'lg'} [size='sm'] - Avatar size
 * @param {string} [className=''] - Optional extra class
 * @returns {string}
 */
export function getBankAvatarHtml(name, size = 'sm', className = '') {
  const avatar = getBankAvatarInfo(name);
  const sizeCls = size ? `account-avatar-${size}` : 'account-avatar-sm';
  const cls = ['account-avatar', sizeCls, className].filter(Boolean).join(' ');
  return `<span class="${cls}" style="background:${avatar.bg};color:${avatar.textColor};" aria-hidden="true">${escapeHtml(avatar.initial)}</span>`;
}
