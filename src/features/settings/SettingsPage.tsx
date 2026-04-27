import { useEffect, useState } from "react";
import type { EventTypeStaffRow } from "../../db/types";
import { useDialog } from "../../components/dialog";
import { StatusRow, TypeRow, useEnums } from "../../services/enums";
import {
  COLOR_LABELS,
  COLOR_TOKENS,
  createStatus,
  createType,
  deleteStatus,
  deleteType,
  updateStatus,
  updateType,
} from "./enumsRepo";
import {
  createEventTypeStaff,
  deleteEventTypeStaff,
  listAllEventTypeStaff,
  updateEventTypeStaff,
} from "../summaries/settingsRepo";
import { SUB_TYPES_BY_TYPE } from "../events/subTypes";

function StatusRowEditor({
  row,
  onChanged,
}: {
  row: StatusRow;
  onChanged: () => Promise<void>;
}) {
  const { ask, run } = useDialog();
  const [label, setLabel] = useState(row.label);
  const [color, setColor] = useState(row.color);

  async function saveLabel() {
    const trimmed = label.trim();
    if (!trimmed || trimmed === row.label) return;
    if (await run(() => updateStatus(row.id, { label: trimmed }))) {
      await onChanged();
    }
  }

  async function saveColor(next: string) {
    setColor(next);
    if (await run(() => updateStatus(row.id, { color: next }))) {
      await onChanged();
    }
  }

  async function handleDelete() {
    if (!(await ask(`למחוק את "${row.label}"?`))) return;
    if (await run(() => deleteStatus(row.id, row.code))) {
      await onChanged();
    }
  }

  return (
    <tr>
      <td>
        <span className={`badge badge-color-${color}`}>{label || "—"}</span>
      </td>
      <td>
        <input
          dir="auto"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
        />
      </td>
      <td>
        <select value={color} onChange={(e) => saveColor(e.target.value)}>
          {COLOR_TOKENS.map((c) => (
            <option key={c} value={c}>
              {COLOR_LABELS[c]}
            </option>
          ))}
        </select>
      </td>
      <td style={{ textAlign: "end" }}>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          מחיקה
        </button>
      </td>
    </tr>
  );
}

function StatusesCard() {
  const { run } = useDialog();
  const { statuses, reload } = useEnums();
  const [addingLabel, setAddingLabel] = useState<string | null>(null);
  const [addingColor, setAddingColor] = useState<string>("gray");

  async function handleAdd() {
    if (!addingLabel?.trim()) return;
    if (await run(() => createStatus(addingLabel.trim(), addingColor))) {
      setAddingLabel(null);
      setAddingColor("gray");
      await reload();
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2>סטטוסים</h2>
        <button
          className="btn btn-sm"
          onClick={() => setAddingLabel("")}
          disabled={addingLabel !== null}
        >
          + הוספה
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>תצוגה</th>
            <th>שם</th>
            <th>צבע</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => (
            <StatusRowEditor key={s.id} row={s} onChanged={reload} />
          ))}
          {addingLabel !== null && (
            <tr>
              <td>
                <span className={`badge badge-color-${addingColor}`}>
                  {addingLabel || "—"}
                </span>
              </td>
              <td>
                <input
                  dir="auto"
                  autoFocus
                  value={addingLabel}
                  onChange={(e) => setAddingLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") setAddingLabel(null);
                  }}
                />
              </td>
              <td>
                <select
                  value={addingColor}
                  onChange={(e) => setAddingColor(e.target.value)}
                >
                  {COLOR_TOKENS.map((c) => (
                    <option key={c} value={c}>
                      {COLOR_LABELS[c]}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{ textAlign: "end" }}>
                <button className="btn btn-sm" onClick={handleAdd}>
                  שמירה
                </button>{" "}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAddingLabel(null)}
                >
                  ביטול
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TypeRowEditor({
  row,
  onChanged,
}: {
  row: TypeRow;
  onChanged: () => Promise<void>;
}) {
  const { ask, run } = useDialog();
  const [label, setLabel] = useState(row.label);

  async function saveLabel() {
    const trimmed = label.trim();
    if (!trimmed || trimmed === row.label) return;
    if (await run(() => updateType(row.id, { label: trimmed }))) {
      await onChanged();
    }
  }

  async function handleDelete() {
    if (!(await ask(`למחוק את "${row.label}"?`))) return;
    if (await run(() => deleteType(row.id, row.code))) {
      await onChanged();
    }
  }

  return (
    <tr>
      <td>
        <input
          dir="auto"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
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

function TypesCard() {
  const { run } = useDialog();
  const { types, reload } = useEnums();
  const [addingLabel, setAddingLabel] = useState<string | null>(null);

  async function handleAdd() {
    if (!addingLabel?.trim()) return;
    if (await run(() => createType(addingLabel.trim()))) {
      setAddingLabel(null);
      await reload();
    }
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2>סוגי אירועים</h2>
        <button
          className="btn btn-sm"
          onClick={() => setAddingLabel("")}
          disabled={addingLabel !== null}
        >
          + הוספה
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>שם</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <TypeRowEditor key={t.id} row={t} onChanged={reload} />
          ))}
          {addingLabel !== null && (
            <tr>
              <td>
                <input
                  dir="auto"
                  autoFocus
                  value={addingLabel}
                  onChange={(e) => setAddingLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") setAddingLabel(null);
                  }}
                />
              </td>
              <td style={{ textAlign: "end" }}>
                <button className="btn btn-sm" onClick={handleAdd}>
                  שמירה
                </button>{" "}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAddingLabel(null)}
                >
                  ביטול
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


interface StaffRowEditorProps {
  row: EventTypeStaffRow;
  onChanged: () => void | Promise<void>;
}

function StaffLineEditor({ row, onChanged }: StaffRowEditorProps) {
  const { ask, run } = useDialog();
  const [role, setRole] = useState(row.role);
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [cost, setCost] = useState(String(row.cost));

  async function saveRole() {
    const trimmed = role.trim();
    if (!trimmed || trimmed === row.role) return;
    if (await run(() => updateEventTypeStaff(row.id, { role: trimmed }))) {
      await onChanged();
    }
  }
  async function saveQuantity() {
    const n = Math.max(1, Math.floor(Number(quantity)));
    if (!Number.isFinite(n) || n === row.quantity) return;
    if (await run(() => updateEventTypeStaff(row.id, { quantity: n }))) {
      await onChanged();
    }
  }
  async function saveCost() {
    const n = Number(cost);
    if (!Number.isFinite(n) || n === row.cost) return;
    if (await run(() => updateEventTypeStaff(row.id, { cost: n }))) {
      await onChanged();
    }
  }
  async function handleDelete() {
    if (!(await ask(`למחוק את "${row.role}"?`))) return;
    if (await run(() => deleteEventTypeStaff(row.id))) {
      await onChanged();
    }
  }

  return (
    <tr>
      <td>
        <input
          dir="auto"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onBlur={saveRole}
        />
      </td>
      <td>
        <input
          type="number"
          dir="ltr"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={saveQuantity}
          style={{ width: 80 }}
        />
      </td>
      <td>
        <input
          type="number"
          dir="ltr"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onBlur={saveCost}
          style={{ width: 120 }}
        />
      </td>
      <td style={{ textAlign: "end" }}>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          מחק
        </button>
      </td>
    </tr>
  );
}

interface StaffSectionProps {
  typeCode: string;
  subTypeCode: string | null;
  rows: EventTypeStaffRow[];
  onChanged: () => Promise<void>;
}

function StaffSection({
  typeCode,
  subTypeCode,
  rows,
  onChanged,
}: StaffSectionProps) {
  const { run } = useDialog();
  const [adding, setAdding] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newCost, setNewCost] = useState("0");

  async function handleAdd() {
    const trimmed = newRole.trim();
    if (!trimmed) return;
    const q = Math.max(1, Math.floor(Number(newQty)));
    const c = Number(newCost);
    if (!Number.isFinite(q) || !Number.isFinite(c)) return;
    if (
      await run(async () => {
        await createEventTypeStaff({
          event_type_code: typeCode,
          sub_type: subTypeCode,
          role: trimmed,
          quantity: q,
          cost: c,
        });
      })
    ) {
      setNewRole("");
      setNewQty("1");
      setNewCost("0");
      setAdding(false);
      await onChanged();
    }
  }

  const total = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 8,
        }}
      >
        {!adding && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setAdding(true)}
          >
            + הוסף תפקיד
          </button>
        )}
      </div>
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>תפקיד</th>
              <th>כמות</th>
              <th>עלות (₪)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <StaffLineEditor key={r.id} row={r} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      )}
      {adding && (
        <div
          className="form-row"
          style={{ marginTop: 8, alignItems: "flex-end" }}
        >
          <div>
            <label>תפקיד</label>
            <input
              dir="auto"
              autoFocus
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            />
          </div>
          <div>
            <label>כמות</label>
            <input
              type="number"
              dir="ltr"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
            />
          </div>
          <div>
            <label>עלות</label>
            <input
              type="number"
              dir="ltr"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={handleAdd}>
              שמור
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAdding(false);
                setNewRole("");
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}
      {rows.length === 0 && !adding && (
        <div className="empty" style={{ padding: 8, fontSize: 13 }}>
          לא הוגדר צוות.
        </div>
      )}
      {rows.length > 0 && (
        <div
          className="muted"
          style={{ fontSize: 13, marginTop: 6 }}
          dir="ltr"
        >
          סה"כ: {total.toLocaleString("he-IL")} ₪
        </div>
      )}
    </>
  );
}

function StaffByTypeCard() {
  const { types } = useEnums();
  const [allStaff, setAllStaff] = useState<EventTypeStaffRow[]>([]);

  async function load() {
    try {
      setAllStaff(await listAllEventTypeStaff());
    } catch (e) {
      console.error("failed to load event_type_staff", e);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2>צוות לפי סוג אירוע</h2>
      </div>
      {types.length === 0 ? (
        <div className="empty">אין סוגי אירועים. הוסף סוגים בכרטיסיית "סוגי אירועים".</div>
      ) : (
        types.map((t) => {
          const subs = SUB_TYPES_BY_TYPE[t.code] ?? [];
          return (
            <div
              key={t.code}
              style={{
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h3 style={{ fontSize: 15, margin: "0 0 12px 0" }}>{t.label}</h3>
              {subs.length === 0 ? (
                <StaffSection
                  typeCode={t.code}
                  subTypeCode={null}
                  rows={allStaff.filter(
                    (s) => s.event_type_code === t.code && s.sub_type == null,
                  )}
                  onChanged={load}
                />
              ) : (
                subs.map((sub) => (
                  <div
                    key={sub.code}
                    style={{
                      marginBottom: 16,
                      paddingInlineStart: 12,
                      borderInlineStart: "2px solid var(--border)",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: 14,
                        margin: "0 0 8px 0",
                        color: "var(--text-muted)",
                      }}
                    >
                      {sub.label}
                    </h4>
                    <StaffSection
                      typeCode={t.code}
                      subTypeCode={sub.code}
                      rows={allStaff.filter(
                        (s) =>
                          s.event_type_code === t.code &&
                          s.sub_type === sub.code,
                      )}
                      onChanged={load}
                    />
                  </div>
                ))
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export function SettingsPage() {
  return (
    <>
      <div className="page-header">
        <h1>הגדרות</h1>
      </div>
      <StaffByTypeCard />
      <StatusesCard />
      <TypesCard />
    </>
  );
}
