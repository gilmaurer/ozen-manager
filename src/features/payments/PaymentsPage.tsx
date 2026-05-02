import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  EventStatus,
  EventType,
  EventWithProducer,
} from "../../db/types";
import {
  listEvents,
  updateEventCheckNumber,
  updateEventInvoiceUrl,
  updateEventStatus,
} from "../events/eventsRepo";
import { formatDate } from "../../utils/format";
import { InlineStatusSelect } from "../events/InlineStatusSelect";
import { useEnums } from "../../services/enums";
import { useDialog } from "../../components/dialog";
import { clubTicketShareOf } from "../events/dealCalc";
import {
  listSummaryAggregates,
  SummaryAggregate,
  VAT_RATE,
} from "../summaries/summariesRepo";
import { pickAndUploadInvoice } from "../../services/driveUpload";

const PAYMENT_STATUSES = ["waiting_invoice", "waiting_payment", "done"];

interface Filters {
  q: string;
  status: EventStatus | "";
  type: EventType | "";
}
const EMPTY_FILTERS: Filters = { q: "", status: "", type: "" };

function filtersActive(f: Filters): boolean {
  return f.q !== "" || f.status !== "" || f.type !== "";
}

function matches(f: Filters, e: EventWithProducer): boolean {
  if (f.q && !e.name.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.status && e.status !== f.status) return false;
  if (f.type && e.type !== f.type) return false;
  return true;
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₪`;
}

interface ProducerTotals {
  net: number;
  netExVat: number;
}

export function PaymentsPage() {
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [aggs, setAggs] = useState<Map<number, SummaryAggregate>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { types, typeByCode, statusByCode } = useEnums();
  const { ask, notify } = useDialog();

  const paymentStatuses = PAYMENT_STATUSES
    .map((code) => statusByCode[code])
    .filter(Boolean);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function refresh() {
    setLoading(true);
    const [all, a] = await Promise.all([
      listEvents(),
      listSummaryAggregates().catch(() => new Map<number, SummaryAggregate>()),
    ]);
    setEvents(all.filter((e) => PAYMENT_STATUSES.includes(e.status)));
    setAggs(a);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = useMemo(
    () =>
      events
        .filter((e) => matches(filters, e))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [events, filters],
  );

  function totalsFor(e: EventWithProducer): ProducerTotals {
    const a = aggs.get(e.id);
    const presaleRevenue = a?.presale_revenue ?? 0;
    const presaleCommissions = a?.presale_commissions ?? 0;
    const boxOfficeRevenue = a?.box_office_revenue ?? 0;
    const ticketBase = presaleRevenue - presaleCommissions + boxOfficeRevenue;
    const clubShare = clubTicketShareOf(e, ticketBase);
    const producerTicketShare =
      e.deal_type === "fit_price" ? ticketBase : ticketBase - clubShare;
    const campaignAmount = e.campaign_amount ?? 0;
    const campaignPct = e.campaign ?? 0;
    const producerCampaign = campaignAmount * ((100 - campaignPct) / 100);
    const extras =
      (a?.acum ?? 0) +
      (a?.stereo_record ?? 0) +
      (a?.channels_record ?? 0) +
      (a?.lightman ?? 0);
    const net = producerTicketShare - producerCampaign - extras;
    return { net, netExVat: net / (1 + VAT_RATE) };
  }

  async function handleStatusChange(e: EventWithProducer, next: EventStatus) {
    if (e.status === next) return;
    await updateEventStatus(e.id, next);
    await refresh();
  }

  async function handleUpload(e: EventWithProducer) {
    if (uploadingId != null) return;
    setUploadingId(e.id);
    try {
      const url = await pickAndUploadInvoice(e.name, e.date);
      if (!url) return; // user cancelled
      await updateEventInvoiceUrl(e.id, url);
      if (e.status === "waiting_invoice") {
        await updateEventStatus(e.id, "waiting_payment");
      }
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notify(`העלאת חשבונית נכשלה: ${msg}`);
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSaveCheckNumber(
    e: EventWithProducer,
    next: string,
  ) {
    const trimmed = next.trim();
    const normalized = trimmed === "" ? null : trimmed;
    if (normalized === e.check_number) return;
    try {
      await updateEventCheckNumber(e.id, normalized);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notify(`שמירת מספר הצ'ק נכשלה: ${msg}`);
    }
  }

  async function handleReplace(e: EventWithProducer) {
    if (
      !(await ask(
        "כבר קיימת חשבונית לאירוע זה. להחליף אותה בקובץ חדש?",
      ))
    ) {
      return;
    }
    await handleUpload(e);
  }

  if (loading) return <div className="empty">טוען…</div>;

  return (
    <>
      <div className="page-header">
        <h1>תשלומים</h1>
      </div>

      <div className="card">
        {events.length > 0 && (
          <div className="filter-bar">
            <input
              className="filter-search"
              type="text"
              placeholder="חיפוש לפי שם"
              dir="auto"
              value={filters.q}
              onChange={(e) => updateFilter("q", e.target.value)}
            />
            <select
              value={filters.status}
              onChange={(e) =>
                updateFilter("status", e.target.value as EventStatus | "")
              }
            >
              <option value="">כל הסטטוסים</option>
              {paymentStatuses.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={filters.type}
              onChange={(e) =>
                updateFilter("type", e.target.value as EventType | "")
              }
            >
              <option value="">כל הסוגים</option>
              {types.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
            {filtersActive(filters) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                נקה סינון
              </button>
            )}
          </div>
        )}
        {events.length === 0 ? (
          <div className="empty">
            אין אירועים במחזור התשלומים. שליחת סיכום אירוע למפיק תעביר את
            האירוע לכאן.
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">אין תוצאות לסינון.</div>
        ) : (
          <table className="centered">
            <thead>
              <tr>
                <th>שם</th>
                <th>תאריך</th>
                <th>סוג</th>
                <th>מפיק</th>
                <th>סטטוס</th>
                <th>סה"כ כולל מע"מ</th>
                <th>סה"כ ללא מע"מ</th>
                <th>חשבונית</th>
                <th>מספר צ'ק</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const t = totalsFor(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <Link
                        to={`/events/${e.id}/summary`}
                        className="row-value"
                        dir="auto"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="muted" dir="ltr" style={{ textAlign: "start" }}>
                      {formatDate(e.date)}
                    </td>
                    <td>
                      {e.type ? typeByCode[e.type]?.label ?? e.type : "—"}
                    </td>
                    <td>
                      {e.producer_name && e.producer_id != null ? (
                        <Link
                          to={`/producers/${e.producer_id}`}
                          className="row-value"
                          dir="auto"
                        >
                          {e.producer_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <InlineStatusSelect
                        value={e.status}
                        onChange={(next) => handleStatusChange(e, next)}
                      />
                    </td>
                    <td
                      dir="ltr"
                      style={{ textAlign: "start", fontWeight: 600 }}
                    >
                      {fmtMoney(t.net)}
                    </td>
                    <td dir="ltr" style={{ textAlign: "start" }}>
                      {fmtMoney(t.netExVat)}
                    </td>
                    <td>
                      {e.invoice_url ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <a
                            href={e.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            פתח חשבונית
                          </a>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleReplace(e)}
                            disabled={uploadingId === e.id}
                          >
                            החלף
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-sm"
                          onClick={() => handleUpload(e)}
                          disabled={uploadingId === e.id}
                        >
                          {uploadingId === e.id
                            ? "מעלה…"
                            : "העלה חשבונית"}
                        </button>
                      )}
                    </td>
                    <td>
                      <input
                        key={`check-${e.id}-${e.check_number ?? ""}`}
                        type="text"
                        dir="ltr"
                        defaultValue={e.check_number ?? ""}
                        placeholder="—"
                        onBlur={(ev) =>
                          handleSaveCheckNumber(e, ev.target.value)
                        }
                        style={{ width: 110, textAlign: "start" }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
