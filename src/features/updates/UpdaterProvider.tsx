import { ReactNode, useCallback, useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { UpdateState, UpdaterApi, UpdaterContext } from "./useUpdater";

// Safety net: if the Tauri updater never triggers a process relaunch,
// force it ourselves this many ms after the install completes.
const INSTALL_RELAUNCH_DELAY_MS = 10_000;

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  const runCheck = useCallback(async () => {
    setState({ status: "checking" });
    try {
      const update = await check();
      if (update?.available) {
        setState({ status: "available", update });
      } else {
        setState({ status: "none" });
      }
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const installNow = useCallback(async () => {
    setState((prev) => {
      if (prev.status !== "available") return prev;
      // Kick off the async install using the captured Update object.
      const update = prev.update;
      (async () => {
        try {
          let downloaded = 0;
          let total = 0;
          await update.downloadAndInstall((ev) => {
            if (ev.event === "Started") total = ev.data.contentLength ?? 0;
            if (ev.event === "Progress") {
              downloaded += ev.data.chunkLength;
              setState({
                status: "downloading",
                pct: total ? Math.round((downloaded / total) * 100) : 0,
              });
            }
            if (ev.event === "Finished") {
              setState({ status: "installing" });
              // On macOS the Tauri updater often fails to relaunch the app
              // on its own. As a safety net, force a relaunch after a short
              // delay. Windows usually relaunches first; this is a no-op
              // there.
              setTimeout(() => {
                relaunch().catch((err) => {
                  console.error("auto-relaunch failed", err);
                  setState({
                    status: "error",
                    message:
                      "ההתקנה הושלמה אך ההפעלה מחדש נכשלה. סגור ופתח את האפליקציה ידנית.",
                  });
                });
              }, INSTALL_RELAUNCH_DELAY_MS);
            }
          });
        } catch (e) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      })();
      return { status: "downloading", pct: 0 };
    });
  }, []);

  const restartNow = useCallback(async () => {
    try {
      await relaunch();
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const dismiss = useCallback(() => {
    setState((prev) => {
      if (prev.status === "available") {
        return { status: "dismissed", version: prev.update.version };
      }
      return prev;
    });
  }, []);

  // Auto-check once per mount (per app launch).
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const api: UpdaterApi = { state, runCheck, installNow, restartNow, dismiss };

  return (
    <UpdaterContext.Provider value={api}>{children}</UpdaterContext.Provider>
  );
}
