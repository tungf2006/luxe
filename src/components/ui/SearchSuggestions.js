/**
 * @file SearchSuggestions.js
 * High-fidelity, keyboard-navigable autocomplete popover for Luxe search inputs.
 * Zero-emoji discipline: Uses crisp SVGs with tinted badge containers.
 * Prefix-based matching (accent-insensitive, direct prefix & word prefix),
 * matching text highlight, keyboard navigation (ArrowUp/Down, Enter, Esc),
 * and outside click dismissal.
 */

import { escapeHtml, removeDiacritics } from '../../utils/format.js';
import { CATEGORIES, CATEGORY_MAP } from '../../constants/categories.js';

// SVG Icons
const ICON_MERCHANT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
const ICON_CATEGORY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
const ICON_PAYMENT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
const ICON_ENTER = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>`;

/**
 * Extract candidates pool from transactions and category constants.
 * @param {Array<object>} transactions
 * @returns {Array<object>}
 */
export function buildCandidatesPool(transactions = []) {
  const map = new Map();

  // 1. Add categories
  for (const cat of CATEGORIES) {
    if (cat.labelVi && !map.has(cat.labelVi.toLowerCase())) {
      map.set(cat.labelVi.toLowerCase(), {
        text: cat.labelVi,
        type: 'category',
        category: cat.id,
        badge: 'Danh mục',
        color: cat.color || '#22C55E',
        icon: ICON_CATEGORY,
      });
    }
  }

  // 2. Add payment methods
  const paymentMethods = [
    { text: 'Tiền mặt', slug: 'cash' },
    { text: 'Thẻ', slug: 'card' },
    { text: 'Chuyển khoản', slug: 'transfer' },
    { text: 'Ví điện tử', slug: 'ewallet' },
  ];
  for (const pm of paymentMethods) {
    if (!map.has(pm.text.toLowerCase())) {
      map.set(pm.text.toLowerCase(), {
        text: pm.text,
        type: 'payment',
        badge: 'Phương thức',
        color: '#38BDF8',
        icon: ICON_PAYMENT,
      });
    }
  }

  // 3. Add merchants from transactions
  for (const tx of transactions) {
    const merchant = (tx.merchant || '').trim();
    if (!merchant) continue;
    const key = merchant.toLowerCase();
    if (!map.has(key)) {
      const cat = CATEGORY_MAP[tx.category];
      map.set(key, {
        text: merchant,
        type: 'merchant',
        category: tx.category,
        badge: cat?.labelVi || 'Giao dịch',
        color: cat?.color || '#A78BDA',
        icon: ICON_MERCHANT,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Filter candidates where text or any word starts with query.
 * Supports accent-insensitive comparison.
 *
 * @param {string} query
 * @param {Array<object>} candidates
 * @param {number} [maxResults=6]
 * @returns {Array<object>}
 */
export function getPrefixSuggestions(query, candidates = [], maxResults = 6) {
  const raw = String(query || '').trim();
  if (!raw) return [];

  const rawLower = raw.toLowerCase();
  const normQuery = removeDiacritics(rawLower);

  const matched = [];

  for (const cand of candidates) {
    const text = cand.text || '';
    const textLower = text.toLowerCase();
    const textNorm = removeDiacritics(textLower);

    let score = 0;
    let matchStart = -1;
    let matchLen = raw.length;

    // 1. Direct string prefix (Highest priority)
    if (textLower.startsWith(rawLower)) {
      score = 100;
      matchStart = 0;
    } else if (normQuery && textNorm.startsWith(normQuery)) {
      score = 90;
      matchStart = 0;
    } else {
      // 2. Word prefix (e.g. "Highlands" in "Cà phê Highlands")
      // Find words boundaries
      const regex = new RegExp(`(?:^|[\\s-_/])(${escapeRegExp(rawLower)})`, 'i');
      const normRegex = normQuery ? new RegExp(`(?:^|[\\s-_/])(${escapeRegExp(normQuery)})`, 'i') : null;

      const directMatch = textLower.match(regex);
      if (directMatch && directMatch.index !== undefined) {
        // Adjust for leading separator if any
        const offset = directMatch[0].length - directMatch[1].length;
        matchStart = directMatch.index + offset;
        score = 60 - matchStart; // earlier word matches rank higher
      } else if (normRegex) {
        const normMatch = textNorm.match(normRegex);
        if (normMatch && normMatch.index !== undefined) {
          const offset = normMatch[0].length - normMatch[1].length;
          matchStart = normMatch.index + offset;
          score = 50 - matchStart;
        }
      }
    }

    if (score > 0) {
      matched.push({
        ...cand,
        score,
        matchStart: matchStart >= 0 ? matchStart : 0,
        matchLen,
      });
    }
  }

  // Sort by score desc, then by length asc
  matched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.text.length - b.text.length;
  });

  return matched.slice(0, maxResults);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Render highlighted text wrapping the matching prefix with <strong class="suggestion-match">.
 * @param {string} text
 * @param {number} start
 * @param {number} len
 * @returns {string}
 */
export function highlightMatchHTML(text, start, len) {
  if (start < 0 || start >= text.length) return escapeHtml(text);
  const end = Math.min(start + len, text.length);
  const before = text.slice(0, start);
  const match = text.slice(start, end);
  const after = text.slice(end);
  return `${escapeHtml(before)}<strong class="suggestion-match">${escapeHtml(match)}</strong>${escapeHtml(after)}`;
}

/**
 * Initialize Autocomplete Suggestions on a search input.
 *
 * @param {object} options
 * @param {HTMLInputElement} options.inputEl - Search <input> element
 * @param {HTMLElement} options.containerEl - Container element to anchor dropdown
 * @param {() => Array<object>} options.getCandidates - Callback returning candidates pool
 * @param {(selectedText: string) => void} options.onSelect - Callback on suggestion selection
 * @returns {{ close: () => void, refresh: () => void, destroy: () => void }}
 */
export function initSearchSuggestions({ inputEl, containerEl, getCandidates, onSelect }) {
  if (!inputEl || !containerEl) return { close: () => {}, refresh: () => {}, destroy: () => {} };

  // Create or retrieve suggestions dropdown container
  let dropdown = containerEl.querySelector('.search-suggestions-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'search-suggestions-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Gợi ý tìm kiếm');
    dropdown.style.display = 'none';
    containerEl.appendChild(dropdown);
  }

  inputEl.setAttribute('autocomplete', 'off');
  inputEl.setAttribute('role', 'combobox');
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-expanded', 'false');

  let activeIndex = -1;
  let currentSuggestions = [];

  function renderList(suggestions, query) {
    currentSuggestions = suggestions;
    activeIndex = -1;

    if (!suggestions || suggestions.length === 0) {
      dropdown.style.display = 'none';
      inputEl.setAttribute('aria-expanded', 'false');
      dropdown.innerHTML = '';
      return;
    }

    const html = `
      <div class="search-suggestions-header">
        <span>Gợi ý bắt đầu bằng <strong>"${escapeHtml(query)}"</strong></span>
      </div>
      <div class="search-suggestions-list">
        ${suggestions.map((item, idx) => {
          const highlighted = highlightMatchHTML(item.text, item.matchStart, item.matchLen);
          return `
            <div class="search-suggestion-item" role="option" id="suggestion-item-${idx}" data-index="${idx}" data-value="${escapeHtml(item.text)}" tabindex="-1">
              <span class="suggestion-icon-ring" style="--accent-ring: ${item.color || '#22C55E'}" aria-hidden="true">
                ${item.icon || ICON_MERCHANT}
              </span>
              <div class="suggestion-content">
                <span class="suggestion-title">${highlighted}</span>
                <span class="suggestion-badge">${escapeHtml(item.badge || '')}</span>
              </div>
              <span class="suggestion-action-hint" title="Nhấn để chọn">${ICON_ENTER}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    inputEl.setAttribute('aria-expanded', 'true');
  }

  function updateActiveVisual() {
    const items = dropdown.querySelectorAll('.search-suggestion-item');
    items.forEach((el, idx) => {
      const isActive = idx === activeIndex;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        el.scrollIntoView({ block: 'nearest' });
        inputEl.setAttribute('aria-activedescendant', el.id);
      }
    });
    if (activeIndex === -1) {
      inputEl.removeAttribute('aria-activedescendant');
    }
  }

  function selectItem(index) {
    if (index >= 0 && index < currentSuggestions.length) {
      const chosen = currentSuggestions[index];
      inputEl.value = chosen.text;
      close();
      if (typeof onSelect === 'function') {
        onSelect(chosen.text);
      }
    }
  }

  function close() {
    dropdown.style.display = 'none';
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function triggerSearch() {
    const query = inputEl.value;
    if (!query.trim()) {
      close();
      return;
    }
    const candidates = typeof getCandidates === 'function' ? getCandidates() : [];
    const suggestions = getPrefixSuggestions(query, candidates, 6);
    renderList(suggestions, query);
  }

  // Input event
  const onInput = () => triggerSearch();

  // Keydown navigation
  const onKeyDown = e => {
    if (dropdown.style.display === 'none') {
      if (e.key === 'ArrowDown' && inputEl.value.trim()) {
        triggerSearch();
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % currentSuggestions.length;
      updateActiveVisual();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
      updateActiveVisual();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < currentSuggestions.length) {
        e.preventDefault();
        selectItem(activeIndex);
      } else {
        close();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  // Focus event
  const onFocus = () => {
    if (inputEl.value.trim()) {
      triggerSearch();
    }
  };

  // Click on suggestion item (delegation)
  const onDropdownClick = e => {
    const item = e.target.closest('.search-suggestion-item');
    if (!item) return;
    const idx = parseInt(item.dataset.index, 10);
    selectItem(idx);
  };

  // Click outside listener
  const onDocumentClick = e => {
    if (!containerEl.contains(e.target)) {
      close();
    }
  };

  inputEl.addEventListener('input', onInput);
  inputEl.addEventListener('keydown', onKeyDown);
  inputEl.addEventListener('focus', onFocus);
  dropdown.addEventListener('click', onDropdownClick);
  document.addEventListener('click', onDocumentClick);

  return {
    close,
    refresh: triggerSearch,
    destroy() {
      inputEl.removeEventListener('input', onInput);
      inputEl.removeEventListener('keydown', onKeyDown);
      inputEl.removeEventListener('focus', onFocus);
      dropdown.removeEventListener('click', onDropdownClick);
      document.removeEventListener('click', onDocumentClick);
      dropdown.remove();
    }
  };
}
