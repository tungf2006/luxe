# Luxe — Personal Finance Dashboard

<p align="center">
  <img src="css/logo/luxe-lx-logo.svg" alt="Luxe" width="80" />
</p>

<p align="center">
  <strong>Luxe</strong> is a vanilla-JS personal finance dashboard that helps you track spending, manage budgets, and build better financial habits — all in a refined, dark-themed interface.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#stack">Stack</a>
</p>

---

## Features

- 📊 **Dashboard** — KPI cards, spending charts, recent transactions, budget progress, and financial insights
- 💸 **Transactions** — Full CRUD with inline editing, filters, search, pagination, bulk actions, and undo delete
- 🎯 **Budgets** — Budget tracking with 3-level alert system (warning / danger / critical)
- 📈 **Reports** — Cash flow bar chart, category breakdown donut, and net worth trend
- ⚙️ **Settings** — Profile, currency, notifications, appearance, and security tabs with dirty-state save bar
- 🔐 **Auth** — Login, register, forgot password, email verification with Supabase or mock mode
- 🌍 **i18n** — Vietnamese & English translations with no global leak
- 📱 **Responsive** — Mobile-first with bottom nav, FAB, and more-sheet

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (serves src/ on port 3000)
node server.js

# Run smoke test (requires server running on :3000)
npm run smoke
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

## Stack

- **No framework** — pure vanilla JS + native ES modules (`type="module"`)
- **No build step** — import paths use `./` or `../` relative to `src/`
- **Event bus** — feature modules communicate via `src/utils/eventBus.js` (`emit`/`on`) to avoid circular imports
- **Data** — `dataService` wraps `localStorage` with `luxe_` key prefix
- **Charts** — Chart.js (loaded from CDN in `index.html`)
- **Persistence** — `emit('data:changed')` after writes; router listens and re-renders the current page
- **Visual assets** — CSS-only backgrounds (radial gradients, repeating-linear-gradient patterns, pseudo-elements); no images in cards, tables, or charts; dark charcoal (#0B0B0D) base with emerald green (#22C55E) accents

## Testing

Tests use Puppeteer (the only npm dependency) against the live dev server.

```bash
npm run smoke    # Run smoke test
npm run test     # Run donut chart test
```

## License

MIT
