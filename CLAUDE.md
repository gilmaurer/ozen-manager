# CLAUDE.md — ozen-manager

Project context for future Claude Code sessions working in this repo.

## What this is
Desktop app for night club management (events, dashboard, staff, shifts, producers). Multi-user (3–4 users signing in with their own Google account), cross-platform (macOS + Windows via Tauri). Data lives in Supabase; the app needs an internet connection to open.

## Stack
- **Shell:** Tauri v2 (Rust)
- **UI:** React 18 + TypeScript + Vite + react-router-dom (HashRouter)
- **DB + Auth:** Supabase (Postgres + Google OAuth). `@supabase/supabase-js` on the frontend; schema + RLS policies live in the Supabase project (not in migrations).
- **Deep-linking:** `@tauri-apps/plugin-deep-link` — OAuth redirects come back to the app via the `ozen-manager://` custom scheme.
- **No state library** (Redux/Zustand). Pages hold their own state + call repos directly.
- **No test framework yet.** Add when domain stabilizes.

## File layout conventions
- Per-feature folder under `src/features/<name>/` containing `Page.tsx`, `Form.tsx`, and `repo.ts`.
- Shared UI primitives under `src/components/` (keep small — `Modal`, `StatusBadge`).
- All Supabase access goes through `src/db/supabase.ts` → `supabase` client. Repos in `*/repo.ts` wrap calls in `withRetry()` from `src/services/network.ts`.
- Row types in `src/db/types.ts`. Keep DB row shape and TS type in lock-step when the Supabase schema changes.

## Language convention (important)
- UI chrome is **Hebrew**. HTML root is `<html lang="he" dir="rtl">`.
- User-entered values may be Hebrew, English, or mixed — any component rendering a user value adds `dir="auto"` and the `.row-value` class (which sets `unicode-bidi: plaintext`). Same for form `<input>` / `<textarea>` fields holding user text.
- When adding new UI, all new labels/headers/buttons should be in Hebrew.
- Dates/times formatted with `Intl.DateTimeFormat("he-IL", ...)` via `src/utils/format.ts`. Use those helpers — do not build date strings ad-hoc.

## Domain vocabulary (Hebrew ↔ DB)
| UI (Hebrew)    | Code / DB            | Notes |
|----------------|----------------------|-------|
| אירוע           | `events` table       | A scheduled party/show. 7-state lifecycle `status`. |
| מפיק            | `producers` table    | First-class entity. Events FK `producer_id` with `ON DELETE RESTRICT`. |
| צוות            | `staff` table        | People who work shifts. `active: boolean`. |
| משמרת           | `shifts` table       | Joins an event to a staff member with optional times + position. |
| לוח בקרה        | `DashboardPage`      | Upcoming events (14d) + today's shifts. |
| תפקיד           | `staff.role` or `shifts.position` | Role label. |

## Datetime storage
- `events.date` → Postgres `DATE` (`YYYY-MM-DD`, no time).
- `shifts.starts_at` / `ends_at` → Postgres `TIMESTAMPTZ`; Supabase returns ISO-8601 strings.
- `utils/format.ts#fromInputLocal` / `#toInputLocal` still handle `<input type="datetime-local">` ↔ storage.
- Display helpers: `formatDateTime`, `formatDate`, `formatTime` — all `he-IL`.

## Env vars (not committed)
`.env` at repo root:
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```
Anon / publishable keys are safe to embed in client apps — RLS protects the data.

## Supabase schema + RLS
Schema was loaded once via the Supabase SQL editor (see `/Users/gil.maurer/.claude/plans/how-can-i-ran-async-twilight.md` for the original block). User allowlist lives in a SQL function `public.is_allowed_user()` — to add or remove a user, edit that function in the Supabase SQL editor. The RLS policies on all four tables delegate to it.

Adding a column or table: run the `ALTER TABLE` / `CREATE TABLE` directly in the Supabase SQL editor. Update `src/db/types.ts` to match. No client-side migration files anymore.

## Auth flow
- First launch: `AuthGate` (`src/features/auth/AuthGate.tsx`) shows `LoginPage` — one "התחבר עם Google" button.
- Click → `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "ozen-manager://auth/callback" } })`.
- System browser handles Google consent; Google redirects to Supabase; Supabase redirects to the custom scheme. The deep-link handler in `AuthGate` calls `exchangeCodeForSession` to complete.
- Session persists in localStorage. Sign out via the sidebar footer button.

## Network resilience
- No true offline — the app needs net to open.
- Brief drops handled by `src/services/network.ts#withRetry` (1s/3s/10s/30s backoff for `fetch`-level errors; non-network errors rethrow immediately).
- Every repo mutator wraps in `withRetry`.
- `<OfflineBanner>` in `App.tsx` reads `navigator.onLine` and shows a sticky banner when the OS reports no network.

## Running
- Dev: `npm run tauri dev` (rebuilds Rust on first run — slow; subsequent runs are fast).
- Prod build: `npm run tauri build`.
- Clear local session: sign out via the UI button, or clear site data for the app's web view.

## Drive backup (manual export)
The app can export the full DB as `ozen-manager.xlsx` to a shared Google Drive folder via the sidebar footer button. Uses a service account; see setup below. Since Supabase is the source of truth, this is for human-readable reporting only — not a sync mechanism.

Setup (one-time per machine):
1. Create a GCP service account, download JSON key.
2. Share the Drive folder with the service account's `client_email` as Editor.
3. Create `~/Library/Application Support/com.gilmaurer.ozenmanager/drive-backup.json`:
   ```json
   {
     "folder_id": "1Sqs6KC8pjrjbwmNuoPpqTQBIeOehM76b",
     "service_account": { ...full JSON key contents... }
   }
   ```

Without this file the button shows `ייצוא לא מוגדר`; the app itself keeps working.

Rust implementation: `src-tauri/src/drive_backup.rs`. Frontend: `src/services/backup.ts` + `src/components/BackupStatus.tsx`.

## Deferred / out of scope (don't build unless asked)
- Guest lists / ticketing
- Inventory
- Analytics / reports
- True offline mode (requires PowerSync/ElectricSQL or a custom sync engine)
- Tests, CI, signing

## UI conventions

### Producer filter
Whenever a list needs a "filter by producer" control, it is a **free-text search**, not a dropdown — the club will eventually have many producers, so dropdowns don't scale. Implementation pattern:

- Filter state holds a string (`producer: string`), not a producer id.
- Match is a case-insensitive substring check against `producer_name` (or the producer row's `name`).
- The input uses `className="filter-search filter-search-sm"` so it renders narrower than the primary name/event search (see `.filter-search-sm` in `src/styles/global.css`). This is the visual standard across Events, Payments, and Producers pages — keep it consistent when adding new producer filters.
- Placeholder: `חיפוש לפי מפיק` (or `חיפוש לפי שם` if the page is the producers list itself, matching on `producers.name`).

Existing references: `src/features/events/EventsPage.tsx`, `src/features/payments/PaymentsPage.tsx`, `src/features/producers/ProducersPage.tsx`.

## Working style preferences
- Keep components small; repos flat (no ORM layer).
- Don't over-abstract — three similar forms is fine, no form factory.
- Stay Hebrew-first. Don't introduce i18n unless explicitly requested.
- All new UI must be checked for RTL correctness (alignment, icon sides, bidi on user values).
