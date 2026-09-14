/**
 * @file Type definitions shared across the application.
 * In vanilla JS these serve as JSDoc references; when migrating to
 * TypeScript/Supabase they become the canonical schema.
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} merchant
 * @property {string} category
 * @property {'income'|'expense'} type
 * @property {string} date        ISO date YYYY-MM-DD
 * @property {number} amount
 * @property {'completed'|'pending'} status
 */

/**
 * @typedef {Object} Budget
 * @property {string} id
 * @property {string} category
 * @property {number} limit
 * @property {number} spent
 * @property {string} icon
 * @property {string} color
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} color
 * @property {'income'|'expense'} type
 */

/**
 * @typedef {Object} Account
 * @property {string} id
 * @property {string} name
 * @property {'checking'|'savings'|'credit'|'investment'} type
 * @property {number} balance
 * @property {string} currency
 */

/**
 * @typedef {Object} Goal
 * @property {string} id
 * @property {string} name
 * @property {number} target
 * @property {number} current
 * @property {string} deadline  ISO date
 */

/**
 * @typedef {Object} Settings
 * @property {'dark'|'light'} theme
 * @property {string} currency
 * @property {string} payDay
 * @property {'monthly'|'weekly'|'bi-weekly'} budgetPeriod
 * @property {boolean} compactMode
 * @property {boolean} animations
 * @property {Object} notifications
 */

/**
 * @typedef {'income'|'expense'|'completed'|'pending'|'warning'|'info'|'success'|'error'} TrendDirection
 */
