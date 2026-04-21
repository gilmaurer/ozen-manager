import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { EventRow } from "../../db/types";
import {
  createEvent,
  deleteEvent,
  EventInput,
  listEvents,
  updateEvent,
} from "./eventsRepo";
import { formatDateTime } from "../../utils/format";
import { StatusBadge } from "../../components/StatusBadge";
import { Modal } from "../../components/Modal";
import { EventForm } from "./EventForm";

export function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    setEvents(await listEvents());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(input: EventInput) {
    await createEvent(input);
    setCreating(false);
    await refresh();
  }

  async function handleUpdate(input: EventInput) {
    if (!editing) return;
    await updateEvent(editing.id, input);
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("למחוק את האירוע? פעולה זו תמחק גם את המשמרות.")) return;
    await deleteEvent(id);
    await refresh();
  }

  return (
    <>
      <div className="page-header">
        <h1>אירועים</h1>
        <button className="btn" onClick={() => setCreating(true)}>
          + אירוע חדש
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">טוען…</div>
        ) : events.length === 0 ? (
          <div className="empty">אין אירועים עדיין. לחצו על "אירוע חדש" כדי להתחיל.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>שם</th>
                <th>התחלה</th>
                <th>אזור</th>
                <th>סטטוס</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/events/${e.id}`} className="row-value" dir="auto">
                      {e.name}
                    </Link>
                  </td>
                  <td className="muted">{formatDateTime(e.starts_at)}</td>
                  <td className="row-value" dir="auto">{e.venue_area ?? "—"}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td style={{ textAlign: "end" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(e)}>
                      עריכה
                    </button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={creating} title="אירוע חדש" onClose={() => setCreating(false)}>
        <EventForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={!!editing} title="עריכת אירוע" onClose={() => setEditing(null)}>
        <EventForm
          initial={editing}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </>
  );
}
