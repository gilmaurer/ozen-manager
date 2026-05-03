import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  EventStatus,
  EventType,
  EventWithProducer,
  ProducerRow,
} from "../../db/types";
import {
  createEvent,
  deleteEvent,
  EventInput,
  listEvents,
  updateEvent,
  updateEventStatus,
} from "./eventsRepo";
import {
  listProducers,
  resolveOrCreateProducerByName,
} from "../producers/producersRepo";
import { formatDate } from "../../utils/format";
import { Modal } from "../../components/Modal";
import { EventForm, EventFormValues } from "./EventForm";
import { EventsCalendar } from "./EventsCalendar";
import { InlineStatusSelect } from "./InlineStatusSelect";
import { MONTH_FMT, monthBounds, startOfMonth } from "./monthNav";
import { clubTicketShareOf, dealLabel } from "./dealCalc";
import { useEnums } from "../../services/enums";
import {
  listSummaryAggregates,
  SummaryAggregate,
} from "../summaries/summariesRepo";
import { listAllEventTypeStaff } from "../summaries/settingsRepo";
import { useDialog } from "../../components/dialog";

const VIEW_STORAGE_KEY = "ozen.events.view";
const SCOPE_STORAGE_KEY = "ozen.events.scope";
type View = "list" | "calendar";
type Scope = "all" | "summaries";

interface Filters {
  q: string;
  status: EventStatus | "";
  type: EventType | "";
  producer: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  q: "",
  status: "",
  type: "",
  producer: "",
  from: "",
  to: "",
};

function filtersActive(f: Filters): boolean {
  return (
    f.q !== "" ||
    f.status !== "" ||
    f.type !== "" ||
    f.producer !== "" ||
    f.from !== "" ||
    f.to !== ""
  );
}

function matches(f: Filters, e: EventWithProducer): boolean {
  if (f.q && !e.name.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.status && e.status !== f.status) return false;
  if (f.type && e.type !== f.type) return false;
  if (
    f.producer &&
    !(e.producer_name ?? "")
      .toLowerCase()
      .includes(f.producer.toLowerCase())
  )
    return false;
  if (f.from && e.date < f.from) return false;
  if (f.to && e.date > f.to) return false;
  return true;
}

export function EventsPage() {
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [producers, setProducers] = useState<ProducerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventWithProducer | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === "calendar" ? "calendar" : "list";
  });
  const [scope, setScope] = useState<Scope>(() => {
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY);
    return saved === "summaries" ? "summaries" : "all";
  });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [summaryAggs, setSummaryAggs] = useState<Map<number, SummaryAggregate>>(
    () => new Map(),
  );
  const [staffCostByType, setStaffCostByType] = useState<Map<string, number>>(
    () => new Map(),
  );
  const { statuses, types, typeByCode } = useEnums();
  const { ask } = useDialog();

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem(SCOPE_STORAGE_KEY, scope);
  }, [scope]);

  async function refresh() {
    setLoading(true);
    const [evs, prods, aggs, staffRows] = await Promise.all([
      listEvents(),
      listProducers(),
      listSummaryAggregates().catch(() => new Map<number, SummaryAggregate>()),
      listAllEventTypeStaff().catch(() => []),
    ]);
    const staffMap = new Map<string, number>();
    for (const r of staffRows) {
      const key = `${r.event_type_code}|${r.sub_type ?? ""}`;
      staffMap.set(key, (staffMap.get(key) ?? 0) + r.cost);
    }
    setEvents(evs);
    setProducers(prods);
    setSummaryAggs(aggs);
    setStaffCostByType(staffMap);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredEvents = useMemo(() => {
    const applyMonth =
      view === "list" && filters.from === "" && filters.to === "";
    const { start, end } = monthBounds(monthCursor);
    return events.filter((e) => {
      if (scope === "summaries" && !e.has_summary) return false;
      if (!matches(filters, e)) return false;
      if (applyMonth && (e.date < start || e.date > end)) return false;
      return true;
    });
  }, [events, filters, scope, view, monthCursor]);

  async function resolveProducerId(name: string | null): Promise<number | null> {
    if (!name) return null;
    return resolveOrCreateProducerByName(name);
  }

  function toEventInput(
    values: EventFormValues,
    producer_id: number | null,
    invoice_url: string | null,
    check_number: string | null,
  ): EventInput {
    return {
      name: values.name,
      date: values.date,
      start_time: values.start_time,
      type: values.type,
      sub_type: values.sub_type,
      producer_id,
      status: values.status,
      deal_type: values.deal_type,
      deal: values.deal,
      deal_fit_price: values.deal_fit_price,
      campaign: values.campaign,
      campaign_amount: values.campaign_amount,
      invoice_url,
      check_number,
      notes: values.notes,
    };
  }

  async function handleCreate(values: EventFormValues) {
    const producer_id = await resolveProducerId(values.producer_name);
    await createEvent(toEventInput(values, producer_id, null, null));
    setCreating(false);
    await refresh();
  }

  async function handleUpdate(values: EventFormValues) {
    if (!editing) return;
    const producer_id = await resolveProducerId(values.producer_name);
    await updateEvent(
      editing.id,
      toEventInput(values, producer_id, editing.invoice_url, editing.check_number),
    );
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!(await ask("למחוק את האירוע?"))) return;
    await deleteEvent(id);
    await refresh();
  }

  async function handleStatusChange(
    event: EventWithProducer,
    next: EventStatus,
  ) {
    if (event.status === next) return;
    await updateEventStatus(event.id, next);
    await refresh();
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const hasFilters = filtersActive(filters);
  const showEmpty = !loading && events.length === 0;
  const showNoMatches =
    !loading && events.length > 0 && filteredEvents.length === 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 8 }}>אירועים</h1>
          <div className="view-toggle">
            <button
              className={scope === "all" ? "active" : ""}
              onClick={() => setScope("all")}
            >
              הכל
            </button>
            <button
              className={scope === "summaries" ? "active" : ""}
              onClick={() => setScope("summaries")}
            >
              סיכומי אירועים
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="view-toggle">
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              רשימה
            </button>
            <button
              className={view === "calendar" ? "active" : ""}
              onClick={() => setView("calendar")}
            >
              לוח שנה
            </button>
          </div>
          <button className="btn" onClick={() => setCreating(true)}>
            + אירוע חדש
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">טוען…</div>
        ) : showEmpty ? (
          <div className="empty">אין אירועים עדיין. לחצו על "אירוע חדש" כדי להתחיל.</div>
        ) : (
          <>
            {view === "list" && (
              <div
                className="calendar-header"
                style={{ marginBottom: 12 }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setMonthCursor(
                        new Date(
                          monthCursor.getFullYear(),
                          monthCursor.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                  >
                    ›
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setMonthCursor(startOfMonth(new Date()))}
                  >
                    היום
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setMonthCursor(
                        new Date(
                          monthCursor.getFullYear(),
                          monthCursor.getMonth() - 1,
                          1,
                        ),
                      )
                    }
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
                {statuses.map((s) => (
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
              <input
                className="filter-search filter-search-sm"
                type="text"
                placeholder="חיפוש לפי מפיק"
                dir="auto"
                value={filters.producer}
                onChange={(e) => updateFilter("producer", e.target.value)}
              />
              <input
                className="filter-date"
                type="date"
                value={filters.from}
                onChange={(e) => updateFilter("from", e.target.value)}
                aria-label="מתאריך"
              />
              <input
                className="filter-date"
                type="date"
                value={filters.to}
                onChange={(e) => updateFilter("to", e.target.value)}
                aria-label="עד תאריך"
              />
              {hasFilters && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  נקה סינון
                </button>
              )}
            </div>

            {view === "calendar" ? (
              <EventsCalendar
                events={filteredEvents}
                onStatusChange={handleStatusChange}
              />
            ) : showNoMatches ? (
              <div className="empty">אין תוצאות לסינון.</div>
            ) : scope === "summaries" ? (
              <table className="centered">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>תאריך</th>
                    <th>סטטוס</th>
                    <th>כרטיסים</th>
                    <th>הכנסות כרטיסים</th>
                    <th>דיל</th>
                    <th>חלק המועדון מכרטיסים</th>
                    <th>בר</th>
                    <th>מונה</th>
                    <th>סה"כ הכנסות למועדון</th>
                    <th>הוצאות</th>
                    <th>נטו למועדון</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e) => {
                    const a = summaryAggs.get(e.id);
                    const ticketsRevenue = a?.tickets_revenue ?? 0;
                    const presaleRevenue = a?.presale_revenue ?? 0;
                    const boxOfficeRevenue = a?.box_office_revenue ?? 0;
                    const presaleCommissions = a?.presale_commissions ?? 0;
                    const ozenCommission = a?.ozen_commission ?? 0;
                    const barTotal = a?.bar_total ?? 0;
                    const ticketBase =
                      presaleRevenue - presaleCommissions + boxOfficeRevenue;
                    const clubTicketShare = clubTicketShareOf(e, ticketBase);
                    const clubTicketIncome = clubTicketShare + ozenCommission;
                    const clubTotalRevenue = clubTicketIncome + barTotal;
                    const staffCost = e.type
                      ? staffCostByType.get(
                          `${e.type}|${e.sub_type ?? ""}`,
                        ) ?? 0
                      : 0;
                    const campaignPct = e.campaign ?? 0;
                    const campaignAmount = e.campaign_amount ?? 0;
                    const clubCampaignExpense =
                      campaignAmount * (campaignPct / 100);
                    const expenses = staffCost + clubCampaignExpense;
                    const net = clubTotalRevenue - expenses;
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
                        <td
                          className="muted"
                          dir="ltr"
                          style={{ textAlign: "start" }}
                        >
                          {formatDate(e.date)}
                        </td>
                        <td>
                          <InlineStatusSelect
                            value={e.status}
                            onChange={(next) => handleStatusChange(e, next)}
                          />
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {a?.tickets_count ?? 0}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {ticketsRevenue.toLocaleString("he-IL")}{" ₪"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {dealLabel(e)}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {clubTicketIncome.toLocaleString("he-IL", {
                            maximumFractionDigits: 2,
                          })}
                          {" ₪"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {barTotal.toLocaleString("he-IL")}{" ₪"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {a?.counter ?? "—"}
                        </td>
                        <td
                          dir="ltr"
                          style={{ textAlign: "start", fontWeight: 600 }}
                        >
                          {clubTotalRevenue.toLocaleString("he-IL", {
                            maximumFractionDigits: 2,
                          })}
                          {" ₪"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {expenses.toLocaleString("he-IL")}{" ₪"}
                        </td>
                        <td
                          dir="ltr"
                          style={{ textAlign: "start", fontWeight: 600 }}
                        >
                          {net.toLocaleString("he-IL", {
                            maximumFractionDigits: 2,
                          })}
                          {" ₪"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="centered">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>תאריך</th>
                    <th>שעה</th>
                    <th>סוג</th>
                    <th>מפיק</th>
                    <th>סטטוס</th>
                    <th>הערות</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link
                          to={`/events/${e.id}`}
                          className="row-value"
                          dir="auto"
                        >
                          {e.name}
                        </Link>
                      </td>
                      <td className="muted" dir="ltr" style={{ textAlign: "start" }}>
                        {formatDate(e.date)}
                      </td>
                      <td className="muted" dir="ltr" style={{ textAlign: "start" }}>
                        {e.start_time ? e.start_time.slice(0, 5) : "—"}
                      </td>
                      <td>{e.type ? typeByCode[e.type]?.label ?? e.type : "—"}</td>
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
                        className="row-value cell-truncate"
                        dir="auto"
                        title={e.notes ?? undefined}
                      >
                        {e.notes ?? "—"}
                      </td>
                      <td style={{ textAlign: "end" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditing(e)}
                        >
                          עריכה
                        </button>{" "}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(e.id)}
                        >
                          מחיקה
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <Modal open={creating} title="אירוע חדש" onClose={() => setCreating(false)}>
        <EventForm
          producers={producers}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal open={!!editing} title="עריכת אירוע" onClose={() => setEditing(null)}>
        <EventForm
          initial={editing}
          producers={producers}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </>
  );
}
