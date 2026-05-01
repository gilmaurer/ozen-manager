import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  EventSummaryRow,
  EventWithProducer,
  SummaryTicketRow,
} from "../../db/types";
import { supabase } from "../../db/supabase";
import { sendMailViaGmail } from "../../services/gmail";
import {
  CurrentSender,
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  fillPlaceholders,
} from "./emailInvoice";
import {
  computeInvoice,
  generateProducerInvoicePdf,
} from "./producerInvoice";
import { updateEventStatus } from "../events/eventsRepo";

interface Props {
  open: boolean;
  event: EventWithProducer;
  summary: EventSummaryRow;
  tickets: SummaryTicketRow[];
  producerEmail: string;
  sender: CurrentSender;
  onClose: () => void;
  onSent: () => void;
}

function fmtMoney(n: number): string {
  return `${n.toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₪`;
}

function formatDDMYY(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d}.${m}.${String(y).slice(2)}`;
}

export function SendInvoiceModal({
  open,
  event,
  summary,
  tickets,
  producerEmail,
  sender,
  onClose,
  onSent,
}: Props) {
  const placeholders = useMemo(() => {
    const calc = computeInvoice(event, summary, tickets);
    return {
      producer_name: event.producer_name ?? "",
      event_name: event.name ?? "",
      event_date: formatDDMYY(event.date),
      amount_incl_vat: fmtMoney(calc.producerNet),
      amount_ex_vat: fmtMoney(calc.producerNetExVat),
      sender_name: sender.email,
    };
  }, [event, summary, tickets, sender.email]);

  const [subject, setSubject] = useState(() =>
    fillPlaceholders(DEFAULT_SUBJECT, placeholders),
  );
  const [body, setBody] = useState(() =>
    fillPlaceholders(DEFAULT_BODY, placeholders),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredToken, setExpiredToken] = useState(false);

  // Re-apply template if the modal reopens for a different event.
  useEffect(() => {
    if (open) {
      setSubject(fillPlaceholders(DEFAULT_SUBJECT, placeholders));
      setBody(fillPlaceholders(DEFAULT_BODY, placeholders));
      setError(null);
      setExpiredToken(false);
    }
  }, [open, placeholders]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    setExpiredToken(false);
    try {
      const pdfBytes = await generateProducerInvoicePdf(
        event,
        summary,
        tickets,
      );
      const safeName = (event.name ?? "event").replace(/[\\/:*?"<>|]/g, "_");
      const pdfFilename = `סיכום_אירוע_${safeName}_${event.date}.pdf`;
      await sendMailViaGmail({
        to: producerEmail,
        subject,
        body,
        pdfBytes,
        pdfFilename,
        accessToken: sender.providerToken,
      });
      // Auto-advance event status to waiting_invoice. Non-blocking:
      // the email already went out, so a stale status shouldn't hide that.
      try {
        await updateEventStatus(event.id, "waiting_invoice");
      } catch (statusErr) {
        console.warn("failed to flip status to waiting_invoice", statusErr);
      }
      onSent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (/\b401\b/.test(msg) || /Unauthorized/i.test(msg)) {
        setExpiredToken(true);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleReauth() {
    try {
      await supabase.auth.signOut();
    } finally {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>שליחת סיכום אירוע למפיק</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={sending}
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div>
              <label>שלח מאת</label>
              <input dir="ltr" value={sender.email} readOnly />
            </div>
            <div>
              <label>אל</label>
              <input dir="ltr" value={producerEmail} readOnly />
            </div>
          </div>
          <div className="form-row single">
            <div>
              <label>נושא</label>
              <input
                dir="auto"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row single">
            <div>
              <label>גוף ההודעה</label>
              <textarea
                dir="auto"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                background: "#fdecec",
                border: "1px solid #f5b5b5",
                borderRadius: 6,
                color: "#8a1f1f",
                fontSize: 13,
                display: "grid",
                gap: 6,
              }}
            >
              <div>
                {expiredToken
                  ? 'פג תוקף ההתחברות ל-Google. התנתק והתחבר מחדש כדי לחדש הרשאה לשלוח.'
                  : `שליחה נכשלה: ${error}`}
              </div>
              {expiredToken && (
                <div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleReauth}
                  >
                    התנתק
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={sending}
            >
              ביטול
            </button>
            <button type="submit" className="btn" disabled={sending}>
              {sending ? "שולח…" : "שלח"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
