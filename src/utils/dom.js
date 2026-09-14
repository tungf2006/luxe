/**
 * @file Small DOM manipulation helpers.
 */

/**
 * Create a DOM element with optional attributes and children.
 * @param {string} tag
 * @param {Object} [attrs]
 * @param {string|Node|Array} [children]
 * @returns {HTMLElement}
 */
export function createEl(tag, attrs = {}, children = null) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'className') el.className = val;
    else if (key === 'innerHTML') el.innerHTML = val;
    else if (val != null) el.setAttribute(key, val);
  });
  if (children != null) {
    if (Array.isArray(children)) {
      children.forEach(c => el.appendChild(c));
    } else if (typeof children === 'string') {
      el.innerHTML = children;
    } else {
      el.appendChild(children);
    }
  }
  return el;
}

/**
 * Remove a class from all elements matching selector.
 * @param {string} selector
 * @param {string} cls
 */
export function removeClassAll(selector, cls) {
  document.querySelectorAll(selector).forEach(el => el.classList.remove(cls));
}

/**
 * Add a class to an element.
 * @param {HTMLElement} el
 * @param {string} cls
 */
export function addClass(el, cls) {
  if (el) el.classList.add(cls);
}

/**
 * Remove a class from an element.
 * @param {HTMLElement} el
 * @param {string} cls
 */
export function removeClass(el, cls) {
  if (el) el.classList.remove(cls);
}

/**
 * Show or hide an element.
 * @param {HTMLElement} el
 * @param {boolean} show
 */
export function toggleVisibility(el, show) {
  if (el) el.style.display = show ? '' : 'none';
}

/**
 * Find the closest ancestor matching a selector.
 * @param {EventTarget} target
 * @param {string} selector
 * @returns {Element|null}
 */
export function closest(target, selector) {
  return target?.closest?.(selector) ?? null;
}
