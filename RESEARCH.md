# RESEARCH: Mortgage Broker CRM with AI Transcription & Policy Matching
Generated: 2026-03-02
Stack: Tauri 2 + React 19 + TypeScript + Rust + SQLite (confirmed optimal)

## STACK VERDICT

Current stack (Tauri 2 + React 19 + SQLite) is the best choice for 2026. No changes needed.
- Tauri 2: 2.5-10 MB bundle vs Electron's 85-120 MB, 30-40 MB idle RAM vs 200-300 MB
- React 19: largest ecosystem for Tauri, best hiring pool, TypeScript battle-tested
- SQLite: best for OLTP local-first desktop apps (used by Figma, Obsidian, Slack)
- Future option: swap to libSQL if cloud sync needed (drop-in SQLite replacement)

## INSTALL

```bash
# Frontend dependencies (new)
npm install zustand@5.0.11 @tanstack/react-table@8.21.3 @schedule-x/react@3.4.0 react-hook-form@7.71.2 react-email@5.2.9

# Dev dependencies (new)
npm install -D @biomejs/biome@2.4.4

# Upgrade Tailwind v3 -> v4
npm uninstall tailwindcss autoprefixer
npm install -D tailwindcss@4 @tailwindcss/postcss

# Initialize Biome
npx @biomejs/biome init

# Install Lefthook (git hooks)
brew install lefthook
lefthook install

# Tauri plugins
npm run tauri add fs
npm run tauri add http
npm run tauri add notification
npm run tauri add dialog

# Rust dependencies (add to src-tauri/Cargo.toml)
# mistralrs = "0.7"        # Local LLM inference
# spider = "2.39"           # Bank policy web scraping
# pdf_oxide = "0.3"         # PDF text extraction
# scraper = "0.18"          # HTML/CSS parsing
# tokio-cron-scheduler = "0.9"  # Background job scheduling
# thiserror = "1"           # Error handling
# tracing = "0.1"           # Logging/observability
# tracing-subscriber = "0.3"
```

## DEPENDENCIES

### Frontend (npm)
| package | version | purpose |
|---------|---------|---------|
| zustand | 5.0.11 | Global state management |
| @tanstack/react-table | 8.21.3 | Headless data tables |
| @schedule-x/react | 3.4.0 | Calendar/scheduling UI |
| react-hook-form | 7.71.2 | Form handling + validation |
| react-email | 5.2.9 | Email composition components |

### Backend (Cargo.toml)
| crate | version | purpose |
|-------|---------|---------|
| mistralrs | 0.7 | Local LLM inference (Rust) |
| spider | 2.39 | Web scraping with JS rendering |
| pdf_oxide | 0.3 | PDF text extraction (0.8ms/doc) |
| scraper | 0.18 | HTML/CSS selector parsing |
| tokio-cron-scheduler | 0.9 | Recurring background jobs |
| thiserror | 1 | Typed error handling |
| tracing | 0.1 | Structured logging |
| tracing-subscriber | 0.3 | Log output formatting |

### Already Installed (no action needed)
| package | version | purpose |
|---------|---------|---------|
| @tauri-apps/api | 2.10.1 | Tauri frontend API |
| react | 19.2.4 | UI framework |
| tailwindcss | 3.4.19 -> 4.x | Utility CSS (upgrade) |
| vite | 7.3.1 | Bundler |
| vitest | 4.0.18 | Test framework |
| whisper-rs | 0.13 | On-device transcription |
| rusqlite | 0.32 | SQLite bindings |
| reqwest | 0.12 | HTTP client |
| cpal | 0.15 | Audio capture |

## DEV DEPENDENCIES

| package | version | purpose |
|---------|---------|---------|
| @biomejs/biome | 2.4.4 | Linter + formatter (replaces ESLint+Prettier) |
| @tailwindcss/postcss | 4.x | Tailwind v4 PostCSS plugin |
| lefthook | 2.1.1 | Git hooks (brew install) |

## CONFIG FILES TO CREATE

### biome.json
```json
{
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentSize": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "trailingCommas": "es5",
      "arrowParentheses": "always",
      "semicolons": "always"
    }
  }
}
```

### lefthook.yml
```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{js,ts,tsx,json}"
      run: npx @biomejs/biome check --staged
    typecheck:
      glob: "*.{ts,tsx}"
      run: npx tsc --noEmit
    clippy:
      glob: "*.rs"
      run: cd src-tauri && cargo clippy --all-targets -- -D warnings
```

### postcss.config.mjs (replace existing postcss.config.js)
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

### src/index.css (update for Tailwind v4)
```css
@import "tailwindcss";

@theme {
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
}
```

### src-tauri/clippy.toml
```toml
msrv = "1.70"
allow-expect-in-tests = true
allow-unwrap-in-tests = true
```

### tsconfig.json (add these to existing compilerOptions)
```json
{
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "noImplicitOverride": true
}
```

## PROJECT STRUCTURE

```
brokerage-crm/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx         # Metrics, upcoming meetings
│   │   ├── Clients.tsx           # Client CRUD, documents, deals
│   │   ├── Meetings.tsx          # Recording, transcription, calendar
│   │   ├── BankPolicies.tsx      # Policy management, eligibility
│   │   ├── Settings.tsx          # OAuth, Whisper, profile config
│   │   └── Team.tsx              # Broker profile dashboard
│   ├── hooks/                    # NEW
│   │   ├── useTauriCommand.ts    # Typed invoke() wrapper with loading/error
│   │   ├── useAsync.ts           # Async Tauri call state management
│   │   └── useDatabase.ts       # DB query hook
│   ├── stores/                   # NEW (Zustand)
│   │   ├── clientStore.ts        # Client list, selection, search
│   │   ├── meetingStore.ts       # Meetings, recording state
│   │   ├── policyStore.ts       # Bank policies, match results
│   │   └── uiStore.ts           # Loading, notifications, modals
│   ├── types/                    # NEW
│   │   └── api.ts               # Shared TS interfaces matching Rust structs
│   ├── utils/
│   │   ├── policyMatching.ts    # Eligibility calculator (existing)
│   │   └── formatters.ts        # Currency, duration, time (existing)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri bootstrap (minimal)
│   │   ├── lib.rs               # State setup, command registration
│   │   ├── error.rs             # NEW: Centralized error types
│   │   ├── commands/            # NEW: Modular Tauri commands
│   │   │   ├── mod.rs
│   │   │   ├── clients.rs
│   │   │   ├── documents.rs
│   │   │   ├── meetings.rs
│   │   │   ├── policies.rs
│   │   │   ├── deals.rs
│   │   │   └── search.rs
│   │   ├── db/                  # NEW: Database layer
│   │   │   ├── mod.rs
│   │   │   ├── init.rs          # Schema + versioned migrations
│   │   │   ├── models.rs        # Struct definitions
│   │   │   └── queries.rs       # Reusable query helpers
│   │   ├── services/            # NEW: Business logic
│   │   │   ├── mod.rs
│   │   │   ├── recording.rs     # Audio capture + Whisper
│   │   │   ├── summarization.rs # LLM transcript processing
│   │   │   ├── policy_scraper.rs # Bank website scraping
│   │   │   └── email_drafter.rs # AI email composition
│   │   ├── background/         # NEW: Scheduled jobs
│   │   │   ├── mod.rs
│   │   │   ├── scheduler.rs    # tokio-cron job runner
│   │   │   └── jobs.rs         # Policy updates, email sync
│   │   └── oauth.rs            # OAuth PKCE (existing)
│   ├── capabilities/           # NEW: Tauri security
│   │   └── default.json
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── biome.json                  # NEW
├── lefthook.yml                # NEW
├── package.json
├── vite.config.ts
├── tsconfig.json
└── CLAUDE.md
```

## SETUP STEPS

1. Install new npm dependencies (see INSTALL section)
2. Upgrade Tailwind v3 to v4 and update index.css
3. Replace postcss.config.js with postcss.config.mjs
4. Delete tailwind.config.js (v4 uses CSS @theme)
5. Create biome.json and run `npx @biomejs/biome check` to verify
6. Install Lefthook and create lefthook.yml
7. Add new Rust crates to src-tauri/Cargo.toml
8. Install Tauri plugins (fs, http, notification, dialog)
9. Create src-tauri/capabilities/default.json
10. Create src/hooks/, src/stores/, src/types/ directories
11. Refactor lib.rs into commands/, db/, services/ modules
12. Run `cargo check` and `npx tsc --noEmit` to verify

## KEY PATTERNS

- **State: Three layers** - useState (local), Zustand (global UI), invoke() for DB reads
- **Commands: Modular Rust** - One file per domain in commands/, registered via generate_handler![]
- **Background jobs: tokio::spawn** - Policy scraping every 12h, email sync every 15m, emit events to frontend
- **DB migrations: PRAGMA user_version** - Auto-run versioned migrations on app startup, no external tools
- **LLM: Local-first via mistralrs** - On-device inference for transcript summarization and data extraction
- **Scraping: spider crate** - JS-rendered bank pages with headless Chrome CDP, caching, proxy support
- **Error handling: thiserror + serde** - Typed Rust errors serialize to frontend, hide internals
- **Forms: react-hook-form** - Uncontrolled inputs for performance, Zod schema validation
- **Tables: @tanstack/react-table** - Headless with Tailwind styling, sorting/filtering/pagination built-in
- **Hooks: useTauriCommand** - Typed wrapper around invoke() with loading/error state

## SOURCES

### Stack Validation
- https://blog.nishikanta.in/tauri-vs-electron-the-complete-developers-guide-2026
- https://dev.to/dataformathub/distributed-sqlite-why-libsql-and-turso-are-the-new-standard-in-2026-58fk
- https://www.analyticsvidhya.com/blog/2026/01/duckdb-vs-sqlite/

### Core Dependencies
- https://github.com/EricLBuehler/mistral.rs
- https://github.com/spider-rs/spider
- https://react.email
- https://github.com/yfedoseev/pdf_oxide
- https://tanstack.com/table/latest
- https://schedule-x.dev/
- https://react-hook-form.com/
- https://github.com/pmndrs/zustand

### Dev Tooling
- https://dev.to/pockit_tools/pnpm-vs-npm-vs-yarn-vs-bun-the-2026-package-manager-showdown-51dc
- https://vite.dev/blog/announcing-vite7
- https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/
- https://vitest.dev/blog/vitest-4
- https://www.edopedia.com/blog/lefthook-vs-husky/
- https://github.com/tauri-apps/tauri-action

### Architecture
- https://v2.tauri.app/start/project-structure/
- https://dev.to/n3rd/how-to-reasonably-keep-your-tauri-commands-organized-in-rust-2gmo/
- https://v2.tauri.app/develop/state-management/

### Config & Integration
- https://tailwindcss.com/blog/tailwindcss-v4
- https://v2.tauri.app/security/capabilities/
- https://v2.tauri.app/plugin/updater/
- https://v2.tauri.app/plugin/
