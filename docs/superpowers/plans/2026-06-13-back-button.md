# Back Button with State Restoration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one consistent "אחורה" back button to every page that returns to the previous page (true history back) with the list's filters and scroll position restored.

**Architecture:** A single `<BackButton>` rendered centrally in `<main>` (above `<Routes>`) calls `navigate(-1)` and hides at the history root. A module-level in-memory cache survives page unmounts: `usePersistentState` (a drop-in `useState` replacement) restores list filters on remount, and `useMainScrollRestoration` restores the shared `<main>` scroll position per history entry.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6 (HashRouter), Vite, Tauri v2.

> **No test framework in this repo** (per CLAUDE.md — "No test framework yet"). Automated verification per task is the TypeScript compiler: `npx tsc --noEmit` (tsconfig has `noEmit: true`). Behavioral verification is a single manual pass at the end (Task 11) via `npm run tauri dev`. Commit after every task.

---

## File Structure

**New files:**
- `src/hooks/usePersistentState.ts` — module-cached `useState` replacement (filters survive unmount).
- `src/hooks/useMainScrollRestoration.ts` — saves/restores `<main>` scrollTop keyed by history entry.
- `src/components/BackButton.tsx` — the `אחורה` button (`navigate(-1)`, hidden at root).
- `src/components/ScrollRestorer.tsx` — tiny wrapper that calls `useMainScrollRestoration` inside router context; renders `null`.

**Modified files:**
- `src/App.tsx` — add `mainRef` on `<main>`, render `<ScrollRestorer>` and `<BackButton>` inside the router.
- `src/styles/global.css` — `.back-btn` rule.
- `src/features/events/EventsPage.tsx` — swap 5 `useState` calls for `usePersistentState`.
- `src/features/payments/PaymentsPage.tsx` — swap 6 `useState` calls.
- `src/features/producers/ProducersPage.tsx` — swap 3 `useState` calls.
- `src/features/forecast/ForecastPage.tsx` — swap 4 `useState` calls.
- `src/features/dashboard/DashboardPage.tsx` — swap 1 `useState` call.
- `src/features/events/EventDetailPage.tsx`, `src/features/summaries/EventSummaryPage.tsx`, `src/features/producers/ProducerDetailPage.tsx` — remove redundant in-card back links.
- `src/features/changelog/entries.ts` — Hebrew changelog bullet.

---

## Task 1: `usePersistentState` hook

**Files:**
- Create: `src/hooks/usePersistentState.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Drop-in replacement for useState whose latest value is mirrored into a
 * module-level cache. The cache lives outside React, so the value survives a
 * component unmount for the lifetime of the session (until full app restart).
 * On remount the hook hydrates from the cache instead of `initial`.
 *
 * Keys must be unique per logical piece of page state, e.g. "events.filters".
 * Holds rich values (Date, Map) directly — no serialization.
 */
const cache = new Map<string, unknown>();

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (cache.has(key)) return cache.get(key) as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  const setPersistent: Dispatch<SetStateAction<T>> = (value) => {
    setState((prev) => {
      const next =
        typeof value === "function"
          ? (value as (p: T) => T)(prev)
          : value;
      cache.set(key, next);
      return next;
    });
  };

  return [state, setPersistent];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePersistentState.ts
git commit -m "feat: usePersistentState hook (session-cached useState)"
```

---

## Task 2: `useMainScrollRestoration` hook

**Files:**
- Create: `src/hooks/useMainScrollRestoration.ts`

Restores scroll only on back/forward (`POP`); resets to top on a fresh `PUSH`. Because list pages re-fetch data on mount (content height starts at 0), a single set won't stick — the hook retries on `requestAnimationFrame` until the container is tall enough or ~1.2s elapses.

- [ ] **Step 1: Create the hook**

```ts
import { useEffect, useLayoutEffect, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// scrollTop keyed by history entry key (stable across back/forward).
const scrollPositions = new Map<string, number>();

export function useMainScrollRestoration(
  containerRef: RefObject<HTMLElement | null>,
): void {
  const location = useLocation();
  const navType = useNavigationType(); // "POP" | "PUSH" | "REPLACE"

  // Continuously record the current entry's scroll position.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      scrollPositions.set(location.key, el.scrollTop);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, location.key]);

  // On navigation: restore (POP) or reset to top (PUSH/REPLACE).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (navType !== "POP") {
      el.scrollTop = 0;
      return;
    }

    const target = scrollPositions.get(location.key) ?? 0;
    if (target === 0) {
      el.scrollTop = 0;
      return;
    }

    const start = performance.now();
    let raf = 0;
    const tryRestore = () => {
      el.scrollTop = target;
      const reached = Math.abs(el.scrollTop - target) < 2;
      const contentTallEnough = el.scrollHeight - el.clientHeight >= target;
      if (!reached && !contentTallEnough && performance.now() - start < 1200) {
        raf = requestAnimationFrame(tryRestore);
      }
    };
    raf = requestAnimationFrame(tryRestore);
    return () => cancelAnimationFrame(raf);
  }, [containerRef, location.key, navType]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMainScrollRestoration.ts
git commit -m "feat: useMainScrollRestoration hook"
```

---

## Task 3: `BackButton` + `ScrollRestorer` components and CSS

**Files:**
- Create: `src/components/BackButton.tsx`
- Create: `src/components/ScrollRestorer.tsx`
- Modify: `src/styles/global.css` (append after the `.btn-danger` rules, ~line 409)

- [ ] **Step 1: Create `BackButton.tsx`**

`useLocation()` is called purely to force a re-render on every navigation so the
freshly-read history `idx` is correct. React Router v6 stores `{ usr, key, idx }`
in `window.history.state`; `idx === 0` is the first entry (nothing to go back to).

```tsx
import { useLocation, useNavigate } from "react-router-dom";

export function BackButton() {
  const navigate = useNavigate();
  useLocation(); // re-render on navigation so the history idx below is fresh

  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx <= 0) return null;

  return (
    <button
      type="button"
      className="btn btn-secondary back-btn"
      onClick={() => navigate(-1)}
    >
      › אחורה
    </button>
  );
}
```

- [ ] **Step 2: Create `ScrollRestorer.tsx`**

```tsx
import { type RefObject } from "react";
import { useMainScrollRestoration } from "../hooks/useMainScrollRestoration";

export function ScrollRestorer({
  mainRef,
}: {
  mainRef: RefObject<HTMLElement | null>;
}) {
  useMainScrollRestoration(mainRef);
  return null;
}
```

- [ ] **Step 3: Append `.back-btn` CSS to `src/styles/global.css`**

```css
.back-btn {
  align-self: flex-start;
  margin-bottom: 16px;
  padding: 4px 12px;
  font-size: 13px;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BackButton.tsx src/components/ScrollRestorer.tsx src/styles/global.css
git commit -m "feat: BackButton and ScrollRestorer components"
```

---

## Task 4: Wire BackButton + ScrollRestorer into App

**Files:**
- Modify: `src/App.tsx` (imports near top; the `App` default export's JSX, ~lines 236-266)

- [ ] **Step 1: Add imports**

Add alongside the other component imports near the top of `src/App.tsx`:

```tsx
import { useRef } from "react";
import { BackButton } from "./components/BackButton";
import { ScrollRestorer } from "./components/ScrollRestorer";
```

Note: `useRef` may need to be merged into the existing
`import { useEffect, useRef, useState } from "react";` line (it is already
imported there — verify and avoid a duplicate import).

- [ ] **Step 2: Add the ref and render the new components**

In the `App` default export, add a ref and attach it to `<main>`, then render
`<ScrollRestorer>` and `<BackButton>` inside `<main>` above `<Routes>`.

Replace this block:

```tsx
export default function App() {
  return (
    <AuthGate>
      <EnumsProvider>
        <DialogProvider>
          <UpdaterProvider>
            <HashRouter>
              <UpdateBanner />
              <OfflineBanner />
              <WhatsNewGate />
              <div className="layout">
                <Sidebar />
                <main className="main">
                  <Routes>
```

with:

```tsx
export default function App() {
  const mainRef = useRef<HTMLElement | null>(null);
  return (
    <AuthGate>
      <EnumsProvider>
        <DialogProvider>
          <UpdaterProvider>
            <HashRouter>
              <UpdateBanner />
              <OfflineBanner />
              <WhatsNewGate />
              <ScrollRestorer mainRef={mainRef} />
              <div className="layout">
                <Sidebar />
                <main className="main" ref={mainRef}>
                  <BackButton />
                  <Routes>
```

(The rest of the JSX — `</Routes>`, `</main>`, closing tags — is unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: render BackButton + scroll restoration in app shell"
```

---

## Task 5: Persist EventsPage filter state

**Files:**
- Modify: `src/features/events/EventsPage.tsx` (import near top; state block ~lines 133-153)

- [ ] **Step 1: Add the import**

Add after the existing `react-router-dom` import line (`import { Link } from "react-router-dom";`):

```tsx
import { usePersistentState } from "../../hooks/usePersistentState";
```

- [ ] **Step 2: Swap the 5 ephemeral `useState` calls**

Leave `view` and `scope` as-is (already localStorage-backed). Replace exactly these:

```tsx
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [allTimes, setAllTimes] = useState(false);
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [summarySort, setSummarySort] = useState<SummarySort>({
    key: "date",
    dir: "desc",
  });
  const [eventsSort, setEventsSort] = useState<EventsSort>({
    key: "date",
    dir: "desc",
  });
```

with:

```tsx
  const [filters, setFilters] = usePersistentState<Filters>(
    "events.filters",
    EMPTY_FILTERS,
  );
  const [allTimes, setAllTimes] = usePersistentState("events.allTimes", false);
  const [monthCursor, setMonthCursor] = usePersistentState<Date>(
    "events.monthCursor",
    () => startOfMonth(new Date()),
  );
  const [summarySort, setSummarySort] = usePersistentState<SummarySort>(
    "events.summarySort",
    { key: "date", dir: "desc" },
  );
  const [eventsSort, setEventsSort] = usePersistentState<EventsSort>(
    "events.eventsSort",
    { key: "date", dir: "desc" },
  );
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/events/EventsPage.tsx
git commit -m "feat: persist Events list filters/sort/month across navigation"
```

---

## Task 6: Persist PaymentsPage filter state

**Files:**
- Modify: `src/features/payments/PaymentsPage.tsx` (import near top; state block ~lines 181-191)

- [ ] **Step 1: Add the import**

Add after the existing `react-router-dom` import line:

```tsx
import { usePersistentState } from "../../hooks/usePersistentState";
```

- [ ] **Step 2: Swap the 6 ephemeral `useState` calls**

Replace exactly these:

```tsx
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [allTimes, setAllTimes] = useState(false);
  const [tab, setTab] = useState<Tab>("waiting_invoice");
  const [direction, setDirection] = useState<Direction>("outgoing");
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [sort, setSort] = useState<PaymentsSort>({
    key: "date",
    dir: "desc",
  });
```

with:

```tsx
  const [filters, setFilters] = usePersistentState<Filters>(
    "payments.filters",
    EMPTY_FILTERS,
  );
  const [allTimes, setAllTimes] = usePersistentState("payments.allTimes", false);
  const [tab, setTab] = usePersistentState<Tab>(
    "payments.tab",
    "waiting_invoice",
  );
  const [direction, setDirection] = usePersistentState<Direction>(
    "payments.direction",
    "outgoing",
  );
  const [monthCursor, setMonthCursor] = usePersistentState<Date>(
    "payments.monthCursor",
    () => startOfMonth(new Date()),
  );
  const [sort, setSort] = usePersistentState<PaymentsSort>("payments.sort", {
    key: "date",
    dir: "desc",
  });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/payments/PaymentsPage.tsx
git commit -m "feat: persist Payments tab/direction/filters/sort/month across navigation"
```

---

## Task 7: Persist ProducersPage list state

**Files:**
- Modify: `src/features/producers/ProducersPage.tsx` (import near top; state block ~lines 24-26)

The producers list has no sort variable — its ephemeral list state is the search
text (`q`) plus pagination (`pageSize`, `page`).

- [ ] **Step 1: Add the import**

Add after the existing `react-router-dom` import line:

```tsx
import { usePersistentState } from "../../hooks/usePersistentState";
```

- [ ] **Step 2: Swap the 3 ephemeral `useState` calls**

Replace exactly these:

```tsx
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [page, setPage] = useState(0);
```

with:

```tsx
  const [q, setQ] = usePersistentState("producers.q", "");
  const [pageSize, setPageSize] = usePersistentState<PageSize>(
    "producers.pageSize",
    20,
  );
  const [page, setPage] = usePersistentState("producers.page", 0);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/producers/ProducersPage.tsx
git commit -m "feat: persist Producers search + pagination across navigation"
```

---

## Task 8: Persist ForecastPage filter state

**Files:**
- Modify: `src/features/forecast/ForecastPage.tsx` (import near top; state block ~lines 120-125)

Leave `scope` as-is (already localStorage-backed, ~line 116).

- [ ] **Step 1: Add the import**

Add after the existing `react-router-dom` import line (or alongside the top imports):

```tsx
import { usePersistentState } from "../../hooks/usePersistentState";
```

- [ ] **Step 2: Swap the 4 ephemeral `useState` calls**

Replace exactly these:

```tsx
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [allTimes, setAllTimes] = useState(false);
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [sort, setSort] = useState<ForecastSort>({ key: "date", dir: "asc" });
```

with:

```tsx
  const [filters, setFilters] = usePersistentState<Filters>(
    "forecast.filters",
    EMPTY_FILTERS,
  );
  const [allTimes, setAllTimes] = usePersistentState("forecast.allTimes", false);
  const [monthCursor, setMonthCursor] = usePersistentState<Date>(
    "forecast.monthCursor",
    () => startOfMonth(new Date()),
  );
  const [sort, setSort] = usePersistentState<ForecastSort>("forecast.sort", {
    key: "date",
    dir: "asc",
  });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/forecast/ForecastPage.tsx
git commit -m "feat: persist Forecast filters/sort/month across navigation"
```

---

## Task 9: Persist DashboardPage month cursor

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx` (import near top; state ~line 116)

- [ ] **Step 1: Add the import**

Add near the top imports of `src/features/dashboard/DashboardPage.tsx`:

```tsx
import { usePersistentState } from "../../hooks/usePersistentState";
```

- [ ] **Step 2: Swap the month cursor `useState`**

Replace exactly this:

```tsx
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
```

…through its closing `);`. The full original is:

```tsx
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
```

with:

```tsx
  const [monthCursor, setMonthCursor] = usePersistentState<Date>(
    "dashboard.monthCursor",
    () => startOfMonth(new Date()),
  );
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/DashboardPage.tsx
git commit -m "feat: persist Dashboard month cursor across navigation"
```

---

## Task 10: Remove redundant in-card back links on detail pages

The central `<BackButton>` now renders above every page, including the detail
pages' "not found" cards. The in-card `btn btn-secondary` links are redundant —
remove them. Keep the breadcrumb links in the normal views.

**Files:**
- Modify: `src/features/events/EventDetailPage.tsx` (~lines 75-82)
- Modify: `src/features/summaries/EventSummaryPage.tsx` (~lines 773-783)
- Modify: `src/features/producers/ProducerDetailPage.tsx` (~lines 123-132)

- [ ] **Step 1: EventDetailPage — remove the in-card link**

Replace:

```tsx
  if (!event) {
    return (
      <div className="card">
        <div className="empty">האירוע לא נמצא.</div>
        <Link to="/events" className="btn btn-secondary">חזרה לאירועים</Link>
      </div>
    );
  }
```

with:

```tsx
  if (!event) {
    return (
      <div className="card">
        <div className="empty">האירוע לא נמצא.</div>
      </div>
    );
  }
```

- [ ] **Step 2: EventSummaryPage — remove the in-card link**

Replace:

```tsx
  if (!event) {
    return (
      <div className="card">
        <div className="empty">האירוע לא נמצא.</div>
        <Link to="/events" className="btn btn-secondary">
          חזרה לאירועים
        </Link>
      </div>
    );
  }
```

with:

```tsx
  if (!event) {
    return (
      <div className="card">
        <div className="empty">האירוע לא נמצא.</div>
      </div>
    );
  }
```

- [ ] **Step 3: ProducerDetailPage — remove the in-card link**

Replace:

```tsx
  if (!producer) {
    return (
      <div className="card">
        <div className="empty">המפיק לא נמצא.</div>
        <Link to="/producers" className="btn btn-secondary">
          חזרה למפיקים
        </Link>
      </div>
    );
  }
```

with:

```tsx
  if (!producer) {
    return (
      <div className="card">
        <div className="empty">המפיק לא נמצא.</div>
      </div>
    );
  }
```

- [ ] **Step 4: Typecheck (also catches now-unused `Link` imports)**

Run: `npx tsc --noEmit`
Expected: PASS. If the compiler reports `Link` as unused (declared but never read) in any of these files, check whether `Link` is still used elsewhere in that file (EventDetailPage and EventSummaryPage still use `<Link>` for breadcrumbs, so it stays; ProducerDetailPage also keeps its breadcrumb `<Link>`). Only remove the `Link` import if the file truly no longer uses it.

- [ ] **Step 5: Commit**

```bash
git add src/features/events/EventDetailPage.tsx src/features/summaries/EventSummaryPage.tsx src/features/producers/ProducerDetailPage.tsx
git commit -m "refactor: drop redundant in-card back links (central BackButton covers them)"
```

---

## Task 11: Changelog entry + manual verification

**Files:**
- Modify: `src/features/changelog/entries.ts` (top of `CHANGELOG_ENTRIES`, ~line 7)

- [ ] **Step 1: Add a changelog entry**

The current top entry is version `1.3.4` dated `2026-06-11`. Add a new entry as
the first element of the `CHANGELOG_ENTRIES` array (above `1.3.4`):

```ts
  {
    version: "1.4.0",
    date: "2026-06-13",
    items: [
      "נוסף כפתור 'אחורה' בכל עמוד — חוזר לעמוד הקודם תוך שמירה על הסינון, המיון ומיקום הגלילה שהיו בו",
    ],
  },
```

- [ ] **Step 2: Typecheck and production build**

Run: `npx tsc --noEmit && npm run build`
Expected: both PASS (the `build` script is `tsc && vite build`).

- [ ] **Step 3: Manual verification**

Run: `npm run tauri dev`, then confirm:
1. **No button at root:** the first page after login shows **no** "אחורה" button.
2. **Events round-trip:** go to Events → switch to a non-current month via the month arrows → type in the producer search → click a sortable column header → scroll down → open an event → click **אחורה**. The month, search text, sort, and scroll position are all restored.
3. **Payments round-trip:** change tab/direction + month + a filter, open an event summary, click אחורה → tab/direction/filters/month restored.
4. **Producers round-trip:** type a search + change page, open a producer, click אחורה → search + page restored.
5. **Forecast round-trip:** change month + sort, navigate away and back → restored.
6. **Detail "not found":** visit a bad id (e.g. `#/events/99999999`) → card shows "האירוע לא נמצא." with the central אחורה button above it (no in-card duplicate).
7. **RTL:** the button sits on the **right**, chevron `›` points right, label reads `אחורה`.

- [ ] **Step 4: Commit**

```bash
git add src/features/changelog/entries.ts
git commit -m "chore: 1.4.0 — back button on every page with state restoration"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** Building blocks (§1) → Tasks 1-3. Central placement + scroll wiring (§2, §4) → Task 4. Per-page filter persistence (§3) → Tasks 5-9. Redundant-link removal (§4) → Task 10. Changelog + verification (§5) → Task 11.
- **Two spec refinements made during planning (both within the approved design's intent):**
  1. The back button is rendered **once centrally** in `<main>` rather than inserted into each page's header — same UX, far less code (spec §4 updated to match).
  2. ProducersPage persists `q`/`pageSize`/`page` (its real ephemeral state) since it has no sort variable; PaymentsPage additionally persists `tab`/`direction`/`allTimes` as part of its "last state."
- **Type names referenced** (`Filters`, `EMPTY_FILTERS`, `SummarySort`, `EventsSort`, `Tab`, `Direction`, `PaymentsSort`, `PageSize`, `ForecastSort`) are all pre-existing in their respective page files — `usePersistentState` only re-uses them.
