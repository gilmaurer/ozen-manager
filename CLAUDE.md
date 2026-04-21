# CLAUDE.md — ozen-manager

Project context for future Claude Code sessions working in this repo.

## What this is
Desktop app for night club management (events, dashboard, staff, shifts). Single-operator, single-machine, offline-first. Gil is the sole user and developer.

## Stack
- **Shell:** Tauri v2 (Rust)
- **UI:** React 18 + TypeScript + Vite + react-router-dom (HashRouter)
- **DB:** Local SQLite via `tauri-plugin-sql`; migrations are Rust-embedded strings in `src-tauri/src/lib.rs` that read `src-tauri/migrations/*.sql` via `include_str!`
- **No state library** (Redux/Zustand). Pages hold their own state + call repos directly.
- **No test framework yet.** Add when domain stabilizes.

## File layout conventions
- Per-feature folder under `src/features/<name>/` containing `Page.tsx`, `Form.tsx`, and `repo.ts`.
- Shared UI primitives under `src/components/` (keep small — `Modal`, `StatusBadge`).
- All DB access goes through `src/db/client.ts` → `getDb()`. Repos in `*/repo.ts` import from there.
- Row types in `src/db/types.ts`. Keep DB row shape and TS type in lock-step when the schema changes.

## Language convention (important)
- UI chrome is **Hebrew**. HTML root is `<html lang="he" dir="rtl">`.
- User-entered values may be Hebrew, English, or mixed — any component rendering a user value adds `dir="auto"` and the `.row-value` class (which sets `unicode-bidi: plaintext`). Same for form `<input>` / `<textarea>` fields holding user text.
- When adding new UI, all new labels/headers/buttons should be in Hebrew.
- Dates/times formatted with `Intl.DateTimeFormat("he-IL", ...)` via `src/utils/format.ts`. Use those helpers — do not build date strings ad-hoc.

## Domain vocabulary (Hebrew ↔ DB)
| UI (Hebrew)    | Code / DB            | Notes |
|----------------|----------------------|-------|
| אירוע           | `events` table       | A scheduled party/show. Has `status` = draft / published / archived. |
| צוות            | `staff` table        | People who work shifts. `active = 0/1`. |
| משמרת           | `shifts` table       | Joins an event to a staff member with optional times + position. |
| לוח בקרה        | `DashboardPage`      | Upcoming events (14d) + today's shifts. |
| אזור / חלל      | `events.venue_area`  | Which part of the venue (main floor, lounge…). |
| תפקיד           | `staff.role` or `shifts.position` | Role label. |

## Datetime storage
- All datetimes stored in SQLite as UTC strings (`YYYY-MM-DD HH:MM:SS`).
- `utils/format.ts#fromInputLocal` converts a browser `<input type="datetime-local">` local value → UTC string for storage.
- `utils/format.ts#toInputLocal` does the reverse for edit forms.
- Display: `formatDateTime`, `formatDate`, `formatTime` — all `he-IL`.

## Adding a migration
1. Create `src-tauri/migrations/NNN_description.sql`.
2. Append a `Migration { version: N, ... include_str!("../migrations/NNN_description.sql") ... }` entry in `src-tauri/src/lib.rs`.
3. Bump the version number strictly upward — `tauri-plugin-sql` records applied versions.
4. Never edit applied migrations. New column? New migration.

## Running
- Dev: `npm run tauri dev` (rebuilds Rust on first run — slow; subsequent runs are fast).
- Prod build: `npm run tauri build`.
- Reset DB: delete `~/Library/Application Support/com.gilmaurer.ozenmanager/ozen.db` (macOS path) and relaunch.

## Deferred / out of scope (don't build unless asked)
- Guest lists / ticketing
- Inventory
- Analytics / reports
- Multi-user / auth
- Remote sync (intentionally local-only for now)
- Tests, CI, signing

## Working style preferences
- Keep components small; repos flat (no ORM layer, no query-builder).
- Don't over-abstract — three similar forms is fine, no form factory.
- Stay Hebrew-first. Don't introduce i18n unless explicitly requested.
- All new UI must be checked for RTL correctness (alignment, icon sides, bidi on user values).
