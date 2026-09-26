/**
 * @file Bank avatar definitions for account cards, dropdowns, and legends.
 */

const BANK_AVATARS = {
  vietcombank: { initial: 'VCB', bg: '#0B5E3A', textColor: '#fff' },
  techcombank: { initial: 'TCB', bg: '#D62828', textColor: '#fff' },
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
