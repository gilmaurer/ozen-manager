import { FormEvent, useState } from "react";
import type { ProducerRow } from "../../db/types";
import { ProducerInput } from "./producersRepo";

interface Props {
  initial?: ProducerRow | null;
  onSubmit: (input: ProducerInput) => Promise<void> | void;
  onCancel: () => void;
}

export function ProducerForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim() || null,
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

      <div className="form-row single">
        <div>
          <label>טלפון</label>
          <input
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="050-0000000"
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
