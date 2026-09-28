/**
 * @file Bank avatar definitions for account cards, dropdowns, and legends.
 */

const BANK_AVATARS = {
  vietcombank: { initial: 'VCB', bg: '#0B5E3A', textColor: '#fff' },
  vcb:         { initial: 'VCB', bg: '#0B5E3A', textColor: '#fff' },
  techcombank: { initial: 'TCB', bg: '#D62828', textColor: '#fff' },
  tcb:         { initial: 'TCB', bg: '#D62828', textColor: '#fff' },
  vietinbank:  { initial: 'CTG', bg: '#0055A5', textColor: '#fff' },
  vietin:      { initial: 'CTG', bg: '#0055A5', textColor: '#fff' },
  bidv:        { initial: 'BIDV', bg: '#107E7D', textColor: '#fff' },
  mbbank:      { initial: 'MB', bg: '#002B7F', textColor: '#fff' },
  'mb bank':   { initial: 'MB', bg: '#002B7F', textColor: '#fff' },
  mb:          { initial: 'MB', bg: '#002B7F', textColor: '#fff' },
  vpbank:      { initial: 'VPB', bg: '#00B050', textColor: '#fff' },
  vpb:         { initial: 'VPB', bg: '#00B050', textColor: '#fff' },
  acb:         { initial: 'ACB', bg: '#005BAB', textColor: '#fff' },
  tpbank:      { initial: 'TPB', bg: '#7B2CBF', textColor: '#fff' },
  'tp bank':   { initial: 'TPB', bg: '#7B2CBF', textColor: '#fff' },
  tpb:         { initial: 'TPB', bg: '#7B2CBF', textColor: '#fff' },
  vib:         { initial: 'VIB', bg: '#0066B2', textColor: '#fff' },
  sacombank:   { initial: 'STB', bg: '#00529C', textColor: '#fff' },
  stb:         { initial: 'STB', bg: '#00529C', textColor: '#fff' },
  hdbank:      { initial: 'HDB', bg: '#E41E26', textColor: '#fff' },
  shb:         { initial: 'SHB', bg: '#F26F21', textColor: '#fff' },
  msb:         { initial: 'MSB', bg: '#EB2227', textColor: '#fff' },
  seabank:     { initial: 'SSB', bg: '#E41E26', textColor: '#fff' },
  ocb:         { initial: 'OCB', bg: '#008751', textColor: '#fff' },
  eximbank:    { initial: 'EIB', bg: '#0066B3', textColor: '#fff' },
  agribank:    { initial: 'VBA', bg: '#800000', textColor: '#fff' },
  timo:        { initial: 'TIMO', bg: '#673AB7', textColor: '#fff' },
  cake:        { initial: 'CAKE', bg: '#FF4275', textColor: '#fff' },
  momo:        { initial: 'MOMO', bg: '#A50064', textColor: '#fff' },
  zalopay:     { initial: 'ZLP', bg: '#0068FF', textColor: '#fff' },
  'zalo pay':  { initial: 'ZLP', bg: '#0068FF', textColor: '#fff' },
  zalo:        { initial: 'ZLP', bg: '#0068FF', textColor: '#fff' },
  vnpay:       { initial: 'VNP', bg: '#005BAA', textColor: '#fff' },
  viettelpay:  { initial: 'VTM', bg: '#EE0033', textColor: '#fff' },
  'viettel money': { initial: 'VTM', bg: '#EE0033', textColor: '#fff' },
};

function toBankInitial(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
}

export function getBankAvatarInfo(name) {
  const lower = (name || '').toLowerCase();
  for (const [key, info] of Object.entries(BANK_AVATARS)) {
    if (lower.includes(key)) return info;
  }
  return { initial: toBankInitial(name), bg: '#64748b', textColor: '#fff' };
}

export function getBankAvatarHtml(name, className) {
  const avatar = getBankAvatarInfo(name);
  const cls = className || '';
  return `<span class="account-avatar ${cls}" style="background:${avatar.bg};color:${avatar.textColor};" aria-hidden="true">${avatar.initial}</span>`;
}
