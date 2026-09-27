# UI States and Semantic Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every authenticated Luxe page resilient and accessible with semantic action controls, local loading skeletons, empty/error states, isolated widget failures, consistent interactions, reduced-motion support, and operation toasts.

**Architecture:** Keep the existing vanilla ES-module feature boundaries and hash router. Add one shared UI-state module for safe markup and widget boundaries, let the router own page-level loading/retry lifecycle, and let each feature render local skeleton/empty/error states around its own data-dependent regions. Extend existing Toast and CSS primitives rather than introducing a framework or full-page spinner.

**Tech Stack:** Vanilla JavaScript ES modules, native DOM APIs, existing event bus/router, existing localStorage/Supabase data adapters, CSS, Puppeteer smoke tests.

**Spec:** `docs/superpowers/specs/2026-09-22-ui-states-and-semantic-interactions-design.md`

## Global Constraints

- Keep native ES modules, the existing hash router, data adapters, and current page/view boundaries.
- Do not add a full-page spinner. Loading feedback is local to KPI cards, tables, and chart panels.
- Use `<a>` only for real navigation to a destination. Internal actions that call `navigateTo`, open a modal, submit a form, skip a step, or trigger an operation use `<button type="button">`.
- Preserve existing untranslated strings and route behavior unless a state requires new Vietnamese copy.
- Preserve unrelated uncommitted work already present in the worktree.
- All interactive elements use pointer cursor, hover, 150ms transitions, active `scale(0.98)`, and 2px accent `:focus-visible` outline with 2px offset.
- `prefers-reduced-motion: reduce` disables shimmer, chart, transition, and transform animation.
- Errors remain visible and retryable; no catch block silently returns success-shaped fallback data.

## Review Focus

- A data request rejected on one page: the page shows a retryable error without leaving stale/blank content.
- A single chart/widget setup throws after the page shell renders: only that widget becomes an inline error state.
- A genuinely empty dataset versus a filtered-to-zero table: the former gets the page primary CTA, the latter keeps filter-specific copy and controls.
- Keyboard and screen-reader activation of converted action controls: buttons do not mutate the URL/history, while true links retain destination semantics.
- Reduced-motion users: skeletons and transitions stop animating without removing focus/hover affordances.

---

### Task 1: Add shared UI-state helpers

**Files:**
- Create: `src/components/ui/UIState.js`
- Modify: `src/components/ui/KPICard.js`
- Modify: `src/components/ui/PanelHeader.js` only if the action contract needs a button-safe name
- Test: `test-app.js` DOM assertions for shared state classes and retry controls

**Interfaces:**
- Produces `kpiSkeletonHTML(count = 1)`, `tableSkeletonHTML(columns = 4, rows = 4)`, `chartSkeletonHTML()`, `emptyStateHTML({ icon, title, message, actionLabel, action })`, `errorStateHTML({ title, message, retryAction })`, and `renderWidgetBoundary(element, render, options)`.
- `renderWidgetBoundary` catches only the supplied widget render/setup callback, logs the error with the widget name, and replaces that widget element with `errorStateHTML`; it does not catch page renderers globally.

- [ ] **Step 1: Add focused DOM assertions to `test-app.js` for skeleton, empty, and error helper output.** Assert skeleton markup contains `aria-busy="true"` and `.skeleton-shimmer`, empty markup contains an icon, heading, explanation, and typed button, and error markup contains `role="alert"` and a typed `Thử lại` button.
- [ ] **Step 2: Run `node test-app.js` against the existing server and confirm the new assertions fail because the helpers do not exist.**
- [ ] **Step 3: Implement `UIState.js` with escaped text attributes, stable `data-ui-action`/`data-retry` hooks, and local widget replacement. Keep markup composable so page views can place it inside a panel instead of replacing the whole page.**
- [ ] **Step 4: Add a loading variant to `kpiCardHTML({ loading })` that preserves the card shell and renders the KPI skeleton in the card body without showing fake values.**
- [ ] **Step 5: Run `node test-app.js` and verify the helper assertions pass.**
- [ ] **Step 6: Commit the shared state primitives with `git add src/components/ui/UIState.js src/components/ui/KPICard.js test-app.js && git commit -m "feat: add shared UI state primitives"`.**

### Task 2: Harden router page lifecycle and retry behavior

**Files:**
- Modify: `src/router.js`
- Modify: `src/features/auth/authPageView.js` only if the loading route currently conflicts with app-page skeleton behavior
- Test: `test-app.js` forced page-render rejection and retry assertions

**Interfaces:**
- Router continues to export `navigateTo`, `refreshCurrentPage`, `initRouter`, `requiresAuth`, `getCurrentPage`, and `getPageContainer`.
- Add one internal guarded render path used by both initial navigation and `refreshCurrentPage`, so data refresh failures are visible instead of only reaching `console.error`.

- [ ] **Step 1: Add a smoke-test hook that temporarily replaces one page renderer or data method with a rejection, then assert the page shows `role="alert"` and `Thử lại` while the app layout remains mounted.**
- [ ] **Step 2: Run the targeted smoke test and confirm refresh failures are currently silent or produce inconsistent behavior.**
- [ ] **Step 3: Refactor `navigateTo` and `refreshCurrentPage` through a shared guarded renderer that clears/sets only the app page container, renders the existing local skeleton before app-page data resolves, and wires retry to the original route.**
- [ ] **Step 4: Preserve history semantics and avoid calling `pushState` on retry; retry should re-render the current route without adding a duplicate history entry.**
- [ ] **Step 5: Run the smoke test and verify initial errors, refresh errors, and retries all pass.**
- [ ] **Step 6: Commit with `git add src/router.js test-app.js && git commit -m "feat: make page rendering retryable"`.**

### Task 3: Convert action anchors and normalize shared interaction CSS

**Files:**
- Modify: `src/components/ui/navRenderer.js`
- Modify: `src/features/auth/authViews.js`
- Modify: `src/features/onboarding/onboardingView.js`
- Modify: `src/features/dashboard/dashboardView.js`
- Modify: `css/styles.css`
- Test: `test-app.js` source/DOM scan for action `href="#"` and interaction states

**Interfaces:**
- Navigation controls remain keyed by `data-page`; event listeners continue to consume the existing data attributes.
- Auth/onboarding controls remain keyed by `data-auth-action` or existing IDs, but render `<button type="button">`.

- [ ] **Step 1: Add a smoke assertion that no rendered action control has `href="#"`, and that every converted control has `type="button"` where it is not a form submit.**
- [ ] **Step 2: Run the assertion and record the current remaining action anchors from nav, auth, onboarding, and dashboard templates.**
- [ ] **Step 3: Convert generated sidebar, mobile nav, mobile-more, auth flow, onboarding skip, and dashboard “view all/manage” controls to buttons; remove obsolete `preventDefault()` calls only where no longer needed, preserving real download/document links.**
- [ ] **Step 4: Add shared CSS for `button`, `[role="button"]`, navigation buttons, and real links: pointer cursor, 150ms color/border/background/shadow/transform transition, hover affordance, `:active { transform: scale(0.98); }`, and accent focus-visible outline with 2px offset.**
- [ ] **Step 5: Replace any broad animation-only reduced-motion rule with explicit rules that disable shimmer/chart/transform transitions while retaining focus and usable state changes; ensure `.no-animations` follows the same behavior.**
- [ ] **Step 6: Run `node test-app.js`, inspect `git grep -n 'href="#"' -- src`, and verify only none or documented non-action remnants remain.**
- [ ] **Step 7: Commit with `git add src/components/ui/navRenderer.js src/features/auth/authViews.js src/features/onboarding/onboardingView.js src/features/dashboard/dashboardView.js css/styles.css test-app.js && git commit -m "fix: use semantic action controls"`.**

### Task 4: Add local loading and empty states to dashboard and transactions

**Files:**
- Modify: `src/features/dashboard/dashboardView.js`
- Modify: `src/features/transactions/transactionsView.js`
- Modify: `src/components/charts/AreaChart.js` only if chart setup needs boundary-compatible initialization
- Test: `test-app.js` dashboard/transactions loading, empty, and retryable widget assertions

**Interfaces:**
- Dashboard and transactions keep their current `render(container, page)` exports and data service calls.
- Dashboard widget boundaries own `#spending-overview-panel`, recent transactions, budget progress, and KPI grid independently.

- [ ] **Step 1: Add smoke assertions that dashboard exposes KPI skeletons, a chart skeleton, and table skeleton rows before data settles; add empty-data assertions for transaction CTA text and icon/title/explanation structure.**
- [ ] **Step 2: Run the test and confirm current render replaces the container only after all dashboard/transaction data resolves, with no local skeleton coverage.**
- [ ] **Step 3: Render dashboard KPI/table/chart skeletons in their panel shells before async data resolves, then replace only each owned region with populated or empty content.**
- [ ] **Step 4: Distinguish dashboard-wide no-transaction empty state from an individual “no budgets” panel and keep the primary action `Chưa có giao dịch nào — Thêm giao dịch đầu tiên` as a typed button opening the existing add-transaction modal.**
- [ ] **Step 5: Wrap chart creation and recent/budget panel population with `renderWidgetBoundary`; provide retry callbacks that re-fetch only the failed region where the existing data API permits it.**
- [ ] **Step 6: Add transaction table row skeletons and KPI skeletons during the initial data request, preserve filtered-to-zero copy, and add the standard page empty state only when the underlying transaction collection is empty.**
- [ ] **Step 7: Surface data failures with inline error state and `showToast(..., "error")`, while leaving export/filter/delete controls recoverable.**
- [ ] **Step 8: Run the smoke test on dashboard and transactions with seeded and empty data and verify all assertions.**
- [ ] **Step 9: Commit with `git add src/features/dashboard/dashboardView.js src/features/transactions/transactionsView.js src/components/charts/AreaChart.js test-app.js && git commit -m "feat: add dashboard and transaction UI states"`.**

### Task 5: Add local states and boundaries to budgets, reports, goals, recurring, and accounts

**Files:**
- Modify: `src/features/budgets/budgetsView.js`
- Modify: `src/features/reports/reportsView.js`
- Modify: `src/features/goals/goalsView.js`
- Modify: `src/features/recurring/recurringView.js`
- Modify: `src/features/accounts/accountsView.js`
- Modify: `src/components/charts/BarChart.js`
- Modify: `src/components/charts/DonutChart.js`
- Modify: `src/components/charts/AreaChart.js` if reports uses its output
- Test: `test-app.js` each authenticated route with populated, empty, and forced-failure data

**Interfaces:**
- Each view continues to export `render(container, page)`.
- Chart panels use `renderWidgetBoundary` and retain existing chart interaction APIs.
- Each page has a page-appropriate primary empty action; transaction pages use the exact standard CTA copy.

- [ ] **Step 1: Add route-by-route smoke assertions for KPI skeletons, table/chart skeletons, empty-state icon/title/explanation/button, and widget-level retry markup.**
- [ ] **Step 2: Run the assertions to identify each page’s current empty behavior and any renderer that assumes a non-empty array.**
- [ ] **Step 3: Add local skeleton shells before `Promise.all`/data calls settle, then replace them with content or shared page empty state after successful data resolution.**
- [ ] **Step 4: Add explicit empty handling for budgets, reports (no transaction/account data), goals, recurring, and accounts; preserve existing card/table layouts when data exists.**
- [ ] **Step 5: Wrap report/account/chart setup and other independent panels so a chart failure replaces only that panel with an inline retry state.**
- [ ] **Step 6: Add error toasts for rejected data calls and keep retry callbacks attached to the failed page/widget. Do not convert a rejection into an empty collection.**
- [ ] **Step 7: Run the full route smoke test with seeded and empty fixtures and verify no route becomes blank when one widget fails.**
- [ ] **Step 8: Commit with `git add src/features/budgets/budgetsView.js src/features/reports/reportsView.js src/features/goals/goalsView.js src/features/recurring/recurringView.js src/features/accounts/accountsView.js src/components/charts/*.js test-app.js && git commit -m "feat: add states to remaining feature pages"`.**

### Task 6: Complete toast coverage for create, update, delete, and failure flows

**Files:**
- Modify: `src/components/ui/Toast.js`
- Modify: `src/features/transactions/transactionForm.js`
- Modify: `src/features/transactions/transactionsView.js`
- Modify: `src/features/budgets/budgetsView.js`
- Modify: `src/features/accounts/accountsView.js`
- Modify: `src/features/goals/goalsView.js`
- Modify: `src/features/recurring/recurringView.js`
- Modify: `src/features/settings/settingsView.js`
- Modify: `src/features/onboarding/onboardingPageView.js` if save/complete operations currently lack feedback
- Test: `test-app.js` operation success/failure toast assertions

**Interfaces:**
- Preserve `showToast(message, type, duration)` and `showToastWithAction(...)`; add no second notification system.
- Mutating feature actions await the data adapter promise before emitting success; rejected operations show `error` toast and leave the action available.

- [ ] **Step 1: Add smoke assertions that creating, updating, deleting, saving settings, and reset/account operations produce a success toast only after completion, and failures produce an error toast.**
- [ ] **Step 2: Run the assertions to locate synchronous mutation calls and operations that currently show informational “coming soon” messages instead of operation feedback.**
- [ ] **Step 3: Update transaction create/edit/delete, budget delete/update, account/goal/recurring actions, settings save/toggles, and onboarding persistence to await returned promises, catch locally, and call the existing toast API with success/error types.**
- [ ] **Step 4: Ensure toast action buttons are typed, keyboard reachable, use escaped text, and respect reduced-motion dismissal behavior.**
- [ ] **Step 5: Run the operation smoke tests and verify duplicate toasts are not emitted on router refresh.**
- [ ] **Step 6: Commit with `git add src/components/ui/Toast.js src/features/transactions/transactionForm.js src/features/transactions/transactionsView.js src/features/budgets/budgetsView.js src/features/accounts/accountsView.js src/features/goals/goalsView.js src/features/recurring/recurringView.js src/features/settings/settingsView.js src/features/onboarding/onboardingPageView.js test-app.js && git commit -m "feat: standardize operation toasts"`.**

### Task 7: Verify accessibility, motion preferences, and regression behavior

**Files:**
- Modify: `test-app.js`
- Modify: `test-donut-chart.js` only if chart boundary changes require coverage
- Modify: `test-typography.js` only if shared interaction CSS selectors are asserted there
- Modify: `CHANGELOG.md` using the repository changelog format if the project convention requires an entry

**Interfaces:**
- Tests run against the existing `node server.js` dev server and Puppeteer dependency; no new test framework or production dependency.

- [ ] **Step 1: Add assertions for keyboard activation, `document.activeElement` focus-visible-compatible controls, `history.length`/URL stability after action-button clicks, and real navigation links.**
- [ ] **Step 2: Add assertions under emulated `prefers-reduced-motion: reduce` that shimmer animation duration is disabled and active transform does not animate.**
- [ ] **Step 3: Run `node test-app.js`, `node test-donut-chart.js`, and `node test-typography.js` with the server running; fix only regressions caused by this feature.**
- [ ] **Step 4: Run `git grep -n 'href="#"' -- src`, `git diff --check`, and a final `git status --short` review to confirm semantic cleanup, whitespace validity, and unrelated worktree changes are preserved.**
- [ ] **Step 5: Commit test-only and documentation updates with `git add test-app.js test-donut-chart.js test-typography.js CHANGELOG.md && git commit -m "test: verify resilient UI states and interactions"`.**
