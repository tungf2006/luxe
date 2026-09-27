/**
 * @file Lint-style unit test: ensure no i18n {{...}} placeholder leaks into DOM.
 *
 * Rule: if a locale string contains {{placeholder}}, every `t('key')` call
 * in src/ MUST pass the required params object.
 *
 * Run: node test-i18n-no-leak.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname);

function findJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) findJsFiles(full);
    else if (entry.endsWith('.js')) files.push(full);
  }
  return files;
}

function extractPlaceholderKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? prefix + '.' + key : key;
    if (typeof value === 'string' && /\{\{[a-zA-Z_]+\}\}/.test(value)) {
      keys.add(fullKey);
    } else if (typeof value === 'object' && value !== null) {
      extractPlaceholderKeys(value, fullKey).forEach(k => keys.add(k));
    }
  }
  return keys;
}

const localesDir = path.join(root, 'src', 'locales');
const placeholderKeys = new Set();
for (const file of fs.readdirSync(localesDir)) {
  if (file.endsWith('.json')) {
    const data = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
    extractPlaceholderKeys(data).forEach(k => placeholderKeys.add(k));
  }
}

const jsFiles = findJsFiles(path.join(root, 'src'));
const issues = [];

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = [...line.matchAll(/\bt\(['"]([^'"]+)['"](\s*,\s*\{[^}]*\})?\s*\)/g)];
    for (const m of matches) {
      const key = m[1];
      const hasParams = !!m[2];
      if (placeholderKeys.has(key) && !hasParams) {
        issues.push({ file: path.relative(root, file), line: i + 1, key });
      }
    }
  }
}

let passed = true;
if (issues.length === 0) {
  console.log('✅ PASS: No i18n placeholder leaks found.');
} else {
  passed = false;
  console.error('❌ FAIL: Found t() calls missing params for placeholder keys:');
  for (const issue of issues) {
    console.error(`  ${issue.file}:${issue.line} -> ${issue.key}`);
  }
}

process.exit(passed ? 0 : 1);
