import { useUpdater } from "./useUpdater";

export function UpdateBanner() {
  const { state, installNow, dismiss } = useUpdater();

  if (
    state.status === "idle" ||
    state.status === "checking" ||
    state.status === "none" ||
    state.status === "dismissed"
  ) {
    return null;
  }

  const bg =
    state.status === "error" ? "#fdecec" : "#fff6db";
  const border =
    state.status === "error" ? "#f5b5b5" : "#f0c674";
  const fg = state.status === "error" ? "#8a1f1f" : "#4a3800";

  return (
    <div
      dir="rtl"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
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
        <span>מתקין עדכון — האפליקציה תופעל מחדש בקרוב…</span>
      )}
      {state.status === "error" && (
        <span>שגיאה בבדיקת עדכון: {state.message}</span>
      )}
    </div>
  );
}
