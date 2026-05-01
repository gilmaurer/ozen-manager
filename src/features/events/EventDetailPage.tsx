import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ensureSummaryForEvent } from "../summaries/summariesRepo";
import type { EventWithProducer, ProducerRow } from "../../db/types";
import { getEvent, updateEvent } from "./eventsRepo";
import {
  listProducers,
  resolveOrCreateProducerByName,
} from "../producers/producersRepo";
import { formatDate } from "../../utils/format";
import { StatusBadge } from "../../components/StatusBadge";
import { Modal } from "../../components/Modal";
import { EventForm, EventFormValues } from "./EventForm";
import { useEnums } from "../../services/enums";
import { hasSubTypes, subTypeLabel } from "./subTypes";
import { dealLabel } from "./dealCalc";

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const navigate = useNavigate();
  const { typeByCode } = useEnums();
  const [event, setEvent] = useState<EventWithProducer | null>(null);
  const [producers, setProducers] = useState<ProducerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [e, prods] = await Promise.all([getEvent(eventId), listProducers()]);
    setEvent(e);
    setProducers(prods);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleOpenSummary() {
    if (!event) return;
    if (!event.has_summary) {
      await ensureSummaryForEvent(eventId);
    }
    navigate(`/events/${eventId}/summary`);
  }

  async function handleUpdate(values: EventFormValues) {
    if (!event) return;
    const producer_id = values.producer_name
      ? await resolveOrCreateProducerByName(values.producer_name)
      : null;
    await updateEvent(event.id, {
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
      notes: values.notes,
    });
    setEditing(false);
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
            {formatDate(event.date)} · <StatusBadge status={event.status} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>
            עריכה
          </button>
          <button className="btn" onClick={handleOpenSummary}>
            {event.has_summary ? "פתיחת סיכום" : "יצירת סיכום"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="detail-row">
          <span className="muted">שם: </span>
          <span className="row-value" dir="auto">{event.name}</span>
        </div>
        <div className="detail-row">
          <span className="muted">תאריך: </span>
          <span>{formatDate(event.date)}</span>
        </div>
        <div className="detail-row">
          <span className="muted">שעה: </span>
          <span dir="ltr">{event.start_time ? event.start_time.slice(0, 5) : "—"}</span>
        </div>
        <div className="detail-row">
          <span className="muted">סוג: </span>
          <span>{event.type ? typeByCode[event.type]?.label ?? event.type : "—"}</span>
        </div>
        {hasSubTypes(event.type) && (
          <div className="detail-row">
            <span className="muted">תת-סוג: </span>
            <span>{subTypeLabel(event.type, event.sub_type) ?? "—"}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="muted">מפיק: </span>
          {event.producer_name ? (
            <Link
              to={`/producers/${event.producer_id}`}
              className="row-value"
              dir="auto"
            >
              {event.producer_name}
            </Link>
          ) : (
            <span>—</span>
          )}
        </div>
        <div className="detail-row">
          <span className="muted">סטטוס: </span>
          <StatusBadge status={event.status} />
        </div>
        <div className="detail-row">
          <span className="muted">דיל: </span>
          <span dir="ltr">{dealLabel(event)}</span>
        </div>
        <div className="detail-row">
          <span className="muted">קמפיין — סכום: </span>
          <span dir="ltr">
            {event.campaign_amount != null
              ? `${event.campaign_amount.toLocaleString("he-IL", {
                  maximumFractionDigits: 2,
                })} ₪`
              : "—"}
          </span>
        </div>
        <div className="detail-row">
          <span className="muted">קמפיין (% למועדון): </span>
          <span dir="ltr">
            {event.campaign != null ? `${event.campaign}%` : "—"}
          </span>
        </div>
        <div className="detail-row">
          <span className="muted">הערות: </span>
          <span className="row-value" dir="auto">{event.notes ?? "—"}</span>
        </div>
      </div>

      <Modal open={editing} title="עריכת אירוע" onClose={() => setEditing(false)}>
        <EventForm
          initial={event}
          producers={producers}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </>
  );
}
