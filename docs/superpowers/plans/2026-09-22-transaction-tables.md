# Transaction Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver consistent, safe, responsive transaction and recurring-transaction tables with action menus, bulk operations, real statuses, URL-persisted state, and mobile cards.

**Architecture:** Keep `transactionsView.js` and `recurringView.js` as separate feature owners because their records have different fields. Extract only cross-cutting table concerns into focused helpers: query-state serialization, action-menu markup, and status/confirmation UI. Both views use event delegation and the existing `dataAdapter`, event bus, Modal, and Toast components.

**Tech Stack:** Vanilla JavaScript ES modules, HTML template strings, CSS, localStorage/Supabase-ready `dataAdapter`, Puppeteer smoke tests.

**Spec:** `docs/superpowers/specs/2026-09-22-transaction-tables-design.md`

## Global Constraints

- No framework; preserve native ES modules and relative imports.
- Do not add a build step or npm dependency.
- Use `dataAdapter`/`dataService` for persistence; never access localStorage from feature views.
- Emit `data:changed` after successful writes.
- Preserve existing Vietnamese copy and existing dark/light theme variables.
- Support transaction statuses `pending`, `completed`, `failed`, and `cancelled`.
- Show `Đã xoá giao dịch` with `Hoàn tác` for five seconds after a single deletion.
- Render table on desktop and card list below `768px`.
- Do not revert or overwrite unrelated pre-existing worktree changes.

## Review Focus

- Malformed or stale URL query values must fall back to safe defaults instead of throwing or producing an invalid sort/filter.
- Empty filtered results must show a filter-reset CTA, while an actually empty dataset must show the add-transaction CTA.
- A delete undo action must restore the exact record once and become harmless after five seconds or after a second click.
- Menu, checkbox, and toggle controls must remain keyboard accessible and must not trigger row navigation or duplicate listeners after re-render.
- Mobile cards must expose the same record actions and selection affordances as desktop rows without relying on hover.

---

### Task 1: Add shared table state and action/status helpers

**Files:**
- Create: `src/components/ui/tableState.js`
- Create: `src/components/ui/TableActions.js`
- Modify: `src/components/ui/TransactionCells.js`
- Modify: `src/types/index.js`

**Interfaces:**
- `tableState.js` produces `readTableState(defaults, schema)`, `writeTableState(state, schema)`, and `updateTableQuery(patch, schema)` for the current hash URL.
- `TableActions.js` produces `actionMenuHTML({ id, label, kind })`, `detailModalHTML({ title, fields })`, and `confirmDeleteModalHTML({ id, label, kind })`.
- `TransactionCells.js` produces `statusBadgeHTML(status)` for all four canonical statuses and `statusLabel(status)`.
- Later views consume stable action attributes: `data-action="view|edit|duplicate|delete"`, `data-record-id`, and `data-record-kind`.

- [ ] **Step 1: Write focused tests for query parsing and status normalization**

Add a small browser-test helper in `test-app.js` or a new `test-table-state.js` that evaluates the module in a page and asserts:

```js
const result = await page.evaluate(async () => {
  const { readTableState } = await import('/src/components/ui/tableState.js');
  history.replaceState({}, '', '#transactions?search=grab&sort=amount&dir=asc&page=3&unknown=x');
  return readTableState(
    { search: '', sort: 'date', dir: 'desc', page: 1 },
    { allowedSort: ['date', 'amount'], allowedDir: ['asc', 'desc'] }
  );
});
```

Expected result: search is `grab`, sort is `amount`, dir is `asc`, page is `3`, and unknown keys do not appear in the returned state. Add assertions that invalid sort/dir/page use the supplied defaults.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node test-table-state.js`

Expected: FAIL because `src/components/ui/tableState.js` does not exist.

- [ ] **Step 3: Implement URL state helpers**

Parse the query after the hash route using `window.location.hash`, validate each field against the supplied schema, coerce `page` to a positive integer, and preserve unrelated query parameters. `writeTableState` must use `history.replaceState` so sorting/filtering does not add a history entry; dispatch a `table:state-changed` custom event for tests or listeners.

- [ ] **Step 4: Implement shared action menu markup and canonical statuses**

Render a three-dot button and a menu with Vietnamese labels, `role="menu"`, `role="menuitem"`, and an accessible label containing the record name. Add a canonical status map:

```js
const STATUS_META = {
  pending: { label: 'Đang chờ', className: 'status-pending', icon: '◷' },
  completed: { label: 'Hoàn thành', className: 'status-completed', icon: '✓' },
  failed: { label: 'Thất bại', className: 'status-failed', icon: '!' },
  cancelled: { label: 'Đã huỷ', className: 'status-cancelled', icon: '–' },
};
```

Unknown/missing transaction statuses normalize to `completed`. Update the JSDoc typedef to include all four values.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `node test-table-state.js`

Expected: PASS for valid/invalid URL state, all four badge labels/classes, and action attributes.

- [ ] **Step 6: Commit the shared helpers**

```bash
git add src/components/ui/tableState.js src/components/ui/TableActions.js src/components/ui/TransactionCells.js src/types/index.js test-table-state.js
git commit -m "feat: add shared table state and action helpers"
```

### Task 2: Extend transaction form for edit and duplicate flows

**Files:**
- Modify: `src/features/transactions/transactionForm.js`
- Modify: `src/features/transactions/transactionsView.js`

**Interfaces:**
- `transactionForm.js` exports `open(options = {})`, where `options.mode` is `'add' | 'edit' | 'duplicate'` and `options.transaction` is a transaction-like object.
- `transactionsView.js` calls `openTransactionForm({ mode, transaction })`; existing `[data-open-modal]` add buttons continue to call `open()`.

- [ ] **Step 1: Add form-flow tests to the Puppeteer harness**

Navigate to `#transactions`, trigger edit and duplicate actions, and assert the modal title, merchant/category/date values, and that duplicate submission creates a different id while edit preserves the original id and status.

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `node test-app.js`

Expected: FAIL because action menu triggers do not exist and `open()` cannot accept a record.

- [ ] **Step 3: Refactor form state without changing the existing add flow**

Track `_editingId` and `_formMode`. Populate type, merchant, amount, account, category, date, recurrence, and status from the supplied record. Add a status select with the four canonical values for edit mode. On submit, call `updateTransaction(_editingId, updates)` for edit, or `addTransaction({...record, id omitted})` for add/duplicate. Keep duplicate’s date/category/amount but clear the id and set status to `completed`.

- [ ] **Step 4: Implement view/detail and form entry points**

Add a small exported `openTransactionForm(mode, tx)` adapter in `transactionsView.js` that imports the form module and calls its `open`. Render the read-only detail modal through the shared helper and fill it with escaped field values.

- [ ] **Step 5: Run the form tests and verify they pass**

Run: `node test-app.js`

Expected: add remains functional; edit updates the selected row; duplicate inserts a new row; status persists.

- [ ] **Step 6: Commit the form integration**

```bash
git add src/features/transactions/transactionForm.js src/features/transactions/transactionsView.js test-app.js
git commit -m "feat: support transaction edit and duplicate actions"
```

### Task 3: Rebuild the transactions table interactions

**Files:**
- Modify: `src/features/transactions/transactionsView.js`
- Modify: `src/services/dataService.js`
- Modify: `src/services/supabaseService.js`
- Modify: `src/components/ui/Toast.js`

**Interfaces:**
- The view owns `selectedIds`, `txFilters`, `sortField`, `sortDir`, and `txPage`; all filter/sort changes call `updateTableQuery`.
- Deletion uses `deleteTransaction(id)` and undo uses `addTransaction(snapshot)` or a backend-compatible restore helper.
- Toast undo uses existing `showToastWithAction(message, actionLabel, onAction, type, 5000)`.

- [ ] **Step 1: Add tests for menu, selection, sort, URL restore, and delete confirmation**

In Puppeteer, assert:

```js
await page.click('[data-action="open-menu"][data-record-id="t03"]');
await page.click('[data-action="delete"][data-record-id="t03"]');
console.assert(await page.$('#confirm-delete-modal.open'));
```

Also assert header sort on merchant/category/date/amount, checkbox selection showing the bulk bar, and reload preserving `search`, `category`, `sort`, and `dir`.

- [ ] **Step 2: Run tests and verify they fail**

Run: `node test-app.js`

Expected: FAIL because the current table has a text Xoá button, no checkboxes, and only date/amount sorting.

- [ ] **Step 3: Replace table markup and render logic**

Add a select-all checkbox column, sortable headers for Người thu, Danh mục, Ngày, and Số tiền, the action-menu column, and `data-record-id` on rows/cards. Remove the old inline Xoá button. Normalize every transaction status before calling `statusBadgeHTML`.

- [ ] **Step 4: Wire URL-backed filter and sort state**

Initialize state from `readTableState` instead of `resetFilters`. Search/type/category/month/status changes reset page to 1, call `writeTableState`, and rerender. Sort toggles direction for the same field, defaults new fields to descending, calls `writeTableState`, and updates both indicator text and `aria-sort`.

- [ ] **Step 5: Implement confirmation, single undo, and bulk actions**

Use a generated confirmation modal instead of `window.confirm`. On confirmation, snapshot selected records, await deletes, emit `data:changed`, show exact single-delete copy `Đã xoá giao dịch` plus `Hoàn tác`, and refresh. Guard undo with a boolean and restore only once. Add bulk category modal using `updateTransaction` for each selected id, and export only selected rows when the bulk bar is active.

- [ ] **Step 6: Implement empty state and selection behavior**

Render different empty states for no records versus no filter matches. Add `Thêm giao dịch` and `Xoá bộ lọc` buttons. Keep selection ids limited to records currently present, and make select-all reflect the visible page.

- [ ] **Step 7: Run transaction interaction tests and verify they pass**

Run: `node test-app.js`

Expected: action menu, confirmation modal, undo toast, four sort columns, URL restore, bulk controls, status badges, and empty-state CTAs all pass without console/page errors.

- [ ] **Step 8: Commit the transactions table**

```bash
git add src/features/transactions/transactionsView.js src/services/dataService.js src/services/supabaseService.js src/components/ui/Toast.js test-app.js
git commit -m "feat: rebuild transaction table interactions"
```

### Task 4: Rebuild the recurring table with actions and toggle

**Files:**
- Modify: `src/features/recurring/recurringView.js`
- Modify: `src/services/dataService.js`
- Modify: `src/services/supabaseService.js`

**Interfaces:**
- Recurring action controls use the same `data-action` names and `data-record-kind="recurring"`.
- Toggle writes `updateRecurring(id, { status: 'active' | 'inactive' })`.
- Recurring state uses `readTableState` with allowed sort fields `merchant`, `category`, `frequency`, `nextDate`, `amount`, and `status`.

- [ ] **Step 1: Add recurring interaction tests**

Navigate to `#recurring`, assert the action header exists, click the active toggle and assert the status/persistence changes, then open the menu and confirmation modal. Assert sort indicators for name/category/date/amount and URL restoration after reload.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node test-app.js`

Expected: FAIL because recurring has no action column, toggle, checkbox, or sortable header.

- [ ] **Step 3: Add recurring table/card rendering**

Add selection checkbox, status toggle with `role="switch"` and `aria-checked`, action menu, and the same empty-state split as transactions. Preserve KPI and upcoming-due rendering.

- [ ] **Step 4: Wire recurring actions and toggle**

Delegate view/edit/duplicate/detail where meaningful, confirm delete through the shared modal, call `updateRecurring` for toggle, emit `data:changed`, and show an error toast when an async write rejects. Use event delegation on the feature container.

- [ ] **Step 5: Run recurring tests and verify they pass**

Run: `node test-app.js`

Expected: recurring actions, toggle, sort, URL restore, and persistence pass.

- [ ] **Step 6: Commit recurring table changes**

```bash
git add src/features/recurring/recurringView.js src/services/dataService.js src/services/supabaseService.js test-app.js
git commit -m "feat: add recurring table actions and status toggle"
```

### Task 5: Add desktop table polish and mobile card layout

**Files:**
- Modify: `css/styles.css`
- Modify: `src/features/transactions/transactionsView.js`
- Modify: `src/features/recurring/recurringView.js`

**Interfaces:**
- Desktop markup uses `.data-table-shell`, `.table-action-menu`, `.table-select-cell`, `.table-empty-state`.
- Mobile markup uses `.transaction-card-list` and `.transaction-card`; both views keep the same `data-action` and `data-record-id` hooks.

- [ ] **Step 1: Add CSS/layout assertions**

Extend Puppeteer checks to set viewport widths `1024` and `390`, assert desktop table visibility at 1024, card-list visibility at 390, and action-menu visibility/focusability at both widths.

- [ ] **Step 2: Run assertions and verify they fail**

Run: `node test-app.js`

Expected: FAIL because the current views do not render mobile card lists or the new class hooks.

- [ ] **Step 3: Implement desktop table styling**

Add sticky `thead`, subtle alternating row background, hover highlight, selected-row treatment, action menu positioning, mobile-safe focus styles, and a fixed/floating bulk bar that does not cover table content.

- [ ] **Step 4: Implement mobile card markup and CSS**

Below `@media (max-width: 767px)`, hide table wrappers and show cards. Each card places category icon/name/category/date on the left and signed amount on the right, with selection and action controls always visible. Ensure long merchant names wrap without pushing the amount off-screen.

- [ ] **Step 5: Implement empty-state illustration and CTAs**

Use inline SVG/CSS-only illustration and style both CTA variants with existing button tokens; do not add image assets.

- [ ] **Step 6: Run responsive assertions and verify they pass**

Run: `node test-app.js`

Expected: no horizontal overflow at 390px, card content and actions visible, sticky header active on desktop, and zebra/hover styles present.

- [ ] **Step 7: Commit responsive table polish**

```bash
git add css/styles.css src/features/transactions/transactionsView.js src/features/recurring/recurringView.js test-app.js
git commit -m "feat: add responsive transaction table layouts"
```

### Task 6: Run full validation and update smoke coverage

**Files:**
- Modify: `test-app.js`
- Modify: `test-donut-chart.js` only if shared setup requires it

**Interfaces:**
- Smoke test starts against `http://localhost:3000`, uses only existing Puppeteer dependency, and must leave localStorage isolated or restore seeded data after destructive checks.

- [ ] **Step 1: Add isolated test setup and cleanup**

At the beginning of the table tests, reload defaults or save the initial transaction/recurring arrays; at the end, restore them through the service or clear only the test records so repeated runs remain deterministic.

- [ ] **Step 2: Run syntax/module checks**

Run: `node --check test-app.js`; load the app through the browser and fail on `pageerror`, failed requests, or console errors.

Expected: no syntax errors, module errors, or unhandled browser errors.

- [ ] **Step 3: Run the application smoke suite**

Start the server with `node server.js`, then run `node test-app.js`.

Expected: all existing dashboard/navigation/modal checks and all new table checks pass.

- [ ] **Step 4: Run the existing npm test**

Run: `npm test`

Expected: PASS without changing unrelated chart behavior.

- [ ] **Step 5: Commit final test coverage**

```bash
git add test-app.js
git commit -m "test: cover transaction table workflows"
```

