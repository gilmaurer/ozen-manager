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
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_OPTIONS,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  eventTypeLabel,
} from "./labels";

const VIEW_STORAGE_KEY = "ozen.events.view";
type View = "list" | "calendar";

interface Filters {
  q: string;
  status: EventStatus | "";
  type: EventType | "";
  producer_id: number | null;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  q: "",
  status: "",
  type: "",
  producer_id: null,
  from: "",
  to: "",
};

function filtersActive(f: Filters): boolean {
  return (
    f.q !== "" ||
    f.status !== "" ||
    f.type !== "" ||
    f.producer_id !== null ||
    f.from !== "" ||
    f.to !== ""
  );
}

function matches(f: Filters, e: EventWithProducer): boolean {
  if (f.q && !e.name.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.status && e.status !== f.status) return false;
  if (f.type && e.type !== f.type) return false;
  if (f.producer_id !== null && e.producer_id !== f.producer_id) return false;
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  async function refresh() {
    setLoading(true);
    const [evs, prods] = await Promise.all([listEvents(), listProducers()]);
    setEvents(evs);
    setProducers(prods);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredEvents = useMemo(
    () => events.filter((e) => matches(filters, e)),
    [events, filters],
  );

  async function resolveProducerId(name: string | null): Promise<number | null> {
    if (!name) return null;
    return resolveOrCreateProducerByName(name);
  }

  function toEventInput(
    values: EventFormValues,
    producer_id: number | null,
  ): EventInput {
    return {
      name: values.name,
      date: values.date,
      type: values.type,
      producer_id,
      status: values.status,
      deal: values.deal,
      ticket_link: values.ticket_link,
      notes: values.notes,
    };
  }

  async function handleCreate(values: EventFormValues) {
    const producer_id = await resolveProducerId(values.producer_name);
    await createEvent(toEventInput(values, producer_id));
    setCreating(false);
    await refresh();
  }

  async function handleUpdate(values: EventFormValues) {
    if (!editing) return;
    const producer_id = await resolveProducerId(values.producer_name);
    await updateEvent(editing.id, toEventInput(values, producer_id));
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("למחוק את האירוע? פעולה זו תמחק גם את המשמרות.")) return;
    await deleteEvent(id);
    await refresh();
  }

  async function handleStatusChange(
    event: EventWithProducer,
    next: EventStatus,
  ) {
    if (event.status === next) return;
    await updateEvent(event.id, {
      name: event.name,
      date: event.date,
      type: event.type,
      producer_id: event.producer_id,
      status: next,
      deal: event.deal,
      ticket_link: event.ticket_link,
      notes: event.notes,
    });
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
        <h1>אירועים</h1>
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
        ) : view === "calendar" ? (
          <EventsCalendar
            events={filteredEvents}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <>
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
                {EVENT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {EVENT_STATUS_LABELS[s]}
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
                {EVENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <select
                value={filters.producer_id ?? ""}
                onChange={(e) =>
                  updateFilter(
                    "producer_id",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              >
                <option value="">כל המפיקים</option>
                {producers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
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

            {showNoMatches ? (
              <div className="empty">אין תוצאות לסינון.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>תאריך</th>
                    <th>סוג</th>
                    <th>מפיק</th>
                    <th>סטטוס</th>
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
                      <td className="muted">{formatDate(e.date)}</td>
                      <td>{eventTypeLabel(e.type)}</td>
                      <td className="row-value" dir="auto">
                        {e.producer_name ?? "—"}
                      </td>
                      <td>
                        <InlineStatusSelect
                          value={e.status}
                          onChange={(next) => handleStatusChange(e, next)}
                        />
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
