import { createContext, useContext } from "react";
import type { Update } from "@tauri-apps/plugin-updater";

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "none" }
  | { status: "available"; update: Update }
  | { status: "downloading"; pct: number }
  | { status: "installing" }
  | { status: "dismissed"; version: string }
  | { status: "error"; message: string };

export interface UpdaterApi {
  state: UpdateState;
  runCheck: () => Promise<void>;
  installNow: () => Promise<void>;
  restartNow: () => Promise<void>;
  dismiss: () => void;
}

export const UpdaterContext = createContext<UpdaterApi | null>(null);

export function useUpdater(): UpdaterApi {
  const api = useContext(UpdaterContext);
  if (!api) throw new Error("useUpdater must be used inside <UpdaterProvider>");
  return api;
}
