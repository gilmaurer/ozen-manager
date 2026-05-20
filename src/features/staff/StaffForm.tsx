import { FormEvent, useState } from "react";
import type { JobTitleRow, StaffRow } from "../../db/types";
import { StaffInput } from "./staffRepo";

interface Props {
  initial?: StaffRow | null;
  jobTitles: JobTitleRow[];
  onSubmit: (input: StaffInput) => Promise<void> | void;
  onCancel: () => void;
}

export function StaffForm({ initial, jobTitles, onSubmit, onCancel }: Props) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [titleIds, setTitleIds] = useState<number[]>(
    initial?.job_title_ids ?? [],
  );
  const [submitting, setSubmitting] = useState(false);

  function toggleTitle(id: number) {
    setTitleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        active,
        job_title_ids: titleIds,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
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
        <div>
          <label>טלפון</label>
          <input
            dir="auto"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row single">
        <div>
          <label>תפקידים</label>
          {jobTitles.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>
              אין תפקידים מוגדרים. הוסף בכרטיסיית "תפקידים".
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 4,
              }}
            >
              {jobTitles.map((t) => {
                const checked = titleIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      background: checked ? "var(--bg-panel-hover)" : "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTitle(t.id)}
                      style={{ width: "auto", margin: 0 }}
                    />
                    <span className="row-value" dir="auto">
                      {t.name}
                    </span>
                    {t.default_rate != null && (
                      <span className="muted" dir="ltr" style={{ fontSize: 12 }}>
                        ({t.default_rate}₪)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="form-row single">
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
