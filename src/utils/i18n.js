import { on, emit } from './eventBus.js';

let _currentLocale = 'vi';
let _translations = { vi: {}, en: {} };
let _pending = [];
let _initialized = false;

function getNested(obj, path) {
  return path.split('.').reduce((o, key) => (o && o[key] !== undefined) ? o[key] : undefined, obj);
}

async function loadLocale(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch {}
  return {};
}

export async function initI18n(defaultLocale = 'vi') {
  const [vi, en] = await Promise.all([
    loadLocale('./src/locales/vi.json'),
    loadLocale('./src/locales/en.json'),
  ]);
  _translations = { vi, en };
  _currentLocale = defaultLocale;
  _initialized = true;
  _pending.forEach(fn => fn());
  _pending = [];
  emit('i18n:ready', { locale: _currentLocale });
}

export function setLocale(locale) {
  if (!_translations[locale]) return false;
  _currentLocale = locale;
  document.documentElement.lang = locale;
  emit('i18n:changed', { locale });
  return true;
}

export function getLocale() {
  return _currentLocale;
}

export function t(key, params = {}) {
  let translation = getNested(_translations[_currentLocale], key)
    || getNested(_translations['vi'], key)
    || key;
  if (typeof translation !== 'string') return key;
  return translation.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p] !== undefined ? params[p] : `{{${p}}}`);
}

export function hasLocale(locale) {
  return !!_translations[locale];
}

export function getAvailableLocales() {
  return Object.keys(_translations);
}

export function whenReady(fn) {
  if (_initialized) { fn(); return; }
  _pending.push(fn);
}