# אוזן — ניהול מועדון

אפליקציית דסקטופ לניהול מועדון לילה: יצירת אירועים ומחזור חיים, סיכומי אירוע, תשלומים ומעקב חשבוניות, ניהול מפיקים, צוות ושיבוץ משמרות. רב-משתמשי — כל משתמש מתחבר עם חשבון Google שלו. דורש חיבור לאינטרנט כדי לעבוד.

Desktop app for managing a night club — event lifecycle, per-event summaries, payments and invoice tracking, producers, staff & shifts. Multi-user: each user signs in with their own Google account. Requires an internet connection.

## Tech stack
- **Tauri v2** — Rust-based desktop shell (macOS + Windows)
- **React 19 + TypeScript + Vite** — UI
- **Supabase** — hosted Postgres + Google OAuth. Schema lives in the Supabase project (managed via the SQL editor, no local migrations); RLS delegates to an allowlist function `public.is_allowed_user()`.
- **react-router-dom** — hash-based routing
- **`@tauri-apps/plugin-deep-link`** — OAuth return via `ozen-manager://` custom scheme
- **`@tauri-apps/plugin-updater` / `-process`** — auto-updater via GitHub Releases

The desktop binary is a thin native shell around the React app; all data reads/writes go through `@supabase/supabase-js` directly from the frontend. There is no local database.

## Prerequisites
- Node.js 20+ and npm
- Rust toolchain (stable). Install via `rustup`:
  ```sh
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source "$HOME/.cargo/env"
  ```
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- A `.env` at the repo root with Supabase project credentials:
  ```
  VITE_SUPABASE_URL=https://<project-ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_...
  ```
  (Anon / publishable keys are safe to ship in the client — RLS protects the data.)

## Run locally
```sh
npm install
npm run tauri dev
```

The first Rust build takes 30–60 seconds; subsequent runs are fast. The app opens a native window, goes through AuthGate → LoginPage, and uses a localhost loopback OAuth flow to sign you in with Google.

## Build a distributable
```sh
npm run tauri build
```

Output is in `src-tauri/target/release/bundle/`. The release pipeline (`.github/workflows/release.yml`) tags builds `vX.Y.Z`, signs them with the Tauri updater key, and publishes macOS (`.dmg`) + Windows (`.exe`) artifacts as a GitHub Release.

## Project layout
```
src/
  App.tsx                    # router, auth gate, offline banner, sidebar
  db/
    supabase.ts              # typed client instance
    types.ts                 # row shapes mirroring the Supabase schema
  features/
    auth/                    # AuthGate, LoginPage, useIsAdmin
    dashboard/               # לוח בקרה
    events/                  # רשימה + לוח שנה + סיכומי אירועים
    summaries/               # per-event summary page, CSV upload, PDF invoice
    payments/                # tabbed by status, invoice upload, check tracking
    producers/               # רשימת מפיקים + דף מפיק
    staff/                   # ניהול צוות
    shifts/                  # used inside event detail
    updates/                 # auto-updater banner + provider
  services/
    network.ts               # withRetry (fetch-level retries)
    enums.tsx                # enum provider (statuses, event types)
    googleReauth.ts          # silent Google OAuth refresh
    driveUpload.ts           # per-user invoice upload to Drive
    backup.ts                # nightly xlsx export to Drive
  components/                # Modal, StatusBadge, BackupStatus, dialog
  styles/global.css          # dark theme, RTL-friendly
  utils/format.ts            # he-IL date/time helpers + datetime-local conversion
src-tauri/
  src/lib.rs                 # Tauri entry; registers plugins + custom commands
  src/auth_loopback.rs       # localhost OAuth callback listener
  src/drive_backup.rs        # Drive export (user OAuth token)
  src/drive_upload.rs        # invoice upload (user OAuth token)
```

## Language & UI direction
- Interface chrome is **Hebrew**, with `<html lang="he" dir="rtl">`.
- User-entered values (event names, staff names, notes, positions, producer names) can be Hebrew, English, or mixed — inputs and value cells use `dir="auto"` + `.row-value` so each string renders with the correct directionality regardless of language mix.

## Roadmap (deferred)
- Guest lists / RSVPs / ticketing
- Bar inventory
- Reports & analytics
- True offline mode (would require PowerSync / ElectricSQL or a custom sync engine)
- Automated tests and CI beyond the release pipeline
- Code signing for distribution
