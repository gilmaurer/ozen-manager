import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listUpcomingEvents } from "../events/eventsRepo";
import { listTodaysShifts } from "../shifts/shiftsRepo";
import type { EventWithProducer, ShiftWithStaff } from "../../db/types";
import { formatDate, formatTime } from "../../utils/format";
import { StatusBadge } from "../../components/StatusBadge";
import { eventTypeLabel } from "../events/labels";

export function DashboardPage() {
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [shifts, setShifts] = useState<ShiftWithStaff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [e, s] = await Promise.all([
        listUpcomingEvents(14),
        listTodaysShifts(),
      ]);
      setEvents(e);
      setShifts(s);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>לוח בקרה</h1>
      </div>

      <div className="card-grid">
        <div className="card">
          <h2>אירועים קרובים</h2>
          {loading ? (
            <div className="empty">טוען…</div>
          ) : events.length === 0 ? (
            <div className="empty">אין אירועים קרובים בשבועיים הבאים</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>תאריך</th>
                  <th>סוג</th>
                  <th>סטטוס</th>
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
                    <td className="muted">{formatDate(e.date)}</td>
                    <td>{eventTypeLabel(e.type)}</td>
                    <td><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>משמרות היום</h2>
          {loading ? (
            <div className="empty">טוען…</div>
          ) : shifts.length === 0 ? (
            <div className="empty">אין משמרות מתוכננות להיום</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>אירוע</th>
                  <th>עובד/ת</th>
                  <th>תפקיד</th>
                  <th>שעות</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/events/${s.event_id}`} className="row-value" dir="auto">
                        {s.event_name}
                      </Link>
                    </td>
                    <td className="row-value" dir="auto">{s.staff_name ?? "—"}</td>
                    <td className="row-value" dir="auto">{s.position ?? "—"}</td>
                    <td className="muted">
                      {formatTime(s.starts_at)} – {formatTime(s.ends_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
