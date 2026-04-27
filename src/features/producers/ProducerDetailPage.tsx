import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { EventWithProducer, ProducerRow } from "../../db/types";
import {
  countEventsByProducer,
  deleteProducer,
  getProducer,
  ProducerInput,
  updateProducer,
} from "./producersRepo";
import { listEventsByProducer } from "../events/eventsRepo";
import { Modal } from "../../components/Modal";
import { ProducerForm } from "./ProducerForm";
import { StatusBadge } from "../../components/StatusBadge";
import { formatDate } from "../../utils/format";
import { useEnums } from "../../services/enums";
import { useDialog } from "../../components/dialog";

export function ProducerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const producerId = Number(id);
  const navigate = useNavigate();
  const { typeByCode } = useEnums();
  const { ask, notify } = useDialog();
  const [producer, setProducer] = useState<ProducerRow | null>(null);
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, es] = await Promise.all([
      getProducer(producerId),
      listEventsByProducer(producerId),
    ]);
    setProducer(p);
    setEvents(es);
    setLoading(false);
  }, [producerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleUpdate(input: ProducerInput) {
    await updateProducer(producerId, input);
    setEditing(false);
    await refresh();
  }

  async function handleDelete() {
    const count = await countEventsByProducer(producerId);
    if (count > 0) {
      await notify(
        `למפיק זה משויכים ${count} אירועים. יש למחוק או לשייך מחדש את האירועים לפני מחיקה.`,
      );
      return;
    }
    if (!(await ask("למחוק את המפיק?"))) return;
    await deleteProducer(producerId);
    navigate("/producers");
  }

  if (loading) return <div className="empty">טוען…</div>;
  if (!producer) {
    return (
      <div className="card">
        <div className="empty">המפיק לא נמצא.</div>
        <Link to="/producers" className="btn btn-secondary">
          חזרה למפיקים
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            <Link to="/producers">מפיקים</Link> ›
          </div>
          <h1 className="row-value" dir="auto">
            {producer.name}
          </h1>
          <div className="muted" style={{ marginTop: 4 }} dir="ltr">
            {producer.phone ?? "—"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setEditing(true)}
          >
            עריכה
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            מחיקה
          </button>
        </div>
      </div>

      <div className="card">
        <h2>אירועים של המפיק</h2>
        {events.length === 0 ? (
          <div className="empty">אין אירועים משויכים למפיק זה.</div>
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
                    <Link
                      to={`/events/${e.id}`}
                      className="row-value"
                      dir="auto"
                    >
                      {e.name}
                    </Link>
                  </td>
                  <td className="muted">{formatDate(e.date)}</td>
                  <td>{e.type ? typeByCode[e.type]?.label ?? e.type : "—"}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={editing} title="עריכת מפיק" onClose={() => setEditing(false)}>
        <ProducerForm
          initial={producer}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </>
  );
}
