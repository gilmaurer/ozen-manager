# Design: Per-page back button with state restoration

**Date:** 2026-06-11
**Status:** Approved

## Problem

Pages have no consistent "back" affordance. The few that do (`EventDetailPage`,
`EventSummaryPage`, `ProducerDetailPage`) use hardcoded `<Link to="/...">` back
links that jump to a fixed route and **lose the list's filter state** — month
cursor, search text, sort, view toggle, scope all live in in-memory `useState`
and reset when the page remounts.

## Goal

A back button on **every page** that:

1. Returns to the page the user **actually came from** (true browser-history
   back, `navigate(-1)`), not a fixed parent.
2. Restores the **last state** of the page being returned to — list filters
   **and** scroll position — so it feels like the user never left.

Scoped to within a session: a full app restart is a fresh start (state is held
in memory, not persisted to disk).

## Approach (chosen)

In-memory page-state cache + `navigate(-1)`. A module-level cache (lives outside
React, survives page unmount) holds ephemeral page state and scroll positions.
Rich values (`Date`, `Map`) are kept as-is with no serialization. Chosen over
URL search params (invasive rewrite, awkward under HashRouter) and sessionStorage
(serialization boilerplate for a reload-survival benefit that rarely applies in a
Tauri app).

## Architecture

The feature has two independent pieces: the back button itself, and state
preservation. State preservation further splits into **scroll** (centralized,
covers all pages) and **filters** (per-list-page).

### 1. Building blocks (new files)

**`src/components/BackButton.tsx`**
- Renders a button labeled **`אחורה`** with a right-pointing chevron `›`
  (correct "back" direction in RTL), `className="btn btn-secondary back-btn"`.
- On click: `navigate(-1)`.
- Hidden at the history root: reads `(window.history.state as { idx?: number })
  ?.idx ?? 0` (React Router v6 maintains this `idx`; `0` = first entry) and
  returns `null` when there is nowhere to go back to. So the first page after
  login shows no button.

**`src/hooks/usePersistentState.ts`**
- `usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>]`
  — a drop-in replacement for `useState`.
- Backed by a module-level `Map<string, unknown>` defined at module scope (outside
  any component) so values survive page unmount for the session lifetime.
- On mount: if `key` exists in the cache, hydrate from it; otherwise use `initial`.
- On every change: write the new value through to the cache (in addition to React
  state), so the latest value is available when the page remounts.
- No serialization — stores `Date`, `Map`, etc. directly.

### 2. Centralized scroll restoration

**`src/hooks/useMainScrollRestoration.ts`**, called once inside the router (in
`App`, inside `<HashRouter>`).
- The scroll container is the shared `<main className="main">` (it has
  `overflow-y: auto`); all pages render inside it.
- Keys `main.scrollTop` by `location.key` (React Router assigns a stable key per
  history entry; returning to an entry via back yields the same key).
- Behavior:
  - Before navigating away, save the outgoing entry's `scrollTop` into the cache
    keyed by its `location.key`.
  - On `POP` navigation (back/forward), restore the saved `scrollTop` for the new
    `location.key` via `useLayoutEffect` (after paint of the restored content).
  - On a fresh `PUSH`, scroll to top.
- Because it operates at the `<main>` level, it restores scroll for **all** pages
  (including detail pages) with zero per-page edits.

Implementation note: the hook locates the container via a ref passed from `App`
to `<main>` (preferred) or `document.querySelector(".main")` as a fallback. It
keeps an in-cache map of `location.key -> scrollTop` and reads `navigationType`
from `useNavigationType()` to distinguish POP from PUSH/REPLACE.

### 3. Per-page filter persistence

Each list page swaps its **ephemeral** `useState` calls for `usePersistentState`
with a page-scoped key prefix. State already persisted to `localStorage` (Events'
`view` and `scope`) is left as-is.

| Page | Keys to persist |
|------|-----------------|
| `EventsPage` (`src/features/events/EventsPage.tsx`) | `events.filters`, `events.monthCursor`, `events.summarySort`, `events.eventsSort`, `events.allTimes` |
| `PaymentsPage` (`src/features/payments/PaymentsPage.tsx`) | payments filters, month cursor, sort |
| `ProducersPage` (`src/features/producers/ProducersPage.tsx`) | producer search filter, sort |
| `ForecastPage` (`src/features/forecast/ForecastPage.tsx`) | month cursor, sort |
| `DashboardPage` (`src/features/dashboard/DashboardPage.tsx`) | its month cursor |

Detail pages (`EventDetailPage`, `EventSummaryPage`, `ProducerDetailPage`) hold no
list filters and need no per-page changes; scroll restoration (§2) covers them.

Exact key names are finalized during implementation against each page's actual
state variables, but follow the `<page>.<stateName>` convention.

### 4. Placement, RTL, and existing links

- Render `<BackButton />` **once, centrally** — inside `<main className="main">`
  directly above `<Routes>` in `App`. Because every page renders inside `<main>`,
  this puts a single consistent back button at the top of the content area for
  **every** route, with zero per-page button edits. It auto-hides at the history
  root (so the first page after login shows nothing).
- `.back-btn` CSS: small secondary button with a bottom margin. In RTL it
  naturally sits at the inline-start (right). The `›` glyph points right (back
  direction in RTL).
- The existing prominent "חזרה לX" links live only in the detail pages'
  *not-found* cards (`EventDetailPage`, `EventSummaryPage`, `ProducerDetailPage`).
  With the central back button now above them, those in-card links are redundant
  and are **removed**.
- Keep the small breadcrumb links (e.g. `<Link to="/events">אירועים</Link> ›`) as
  breadcrumbs.

## Error handling / edge cases

- **History root:** button hidden when `idx === 0` (nothing to go back to).
- **Missing `window.history.state.idx`:** default to `0` (hide), so a missing
  value never produces a broken button.
- **Scroll container absent or key not yet in cache:** restore is a no-op (stays
  at top); never throws.
- **Cache miss for filters:** `usePersistentState` falls back to `initial`,
  identical to today's behavior.

## Testing / verification

No test framework in the repo (per CLAUDE.md). Verify manually via
`npm run tauri dev`:
1. Events list → filter to a non-current month + type a producer search + sort a
   column + scroll down → open an event → click `אחורה` → month, search, sort, and
   scroll position are all restored.
2. Repeat the filter/scroll check for Payments, Producers, Forecast.
3. The first page after login shows **no** back button (history root).
4. RTL: button sits on the right, chevron points right, label reads `אחורה`.
5. Detail pages: scroll down a long detail page, navigate away and back → scroll
   restored.

## Changelog

Per repo convention ([[feedback_changelog_entries]]), add a Hebrew bullet to
`src/features/changelog/entries.ts` describing the new back button before
committing.

## Out of scope

- Persisting state across full app restarts (would require sessionStorage/disk).
- Encoding filters in the URL / shareable links.
- Forward-button UI (browser forward is not surfaced).
