import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  EventSummaryRow,
  EventTypeStaffRow,
  EventWithProducer,
  SummaryTicketRow,
} from "../../db/types";
import { getEvent } from "../events/eventsRepo";
import { StatusBadge } from "../../components/StatusBadge";
import { useDialog } from "../../components/dialog";
import { formatDate } from "../../utils/format";
import {
  OZEN_SOURCE,
  deleteSummary,
  deleteTicket,
  ensureSummaryForEvent,
  insertTicket,
  listTickets,
  ozenCommission,
  updateSummary,
  updateTicket,
} from "./summariesRepo";
import { listEventTypeStaff } from "./settingsRepo";
import { CsvUploadModal } from "./CsvUploadModal";

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ₪`;
}

interface TicketRowProps {
  row: SummaryTicketRow;
  withCommission: boolean;
  sourceListId?: string;
  onChanged: () => void | Promise<void>;
}

function TicketRow({
  row,
  withCommission,
  sourceListId,
  onChanged,
}: TicketRowProps) {
  const { ask } = useDialog();
  const [price, setPrice] = useState(String(row.price));
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [source, setSource] = useState(row.source);
  const [commission, setCommission] = useState(String(row.commission ?? 0));

  const isOzen = row.source === OZEN_SOURCE;
  const priceN = Number(price) || 0;
  const quantityN = Number(quantity) || 0;
  const commissionN = withCommission
    ? isOzen
      ? ozenCommission(priceN, quantityN)
      : Number(commission) || 0
    : 0;
  const displayCommission = isOzen ? String(commissionN) : commission;
  const rowNetTotal = priceN * quantityN - commissionN;

  async function savePrice() {
    const n = Number(price);
    if (!Number.isFinite(n) || n === row.price) return;
    const patch: { price: number; commission?: number } = { price: n };
    if (isOzen) {
      const c = ozenCommission(n, row.quantity);
      patch.commission = c;
      setCommission(String(c));
    }
    await updateTicket(row.id, patch);
    await onChanged();
  }
  async function saveQuantity() {
    const n = Math.max(1, Math.floor(Number(quantity)));
    if (!Number.isFinite(n) || n === row.quantity) return;
    const patch: { quantity: number; commission?: number } = { quantity: n };
    if (isOzen) {
      const c = ozenCommission(row.price, n);
      patch.commission = c;
      setCommission(String(c));
    }
    await updateTicket(row.id, patch);
    await onChanged();
  }
  async function saveSource() {
    const trimmed = source.trim();
    if (!trimmed) {
      setSource(row.source);
      return;
    }
    if (trimmed === row.source) return;
    const patch: { source: string; commission?: number } = { source: trimmed };
    if (trimmed === OZEN_SOURCE) {
      const c = ozenCommission(row.price, row.quantity);
      patch.commission = c;
      setCommission(String(c));
    }
    await updateTicket(row.id, patch);
    await onChanged();
  }
  async function saveCommission() {
    if (isOzen) return;
    const n = Number(commission);
    if (!Number.isFinite(n) || n < 0) {
      setCommission(String(row.commission ?? 0));
      return;
    }
    const rounded = Math.round(n * 100) / 100;
    if (rounded === (row.commission ?? 0)) return;
    await updateTicket(row.id, { commission: rounded });
    await onChanged();
  }
  async function handleDelete() {
    if (!(await ask("למחוק שורה?"))) return;
    await deleteTicket(row.id);
    await onChanged();
  }

  return (
    <tr>
      <td>
        <input
          type="number"
          dir="ltr"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={savePrice}
          style={{ width: 100 }}
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
          type="text"
          dir="auto"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onBlur={saveSource}
          list={sourceListId}
        />
      </td>
      {withCommission && (
        <td>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={displayCommission}
            onChange={(e) => setCommission(e.target.value)}
            onBlur={saveCommission}
            readOnly={isOzen}
            title={isOzen ? "מחושב אוטומטית 6% מהכרטיסים" : undefined}
            style={{ width: 90 }}
          />
        </td>
      )}
      <td dir="ltr" style={{ textAlign: "start" }}>
        {formatMoney(rowNetTotal)}
      </td>
      <td style={{ textAlign: "end" }}>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          מחק
        </button>
      </td>
    </tr>
  );
}

interface AddRowModalProps {
  open: boolean;
  title: string;
  kind: "presale" | "box_office";
  sourceListId?: string;
  onClose: () => void;
  onSubmit: (
    price: number,
    quantity: number,
    source: string,
    commission: number,
  ) => Promise<void>;
}

function AddRowModal({
  open,
  title,
  kind,
  sourceListId,
  onClose,
  onSubmit,
}: AddRowModalProps) {
  const defaultSource = kind === "box_office" ? "קופה" : "";
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [source, setSource] = useState(defaultSource);
  const [commission, setCommission] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrice("");
      setQuantity("");
      setSource(defaultSource);
      setCommission("0");
    } else {
      setSource(defaultSource);
      setCommission("0");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const showCommission = kind === "presale";
  const isOzen = source.trim() === OZEN_SOURCE;
  const priceN = Number(price);
  const qtyN = Math.max(1, Math.floor(Number(quantity)));
  const autoOzenCommission =
    isOzen && Number.isFinite(priceN) && Number.isFinite(qtyN) && qtyN > 0
      ? ozenCommission(priceN, qtyN)
      : 0;

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(price);
    const q = Math.max(1, Math.floor(Number(quantity)));
    const s = source.trim();
    if (!Number.isFinite(p) || !Number.isFinite(q) || !s) return;
    let c = 0;
    if (showCommission) {
      if (s === OZEN_SOURCE) {
        c = ozenCommission(p, q);
      } else {
        const raw = Number(commission);
        c = Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : 0;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit(p, q, s, c);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div>
              <label>מחיר</label>
              <input
                type="number"
                dir="ltr"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label>כמות</label>
              <input
                type="number"
                dir="ltr"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row single">
            <div>
              <label>מקור מכירה</label>
              <input
                type="text"
                dir="auto"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                list={sourceListId}
                required
              />
            </div>
          </div>
          {showCommission && (
            <div className="form-row single">
              <div>
                <label>עמלה (₪)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={isOzen ? String(autoOzenCommission) : commission}
                  onChange={(e) => setCommission(e.target.value)}
                  readOnly={isOzen}
                  title={
                    isOzen ? "מחושב אוטומטית 6% מהכרטיסים" : undefined
                  }
                />
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "שומר…" : "שמור"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EventSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const navigate = useNavigate();
  const { ask } = useDialog();
  const [event, setEvent] = useState<EventWithProducer | null>(null);
  const [summary, setSummary] = useState<EventSummaryRow | null>(null);
  const [tickets, setTickets] = useState<SummaryTicketRow[]>([]);
  const [staff, setStaff] = useState<EventTypeStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvOpen, setCsvOpen] = useState(false);
  const [addBoxOpen, setAddBoxOpen] = useState(false);
  const [addPresaleOpen, setAddPresaleOpen] = useState(false);

  // Bar + counter are controlled inputs for autosave.
  const [cash, setCash] = useState("0");
  const [credit, setCredit] = useState("0");
  const [barExpenses, setBarExpenses] = useState("0");
  const [counter, setCounter] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const ev = await getEvent(eventId);
    if (!ev) {
      setEvent(null);
      setLoading(false);
      return;
    }
    const sum = await ensureSummaryForEvent(eventId);
    const [ts, stf] = await Promise.all([
      listTickets(sum.id),
      ev.type ? listEventTypeStaff(ev.type, ev.sub_type) : Promise.resolve([]),
    ]);
    setEvent(ev);
    setSummary(sum);
    setTickets(ts);
    setStaff(stf);
    setCash(String(sum.bar_cash ?? 0));
    setCredit(String(sum.bar_credit ?? 0));
    setBarExpenses(String(sum.bar_expenses ?? 0));
    setCounter(sum.counter == null ? "" : String(sum.counter));
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function reloadTickets() {
    if (!summary) return;
    setTickets(await listTickets(summary.id));
  }

  async function saveCash() {
    if (!summary) return;
    const n = Number(cash);
    if (!Number.isFinite(n) || n === summary.bar_cash) return;
    await updateSummary(summary.id, { bar_cash: n });
    setSummary({ ...summary, bar_cash: n });
  }
  async function saveCredit() {
    if (!summary) return;
    const n = Number(credit);
    if (!Number.isFinite(n) || n === summary.bar_credit) return;
    await updateSummary(summary.id, { bar_credit: n });
    setSummary({ ...summary, bar_credit: n });
  }
  async function saveBarExpenses() {
    if (!summary) return;
    const n = Number(barExpenses);
    if (!Number.isFinite(n) || n === summary.bar_expenses) return;
    await updateSummary(summary.id, { bar_expenses: n });
    setSummary({ ...summary, bar_expenses: n });
  }
  async function saveCounter() {
    if (!summary) return;
    const n = counter === "" ? null : Math.max(0, Math.floor(Number(counter)));
    if (counter !== "" && !Number.isFinite(Number(counter))) return;
    if (n === summary.counter) return;
    await updateSummary(summary.id, { counter: n });
    setSummary({ ...summary, counter: n });
  }

  async function addBoxOffice(
    price: number,
    quantity: number,
    source: string,
    commission: number,
  ) {
    if (!summary) return;
    await insertTicket({
      summary_id: summary.id,
      kind: "box_office",
      price,
      quantity,
      source,
      commission,
    });
    await reloadTickets();
  }
  async function addPresale(
    price: number,
    quantity: number,
    source: string,
    commission: number,
  ) {
    if (!summary) return;
    await insertTicket({
      summary_id: summary.id,
      kind: "presale",
      price,
      quantity,
      source,
      commission,
    });
    await reloadTickets();
  }

  async function handleDeleteSummary() {
    if (!summary) return;
    if (!(await ask("למחוק את הסיכום? כל נתוני הכרטיסים יימחקו."))) return;
    await deleteSummary(summary.id);
    navigate(`/events/${eventId}`);
  }

  const presale = useMemo(
    () => tickets.filter((t) => t.kind === "presale"),
    [tickets],
  );
  const boxOffice = useMemo(
    () => tickets.filter((t) => t.kind === "box_office"),
    [tickets],
  );

  const subtotal = (rows: SummaryTicketRow[]) =>
    rows.reduce((s, r) => s + r.price * r.quantity, 0);
  const effectiveCommission = (r: SummaryTicketRow) =>
    r.source === OZEN_SOURCE
      ? ozenCommission(r.price, r.quantity)
      : r.commission ?? 0;
  const commissionSum = (rows: SummaryTicketRow[]) =>
    rows.reduce((s, r) => s + effectiveCommission(r), 0);
  const count = (rows: SummaryTicketRow[]) =>
    rows.reduce((s, r) => s + r.quantity, 0);

  const byPrice = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of tickets) m.set(t.price, (m.get(t.price) ?? 0) + t.quantity);
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [tickets]);

  const knownSources = useMemo(() => {
    const set = new Set<string>();
    set.add(OZEN_SOURCE);
    for (const t of tickets) {
      const s = t.source?.trim();
      if (s) set.add(s);
    }
    return Array.from(set);
  }, [tickets]);

  const totalTickets = count(tickets);
  const presaleRevenue = subtotal(presale);
  const boxOfficeRevenue = subtotal(boxOffice);
  const totalTicketRevenue = presaleRevenue + boxOfficeRevenue;
  const presaleCommissions = commissionSum(presale);
  const ozenCommissionTotal = commissionSum(
    presale.filter((r) => r.source === OZEN_SOURCE),
  );
  const barIncome = (Number(cash) || 0) + (Number(credit) || 0);
  const barExp = Number(barExpenses) || 0;
  const barTotal = barIncome - barExp;
  const counterN = counter === "" ? null : Number(counter);
  const perHead =
    counterN && counterN > 0 && Number.isFinite(counterN)
      ? barTotal / counterN
      : null;
  const staffTotal = staff.reduce((s, r) => s + r.cost, 0);
  const campaignPct = event?.campaign ?? 0;
  const campaignAmountN = event?.campaign_amount ?? 0;
  const clubCampaignExpense = campaignAmountN * (campaignPct / 100);
  const expenses = staffTotal + clubCampaignExpense;
  const dealPct = event?.deal ?? 0;
  const ticketBaseForDeal =
    presaleRevenue - presaleCommissions + boxOfficeRevenue;
  const clubTicketShare = ticketBaseForDeal * (dealPct / 100);
  const clubTicketIncome = clubTicketShare + ozenCommissionTotal;
  const clubTotalRevenue = clubTicketIncome + barTotal;
  const clubNet = clubTotalRevenue - expenses;

  if (loading) return <div className="empty">טוען…</div>;
  if (!event) {
    return (
      <div className="card">
        <div className="empty">האירוע לא נמצא.</div>
        <Link to="/events" className="btn btn-secondary">
          חזרה לאירועים
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            <Link to="/events">אירועים</Link> ›{" "}
            <Link to={`/events/${eventId}`} className="row-value" dir="auto">
              {event.name}
            </Link>{" "}
            › סיכום
          </div>
          <h1 className="row-value" dir="auto">
            סיכום אירוע
          </h1>
          <div className="muted" style={{ marginTop: 4 }}>
            <span dir="ltr">
              {formatDate(event.date)}
              {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
            </span>
            {" · "}
            <StatusBadge status={event.status} />
          </div>
        </div>
      </div>

      {/* Tickets */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h2>כרטיסים</h2>
        </div>

        <h3 style={{ fontSize: 14, marginBottom: 8 }}>מכירה מוקדמת</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={() => setCsvOpen(true)}>
            העלה CSV
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setAddPresaleOpen(true)}
          >
            + הוסף שורה
          </button>
        </div>
        {presale.length === 0 ? (
          <div className="empty">אין כרטיסי מכירה מוקדמת.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>מחיר</th>
                <th>כמות</th>
                <th>מקור</th>
                <th>עמלה</th>
                <th>סה"כ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {presale.map((r) => (
                <TicketRow
                  key={r.id}
                  row={r}
                  withCommission
                  sourceListId="ticket-sources"
                  onChanged={reloadTickets}
                />
              ))}
            </tbody>
          </table>
        )}
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }} dir="ltr">
          {count(presale)} tickets ·{" "}
          {formatMoney(presaleRevenue - presaleCommissions)}
          {presaleCommissions > 0 && (
            <>
              {" "}
              (ברוטו {formatMoney(presaleRevenue)} − עמלות{" "}
              {formatMoney(presaleCommissions)})
            </>
          )}
        </div>

        <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>קופה</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setAddBoxOpen(true)}
          >
            + הוסף שורה
          </button>
        </div>
        {boxOffice.length === 0 ? (
          <div className="empty">אין מכירות בקופה.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>מחיר</th>
                <th>כמות</th>
                <th>מקור</th>
                <th>סה"כ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {boxOffice.map((r) => (
                <TicketRow
                  key={r.id}
                  row={r}
                  withCommission={false}
                  onChanged={reloadTickets}
                />
              ))}
            </tbody>
          </table>
        )}
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }} dir="ltr">
          {count(boxOffice)} tickets · {formatMoney(boxOfficeRevenue)}
        </div>

        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            סה"כ:{" "}
            <span dir="ltr">
              {totalTickets} ·{" "}
              {formatMoney(totalTicketRevenue - presaleCommissions)}
            </span>
          </div>
          {byPrice.length > 0 && (
            <div style={{ fontSize: 13 }} className="muted">
              <div style={{ marginBottom: 4 }}>פירוט לפי מחיר:</div>
              <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                {byPrice.map(([price, qty]) => (
                  <li key={price} dir="ltr" style={{ direction: "ltr" }}>
                    {price.toFixed(2)} ₪ × {qty} = {formatMoney(price * qty)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Counter */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>מונה</h2>
        <div className="form-row single">
          <div>
            <label>מספר אנשים שנכחו</label>
            <input
              type="number"
              dir="ltr"
              value={counter}
              onChange={(e) => setCounter(e.target.value)}
              onBlur={saveCounter}
            />
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>בר</h2>
        <div className="form-row">
          <div>
            <label>מזומן</label>
            <input
              type="number"
              dir="ltr"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              onBlur={saveCash}
            />
          </div>
          <div>
            <label>אשראי</label>
            <input
              type="number"
              dir="ltr"
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              onBlur={saveCredit}
            />
          </div>
        </div>
        <div className="form-row single">
          <div>
            <label>הוצאות בר</label>
            <input
              type="number"
              dir="ltr"
              value={barExpenses}
              onChange={(e) => setBarExpenses(e.target.value)}
              onBlur={saveBarExpenses}
            />
          </div>
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          הכנסות ברוטו: <span dir="ltr">{formatMoney(barIncome)}</span>
          {" · "}
          הוצאות: <span dir="ltr">{formatMoney(barExp)}</span>
          {" · "}
          <strong>
            נטו בר: <span dir="ltr">{formatMoney(barTotal)}</span>
          </strong>
          {" · "}
          הכנסה לראש:{" "}
          <span dir="ltr">
            {perHead == null ? "—" : formatMoney(perHead)}
          </span>
        </div>
      </div>

      {/* Campaign */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>קמפיין</h2>
        {event.campaign_amount == null && event.campaign == null ? (
          <div className="empty">
            לא הוגדרו פרטי קמפיין.{" "}
            <Link to={`/events/${eventId}`}>הגדר באירוע</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              סה"כ עלות קמפיין:{" "}
              <span dir="ltr">{formatMoney(campaignAmountN)}</span>
            </div>
            <div>
              אחוז למועדון: <span dir="ltr">{campaignPct}%</span>
            </div>
            <div style={{ fontWeight: 600 }}>
              חלק המועדון (הוצאה):{" "}
              <span dir="ltr">{formatMoney(clubCampaignExpense)}</span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              חלק המפיק:{" "}
              <span dir="ltr">
                {formatMoney(campaignAmountN - clubCampaignExpense)}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              <Link to={`/events/${eventId}`}>עריכה באירוע</Link>
            </div>
          </div>
        )}
      </div>

      {/* Staff */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>צוות</h2>
        {staff.length === 0 ? (
          <div className="empty">
            לא הוגדר צוות לסוג האירוע הזה.
            {event.type && (
              <>
                {" "}
                <Link to="/settings">הגדרה בהגדרות</Link>
              </>
            )}
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>תפקיד</th>
                  <th>כמות</th>
                  <th>עלות</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="row-value" dir="auto">
                      {s.role}
                    </td>
                    <td dir="ltr" style={{ textAlign: "start" }}>
                      {s.quantity}
                    </td>
                    <td dir="ltr" style={{ textAlign: "start" }}>
                      {formatMoney(s.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              className="muted"
              style={{ fontSize: 13, marginTop: 8 }}
              dir="ltr"
            >
              סה"כ צוות: {formatMoney(staffTotal)}
            </div>
          </>
        )}
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          <Link to="/settings">עריכה בהגדרות</Link>
        </div>
      </div>

      {/* Summary strip */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>סיכום כולל</h2>
        <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
          <div>
            הכנסות כרטיסים ברוטו:{" "}
            <span dir="ltr">{formatMoney(totalTicketRevenue)}</span>
          </div>
          <div>
            עמלות מכירה מוקדמת:{" "}
            <span dir="ltr">{formatMoney(presaleCommissions)}</span>
          </div>
          {ozenCommissionTotal > 0 && (
            <div className="muted" style={{ fontSize: 13 }}>
              ‎מתוכן עמלת אתר האוזן (מוחזרת למועדון):{" "}
              <span dir="ltr">{formatMoney(ozenCommissionTotal)}</span>
            </div>
          )}
          <div>
            בסיס לחלוקה:{" "}
            <span dir="ltr">{formatMoney(ticketBaseForDeal)}</span>
          </div>
          <div>
            דיל למועדון: <span dir="ltr">{dealPct}%</span>
          </div>
          <div>
            חלק המועדון מהכרטיסים:{" "}
            <span dir="ltr">{formatMoney(clubTicketShare)}</span>
          </div>
          {ozenCommissionTotal > 0 && (
            <div>
              החזר עמלת אתר האוזן:{" "}
              <span dir="ltr">{formatMoney(ozenCommissionTotal)}</span>
            </div>
          )}
          <div>
            סה"כ הכנסות כרטיסים למועדון:{" "}
            <span dir="ltr">{formatMoney(clubTicketIncome)}</span>
          </div>
          <div>
            נטו בר: <span dir="ltr">{formatMoney(barTotal)}</span>
          </div>
          <div style={{ fontWeight: 600 }}>
            סה"כ הכנסות למועדון:{" "}
            <span dir="ltr">{formatMoney(clubTotalRevenue)}</span>
          </div>
          <div>
            הוצאות צוות:{" "}
            <span dir="ltr">{formatMoney(staffTotal)}</span>
          </div>
          <div>
            הוצאות קמפיין (חלק המועדון):{" "}
            <span dir="ltr">{formatMoney(clubCampaignExpense)}</span>
            {campaignAmountN > 0 && (
              <span className="muted" style={{ fontSize: 13 }}>
                {" "}
                ({campaignPct}% מתוך{" "}
                <span dir="ltr">{formatMoney(campaignAmountN)}</span>)
              </span>
            )}
          </div>
          <div>
            סה"כ הוצאות: <span dir="ltr">{formatMoney(expenses)}</span>
          </div>
          <div
            style={{
              fontWeight: 600,
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
            }}
          >
            נטו למועדון: <span dir="ltr">{formatMoney(clubNet)}</span>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <button
          className="btn"
          onClick={() => {
            const el = document.activeElement as HTMLElement | null;
            if (el && typeof el.blur === "function") el.blur();
            setTimeout(() => navigate("/events"), 100);
          }}
        >
          שמור וסגור
        </button>
        <button className="btn btn-danger" onClick={handleDeleteSummary}>
          מחק סיכום
        </button>
      </div>

      {summary && (
        <CsvUploadModal
          open={csvOpen}
          summaryId={summary.id}
          onClose={() => setCsvOpen(false)}
          onSaved={reloadTickets}
        />
      )}
      <AddRowModal
        open={addBoxOpen}
        title="הוספת שורה לקופה"
        kind="box_office"
        onClose={() => setAddBoxOpen(false)}
        onSubmit={addBoxOffice}
      />
      <AddRowModal
        open={addPresaleOpen}
        title="הוספת שורה למכירה מוקדמת"
        kind="presale"
        sourceListId="ticket-sources"
        onClose={() => setAddPresaleOpen(false)}
        onSubmit={addPresale}
      />
      <datalist id="ticket-sources">
        {knownSources.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
