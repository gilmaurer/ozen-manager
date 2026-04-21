import { FormEvent, useState } from "react";
import type { ShiftRow, StaffRow } from "../../db/types";
import { fromInputLocal, toInputLocal } from "../../utils/format";
import { ShiftInput } from "./shiftsRepo";

interface Props {
  eventId: number;
  staff: StaffRow[];
  initial?: ShiftRow | null;
  onSubmit: (input: ShiftInput) => Promise<void> | void;
  onCancel: () => void;
}

export function ShiftForm({ eventId, staff, initial, onSubmit, onCancel }: Props) {
  const [staffId, setStaffId] = useState<string>(
    initial?.staff_id != null ? String(initial.staff_id) : "",
  );
  const [startsAt, setStartsAt] = useState(toInputLocal(initial?.starts_at));
  const [endsAt, setEndsAt] = useState(toInputLocal(initial?.ends_at));
  const [position, setPosition] = useState(initial?.position ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        event_id: eventId,
        staff_id: staffId ? Number(staffId) : null,
        starts_at: fromInputLocal(startsAt),
        ends_at: fromInputLocal(endsAt),
        position: position.trim() || null,
        notes: notes.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div>
          <label>עובד/ת</label>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">— ללא שיוך —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.role ? ` · ${s.role}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>תפקיד במשמרת</label>
          <input
            dir="auto"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
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

      <div className="form-row single">
        <div>
          <label>הערות</label>
          <textarea
            dir="auto"
            rows={2}
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
