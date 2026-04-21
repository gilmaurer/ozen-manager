import { useEffect, useState } from "react";
import type { StaffRow } from "../../db/types";
import {
  createStaff,
  deleteStaff,
  listStaff,
  StaffInput,
  toggleStaffActive,
  updateStaff,
} from "./staffRepo";
import { Modal } from "../../components/Modal";
import { StaffForm } from "./StaffForm";

export function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    setStaff(await listStaff());
    setLoading(false);
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
    await toggleStaffActive(s.id, s.active ? 0 : 1);
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
        <h1>צוות</h1>
        <button className="btn" onClick={() => setCreating(true)}>
          + עובד/ת חדש/ה
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">טוען…</div>
        ) : staff.length === 0 ? (
          <div className="empty">אין אנשי צוות עדיין.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>שם</th>
                <th>תפקיד</th>
                <th>טלפון</th>
                <th>שכר שעתי</th>
                <th>פעיל</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
                  <td className="row-value" dir="auto">{s.full_name}</td>
                  <td className="row-value" dir="auto">{s.role ?? "—"}</td>
                  <td className="row-value" dir="auto">{s.phone ?? "—"}</td>
                  <td className="muted">{s.hourly_rate != null ? `${s.hourly_rate} ₪` : "—"}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!s.active}
                      onChange={() => handleToggle(s)}
                      style={{ width: "auto" }}
                    />
                  </td>
                  <td style={{ textAlign: "end" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(s)}>
                      עריכה
                    </button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={creating} title="עובד/ת חדש/ה" onClose={() => setCreating(false)}>
        <StaffForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={!!editing} title="עריכת פרטי עובד/ת" onClose={() => setEditing(null)}>
        <StaffForm
          initial={editing}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </>
  );
}
