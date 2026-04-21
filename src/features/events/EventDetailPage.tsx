import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { EventRow, ShiftWithStaff, StaffRow } from "../../db/types";
import { getEvent } from "./eventsRepo";
import { listStaff } from "../staff/staffRepo";
import {
  createShift,
  deleteShift,
  listShiftsForEvent,
  ShiftInput,
  updateShift,
} from "../shifts/shiftsRepo";
import { formatDateTime, formatTime } from "../../utils/format";
import { StatusBadge } from "../../components/StatusBadge";
import { Modal } from "../../components/Modal";
import { ShiftForm } from "../shifts/ShiftForm";

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [shifts, setShifts] = useState<ShiftWithStaff[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ShiftWithStaff | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [e, s, st] = await Promise.all([
      getEvent(eventId),
      listShiftsForEvent(eventId),
      listStaff(),
    ]);
    setEvent(e);
    setShifts(s);
    setStaff(st);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(input: ShiftInput) {
    await createShift(input);
    setCreating(false);
    await refresh();
  }

  async function handleUpdate(input: ShiftInput) {
    if (!editing) return;
    await updateShift(editing.id, input);
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("למחוק את המשמרת?")) return;
    await deleteShift(id);
    await refresh();
  }

  if (loading) return <div className="empty">טוען…</div>;
  if (!event) {
    return (
      <div className="card">
        <div className="empty">האירוע לא נמצא.</div>
        <Link to="/events" className="btn btn-secondary">חזרה לאירועים</Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            <Link to="/events">אירועים</Link> ›
          </div>
          <h1 className="row-value" dir="auto">{event.name}</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            {formatDateTime(event.starts_at)}
            {event.ends_at ? ` – ${formatDateTime(event.ends_at)}` : ""} · <StatusBadge status={event.status} />
          </div>
        </div>
      </div>

      {(event.venue_area || event.notes) && (
        <div className="card" style={{ marginBottom: 16 }}>
          {event.venue_area && (
            <div style={{ marginBottom: 8 }}>
              <span className="muted">אזור: </span>
              <span className="row-value" dir="auto">{event.venue_area}</span>
            </div>
          )}
          {event.notes && (
            <div>
              <span className="muted">הערות: </span>
              <span className="row-value" dir="auto">{event.notes}</span>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h2>משמרות לאירוע</h2>
          <button className="btn btn-sm" onClick={() => setCreating(true)}>
            + משמרת חדשה
          </button>
        </div>

        {shifts.length === 0 ? (
          <div className="empty">אין משמרות משויכות לאירוע זה.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>עובד/ת</th>
                <th>תפקיד</th>
                <th>התחלה</th>
                <th>סיום</th>
                <th>הערות</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td className="row-value" dir="auto">{s.staff_name ?? "—"}</td>
                  <td className="row-value" dir="auto">{s.position ?? "—"}</td>
                  <td className="muted">{formatTime(s.starts_at)}</td>
                  <td className="muted">{formatTime(s.ends_at)}</td>
                  <td className="row-value" dir="auto">{s.notes ?? "—"}</td>
                  <td style={{ textAlign: "end" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditing(s)}
                    >
                      עריכה
                    </button>{" "}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(s.id)}
                    >
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={creating} title="משמרת חדשה" onClose={() => setCreating(false)}>
        <ShiftForm
          eventId={eventId}
          staff={staff}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal open={!!editing} title="עריכת משמרת" onClose={() => setEditing(null)}>
        <ShiftForm
          eventId={eventId}
          staff={staff}
          initial={editing}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </>
  );
}
