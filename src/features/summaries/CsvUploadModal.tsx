import { useState } from "react";
import { Modal } from "../../components/Modal";
import { parseTicketCsv, ParseResult } from "./parseTicketCsv";
import { ozenCommission, replacePresaleTickets } from "./summariesRepo";

interface Props {
  open: boolean;
  summaryId: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function CsvUploadModal({ open, summaryId, onClose, onSaved }: Props) {
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setError(null);
    setResult(null);
    try {
      const r = await parseTicketCsv(file);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      await replacePresaleTickets(summaryId, result.rows);
      await onSaved();
      handleCloseReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleCloseReset() {
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} title="העלאת CSV של כרטיסים" onClose={handleCloseReset}>
      <div className="form-row single">
        <div>
          <label>בחר קובץ CSV</label>
          <input
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
            disabled={parsing || saving}
          />
        </div>
      </div>

      {parsing && <div className="empty">מעבד…</div>}

      {result && (
        <>
          {result.warning && (
            <div className="empty" style={{ color: "var(--warn)" }}>
              {result.warning}
            </div>
          )}
          <div
            className="muted"
            style={{ marginBottom: 8, fontSize: 13 }}
            dir="ltr"
          >
            {result.totalTickets} tickets · {result.totalRevenue.toFixed(2)} ₪
            {" · "}
            commission{" "}
            {result.rows
              .reduce((s, r) => s + ozenCommission(r.price, r.quantity), 0)
              .toFixed(2)}{" "}
            ₪
            {result.skippedCount > 0 ? ` · ${result.skippedCount} skipped` : ""}
          </div>
          {result.rows.length === 0 ? (
            <div className="empty">לא נמצאו שורות תקפות.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>מחיר</th>
                  <th>כמות</th>
                  <th>עמלה (6%)</th>
                  <th>סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.price}>
                    <td dir="ltr" style={{ textAlign: "start" }}>
                      {r.price.toFixed(2)} ₪
                    </td>
                    <td dir="ltr" style={{ textAlign: "start" }}>
                      {r.quantity}
                    </td>
                    <td dir="ltr" style={{ textAlign: "start" }}>
                      {ozenCommission(r.price, r.quantity).toFixed(2)} ₪
                    </td>
                    <td dir="ltr" style={{ textAlign: "start" }}>
                      {(r.price * r.quantity).toFixed(2)} ₪
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {error && <div className="login-error">{error}</div>}

      <div className="modal-actions">
        <button
          className="btn btn-secondary"
          onClick={handleCloseReset}
          disabled={saving}
        >
          ביטול
        </button>
        <button
          className="btn"
          onClick={handleConfirm}
          disabled={!result || result.rows.length === 0 || saving}
        >
          {saving ? "שומר…" : "אישור והחלפה"}
        </button>
      </div>
    </Modal>
  );
}
