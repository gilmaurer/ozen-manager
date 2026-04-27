import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listUpcomingEvents } from "../events/eventsRepo";
import type { EventWithProducer } from "../../db/types";
import { formatDate } from "../../utils/format";
import { StatusBadge } from "../../components/StatusBadge";
import { useEnums } from "../../services/enums";

export function DashboardPage() {
  const { typeByCode } = useEnums();
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const e = await listUpcomingEvents(14);
      setEvents(e);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>לוח בקרה</h1>
      </div>

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
                  <td className="muted" dir="ltr" style={{ textAlign: "start" }}>
                    {formatDate(e.date)}
                    {e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""}
                  </td>
                  <td>{e.type ? typeByCode[e.type]?.label ?? e.type : "—"}</td>
                  <td><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
