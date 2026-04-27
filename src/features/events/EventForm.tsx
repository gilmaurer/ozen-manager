import { FormEvent, useState } from "react";
import type {
  EventStatus,
  EventType,
  EventWithProducer,
  ProducerRow,
} from "../../db/types";
import { useEnums } from "../../services/enums";
import { SUB_TYPES_BY_TYPE } from "./subTypes";

export interface EventFormValues {
  name: string;
  date: string;
  start_time: string | null;
  type: EventType | null;
  sub_type: string | null;
  producer_name: string | null;
  status: EventStatus;
  deal: number | null;
  campaign: number | null;
  campaign_amount: number | null;
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
  const { statuses, types } = useEnums();
  const defaultStatus = statuses[0]?.code ?? "draft";
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [startTime, setStartTime] = useState(
    initial?.start_time ? initial.start_time.slice(0, 5) : "",
  );
  const [type, setType] = useState<EventType | "">(initial?.type ?? "");
  const [subType, setSubType] = useState<string>(initial?.sub_type ?? "");
  const [producer, setProducer] = useState(initial?.producer_name ?? "");
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? defaultStatus);
  const [deal, setDeal] = useState<string>(
    initial?.deal != null ? String(initial.deal) : "",
  );
  const [campaign, setCampaign] = useState<string>(
    initial?.campaign != null ? String(initial.campaign) : "",
  );
  const [campaignAmount, setCampaignAmount] = useState<string>(
    initial?.campaign_amount != null ? String(initial.campaign_amount) : "",
  );
  const [ticketLink, setTicketLink] = useState(initial?.ticket_link ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const subTypeOptions = type ? SUB_TYPES_BY_TYPE[type] ?? [] : [];
  const hasSub = subTypeOptions.length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !date) return;
    if (hasSub && !subType) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        date,
        start_time: startTime || null,
        type: type || null,
        sub_type: hasSub ? subType || null : null,
        producer_name: producer.trim() || null,
        status,
        deal: deal === "" ? null : Math.max(0, Math.min(100, Math.round(Number(deal)))),
        campaign:
          campaign === ""
            ? null
            : Math.max(0, Math.min(100, Math.round(Number(campaign)))),
        campaign_amount:
          campaignAmount === "" || !Number.isFinite(Number(campaignAmount))
            ? null
            : Math.max(0, Math.round(Number(campaignAmount) * 100) / 100),
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
          <label>שעה</label>
          <input
            type="time"
            dir="ltr"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div>
          <label>סוג</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as EventType | "");
              setSubType("");
            }}
          >
            <option value="">—</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasSub && (
        <div className="form-row single">
          <div>
            <label>תת-סוג</label>
            <select
              value={subType}
              onChange={(e) => setSubType(e.target.value)}
              required
            >
              <option value="">—</option>
              {subTypeOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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
            {statuses.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row single">
        <div>
          <label>דיל — אחוז למועדון מהכרטיסים (%)</label>
          <input
            type="number"
            dir="ltr"
            min={0}
            max={100}
            value={deal}
            onChange={(e) => setDeal(e.target.value)}
            placeholder="0 – 100"
          />
        </div>
      </div>

      <div className="form-row">
        <div>
          <label>קמפיין — סכום (₪)</label>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={campaignAmount}
            onChange={(e) => setCampaignAmount(e.target.value)}
            placeholder="סה״כ עלות הקמפיין"
          />
        </div>
        <div>
          <label>קמפיין — אחוז למועדון (%)</label>
          <input
            type="number"
            dir="ltr"
            min={0}
            max={100}
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="0 – 100"
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
