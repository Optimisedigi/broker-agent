# Broker Agent CRM

A secure, local-first desktop CRM for mortgage brokers. Tauri 2 app with Rust backend and React/TypeScript frontend. All data stored locally in SQLite with on-device Whisper transcription.

## Project Structure

```
src/                              # React TypeScript frontend
  ├── components/
  │   ├── Dashboard.tsx           # Metrics, upcoming meetings, quick actions
  │   ├── Clients.tsx             # Client CRUD, documents, deals, policy matching
  │   ├── Meetings.tsx            # Recording, transcription, calendar events
  │   ├── BankPolicies.tsx        # Policy management and eligibility matching
  │   ├── Settings.tsx            # OAuth connections, Whisper model, profile
  │   └── Team.tsx                # Team/broker profile dashboard
  ├── App.tsx                     # Navigation shell, view routing, zoom
  ├── main.tsx                    # React entry point
  └── index.css                   # Tailwind + custom styles

src-tauri/                        # Rust backend
  ├── src/
  │   ├── lib.rs                  # Core: DB schema, all commands, recording, Whisper
  │   ├── oauth.rs                # OAuth PKCE, Gmail/Outlook sync, calendar API
  │   └── main.rs                 # Tauri bootstrap
  ├── Cargo.toml                  # Rust dependencies
  └── tauri.conf.json             # App config, window, bundle settings
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Rust, Tauri 2, SQLite (rusqlite), whisper-rs
- **APIs**: Gmail API, Microsoft Graph (OAuth2 PKCE), Google/Outlook Calendar
- **Audio**: cpal (capture), hound (WAV), whisper-rs (transcription)

## Key Architecture

- Frontend calls Rust via `invoke('command_name', { args })` from `@tauri-apps/api/core`
- DB connection: `Arc<Mutex<Connection>>` in `AppState`, never held across `.await`
- OAuth tokens stored in `oauth_tokens` table, auto-refresh before expiry
- Whisper large-v3 model downloaded on first use to `~/Library/Application Support/BrokerageCRM/`
- Documents stored as base64 data URIs in `documents.file_data` column

## Organization Rules

- One React component per file in `src/components/`
- All Tauri commands in `src-tauri/src/lib.rs` (DB, recording, Whisper) or `src-tauri/src/oauth.rs` (OAuth, sync, calendar)
- Register new commands in `generate_handler![]` in `lib.rs`
- DB migrations via `init_db()` using `ALTER TABLE` for new columns

## Code Quality

After editing files, run:

```bash
# Rust
cargo check --manifest-path src-tauri/Cargo.toml

# TypeScript
npx tsc --noEmit
```

Fix ALL errors before continuing.

To run the app:

```bash
npm run tauri dev
```

## Database

Located at `~/Library/Application Support/BrokerageCRM/database.db`. Tables: `clients`, `documents`, `meetings`, `bank_policies`, `deals`, `deal_events`, `email_imports`, `oauth_tokens`, `broker_profile`. Numeric columns may contain TEXT from legacy inserts; use `get_opt_f64()` helper when reading.

## OAuth Credentials

- Google Web Client ID: `706581607048-l3vj1b0gg3v7gt2b7ge5300dd76f92rf.apps.googleusercontent.com`
- Microsoft Client ID: `e01aaedb-6e8b-4bbf-8220-a512eaed8956`
- Redirect URI: `http://localhost:9876/callback`
