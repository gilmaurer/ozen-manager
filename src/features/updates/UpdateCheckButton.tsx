import { useEffect, useRef, useState } from "react";
import { useUpdater } from "./useUpdater";

const FLASH_MS = 3000;

export function UpdateCheckButton() {
  const { state, runCheck } = useUpdater();
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  // Flash transient states ("none" = no updates, "error") for 3s, then hide them.
  // Persistent states ("available", "downloading", "installing") keep their label.
  useEffect(() => {
    if (state.status === "none" || state.status === "error") {
      setFlashing(true);
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current);
      }
      flashTimerRef.current = window.setTimeout(() => {
        setFlashing(false);
        flashTimerRef.current = null;
      }, FLASH_MS);
    } else {
      setFlashing(false);
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    }
    return () => {
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };
  }, [state.status]);

  const showTransient =
    flashing && (state.status === "none" || state.status === "error");

  let label = "בדוק עדכון";
  let title: string | undefined;
  if (state.status === "checking") label = "בודק…";
  else if (state.status === "available")
    label = `עדכון זמין: v${state.update.version}`;
  else if (state.status === "downloading") label = `מוריד ${state.pct}%`;
  else if (state.status === "installing") label = "מתקין…";
  else if (showTransient && state.status === "none") label = "אין עדכונים זמינים";
  else if (showTransient && state.status === "error") {
    label = "בדוק עדכון (שגיאה)";
    title = state.message;
  }

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={runCheck}
      disabled={
        state.status === "checking" ||
        state.status === "downloading" ||
        state.status === "installing"
      }
      title={title}
    >
      {label}
    </button>
  );
}
