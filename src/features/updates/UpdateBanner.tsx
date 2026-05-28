import { useUpdater } from "./useUpdater";

export function UpdateBanner() {
  const { state, installNow, restartNow, dismiss } = useUpdater();

  if (
    state.status === "idle" ||
    state.status === "checking" ||
    state.status === "none" ||
    state.status === "dismissed"
  ) {
    return null;
  }

  const isError = state.status === "error";

  return (
    <div
      dir="rtl"
      style={{
        background: isError ? "var(--danger-bg-soft)" : "var(--warn-bg-soft)",
        border: `1px solid ${isError ? "var(--danger)" : "var(--warn)"}`,
        color: isError ? "var(--danger)" : "var(--warn)",
        padding: "8px 14px",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {state.status === "available" && (
        <>
          <span>
            🔔 עדכון זמין: <strong>v{state.update.version}</strong>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={installNow}>
              התקן עכשיו
            </button>
            <button className="btn btn-secondary btn-sm" onClick={dismiss}>
              דחה
            </button>
          </div>
        </>
      )}
      {state.status === "downloading" && (
        <span>מוריד עדכון… {state.pct}%</span>
      )}
      {state.status === "installing" && (
        <>
          <span>מתקין — האפליקציה תופעל מחדש בעוד כמה שניות…</span>
          <button className="btn btn-sm" onClick={restartNow}>
            הפעל מחדש עכשיו
          </button>
        </>
      )}
      {state.status === "error" && (
        <span>שגיאה בבדיקת עדכון: {state.message}</span>
      )}
    </div>
  );
}
