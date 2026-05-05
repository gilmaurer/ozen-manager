import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createProducer,
  deleteProducer,
  listProducers,
  ProducerInput,
  ProducerWithCount,
  updateProducer,
} from "./producersRepo";
import { Modal } from "../../components/Modal";
import { useDialog } from "../../components/dialog";
import { ProducerForm } from "./ProducerForm";

const PAGE_SIZES = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

export function ProducersPage() {
  const { ask, notify } = useDialog();
  const [producers, setProducers] = useState<ProducerWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProducerWithCount | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [page, setPage] = useState(0);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? producers.filter((p) => p.name.toLowerCase().includes(needle))
      : producers;
    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "he"),
    );
  }, [producers, q]);

  // Reset to the first page whenever the filtered set or page size changes.
  useEffect(() => {
    setPage(0);
  }, [q, pageSize]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = visible.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );

  async function refresh() {
    setLoading(true);
    setProducers(await listProducers());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(input: ProducerInput) {
    await createProducer(input);
    setCreating(false);
    await refresh();
  }

  async function handleUpdate(input: ProducerInput) {
    if (!editing) return;
    await updateProducer(editing.id, input);
    setEditing(null);
    await refresh();
  }

  async function handleDelete(p: ProducerWithCount) {
    if (p.event_count > 0) {
      await notify(
        `למפיק "${p.name}" משויכים ${p.event_count} אירועים. יש למחוק או לשייך מחדש את האירועים לפני מחיקה.`,
      );
      return;
    }
    if (!(await ask(`למחוק את המפיק "${p.name}"?`))) return;
    await deleteProducer(p.id);
    await refresh();
  }

  return (
    <>
      <div className="page-header">
        <h1>מפיקים</h1>
        <button className="btn" onClick={() => setCreating(true)}>
          + מפיק חדש
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">טוען…</div>
        ) : producers.length === 0 ? (
          <div className="empty">אין מפיקים עדיין.</div>
        ) : (
          <>
            <div className="filter-bar">
              <input
                className="filter-search"
                type="text"
                placeholder="חיפוש לפי שם"
                dir="auto"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q !== "" && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQ("")}
                >
                  נקה סינון
                </button>
              )}
              <div
                style={{
                  marginInlineStart: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span className="muted" style={{ fontSize: 13 }}>
                  הצג בעמוד:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(Number(e.target.value) as PageSize)
                  }
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {visible.length === 0 ? (
              <div className="empty">אין תוצאות לסינון.</div>
            ) : (
          <table>
            <thead>
              <tr>
                <th>שם</th>
                <th>טלפון</th>
                <th>מייל</th>
                <th>מספר אירועים</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      to={`/producers/${p.id}`}
                      className="row-value"
                      dir="auto"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td dir="ltr" style={{ textAlign: "start" }}>
                    {p.phone ?? "—"}
                  </td>
                  <td dir="ltr" style={{ textAlign: "start" }}>
                    {p.email ?? "—"}
                  </td>
                  <td className="muted">{p.event_count}</td>
                  <td style={{ textAlign: "end" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditing(p)}
                    >
                      עריכה
                    </button>{" "}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(p)}
                    >
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            )}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  הקודם
                </button>
                <span className="muted" style={{ fontSize: 13 }}>
                  עמוד {currentPage + 1} מתוך {totalPages} ({visible.length}{" "}
                  מפיקים)
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                >
                  הבא
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={creating} title="מפיק חדש" onClose={() => setCreating(false)}>
        <ProducerForm
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal open={!!editing} title="עריכת מפיק" onClose={() => setEditing(null)}>
        <ProducerForm
          initial={editing}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </>
  );
}
