import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from "react";
import { Modal } from "./Modal";

export interface DialogApi {
  ask: (message: string) => Promise<boolean>;
  notify: (message: string) => Promise<void>;
  run: (op: () => Promise<void>) => Promise<boolean>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog must be used within DialogProvider");
  return api;
}

type AskState = {
  kind: "ask";
  message: string;
  resolve: (v: boolean) => void;
};
type NotifyState = {
  kind: "notify";
  message: string;
  resolve: () => void;
};
type DialogState = AskState | NotifyState;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const notify = (message: string): Promise<void> =>
    new Promise<void>((resolve) => {
      setState({ kind: "notify", message, resolve });
    });

  const api: DialogApi = {
    ask: (message) =>
      new Promise<boolean>((resolve) => {
        setState({ kind: "ask", message, resolve });
      }),
    notify,
    run: async (op) => {
      try {
        await op();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await notify(msg);
        return false;
      }
    },
  };

  function close(result?: boolean) {
    if (!state) return;
    if (state.kind === "ask") state.resolve(result ?? false);
    else state.resolve();
    setState(null);
  }

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        open={!!state}
        title={state?.kind === "ask" ? "אישור" : "שגיאה"}
        onClose={() => close(false)}
      >
        <p
          className="row-value"
          dir="auto"
          style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}
        >
          {state?.message}
        </p>
        <div className="modal-actions">
          {state?.kind === "ask" ? (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => close(false)}
              >
                ביטול
              </button>
              <button className="btn btn-danger" onClick={() => close(true)}>
                אישור
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => close()}>
              סגור
            </button>
          )}
        </div>
      </Modal>
    </DialogContext.Provider>
  );
}
