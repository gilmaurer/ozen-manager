// Helpers to transparently refresh the Google OAuth provider token.
//
// Google access tokens expire after ~1 hour. Supabase does NOT auto-refresh
// the `provider_token` on its own session refresh cycle, so Drive / Gmail
// calls start returning 401 an hour after sign-in.
//
// silentlyRefreshGoogleToken() re-runs the same loopback OAuth flow as
// LoginPage, but with `prompt=none` and a `login_hint` — Google returns a
// fresh token without showing any dialogs if the browser still has a
// valid Google session. Returns the new provider_token, or null if the
// silent attempt failed (user signed out of Google in the browser, session
// expired on Google's side, network error, timeout, etc.).
//
// withFreshProviderToken() is a convenience wrapper: runs the given
// operation with the current token, and on 401 refreshes once and retries.

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "../db/supabase";

const SILENT_TIMEOUT_MS = 15000;

let inFlight: Promise<string | null> | null = null;

export async function silentlyRefreshGoogleToken(): Promise<string | null> {
  if (inFlight) return inFlight;
  inFlight = runSilentRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSilentRefresh(): Promise<string | null> {
  const unlistenFns: UnlistenFn[] = [];
  try {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? undefined;

    const port = await invoke<number>("start_auth_listener");
    const redirectTo = `http://localhost:${port}/auth/callback`;

    let resolveCode: (value: string | null) => void;
    const codePromise = new Promise<string | null>((resolve) => {
      resolveCode = resolve;
    });
    const timer = setTimeout(() => resolveCode(null), SILENT_TIMEOUT_MS);

    unlistenFns.push(
      await listen<string>("auth-code-received", (ev) => {
        clearTimeout(timer);
        resolveCode(ev.payload);
      }),
    );
    unlistenFns.push(
      await listen<string>("auth-code-error", () => {
        clearTimeout(timer);
        resolveCode(null);
      }),
    );

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        scopes:
          "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file",
        queryParams: {
          prompt: "none",
          ...(email ? { login_hint: email } : {}),
        },
      },
    });
    if (error || !data?.url) return null;

    await openUrl(data.url);

    const code = await codePromise;
    if (!code) return null;

    const { data: sessionData, error: xErr } =
      await supabase.auth.exchangeCodeForSession(code);
    if (xErr) return null;
    return sessionData.session?.provider_token ?? null;
  } catch {
    return null;
  } finally {
    unlistenFns.forEach((fn) => fn());
  }
}

export function isAuthError(e: unknown): boolean {
  const msg =
    typeof e === "string"
      ? e
      : (e as { message?: string })?.message ?? String(e);
  return (
    /\b401\b/.test(msg) ||
    /unauthorized/i.test(msg) ||
    msg.includes("missing Google access token")
  );
}

export async function withFreshProviderToken<T>(
  run: (token: string) => Promise<T>,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.provider_token ?? "";

  if (!token) {
    const fresh = await silentlyRefreshGoogleToken();
    if (!fresh) throw new Error("missing Google access token");
    token = fresh;
  }

  try {
    return await run(token);
  } catch (e) {
    if (!isAuthError(e)) throw e;
    const fresh = await silentlyRefreshGoogleToken();
    if (!fresh) throw e;
    return await run(fresh);
  }
}
