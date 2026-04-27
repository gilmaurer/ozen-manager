import { FormEvent, useState } from "react";
import type { StaffRow } from "../../db/types";
import { StaffInput } from "./staffRepo";

interface Props {
  initial?: StaffRow | null;
  onSubmit: (input: StaffInput) => Promise<void> | void;
  onCancel: () => void;
}

export function StaffForm({ initial, onSubmit, onCancel }: Props) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [hourlyRate, setHourlyRate] = useState<string>(
    initial?.hourly_rate != null ? String(initial.hourly_rate) : "",
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName.trim(),
        role: role.trim() || null,
        phone: phone.trim() || null,
        hourly_rate: hourlyRate ? Number(hourlyRate) : null,
        active,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row single">
        <div>
          <label>שם מלא</label>
          <input
            dir="auto"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoFocus
          />
        </div>
      </div>

      <div className="form-row">
        <div>
          <label>תפקיד</label>
          <input
            dir="auto"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div>
          <label>טלפון</label>
          <input
            dir="auto"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <div>
          <label>שכר שעתי (₪)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </div>
        <div>
          <label>סטטוס</label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
            }}
          >
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ width: "auto" }}
            />
            <span style={{ color: "var(--text)" }}>פעיל</span>
          </label>
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
