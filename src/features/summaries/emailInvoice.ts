import { useEffect, useState } from "react";
import { supabase } from "../../db/supabase";

// Only these Google accounts are allowed to send producer invoices via Gmail.
// When the currently signed-in user is not one of these, the send button is
// hidden entirely.
export const ALLOWED_SENDERS = [
  "maurer.gil@gmail.com",
  "booking@ozenlive.com",
  "elinora@ozenlive.com",
];

export interface CurrentSender {
  email: string;
  providerToken: string;
}

export type SenderState =
  | { status: "ready"; email: string; providerToken: string }
  | { status: "not-allowed"; email: string | null }
  | { status: "no-token"; email: string };

// Re-evaluates on every auth state change. Distinguishes three outcomes so the
// caller can decide whether to show / disable / hide the send button.
export function useSenderState(): SenderState {
  const [state, setState] = useState<SenderState>({
    status: "not-allowed",
    email: null,
  });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      const email = s?.user?.email ?? null;
      const token = s?.provider_token ?? "";
      if (cancelled) return;
      if (!email || !ALLOWED_SENDERS.includes(email)) {
        setState({ status: "not-allowed", email });
        return;
      }
      if (!token) {
        setState({ status: "no-token", email });
        return;
      }
      setState({ status: "ready", email, providerToken: token });
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

// Back-compat: returns non-null only for ready senders.
export function useCurrentSender(): CurrentSender | null {
  const s = useSenderState();
  return s.status === "ready"
    ? { email: s.email, providerToken: s.providerToken }
    : null;
}

// Placeholder template — swap these once the real copy is decided.
// Available placeholders: {{producer_name}}, {{event_name}}, {{event_date}},
// {{amount_incl_vat}}, {{amount_ex_vat}}, {{sender_name}}.
export const DEFAULT_SUBJECT = 'סיכום אירוע: {{event_name}} — {{event_date}}';
export const DEFAULT_BODY =
  `שלום {{producer_name}},\n\n` +
  `מצורף סיכום אירוע עבור {{event_name}} מיום {{event_date}}.\n` +
  `סכום לתשלום (כולל מע"מ): {{amount_incl_vat}}\n` +
  `סכום לא כולל מע"מ: {{amount_ex_vat}}\n\n` +
  `בברכה,\n{{sender_name}}`;

export function fillPlaceholders(
  tpl: string,
  vars: Record<string, string>,
): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : "",
  );
}
