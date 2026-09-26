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
- **Visual assets** — CSS-only backgrounds (radial gradients, repeating-linear-gradient patterns, pseudo-elements); no images in cards, tables, or charts; dark charcoal (#0B0B0D) base with emerald green (#22C55E) accents

## Testing

Tests use Puppeteer (the only npm dependency) against the live dev server.

## Headroom Integration (Context Compression)

This project is integrated with [Headroom](https://github.com/headroomlabs-ai/headroom) for context compression during development.

### Setup

Headroom CLI is installed as a uv tool. The proxy runs on `http://127.0.0.1:8787`.

### Usage

When working with AI agents (Claude Code, Copilot, etc.), route through the Headroom proxy:
```bash
# Claude Code
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 claude

# Codex / OpenAI compatible
OPENAI_BASE_URL=http://127.0.0.1:8787/v1 your-app
```

### MCP Server

The `.mcp.json` file configures the Headroom MCP server for AI agents that support MCP:
- `headroom_compress` - Compress messages before sending to an LLM
- `headroom_retrieve` - Retrieve original (uncompressed) messages
- `headroom_stats` - View compression statistics

### Memory

Cross-agent memory is enabled for persistent context across sessions. View and manage memories:
```bash
headroom memory list
headroom memory stats
```

### Output Token Reduction

Headroom's output shaper is enabled (`HEADROOM_OUTPUT_SHAPER=1`) to reduce verbose agent responses.

### Dashboard

View live savings statistics:
```bash
headroom dashboard  # http://127.0.0.1:8787/dashboard
```

### Learn from Failed Sessions

After debugging failed development sessions, run:
```bash
headroom learn --verbosity --apply  # Writes corrections to CLAUDE.local.md (gitignored)
```
