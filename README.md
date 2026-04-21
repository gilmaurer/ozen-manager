# אוזן — ניהול מועדון

אפליקציית דסקטופ לניהול מועדון לילה: יצירת אירועים, לוח בקרה, ניהול צוות ושיבוץ משמרות. הנתונים נשמרים במסד נתונים מקומי (SQLite) על המחשב שלך — ללא שרת, עובד גם בלי אינטרנט.

Desktop app for managing a night club — event creation, dashboard, staff & shift management. Data is persisted locally in SQLite; no server required, works offline.

## Tech stack
- **Tauri v2** — Rust-based desktop shell
- **React 18 + TypeScript + Vite** — UI
- **SQLite** via `tauri-plugin-sql` — local DB, auto-migrated on startup
- **react-router-dom** — hash-based routing

## Prerequisites
- Node.js 20+ and npm
- Rust toolchain (stable). Install via `rustup`:
  ```sh
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source "$HOME/.cargo/env"
  ```
- macOS: Xcode Command Line Tools (`xcode-select --install`)

## Run locally
```sh
npm install
npm run tauri dev
```

The first launch creates `ozen.db` in the app-data directory and seeds it with mock data so the app is usable immediately.

- macOS: `~/Library/Application Support/com.gilmaurer.ozenmanager/ozen.db`
- Linux: `~/.local/share/com.gilmaurer.ozenmanager/ozen.db`
- Windows: `%APPDATA%\com.gilmaurer.ozenmanager\ozen.db`

To start fresh, delete that file and relaunch — migrations will run again.

## Build a distributable
```sh
npm run tauri build
```

Output is in `src-tauri/target/release/bundle/`.

## Project layout
```
src/
  App.tsx                  # router + sidebar layout
  db/client.ts             # cached Database handle
  db/types.ts              # row shapes
  features/
    dashboard/             # לוח בקרה
    events/                # אירועים + פרטי אירוע
    staff/                 # צוות
    shifts/                # shift form + repo (used inside event detail)
  components/              # Modal, StatusBadge
  styles/global.css        # dark theme, RTL-friendly
  utils/format.ts          # he-IL date/time helpers + datetime-local conversion
src-tauri/
  src/lib.rs               # Tauri entry; registers tauri-plugin-sql
  migrations/001_init.sql  # schema
  migrations/002_seed.sql  # mock data
```

## Language & UI direction
- Interface chrome (headers, labels, buttons, nav) is **Hebrew**, with `<html lang="he" dir="rtl">`.
- User-entered values (event names, staff names, notes, positions) can be Hebrew, English, or mixed — inputs and value cells use `dir="auto"` so each string renders with the correct directionality.

## Roadmap (deferred)
- Guest lists / RSVPs / ticketing
- Bar inventory
- Reports & analytics (revenue per event, attendance, peak hours)
- Packaging & code signing for distribution
