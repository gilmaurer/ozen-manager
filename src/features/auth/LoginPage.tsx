import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import ozenLogo from "../../assets/ozen-logo.png";
import { supabase } from "../../db/supabase";

export function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    return () => {
      unlistenRef.current.forEach((fn) => fn());
      unlistenRef.current = [];
    };
  }, []);

  async function handleSignIn() {
    setSubmitting(true);
    setError(null);
    try {
      // 1. Start the loopback listener in Rust.
      const port = await invoke<number>("start_auth_listener");
      const redirectTo = `http://localhost:${port}/auth/callback`;

      // 2. Register one-shot listeners for the auth code (or error).
      const codePromise = new Promise<string>((resolve, reject) => {
        listen<string>("auth-code-received", (ev) => {
          resolve(ev.payload);
        }).then((fn) => unlistenRef.current.push(fn));
        listen<string>("auth-code-error", (ev) => {
          reject(new Error(ev.payload));
        }).then((fn) => unlistenRef.current.push(fn));
      });

      // 3. Ask Supabase for the OAuth URL without letting the webview redirect.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Supabase did not return an OAuth URL");

      // 4. Open the URL in the system browser.
      await openUrl(data.url);

      // 5. Wait for the loopback to receive the code.
      const code = await codePromise;

      // 6. Exchange for a session. Auth state change will flip the gate.
      const { error: xchgErr } = await supabase.auth.exchangeCodeForSession(code);
      if (xchgErr) throw xchgErr;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src={ozenLogo} alt="Ozen" className="login-logo" />
        <h1>אוזן</h1>
        <p className="muted">ניהול מועדון</p>
        <button
          className="btn"
          onClick={handleSignIn}
          disabled={submitting}
        >
          {submitting ? "ממתין להתחברות…" : "התחבר עם Google"}
        </button>
        {submitting && (
          <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
            השלימו את ההתחברות בדפדפן שנפתח.
          </p>
        )}
        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
