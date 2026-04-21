import { FormEvent, useState } from "react";
import type {
  EventStatus,
  EventType,
  EventWithProducer,
  ProducerRow,
} from "../../db/types";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_OPTIONS,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
} from "./labels";

export interface EventFormValues {
  name: string;
  date: string;
  type: EventType | null;
  producer_name: string | null;
  status: EventStatus;
  deal: string | null;
  ticket_link: string | null;
  notes: string | null;
}

interface Props {
  initial?: EventWithProducer | null;
  producers: ProducerRow[];
  onSubmit: (values: EventFormValues) => Promise<void> | void;
  onCancel: () => void;
}

export function EventForm({ initial, producers, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [type, setType] = useState<EventType | "">(initial?.type ?? "");
  const [producer, setProducer] = useState(initial?.producer_name ?? "");
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? "draft");
  const [deal, setDeal] = useState(initial?.deal ?? "");
  const [ticketLink, setTicketLink] = useState(initial?.ticket_link ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !date) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        date,
        type: type || null,
        producer_name: producer.trim() || null,
        status,
        deal: deal.trim() || null,
        ticket_link: ticketLink.trim() || null,
        notes: notes.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row single">
        <div>
          <label>שם</label>
          <input
            dir="auto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
      </div>

      <div className="form-row">
        <div>
          <label>תאריך</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label>סוג</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventType | "")}
          >
            <option value="">—</option>
            {EVENT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div>
          <label>מפיק</label>
          <input
            dir="auto"
            list="producer-options"
            value={producer}
            onChange={(e) => setProducer(e.target.value)}
            placeholder="הקלידו או בחרו מפיק"
          />
          <datalist id="producer-options">
            {producers.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label>סטטוס</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EventStatus)}
          >
            {EVENT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row single">
        <div>
          <label>דיל</label>
          <input
            dir="auto"
            value={deal}
            onChange={(e) => setDeal(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row single">
        <div>
          <label>לינק מכירת כרטיסים</label>
          <input
            type="url"
            dir="ltr"
            value={ticketLink}
            onChange={(e) => setTicketLink(e.target.value)}
            placeholder="https://"
          />
        </div>
      </div>

      <div className="form-row single">
        <div>
          <label>הערות</label>
          <textarea
            dir="auto"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          ביטול
        </button>
        <button type="submit" className="btn" disabled={submitting}>
          שמירה
        </button>
      </div>
    </form>
  );
}
