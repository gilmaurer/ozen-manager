import { useUpdater } from "./useUpdater";

export function UpdateCheckButton() {
  const { state, runCheck } = useUpdater();

  let label = "בדוק עדכון";
  if (state.status === "checking") label = "בודק…";
  else if (state.status === "none") label = "אין עדכונים זמינים";
  else if (state.status === "available") label = `עדכון זמין: v${state.update.version}`;
  else if (state.status === "downloading") label = `מוריד ${state.pct}%`;
  else if (state.status === "installing") label = "מתקין…";
  else if (state.status === "dismissed") label = "בדוק עדכון";
  else if (state.status === "error") label = "בדוק עדכון (שגיאה)";

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={runCheck}
      disabled={
        state.status === "checking" ||
        state.status === "downloading" ||
        state.status === "installing"
      }
      title={state.status === "error" ? state.message : undefined}
    >
      {label}
    </button>
  );
}
