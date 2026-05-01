import { ReactNode, useCallback, useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { UpdateState, UpdaterApi, UpdaterContext } from "./useUpdater";

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
            if (ev.event === "Finished") setState({ status: "installing" });
          });
          // Platform-dependent: downloadAndInstall usually relaunches the app.
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

  const api: UpdaterApi = { state, runCheck, installNow, dismiss };

  return (
    <UpdaterContext.Provider value={api}>{children}</UpdaterContext.Provider>
  );
}
