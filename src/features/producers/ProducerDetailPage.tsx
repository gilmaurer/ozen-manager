import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { EventWithProducer, ProducerRow } from "../../db/types";
import {
  countEventsByProducer,
  deleteProducer,
  getProducer,
  ProducerInput,
  updateProducer,
} from "./producersRepo";
import { listEventsByProducer } from "../events/eventsRepo";
import { Modal } from "../../components/Modal";
import { ProducerForm } from "./ProducerForm";
import { StatusBadge } from "../../components/StatusBadge";
import { formatDate } from "../../utils/format";
import { useEnums } from "../../services/enums";
import { useDialog } from "../../components/dialog";

export function ProducerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const producerId = Number(id);
  const navigate = useNavigate();
  const { typeByCode } = useEnums();
  const { ask, notify } = useDialog();
  const [producer, setProducer] = useState<ProducerRow | null>(null);
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{
    key: "name" | "date" | "type" | "status";
    dir: "asc" | "desc";
  }>({ key: "date", dir: "desc" });

  const PAGE_SIZE = 10;
  const sortedEvents = useMemo(() => {
    const copy = [...events];
    copy.sort((a, b) => {
      let av: string, bv: string;
      switch (sort.key) {
        case "name":
          av = a.name;
          bv = b.name;
          break;
        case "date":
          av = a.date;
          bv = b.date;
          break;
        case "type":
          av = a.type ?? "";
          bv = b.type ?? "";
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
      }
      const cmp = av.localeCompare(bv, "he");
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [events, sort]);

  function toggleSort(key: "name" | "date" | "type" | "status") {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }

  function sortArrow(key: "name" | "date" | "type" | "status"): string {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? " ↑" : " ↓";
  }

  useEffect(() => {
    setPage(0);
  }, [sort]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sortedEvents.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, es] = await Promise.all([
      getProducer(producerId),
      listEventsByProducer(producerId),
    ]);
    setProducer(p);
    setEvents(es);
    setLoading(false);
  }, [producerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleUpdate(input: ProducerInput) {
    await updateProducer(producerId, input);
    setEditing(false);
    await refresh();
  }

  async function handleDelete() {
    const count = await countEventsByProducer(producerId);
    if (count > 0) {
      await notify(
        `למפיק זה משויכים ${count} אירועים. יש למחוק או לשייך מחדש את האירועים לפני מחיקה.`,
      );
      return;
    }
    if (!(await ask("למחוק את המפיק?"))) return;
    await deleteProducer(producerId);
    navigate("/producers");
  }

  if (loading) return <div className="empty">טוען…</div>;
  if (!producer) {
    return (
      <div className="card">
        <div className="empty">המפיק לא נמצא.</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            <Link to="/producers">מפיקים</Link> ›
          </div>
          <h1 className="row-value" dir="auto">
            {producer.name}
          </h1>
          <div className="muted" style={{ marginTop: 4 }} dir="ltr">
            {producer.phone ?? "—"}
          </div>
          <div className="muted" style={{ marginTop: 2 }} dir="ltr">
            {producer.email ?? "—"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setEditing(true)}
          >
            עריכה
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            מחיקה
          </button>
        </div>
      </div>

      <div className="card">
        <h2>אירועים של המפיק</h2>
        {sortedEvents.length === 0 ? (
          <div className="empty">אין אירועים משויכים למפיק זה.</div>
        ) : (
          <>
            <div
              className="muted"
              style={{ margin: "0 0 8px", fontSize: 13 }}
            >
              סה"כ: {sortedEvents.length} אירועים
            </div>
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="sort-header"
                      onClick={() => toggleSort("name")}
                    >
                      שם{sortArrow("name")}
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-header"
                      onClick={() => toggleSort("date")}
                    >
                      תאריך{sortArrow("date")}
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-header"
                      onClick={() => toggleSort("type")}
                    >
                      סוג{sortArrow("type")}
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-header"
                      onClick={() => toggleSort("status")}
                    >
                      סטטוס{sortArrow("status")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        to={`/events/${e.id}`}
                        className="row-value"
                        dir="auto"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="muted">{formatDate(e.date)}</td>
                    <td>{e.type ? typeByCode[e.type]?.label ?? e.type : "—"}</td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  עמוד {currentPage + 1} מתוך {totalPages} (
                  {sortedEvents.length} אירועים)
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

      <Modal open={editing} title="עריכת מפיק" onClose={() => setEditing(false)}>
        <ProducerForm
          initial={producer}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </>
  );
}
