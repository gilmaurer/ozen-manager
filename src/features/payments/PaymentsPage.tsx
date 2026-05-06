import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  EventStatus,
  EventType,
  EventWithProducer,
  PaymentMethod,
} from "../../db/types";
import {
  listEvents,
  updateEventCheckDate,
  updateEventCheckNumber,
  updateEventInvoiceUrl,
  updateEventPaymentMethod,
  updateEventPaymentProofUrl,
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
import {
  pickAndUploadInvoice,
  pickAndUploadPaymentProof,
} from "../../services/driveUpload";
import { MONTH_FMT, monthBounds, startOfMonth } from "../events/monthNav";

type Tab = "waiting_invoice" | "waiting_payment" | "done";
const TABS: Tab[] = ["waiting_invoice", "waiting_payment", "done"];

type Direction = "outgoing" | "incoming";
const DIRECTION_LABELS: Record<Direction, string> = {
  outgoing: "תשלום למפיקים",
  incoming: "תשלום לאוזן",
};

const PAYMENT_METHODS: ReadonlyArray<{ code: PaymentMethod; label: string }> = [
  { code: "check", label: "צ'ק" },
  { code: "transfer", label: "העברה" },
  { code: "cash", label: "מזומן" },
  { code: "other", label: "אחר" },
];

interface Filters {
  q: string;
  type: EventType | "";
  producer: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  q: "",
  type: "",
  producer: "",
  from: "",
  to: "",
};

function filtersActive(f: Filters): boolean {
  return (
    f.q !== "" ||
    f.type !== "" ||
    f.producer !== "" ||
    f.from !== "" ||
    f.to !== ""
  );
}

function matches(
  f: Filters,
  e: EventWithProducer,
  allTimes: boolean,
): boolean {
  if (f.q && !e.name.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.type && e.type !== f.type) return false;
  if (
    f.producer &&
    !(e.producer_name ?? "")
      .toLowerCase()
      .includes(f.producer.toLowerCase())
  )
    return false;
  if (!allTimes) {
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
  }
  return true;
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₪`;
}

// DB stores YYYY-MM-DD. Display and editable value both use dd.mm.yyyy.
function isoToDisplayDate(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

// Accepts dd/mm/yyyy, dd.mm.yyyy, or ddmmyyyy (8 digits, no separators).
type ParsedDate = { ok: true; iso: string | null } | { ok: false };
function parseDisplayDate(input: string): ParsedDate {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, iso: null };

  let m = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!m) m = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return { ok: false };

  const d = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const y = m[3];
  const dayN = Number(d);
  const monthN = Number(mm);
  const yearN = Number(y);
  if (monthN < 1 || monthN > 12 || dayN < 1 || dayN > 31 || yearN < 1900) {
    return { ok: false };
  }
  const check = new Date(Date.UTC(yearN, monthN - 1, dayN));
  if (
    isNaN(check.getTime()) ||
    check.getUTCFullYear() !== yearN ||
    check.getUTCMonth() + 1 !== monthN ||
    check.getUTCDate() !== dayN
  ) {
    return { ok: false };
  }
  return { ok: true, iso: `${y}-${mm}-${d}` };
}

const CHECK_DATE_HELP =
  "אפשר להזין בכל אחד מהפורמטים:\n• dd/mm/yyyy\n• dd.mm.yyyy\n• ddmmyyyy (8 ספרות)\nבלחיצה על Enter הערך יומר ל-dd.mm.yyyy.";

type PaymentsSortKey =
  | "name"
  | "date"
  | "type"
  | "producer"
  | "status"
  | "net"
  | "netExVat"
  | "check_date"
  | "check_number";

type PaymentsSort = { key: PaymentsSortKey; dir: "asc" | "desc" };

interface ProducerTotals {
  net: number;
  netExVat: number;
}

export function PaymentsPage() {
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [aggs, setAggs] = useState<Map<number, SummaryAggregate>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [proofUploadingId, setProofUploadingId] = useState<number | null>(
    null,
  );
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [allTimes, setAllTimes] = useState(false);
  const [tab, setTab] = useState<Tab>("waiting_invoice");
  const [direction, setDirection] = useState<Direction>("outgoing");
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [sort, setSort] = useState<PaymentsSort>({
    key: "date",
    dir: "desc",
  });
  const { types, typeByCode, statusByCode } = useEnums();
  const { ask, notify } = useDialog();

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function refresh() {
    setLoading(true);
    const [all, a] = await Promise.all([
      listEvents(),
      listSummaryAggregates().catch(() => new Map<number, SummaryAggregate>()),
    ]);
    setEvents(all.filter((e) => TABS.includes(e.status as Tab)));
    setAggs(a);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = useMemo(() => {
    const applyMonth =
      !allTimes && filters.from === "" && filters.to === "";
    const { start, end } = monthBounds(monthCursor);
    const wantedDeal = direction === "incoming" ? "fit_price" : "split";
    const totalsFn =
      direction === "incoming" ? totalsForIncoming : totalsFor;
    return events
      .filter((e) => e.deal_type === wantedDeal)
      .filter((e) => e.status === tab)
      .filter((e) => matches(filters, e, allTimes))
      .filter((e) => {
        if (!applyMonth) return true;
        return e.date >= start && e.date <= end;
      })
      .map((e) => ({ event: e, totals: totalsFn(e) }))
      .filter(({ totals }) => {
        if (tab !== "done") return true;
        const a = Number.isFinite(totals.net) && totals.net !== 0;
        const b = Number.isFinite(totals.netExVat) && totals.netExVat !== 0;
        return a && b;
      })
      .sort((a, b) => {
        const e1 = a.event;
        const e2 = b.event;
        let av: string | number;
        let bv: string | number;
        switch (sort.key) {
          case "name":
            av = e1.name;
            bv = e2.name;
            break;
          case "date":
            av = e1.date;
            bv = e2.date;
            break;
          case "type":
            av = e1.type ?? "";
            bv = e2.type ?? "";
            break;
          case "producer":
            av = e1.producer_name ?? "";
            bv = e2.producer_name ?? "";
            break;
          case "status":
            av = e1.status;
            bv = e2.status;
            break;
          case "net":
            av = a.totals.net;
            bv = b.totals.net;
            break;
          case "netExVat":
            av = a.totals.netExVat;
            bv = b.totals.netExVat;
            break;
          case "check_date":
            av = e1.check_date ?? "";
            bv = e2.check_date ?? "";
            break;
          case "check_number":
            av = e1.check_number ?? "";
            bv = e2.check_number ?? "";
            break;
        }
        let cmp = 0;
        if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv), "he");
        return sort.dir === "asc" ? cmp : -cmp;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, filters, tab, aggs, monthCursor, allTimes, sort, direction]);

  function toggleSort(key: PaymentsSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }

  function sortArrow(key: PaymentsSortKey): string {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? " ↑" : " ↓";
  }

  function totalsForIncoming(e: EventWithProducer): ProducerTotals {
    const amount = e.deal_fit_price ?? 0;
    return { net: amount, netExVat: amount / (1 + VAT_RATE) };
  }

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

  async function handleSaveCheckDate(
    e: EventWithProducer,
    next: string,
  ) {
    const parsed = parseDisplayDate(next);
    if (!parsed.ok) {
      await notify(
        "תאריך לא תקין. ניתן להזין: dd/mm/yyyy, dd.mm.yyyy, או ddmmyyyy (8 ספרות).",
      );
      return;
    }
    if (parsed.iso === e.check_date) return;
    try {
      await updateEventCheckDate(e.id, parsed.iso);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notify(`שמירת תאריך הצ'ק נכשלה: ${msg}`);
    }
  }

  async function handleSavePaymentMethod(
    e: EventWithProducer,
    next: PaymentMethod | "",
  ) {
    const normalized = next === "" ? null : next;
    if (normalized === e.payment_method) return;
    try {
      await updateEventPaymentMethod(e.id, normalized);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notify(`שמירת אופן התשלום נכשלה: ${msg}`);
    }
  }

  async function handleProofUpload(e: EventWithProducer) {
    if (proofUploadingId != null) return;
    setProofUploadingId(e.id);
    try {
      const url = await pickAndUploadPaymentProof(e.name, e.date);
      if (!url) return;
      await updateEventPaymentProofUrl(e.id, url);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notify(`העלאת אישור התשלום נכשלה: ${msg}`);
    } finally {
      setProofUploadingId(null);
    }
  }

  async function handleProofReplace(e: EventWithProducer) {
    if (
      !(await ask("כבר קיים אישור תשלום לאירוע זה. להחליף אותו בקובץ חדש?"))
    ) {
      return;
    }
    await handleProofUpload(e);
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

  const showCheckColumns = tab !== "waiting_invoice";
  const directionalEvents = events.filter((e) =>
    direction === "incoming"
      ? e.deal_type === "fit_price"
      : e.deal_type === "split",
  );
  const hasEvents = directionalEvents.length > 0;
  const tabHasEvents = directionalEvents.some((e) => e.status === tab);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 8 }}>תשלומים</h1>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            {(["outgoing", "incoming"] as Direction[]).map((d) => (
              <button
                key={d}
                className={`btn btn-secondary btn-sm${direction === d ? " active" : ""}`}
                onClick={() => setDirection(d)}
              >
                {DIRECTION_LABELS[d]}
              </button>
            ))}
          </div>
          <div className="view-toggle">
            {TABS.map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {statusByCode[t]?.label ?? t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        {hasEvents && (
          <div
            className="calendar-header"
            style={{ marginBottom: 12 }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setAllTimes(false);
                  setMonthCursor(
                    new Date(
                      monthCursor.getFullYear(),
                      monthCursor.getMonth() + 1,
                      1,
                    ),
                  );
                }}
              >
                ›
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setAllTimes(false);
                  setMonthCursor(startOfMonth(new Date()));
                }}
              >
                היום
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setAllTimes(false);
                  setMonthCursor(
                    new Date(
                      monthCursor.getFullYear(),
                      monthCursor.getMonth() - 1,
                      1,
                    ),
                  );
                }}
              >
                ‹
              </button>
            </div>
            <div className="month-label">
              {MONTH_FMT.format(monthCursor)}
              {(filters.from !== "" || filters.to !== "") && (
                <span
                  className="muted"
                  style={{ fontSize: 13, marginInlineStart: 8 }}
                >
                  (סינון תאריכים פעיל)
                </span>
              )}
            </div>
          </div>
        )}
        {hasEvents && (
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
            <input
              className="filter-search"
              type="text"
              placeholder="חיפוש לפי מפיק"
              dir="auto"
              value={filters.producer}
              onChange={(e) => updateFilter("producer", e.target.value)}
            />
            <span className="filter-date-label">מ</span>
            <input
              className="filter-date"
              type="date"
              value={filters.from}
              onChange={(e) => {
                setAllTimes(false);
                updateFilter("from", e.target.value);
              }}
              aria-label="מתאריך"
            />
            <span className="filter-date-label">עד</span>
            <input
              className="filter-date"
              type="date"
              value={filters.to}
              onChange={(e) => {
                setAllTimes(false);
                updateFilter("to", e.target.value);
              }}
              aria-label="עד תאריך"
            />
            <button
              className={`btn btn-secondary btn-sm${allTimes ? " active" : ""}`}
              onClick={() => {
                setAllTimes((prev) => !prev);
                if (!allTimes) {
                  updateFilter("from", "");
                  updateFilter("to", "");
                }
              }}
              title="הצג תשלומים מכל התאריכים"
            >
              כל הזמנים
            </button>
            {(filtersActive(filters) || allTimes) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setAllTimes(false);
                }}
              >
                נקה סינון
              </button>
            )}
          </div>
        )}
        {!hasEvents ? (
          <div className="empty">
            אין אירועים במחזור התשלומים. שליחת סיכום אירוע למפיק תעביר את
            האירוע לכאן.
          </div>
        ) : !tabHasEvents ? (
          <div className="empty">אין אירועים בסטטוס זה.</div>
        ) : rows.length === 0 ? (
          <>
            <div
              className="muted"
              style={{ margin: "0 0 8px", fontSize: 13 }}
            >
              סה"כ: 0 תשלומים
            </div>
            <div className="empty">אין תוצאות לסינון.</div>
          </>
        ) : (
          <>
            <div
              className="muted"
              style={{ margin: "0 0 8px", fontSize: 13 }}
            >
              סה"כ: {rows.length} תשלומים
            </div>
          <table className="centered">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className="sort-header"
                    onClick={() => toggleSort("name")}
                  >
                    שם{sortArrow("name")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-header"
                    onClick={() => toggleSort("date")}
                  >
                    תאריך{sortArrow("date")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-header"
                    onClick={() => toggleSort("type")}
                  >
                    סוג{sortArrow("type")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-header"
                    onClick={() => toggleSort("producer")}
                  >
                    מפיק{sortArrow("producer")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-header"
                    onClick={() => toggleSort("status")}
                  >
                    סטטוס{sortArrow("status")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-header"
                    onClick={() => toggleSort("net")}
                  >
                    סה"כ כולל מע"מ{sortArrow("net")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-header"
                    onClick={() => toggleSort("netExVat")}
                  >
                    סה"כ ללא מע"מ{sortArrow("netExVat")}
                  </button>
                </th>
                <th>חשבונית</th>
                {showCheckColumns && direction === "outgoing" && (
                  <th>
                    <button
                      type="button"
                      className="sort-header"
                      onClick={() => toggleSort("check_date")}
                    >
                      תאריך צ'ק{sortArrow("check_date")}
                    </button>
                    <span
                      title={CHECK_DATE_HELP}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16,
                        height: 16,
                        marginInlineStart: 6,
                        borderRadius: "50%",
                        border: "1px solid var(--text-muted)",
                        color: "var(--text-muted)",
                        fontSize: 10,
                        lineHeight: 1,
                        cursor: "help",
                        verticalAlign: "middle",
                      }}
                    >
                      !
                    </span>
                  </th>
                )}
                {showCheckColumns && direction === "outgoing" && (
                  <th>
                    <button
                      type="button"
                      className="sort-header"
                      onClick={() => toggleSort("check_number")}
                    >
                      מספר צ'ק{sortArrow("check_number")}
                    </button>
                  </th>
                )}
                {showCheckColumns && direction === "incoming" && (
                  <th>אופן תשלום</th>
                )}
                {showCheckColumns && direction === "incoming" && (
                  <th>אישור תשלום</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ event: e, totals: t }) => {
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
                        allowedCodes={TABS}
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
                    {showCheckColumns && direction === "outgoing" && (
                      <td>
                        <input
                          key={`checkdate-${e.id}-${e.check_date ?? ""}`}
                          type="text"
                          dir="ltr"
                          defaultValue={isoToDisplayDate(e.check_date)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") {
                              (ev.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={(ev) =>
                            handleSaveCheckDate(e, ev.target.value)
                          }
                          style={{ width: 110, textAlign: "start" }}
                        />
                      </td>
                    )}
                    {showCheckColumns && direction === "outgoing" && (
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
                    )}
                    {showCheckColumns && direction === "incoming" && (
                      <td>
                        <select
                          value={e.payment_method ?? ""}
                          onChange={(ev) =>
                            handleSavePaymentMethod(
                              e,
                              ev.target.value as PaymentMethod | "",
                            )
                          }
                        >
                          <option value="">—</option>
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {showCheckColumns && direction === "incoming" && (
                      <td>
                        {e.payment_proof_url ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <a
                              href={e.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              פתח אישור
                            </a>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleProofReplace(e)}
                              disabled={proofUploadingId === e.id}
                            >
                              החלף
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-sm"
                            onClick={() => handleProofUpload(e)}
                            disabled={proofUploadingId === e.id}
                          >
                            {proofUploadingId === e.id
                              ? "מעלה…"
                              : "העלה אישור"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </div>
    </>
  );
}
