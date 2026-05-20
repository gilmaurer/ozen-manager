import { useMemo, useState } from "react";
import type {
  EventWorkerWithDetails,
  JobTitleRow,
  StaffRow,
} from "../../db/types";
import { useDialog } from "../../components/dialog";
import {
  createEventWorker,
  deleteEventWorker,
  updateEventWorker,
  workerCost,
} from "./eventWorkersRepo";

function formatMoney(n: number): string {
  return `${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ₪`;
}

function allowedTitlesFor(
  staffJobTitleIds: number[],
  jobTitles: JobTitleRow[],
): JobTitleRow[] {
  if (!staffJobTitleIds || staffJobTitleIds.length === 0) return jobTitles;
  return jobTitles.filter((t) => staffJobTitleIds.includes(t.id));
}

interface RowProps {
  worker: EventWorkerWithDetails;
  staffList: StaffRow[];
  jobTitles: JobTitleRow[];
  onChanged: () => Promise<void>;
}

function WorkerRow({ worker, staffList, jobTitles, onChanged }: RowProps) {
  const { ask, run } = useDialog();
  const [staffId, setStaffId] = useState(worker.staff_id);
  const [jobTitleId, setJobTitleId] = useState(worker.job_title_id);
  const [rate, setRate] = useState(String(worker.rate));
  const [hours, setHours] = useState(
    worker.hours == null ? "" : String(worker.hours),
  );

  const selectedStaff = staffList.find((s) => s.id === staffId);
  const allowedTitles = allowedTitlesFor(
    selectedStaff?.job_title_ids ?? worker.staff_job_title_ids,
    jobTitles,
  );

  async function saveStaff(nextId: number) {
    setStaffId(nextId);
    if (await run(() => updateEventWorker(worker.id, { staff_id: nextId }))) {
      await onChanged();
    }
  }
  async function saveJobTitle(nextId: number) {
    const title = jobTitles.find((t) => t.id === nextId);
    setJobTitleId(nextId);
    const patch: { job_title_id: number; rate?: number } = {
      job_title_id: nextId,
    };
    if (title?.default_rate != null) {
      patch.rate = title.default_rate;
      setRate(String(title.default_rate));
    }
    if (await run(() => updateEventWorker(worker.id, patch))) {
      await onChanged();
    }
  }
  async function saveRate() {
    const n = Number(rate);
    if (!Number.isFinite(n) || n === worker.rate) return;
    if (await run(() => updateEventWorker(worker.id, { rate: n }))) {
      await onChanged();
    }
  }
  async function saveHours() {
    const n = hours === "" ? null : Number(hours);
    if (n != null && !Number.isFinite(n)) return;
    if (n === worker.hours) return;
    if (await run(() => updateEventWorker(worker.id, { hours: n }))) {
      await onChanged();
    }
  }
  async function handleDelete() {
    if (!(await ask("להסיר את העובד מהאירוע?"))) return;
    if (await run(() => deleteEventWorker(worker.id))) {
      await onChanged();
    }
  }

  const cost = workerCost(Number(rate) || 0, hours === "" ? null : Number(hours));

  return (
    <tr>
      <td>
        <select
          value={staffId}
          onChange={(e) => saveStaff(Number(e.target.value))}
        >
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
              {s.active ? "" : " (לא פעיל)"}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={jobTitleId}
          onChange={(e) => saveJobTitle(Number(e.target.value))}
        >
          {allowedTitles.length === 0 ? (
            <option value={jobTitleId}>—</option>
          ) : (
            allowedTitles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))
          )}
        </select>
      </td>
      <td>
        <input
          type="number"
          dir="ltr"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onBlur={saveRate}
          style={{ width: 90 }}
        />
      </td>
      <td>
        <input
          type="number"
          dir="ltr"
          step="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          onBlur={saveHours}
          placeholder="—"
          style={{ width: 80 }}
        />
      </td>
      <td dir="ltr" style={{ textAlign: "start" }}>
        {formatMoney(cost)}
      </td>
      <td style={{ textAlign: "end" }}>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          הסר
        </button>
      </td>
    </tr>
  );
}

interface AddRowProps {
  eventId: number;
  staffList: StaffRow[];
  jobTitles: JobTitleRow[];
  onAdded: () => Promise<void>;
  onCancel: () => void;
}

function AddWorkerRow({
  eventId,
  staffList,
  jobTitles,
  onAdded,
  onCancel,
}: AddRowProps) {
  const { run } = useDialog();
  const activeStaff = useMemo(
    () => staffList.filter((s) => s.active),
    [staffList],
  );
  const [staffId, setStaffId] = useState<number | "">(
    activeStaff[0]?.id ?? "",
  );
  const initialAllowed = activeStaff[0]
    ? allowedTitlesFor(activeStaff[0].job_title_ids, jobTitles)
    : jobTitles;
  const [jobTitleId, setJobTitleId] = useState<number | "">(
    initialAllowed[0]?.id ?? "",
  );
  const initialTitle = jobTitles.find((t) => t.id === initialAllowed[0]?.id);
  const [rate, setRate] = useState(
    initialTitle?.default_rate != null ? String(initialTitle.default_rate) : "0",
  );
  const [hours, setHours] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleStaffChange(nextId: number) {
    setStaffId(nextId);
    const next = staffList.find((s) => s.id === nextId);
    const titles = next ? allowedTitlesFor(next.job_title_ids, jobTitles) : jobTitles;
    const firstTitle = titles[0];
    if (firstTitle) {
      setJobTitleId(firstTitle.id);
      if (firstTitle.default_rate != null) {
        setRate(String(firstTitle.default_rate));
      }
    } else {
      setJobTitleId("");
    }
  }

  function handleJobTitleChange(nextId: number) {
    setJobTitleId(nextId);
    const t = jobTitles.find((x) => x.id === nextId);
    if (t?.default_rate != null) setRate(String(t.default_rate));
  }

  async function handleSave() {
    if (staffId === "" || jobTitleId === "") return;
    const n = Number(rate);
    if (!Number.isFinite(n)) return;
    const h = hours === "" ? null : Number(hours);
    if (h != null && !Number.isFinite(h)) return;
    setSubmitting(true);
    try {
      const ok = await run(async () => {
        await createEventWorker({
          event_id: eventId,
          staff_id: staffId,
          job_title_id: jobTitleId,
          rate: n,
          hours: h,
          notes: null,
        });
      });
      if (ok) {
        await onAdded();
        onCancel();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const selected = staffList.find((s) => s.id === staffId);
  const allowedTitles = selected
    ? allowedTitlesFor(selected.job_title_ids, jobTitles)
    : jobTitles;

  return (
    <tr>
      <td>
        <select
          value={staffId}
          onChange={(e) => handleStaffChange(Number(e.target.value))}
        >
          {activeStaff.length === 0 && <option value="">— אין עובדים פעילים —</option>}
          {activeStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={jobTitleId}
          onChange={(e) => handleJobTitleChange(Number(e.target.value))}
        >
          {allowedTitles.length === 0 && <option value="">— אין תפקידים —</option>}
          {allowedTitles.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="number"
          dir="ltr"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          style={{ width: 90 }}
        />
      </td>
      <td>
        <input
          type="number"
          dir="ltr"
          step="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="—"
          style={{ width: 80 }}
        />
      </td>
      <td />
      <td style={{ textAlign: "end" }}>
        <button
          className="btn btn-sm"
          onClick={handleSave}
          disabled={submitting || staffId === "" || jobTitleId === ""}
        >
          שמור
        </button>{" "}
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          ביטול
        </button>
      </td>
    </tr>
  );
}

interface CardProps {
  eventId: number;
  workers: EventWorkerWithDetails[];
  staffList: StaffRow[];
  jobTitles: JobTitleRow[];
  staffTotal: number;
  onChanged: () => Promise<void>;
}

export function EventWorkersCard({
  eventId,
  workers,
  staffList,
  jobTitles,
  staffTotal,
  onChanged,
}: CardProps) {
  const [adding, setAdding] = useState(false);

  const noStaff = staffList.length === 0;
  const noTitles = jobTitles.length === 0;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2>צוות</h2>
        {!adding && !noStaff && !noTitles && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setAdding(true)}
          >
            + הוסף עובד
          </button>
        )}
      </div>

      {workers.length === 0 && !adding ? (
        <div className="empty">
          {noStaff || noTitles
            ? "להגדרת צוות לאירוע הוסף תחילה עובדים ותפקידים בכרטיסיית "
            : "לא הוגדר צוות לאירוע. לחץ על \"+ הוסף עובד\" כדי להוסיף."}
          {(noStaff || noTitles) && <a href="#/staff">צוות</a>}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>עובד/ת</th>
              <th>תפקיד</th>
              <th>תעריף (₪)</th>
              <th>שעות</th>
              <th>עלות</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <WorkerRow
                key={w.id}
                worker={w}
                staffList={staffList}
                jobTitles={jobTitles}
                onChanged={onChanged}
              />
            ))}
            {adding && (
              <AddWorkerRow
                eventId={eventId}
                staffList={staffList}
                jobTitles={jobTitles}
                onAdded={onChanged}
                onCancel={() => setAdding(false)}
              />
            )}
          </tbody>
        </table>
      )}

      {workers.length > 0 && (
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }} dir="ltr">
          סה"כ צוות: {formatMoney(staffTotal)}
        </div>
      )}
    </div>
  );
}
