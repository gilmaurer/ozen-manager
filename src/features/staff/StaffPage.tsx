import { useEffect, useMemo, useState } from "react";
import type { JobTitleRow, StaffRow } from "../../db/types";
import { useDialog } from "../../components/dialog";
import {
  createStaff,
  deleteStaff,
  listStaff,
  StaffInput,
  toggleStaffActive,
  updateStaff,
} from "./staffRepo";
import {
  createJobTitle,
  deleteJobTitle,
  listJobTitles,
  updateJobTitle,
} from "./jobTitlesRepo";
import { Modal } from "../../components/Modal";
import { StaffForm } from "./StaffForm";

function JobTitleEditor({
  row,
  onChanged,
}: {
  row: JobTitleRow;
  onChanged: () => Promise<void>;
}) {
  const { ask, run } = useDialog();
  const [name, setName] = useState(row.name);
  const [rate, setRate] = useState(
    row.default_rate != null ? String(row.default_rate) : "",
  );

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === row.name) return;
    if (await run(() => updateJobTitle(row.id, { name: trimmed }))) {
      await onChanged();
    }
  }
  async function saveRate() {
    const n = rate === "" ? null : Number(rate);
    if (n != null && !Number.isFinite(n)) return;
    if (n === row.default_rate) return;
    if (await run(() => updateJobTitle(row.id, { default_rate: n }))) {
      await onChanged();
    }
  }
  async function handleDelete() {
    if (!(await ask(`למחוק את "${row.name}"?`))) return;
    if (await run(() => deleteJobTitle(row.id))) {
      await onChanged();
    }
  }

  return (
    <tr>
      <td>
        <input
          dir="auto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
        />
      </td>
      <td>
        <input
          type="number"
          dir="ltr"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onBlur={saveRate}
          style={{ width: 100 }}
        />
      </td>
      <td style={{ textAlign: "end" }}>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          מחיקה
        </button>
      </td>
    </tr>
  );
}

function JobTitlesCard({
  jobTitles,
  reload,
}: {
  jobTitles: JobTitleRow[];
  reload: () => Promise<void>;
}) {
  const { run } = useDialog();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const r = newRate === "" ? null : Number(newRate);
    if (r != null && !Number.isFinite(r)) return;
    if (
      await run(async () => {
        await createJobTitle({ name: trimmed, default_rate: r });
      })
    ) {
      setNewName("");
      setNewRate("");
      setAdding(false);
      await reload();
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2>תפקידים</h2>
        <button
          className="btn btn-sm"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          + הוספה
        </button>
      </div>
      {jobTitles.length === 0 && !adding ? (
        <div className="empty">אין תפקידים עדיין.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>תפקיד</th>
              <th>תעריף ברירת מחדל (₪)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobTitles.map((t) => (
              <JobTitleEditor key={t.id} row={t} onChanged={reload} />
            ))}
            {adding && (
              <tr>
                <td>
                  <input
                    dir="auto"
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                      if (e.key === "Escape") setAdding(false);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    dir="ltr"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                      if (e.key === "Escape") setAdding(false);
                    }}
                    style={{ width: 100 }}
                  />
                </td>
                <td style={{ textAlign: "end" }}>
                  <button className="btn btn-sm" onClick={handleAdd}>
                    שמירה
                  </button>{" "}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setAdding(false);
                      setNewName("");
                      setNewRate("");
                    }}
                  >
                    ביטול
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"workers" | "titles">("workers");

  const titlesById = useMemo(() => {
    const m = new Map<number, JobTitleRow>();
    for (const t of jobTitles) m.set(t.id, t);
    return m;
  }, [jobTitles]);

  async function refresh() {
    setLoading(true);
    const [s, t] = await Promise.all([listStaff(), listJobTitles()]);
    setStaff(s);
    setJobTitles(t);
    setLoading(false);
  }

  async function reloadTitles() {
    setJobTitles(await listJobTitles());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(input: StaffInput) {
    await createStaff(input);
    setCreating(false);
    await refresh();
  }

  async function handleUpdate(input: StaffInput) {
    if (!editing) return;
    await updateStaff(editing.id, input);
    setEditing(null);
    await refresh();
  }

  async function handleToggle(s: StaffRow) {
    await toggleStaffActive(s.id, !s.active);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("למחוק את איש/ת הצוות?")) return;
    await deleteStaff(id);
    await refresh();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 8 }}>צוות</h1>
          <div className="view-toggle">
            <button
              className={tab === "workers" ? "active" : ""}
              onClick={() => setTab("workers")}
            >
              עובדים
            </button>
            <button
              className={tab === "titles" ? "active" : ""}
              onClick={() => setTab("titles")}
            >
              תפקידים
            </button>
          </div>
        </div>
        {tab === "workers" && (
          <button className="btn" onClick={() => setCreating(true)}>
            + עובד/ת חדש/ה
          </button>
        )}
      </div>

      {tab === "titles" && (
        <JobTitlesCard jobTitles={jobTitles} reload={reloadTitles} />
      )}

      {tab === "workers" && (
      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h2>עובדים</h2>
        </div>
        {loading ? (
          <div className="empty">טוען…</div>
        ) : staff.length === 0 ? (
          <div className="empty">אין אנשי צוות עדיין.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>שם</th>
                <th>תפקידים</th>
                <th>טלפון</th>
                <th>פעיל</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const titles = (s.job_title_ids ?? [])
                  .map((id) => titlesById.get(id)?.name)
                  .filter((x): x is string => Boolean(x));
                return (
                  <tr key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
                    <td className="row-value" dir="auto">
                      {s.full_name}
                    </td>
                    <td>
                      {titles.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          {titles.map((name) => (
                            <span
                              key={name}
                              className="badge badge-color-gray row-value"
                              dir="auto"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="row-value" dir="auto">
                      {s.phone ?? "—"}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={s.active}
                        onChange={() => handleToggle(s)}
                        style={{ width: "auto" }}
                      />
                    </td>
                    <td style={{ textAlign: "end" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditing(s)}
                      >
                        עריכה
                      </button>{" "}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(s.id)}
                      >
                        מחיקה
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}

      <Modal open={creating} title="עובד/ת חדש/ה" onClose={() => setCreating(false)}>
        <StaffForm
          jobTitles={jobTitles}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal open={!!editing} title="עריכת פרטי עובד/ת" onClose={() => setEditing(null)}>
        <StaffForm
          initial={editing}
          jobTitles={jobTitles}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </>
  );
}
