import { useState } from "react";
import { runBackup } from "../services/backup";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; at: Date }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

const TIME_FMT = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});

export function BackupStatus() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleClick() {
    setState({ kind: "running" });
    const res = await runBackup();
    if (res.ok) setState({ kind: "done", at: new Date() });
    else if (res.disabled) setState({ kind: "disabled" });
    else setState({ kind: "error", message: res.message });
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
  } else if (state.kind === "disabled") {
    label = "ייצוא לא מוגדר";
    className += " backup-status-disabled";
    title =
      "כדי להפעיל ייצוא ל-Google Drive, יש ליצור drive-backup.json ב-~/Library/Application Support/com.gilmaurer.ozenmanager/";
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
