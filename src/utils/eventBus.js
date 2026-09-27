/**
 * @file Simple event bus for decoupled communication between features.
 * Avoids circular imports between the router and feature modules.
 */

const target = new EventTarget();

/**
 * Emit a custom event.
 * @param {string} type
 * @param {*} [detail]
 */
export function emit(type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}

/**
 * Listen for a custom event.
 * @param {string} type
 * @param {(e: CustomEvent) => void} handler
 */
export function on(type, handler) {
  target.addEventListener(type, handler);
}

/**
 * Remove an event listener.
 * @param {string} type
 * @param {(e: CustomEvent) => void} handler
 */
export function off(type, handler) {
  target.removeEventListener(type, handler);
}
