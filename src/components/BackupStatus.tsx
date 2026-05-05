import { useCallback, useEffect, useRef, useState } from "react";
import { runBackup } from "../services/backup";
import { useIsAdmin } from "../features/auth/useIsAdmin";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; at: Date }
  | { kind: "error"; message: string };

const TIME_FMT = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});

const LAST_BACKUP_KEY = "ozen.backup.lastAt";
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const FLASH_MS = 3000;

function readLastBackup(): Date | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return new Date(n);
}

function writeLastBackup(d: Date): void {
  localStorage.setItem(LAST_BACKUP_KEY, String(d.getTime()));
}

export function BackupStatus() {
  const isAdmin = useIsAdmin();
  const [state, setState] = useState<State>({ kind: "idle" });
  const runningRef = useRef(false);
  const revertTimerRef = useRef<number | null>(null);

  const scheduleRevert = useCallback(() => {
    if (revertTimerRef.current != null) {
      window.clearTimeout(revertTimerRef.current);
    }
    revertTimerRef.current = window.setTimeout(() => {
      setState({ kind: "idle" });
      revertTimerRef.current = null;
    }, FLASH_MS);
  }, []);

  const runNow = useCallback(async () => {
    if (runningRef.current) return;
    if (revertTimerRef.current != null) {
      window.clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    runningRef.current = true;
    setState({ kind: "running" });
    const res = await runBackup();
    runningRef.current = false;
    if (res.ok) {
      const now = new Date();
      writeLastBackup(now);
      setState({ kind: "done", at: now });
      scheduleRevert();
    } else if (res.disabled) {
      setState({ kind: "idle" });
    } else {
      setState({ kind: "error", message: res.message });
      scheduleRevert();
    }
    return res;
  }, [scheduleRevert]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    let intervalId: number | null = null;

    async function maybeAutoRun() {
      if (cancelled) return;
      const last = readLastBackup();
      const stale = !last || Date.now() - last.getTime() >= DAY_MS;
      if (!stale) return;
      await runNow();
    }

    void maybeAutoRun();
    intervalId = window.setInterval(() => void maybeAutoRun(), CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
      if (revertTimerRef.current != null) {
        window.clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
      }
    };
  }, [isAdmin, runNow]);

  if (!isAdmin) return null;

  async function handleClick() {
    await runNow();
  }

  let label = "ייצוא ל-Drive";
  let className = "btn btn-secondary btn-sm";
  let title: string | undefined;
  if (state.kind === "running") {
    label = "מייצא…";
  } else if (state.kind === "done") {
    label = `יוצא ב-${TIME_FMT.format(state.at)}`;
  } else if (state.kind === "error") {
    label = "שגיאה בייצוא";
    className += " backup-status-error";
    title = state.message;
  }

  return (
    <button
      className={className}
      onClick={handleClick}
      disabled={state.kind === "running"}
      title={title}
    >
      {label}
    </button>
  );
}
