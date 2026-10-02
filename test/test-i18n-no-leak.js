/**
 * @file Unit & static lint test: ensure no i18n {{...}} placeholder leaks into DOM or UI.
 *
 * Checks:
 *  1. Placeholder symmetry: every key with placeholders in vi.json has matching placeholders in en.json (and vice versa).
 *  2. Static analysis: every `t('key', ...)` call in `src/` for a placeholder key passes a params argument.
 *  3. Runtime hardening unit tests for `t()`:
 *     - When params are supplied, tokens are correctly substituted.
 *     - When params are omitted or missing, `{{token}}` is stripped, dangling punctuation cleaned, and no `{{` is returned.
 *
 * Run: node test-i18n-no-leak.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function findJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'headroom', '.worktrees'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function extractPlaceholdersMap(obj, prefix = '') {
  const map = new Map();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? prefix + '.' + key : key;
    if (typeof value === 'string') {
      const matches = [...value.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map(m => m[1]);
      if (matches.length > 0) {
        map.set(fullKey, new Set(matches));
      }
    } else if (typeof value === 'object' && value !== null) {
      extractPlaceholdersMap(value, fullKey).forEach((v, k) => map.set(k, v));
    }
  }
  return map;
}

const localesDir = path.join(root, 'src', 'locales');
const viFile = path.join(localesDir, 'vi.json');
const enFile = path.join(localesDir, 'en.json');

const viData = JSON.parse(fs.readFileSync(viFile, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));

const viPlaceholders = extractPlaceholdersMap(viData);
const enPlaceholders = extractPlaceholdersMap(enData);

let passed = true;

// 1. Check placeholder consistency between vi and en
console.log(`[i18n-test] Checking placeholder consistency across vi.json (${viPlaceholders.size} keys) and en.json (${enPlaceholders.size} keys)...`);

const allKeys = new Set([...viPlaceholders.keys(), ...enPlaceholders.keys()]);
for (const key of allKeys) {
  const viSet = viPlaceholders.get(key);
  const enSet = enPlaceholders.get(key);

  if (!viSet) {
    console.error(`❌ Mismatch: Key "${key}" has placeholders in en.json but not in vi.json`);
    passed = false;
  } else if (!enSet) {
    console.error(`❌ Mismatch: Key "${key}" has placeholders in vi.json but not in en.json`);
    passed = false;
  } else {
    for (const p of viSet) {
      if (!enSet.has(p)) {
        console.error(`❌ Mismatch in key "${key}": "${p}" found in vi.json but missing in en.json`);
        passed = false;
      }
    }
    for (const p of enSet) {
      if (!viSet.has(p)) {
        console.error(`❌ Mismatch in key "${key}": "${p}" found in en.json but missing in vi.json`);
        passed = false;
      }
    }
  }
}

// 2. Static scan for t() calls
console.log('[i18n-test] Scanning src/ JS files for unparameterized t() calls...');
const jsFiles = findJsFiles(path.join(root, 'src'));
const staticIssues = [];

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = [...line.matchAll(/\bt\(['"]([^'"]+)['"](\s*,\s*\{[^}]*\})?\s*\)/g)];
    for (const m of matches) {
      const key = m[1];
      const hasParams = !!m[2];
      if (allKeys.has(key) && !hasParams) {
        staticIssues.push({ file: path.relative(root, file), line: i + 1, key });
      }
    }
  }
}

if (staticIssues.length > 0) {
  passed = false;
  console.error('❌ FAIL: Found t() calls missing params for placeholder keys:');
  for (const issue of staticIssues) {
    console.error(`  ${issue.file}:${issue.line} -> ${issue.key}`);
  }
}

// 3. Runtime unit tests for t() helper in src/utils/i18n.js
console.log('[i18n-test] Running runtime hardening tests on src/utils/i18n.js...');
const { t, initI18n, setLocale } = await import('../src/utils/i18n.js');

// Mock fetch for initI18n in node environment
globalThis.fetch = async (url) => {
  const filePath = path.resolve(root, url.replace(/^\.\//, ''));
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      ok: true,
      json: async () => JSON.parse(content),
    };
  }
  return { ok: false };
};

await initI18n('vi');

// Test 3.1: Happy path with params
const happyVi = t('dashboard.hero.tagline', { date: '28/09/2026' });
if (happyVi !== 'Danh mục sống động · 28/09/2026') {
  console.error(`❌ Expected "Danh mục sống động · 28/09/2026", got "${happyVi}"`);
  passed = false;
}

// Test 3.2: Missing param should NEVER leak {{date}}
const missingVi = t('dashboard.hero.tagline');
if (missingVi.includes('{{') || missingVi.includes('}}')) {
  console.error(`❌ Leaked placeholder in missing param call: "${missingVi}"`);
  passed = false;
}
if (missingVi !== 'Danh mục sống động') {
  console.error(`❌ Expected cleaned text "Danh mục sống động", got "${missingVi}"`);
  passed = false;
}

// Test 3.3: Missing param in english
setLocale('en');
const missingEn = t('dashboard.hero.tagline');
if (missingEn.includes('{{') || missingEn.includes('}}') || missingEn !== 'Vibrant categories') {
  console.error(`❌ Expected "Vibrant categories", got "${missingEn}"`);
  passed = false;
}

// Test 3.4: Test all placeholder keys without params (must NEVER leak {{...}})
for (const key of allKeys) {
  setLocale('vi');
  const outVi = t(key);
  if (outVi.includes('{{') || outVi.includes('}}')) {
    console.error(`❌ Key "${key}" leaked placeholder in VI fallback: "${outVi}"`);
    passed = false;
  }
  setLocale('en');
  const outEn = t(key);
  if (outEn.includes('{{') || outEn.includes('}}')) {
    console.error(`❌ Key "${key}" leaked placeholder in EN fallback: "${outEn}"`);
    passed = false;
  }
}

if (passed) {
  console.log('✅ PASS: All i18n placeholder tests and runtime hardening passed perfectly.');
  process.exit(0);
} else {
  console.error('❌ FAIL: i18n validation failed.');
  process.exit(1);
}
