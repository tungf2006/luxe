# UI States and Semantic Interactions Design

## Goal

Make every authenticated Luxe page resilient and accessible while preserving
the current vanilla-JS architecture and visual language. The change covers
semantic action controls, local loading feedback, page/widget failures, empty
states, consistent interaction affordances, reduced-motion support, and
operation feedback through toasts.

## Scope and invariants

- Keep native ES modules, the existing hash router, data adapters, and current
  page/view boundaries.
- Do not add a full-page spinner. Loading feedback is local to KPI cards,
  tables, and chart panels.
- Use `<a>` only for real navigation to a destination. Internal actions that
  call `navigateTo`, open a modal, submit a form, skip a step, or trigger an
  operation use `<button type="button">`.
- Preserve existing untranslated strings and route behavior unless a state
  requires new Vietnamese copy.
- Preserve unrelated uncommitted work already present in the worktree.

## Architecture

### Shared UI state helpers

Add a small UI-state utility layer for:

- KPI, table-row, and chart skeleton markup with shimmer animation.
- Page-level empty state markup with an illustrative icon, title, explanation,
  and primary action. The standard transaction CTA is:
  “Chưa có giao dịch nào — Thêm giao dịch đầu tiên”.
- Error state markup with a “Thử lại” button and an explicit alert role.
- A widget boundary helper that executes a widget render/setup function,
  catches failures, logs them, and replaces only that widget with an inline
  error state.

The helpers return safe HTML or operate on an owned element, following the
existing escaping utilities and avoiding broad silent catches.

### Router lifecycle

The router remains responsible for page-level lifecycle:

1. Clear or replace the current page with the page skeleton for app routes.
2. Invoke the page renderer.
3. Wrap successful content in the existing page container convention.
4. Replace the page with a retryable error state if the renderer rejects.

Refreshing after `data:changed` uses the same guarded lifecycle rather than
silently logging and leaving stale or blank content.

### Feature views

Each app page identifies whether its returned data is loading, empty, or
available. Empty pages use the shared state component and a page-appropriate
primary CTA. Data-dependent regions (KPI, table, chart) render local
skeletons before data is available and use widget boundaries so one failed
region cannot blank the page. Existing event-bus and modal wiring remains the
integration mechanism.

### Toasts

Retain the existing `showToast` API and extend usage consistently across
create, update, delete, save, and reset operations. Success toasts are emitted
only after the awaited data operation succeeds; failures emit error toasts and
leave the relevant controls recoverable. Toast markup remains keyboard
accessible and uses buttons for actions.

## Interaction and accessibility rules

Add shared CSS rules for all interactive controls and links:

- `cursor: pointer`.
- 150ms transition for color, border, background, shadow, and transform.
- Hover affordance.
- Active state with `transform: scale(0.98)`.
- `:focus-visible` outline `2px` in the accent color with `2px` offset.
- `@media (prefers-reduced-motion: reduce)` disables shimmer, chart,
  transition, and transform animation while retaining usable focus and state
  changes.

Convert every `href="#"` that represents an action to a typed button,
including generated navigation controls that are event-driven. Real auth or
external/document destinations remain links; if an auth control is only an
event action, it becomes a button.

## Error handling

- Page render errors are handled by the router and expose retry.
- Widget render/data errors are isolated to their panel and expose retry for
  that widget where the operation can be retried.
- Data errors are surfaced through the existing toast system as well as the
  visible inline state where appropriate.
- No catch block returns success-shaped fallback data or suppresses errors.

## Verification

- Search source templates for action-role `href="#"` remnants.
- Run the repository smoke test against the dev server.
- Exercise the dashboard and each authenticated route with empty, populated,
  and forced-failure data paths where the current test harness supports them.
- Verify keyboard focus, button semantics, retry controls, local skeleton
  rendering, and reduced-motion CSS using the browser smoke test or equivalent
  DOM assertions.
