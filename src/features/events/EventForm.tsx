import { FormEvent, useState } from "react";
import type { EventRow, EventStatus } from "../../db/types";
import { fromInputLocal, toInputLocal } from "../../utils/format";
import { EventInput } from "./eventsRepo";

interface Props {
  initial?: EventRow | null;
  onSubmit: (input: EventInput) => Promise<void> | void;
  onCancel: () => void;
}

export function EventForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startsAt, setStartsAt] = useState(toInputLocal(initial?.starts_at));
  const [endsAt, setEndsAt] = useState(toInputLocal(initial?.ends_at));
  const [venueArea, setVenueArea] = useState(initial?.venue_area ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? "draft");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startsAt) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        starts_at: fromInputLocal(startsAt)!,
        ends_at: fromInputLocal(endsAt),
        venue_area: venueArea.trim() || null,
        notes: notes.trim() || null,
        status,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row single">
        <div>
          <label>שם האירוע</label>
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
          <label>התחלה</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </div>
        <div>
          <label>סיום</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <div>
          <label>אזור / חלל</label>
          <input
            dir="auto"
            value={venueArea}
            onChange={(e) => setVenueArea(e.target.value)}
          />
        </div>
        <div>
          <label>סטטוס</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
            <option value="draft">טיוטה</option>
            <option value="published">מפורסם</option>
            <option value="archived">בארכיון</option>
          </select>
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
