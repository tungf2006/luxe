# luxe
# Luxe — Personal Finance Dashboard

A vanilla-JS (ES modules) personal finance dashboard with charts, routing, and persistence.

## Commands

```bash
# Start local dev server (serves src/ on port 3000)
node server.js

# Run smoke test (requires server running on :3000)
node test-app.js
```

## Architecture

```
src/
├── app.js                  # Entry point — nav, theme, router init
├── router.js               # SPA router (hash-based, event bus)
├── index.html             # ES module shell (nav + #page-container)
├── styles.css             # Global styles
├── constants/
│   ├── navigation.js      # Page routes, nav items
│   └── categories.js      # Category definitions (single source of truth)
├── utils/
│   ├── format.js          # Date/currency/escape helpers
│   └── eventBus.js        # Pub/sub for cross-module events
├── services/
│   └── dataService.js     # localStorage CRUD for tx/budgets/settings
├── components/ui/
│   ├── Modal.js           # Modal open/close/focus-trap
│   ├── Toast.js           # Toast notifications
│   ├── TransactionCells.js # Table cell formatting (inline edit icons)
│   └── charts/
│       └── spendingChart.js  # Chart.js spending visualization
└── features/
    ├── dashboard/
    │   └── dashboardView.js
    ├── transactions/
    │   ├── transactionsView.js
    │   └── transactionForm.js
    ├── budgets/
    │   └── budgetsView.js
    ├── reports/
    │   └── reportsView.js
    └── settings/
        └── settingsView.js
```

## Conventions

- **No framework** — pure vanilla JS + native ES modules (`type="module"`)
- **No build step** — import paths use `./` or `../` relative to `src/`
- **Event bus** — feature modules communicate via `src/utils/eventBus.js` (`emit`/`on`) to avoid circular imports
- **Data** — `dataService` wraps `localStorage` with `luxe_` key prefix
- **Charts** — Chart.js (loaded from CDN in `index.html`)
- **Persistence** — `emit('data:changed')` after writes; router listens and re-renders the current page

## Testing

Tests use Puppeteer (the only npm dependency) against the live dev server.
