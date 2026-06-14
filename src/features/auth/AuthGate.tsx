import { ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../db/supabase";
import { LoginPage } from "./LoginPage";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      // After sign-out, reset the route so the next login lands on the
      // dashboard — HashRouter otherwise keeps the last hash across
      // logout/login and would drop the user back on the page they left.
      if (ev === "SIGNED_OUT") {
        window.location.hash = "#/";
      }
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="empty" style={{ padding: 40 }}>טוען…</div>;
  if (!session) return <LoginPage />;
  return <>{children}</>;
}
