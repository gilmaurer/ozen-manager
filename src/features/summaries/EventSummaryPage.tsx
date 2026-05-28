import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  EventSummaryRow,
  EventWithProducer,
  EventWorkerWithDetails,
  JobTitleRow,
  StaffRow,
  SummaryExtraExpenseRow,
  SummaryTicketRow,
} from "../../db/types";
import { getEvent } from "../events/eventsRepo";
import { clubTicketShareOf, dealLabel } from "../events/dealCalc";
import { StatusBadge } from "../../components/StatusBadge";
import { useDialog } from "../../components/dialog";
import { formatDate } from "../../utils/format";
import {
  OZEN_SOURCE,
  VAT_RATE,
  deleteExtraExpense,
  deleteSummary,
  deleteTicket,
  ensureSummaryForEvent,
  insertExtraExpense,
  insertTicket,
  listExtraExpenses,
  listTickets,
  ozenCommission,
  updateExtraExpense,
  updateSummary,
  updateTicket,
} from "./summariesRepo";
import { listEventWorkers, workerCost } from "./eventWorkersRepo";
import { EventWorkersCard } from "./EventWorkersCard";
import { listStaff } from "../staff/staffRepo";
import { listJobTitles } from "../staff/jobTitlesRepo";
import { CsvUploadModal } from "./CsvUploadModal";
import { downloadProducerInvoice } from "./producerInvoice";
import { SendInvoiceModal } from "./SendInvoiceModal";
import { useSenderState } from "./emailInvoice";
import { getProducer } from "../producers/producersRepo";
import { supabase } from "../../db/supabase";
import type { EventForecastRow } from "../../db/types";
import { freezeForecast } from "../forecast/forecastsRepo";
import { listAllEventTypeStaff } from "./settingsRepo";
import { ForecastVsActualCard } from "./ForecastVsActualCard";
import { CollapsibleCard } from "../../components/CollapsibleCard";

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

interface ExtraExpenseRowProps {
  row: SummaryExtraExpenseRow;
  onSave: (
    id: number,
    patch: { name?: string; amount?: number },
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function ExtraExpenseRowEditor({ row, onSave, onDelete }: ExtraExpenseRowProps) {
  const [name, setName] = useState(row.name);
  const [amount, setAmount] = useState(String(row.amount));

  async function saveName() {
    const trimmed = name;
    if (trimmed === row.name) return;
    await onSave(row.id, { name: trimmed });
  }
  async function saveAmount() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === row.amount) return;
    await onSave(row.id, { amount: n });
  }

  return (
    <div
      className="form-row"
      style={{ alignItems: "flex-end", marginBottom: 8 }}
    >
      <div>
        <label>שם ההוצאה</label>
        <input
          dir="auto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
        />
      </div>
      <div>
        <label>סכום (₪)</label>
        <input
          type="number"
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={saveAmount}
        />
      </div>
      <div>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => onDelete(row.id)}
        >
          הסר
        </button>
      </div>
    </div>
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
    <div className="modal-backdrop">
      <div className="modal">
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
  const [extraExpenses, setExtraExpenses] = useState<SummaryExtraExpenseRow[]>(
    [],
  );
  const [workers, setWorkers] = useState<EventWorkerWithDetails[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvOpen, setCsvOpen] = useState(false);
  const [addBoxOpen, setAddBoxOpen] = useState(false);
  const [addPresaleOpen, setAddPresaleOpen] = useState(false);
  const [exportingInvoice, setExportingInvoice] = useState(false);
  const [sendInvoiceOpen, setSendInvoiceOpen] = useState(false);
  const [producerEmail, setProducerEmail] = useState<string | null>(null);
  const senderState = useSenderState();
  const sender =
    senderState.status === "ready"
      ? { email: senderState.email, providerToken: senderState.providerToken }
      : null;

  // Bar + counter are controlled inputs for autosave.
  const [barIncomeInput, setBarIncomeInput] = useState("0");
  const [counter, setCounter] = useState("");
  const [acum, setAcum] = useState("0");
  const [stereoRecord, setStereoRecord] = useState("0");
  const [channelsRecord, setChannelsRecord] = useState("0");
  const [lightman, setLightman] = useState("0");
  const [forecast, setForecast] = useState<EventForecastRow | null>(null);
  const [staffCostByType, setStaffCostByType] = useState<Map<string, number>>(
    () => new Map(),
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const ev = await getEvent(eventId);
    if (!ev) {
      setEvent(null);
      setLoading(false);
      return;
    }
    const sum = await ensureSummaryForEvent(eventId);
    const [ts, ee, ws, sl, jt, prod, fc, staffRows] = await Promise.all([
      listTickets(sum.id),
      listExtraExpenses(sum.id),
      listEventWorkers(eventId),
      listStaff(),
      listJobTitles(),
      ev.producer_id ? getProducer(ev.producer_id) : Promise.resolve(null),
      freezeForecast(eventId).catch(() => null),
      listAllEventTypeStaff().catch(() => []),
    ]);
    const staffMap = new Map<string, number>();
    for (const r of staffRows) {
      const key = `${r.event_type_code}|${r.sub_type ?? ""}`;
      staffMap.set(key, (staffMap.get(key) ?? 0) + r.cost);
    }
    setEvent(ev);
    setSummary(sum);
    setTickets(ts);
    setExtraExpenses(ee);
    setWorkers(ws);
    setStaffList(sl);
    setJobTitles(jt);
    setProducerEmail(prod?.email ?? null);
    setForecast(fc);
    setStaffCostByType(staffMap);
    setBarIncomeInput(String((sum.bar_cash ?? 0) + (sum.bar_credit ?? 0)));
    setAcum(String(sum.acum ?? 0));
    setStereoRecord(String(sum.stereo_record ?? 0));
    setChannelsRecord(String(sum.channels_record ?? 0));
    setLightman(String(sum.lightman ?? 0));
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

  async function reloadWorkers() {
    setWorkers(await listEventWorkers(eventId));
  }

  async function reloadExtraExpenses() {
    if (!summary) return;
    setExtraExpenses(await listExtraExpenses(summary.id));
  }

  async function handleAddExtraExpense() {
    if (!summary) return;
    await insertExtraExpense({
      summary_id: summary.id,
      name: "",
      amount: 0,
    });
    await reloadExtraExpenses();
  }

  async function handleUpdateExtraExpense(
    id: number,
    patch: { name?: string; amount?: number },
  ) {
    await updateExtraExpense(id, patch);
    await reloadExtraExpenses();
  }

  async function handleDeleteExtraExpense(id: number) {
    await deleteExtraExpense(id);
    await reloadExtraExpenses();
  }

  async function saveBarIncome() {
    if (!summary) return;
    const n = Number(barIncomeInput);
    if (!Number.isFinite(n)) return;
    const already = (summary.bar_cash ?? 0) + (summary.bar_credit ?? 0);
    if (n === already) return;
    await updateSummary(summary.id, { bar_cash: n, bar_credit: 0 });
    setSummary({ ...summary, bar_cash: n, bar_credit: 0 });
  }
  async function saveCounter() {
    if (!summary) return;
    const n = counter === "" ? null : Math.max(0, Math.floor(Number(counter)));
    if (counter !== "" && !Number.isFinite(Number(counter))) return;
    if (n === summary.counter) return;
    await updateSummary(summary.id, { counter: n });
    setSummary({ ...summary, counter: n });
  }
  async function saveAcum() {
    if (!summary) return;
    const n = Number(acum);
    if (!Number.isFinite(n) || n === summary.acum) return;
    await updateSummary(summary.id, { acum: n });
    setSummary({ ...summary, acum: n });
  }
  async function saveStereoRecord() {
    if (!summary) return;
    const n = Number(stereoRecord);
    if (!Number.isFinite(n) || n === summary.stereo_record) return;
    await updateSummary(summary.id, { stereo_record: n });
    setSummary({ ...summary, stereo_record: n });
  }
  async function saveChannelsRecord() {
    if (!summary) return;
    const n = Number(channelsRecord);
    if (!Number.isFinite(n) || n === summary.channels_record) return;
    await updateSummary(summary.id, { channels_record: n });
    setSummary({ ...summary, channels_record: n });
  }
  async function saveLightman() {
    if (!summary) return;
    const n = Number(lightman);
    if (!Number.isFinite(n) || n === summary.lightman) return;
    await updateSummary(summary.id, { lightman: n });
    setSummary({ ...summary, lightman: n });
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
  const barIncome = Number(barIncomeInput) || 0;
  const barVatExpense = barIncome * VAT_RATE;
  const barOperatingExpense = barIncome * (1 - VAT_RATE) * 0.25;
  const barExp = barVatExpense + barOperatingExpense;
  const barTotal = barIncome - barExp;
  const counterN = counter === "" ? null : Number(counter);
  const perHead =
    counterN && counterN > 0 && Number.isFinite(counterN)
      ? barTotal / counterN
      : null;
  const staffTotal = workers.reduce(
    (s, w) => s + workerCost(w.rate, w.hours),
    0,
  );
  const campaignPct = event?.campaign ?? 0;
  const campaignAmountN = event?.campaign_amount ?? 0;
  const clubCampaignExpense = campaignAmountN * (campaignPct / 100);
  const ticketBaseForDeal =
    presaleRevenue - presaleCommissions + boxOfficeRevenue;
  const clubTicketShare = event
    ? clubTicketShareOf(event, ticketBaseForDeal)
    : 0;
  const dealLabelText = event ? dealLabel(event) : "—";
  const producerDealLabelText =
    event && event.deal_type === "split" && event.deal != null
      ? `${100 - event.deal}%`
      : dealLabelText;
  const clubTicketIncome = clubTicketShare + ozenCommissionTotal;
  const stereoRecordN = Number(stereoRecord) || 0;
  const channelsRecordN = Number(channelsRecord) || 0;
  const lightmanN = Number(lightman) || 0;
  const acumN = Number(acum) || 0;
  const extraExpensesTotal = extraExpenses.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0,
  );
  // Four fixed items: services the club provides and bills the producer for.
  // Reduce producer net AND show as club income.
  const fixedAdditionalTotal =
    acumN + stereoRecordN + channelsRecordN + lightmanN;
  // Card-bottom display total = everything in the card.
  const additionalExpensesTotal = fixedAdditionalTotal + extraExpensesTotal;
  const clubOthersIncome = fixedAdditionalTotal;
  const clubTotalRevenue = clubTicketIncome + barIncome + clubOthersIncome;
  const expenses =
    staffTotal + clubCampaignExpense + barExp + extraExpensesTotal;
  const clubNet = clubTotalRevenue - expenses;

  const actualAggregate = useMemo(() => {
    if (!summary) return null;
    return {
      event_id: eventId,
      tickets_count: totalTickets,
      tickets_revenue: totalTicketRevenue,
      presale_revenue: presaleRevenue,
      box_office_revenue: boxOfficeRevenue,
      presale_commissions: presaleCommissions,
      ozen_commission: ozenCommissionTotal,
      bar_total:
        (summary.bar_cash ?? 0) +
        (summary.bar_credit ?? 0) -
        (summary.bar_expenses ?? 0),
      counter: counterN,
      acum: acumN,
      stereo_record: stereoRecordN,
      channels_record: channelsRecordN,
      lightman: lightmanN,
      extra_expenses_total: extraExpensesTotal,
      producer_additional_expenses: fixedAdditionalTotal,
      club_extra_expenses: extraExpensesTotal,
    };
  }, [
    summary,
    eventId,
    totalTickets,
    totalTicketRevenue,
    presaleRevenue,
    boxOfficeRevenue,
    presaleCommissions,
    ozenCommissionTotal,
    counterN,
    acumN,
    stereoRecordN,
    channelsRecordN,
    lightmanN,
    extraExpensesTotal,
    fixedAdditionalTotal,
  ]);

  const producerCampaignPct = 100 - campaignPct;
  const producerTicketShare =
    event?.deal_type === "fit_price"
      ? ticketBaseForDeal
      : ticketBaseForDeal - clubTicketShare;
  const producerCampaignExpense =
    campaignAmountN * (producerCampaignPct / 100);
  const producerExpenses = producerCampaignExpense + fixedAdditionalTotal;
  const producerNet = producerTicketShare - producerExpenses;
  const producerNetExVat = producerNet / (1 + VAT_RATE);

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
      <CollapsibleCard title="כרטיסים" style={{ marginBottom: 16 }}>
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
      </CollapsibleCard>

      {/* Counter */}
      <CollapsibleCard title="מונה" style={{ marginBottom: 16 }}>
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
      </CollapsibleCard>

      {/* Bar */}
      <CollapsibleCard title="בר" style={{ marginBottom: 16 }}>
        <div className="form-row single">
          <div>
            <label>הכנסות בר</label>
            <input
              type="number"
              dir="ltr"
              value={barIncomeInput}
              onChange={(e) => setBarIncomeInput(e.target.value)}
              onBlur={saveBarIncome}
            />
          </div>
        </div>
        <div
          className="muted"
          style={{ fontSize: 13, marginTop: 10, display: "grid", gap: 2 }}
        >
          <div>
            הכנסות ברוטו: <span dir="ltr">{formatMoney(barIncome)}</span>
          </div>
          <div>
            מע"מ בר ({Math.round(VAT_RATE * 100)}%):{" "}
            <span dir="ltr">{formatMoney(barVatExpense)}</span>
          </div>
          <div>
            הוצאות בר (25% מהכנסה ללא מע"מ):{" "}
            <span dir="ltr">{formatMoney(barOperatingExpense)}</span>
          </div>
          <div>
            נטו הכנסות בר:{" "}
            <span dir="ltr">{formatMoney(barTotal)}</span>
          </div>
          <div>
            הכנסה לראש:{" "}
            <span dir="ltr">
              {perHead == null ? "—" : formatMoney(perHead)}
            </span>
          </div>
        </div>
      </CollapsibleCard>

      {/* Additional expenses (producer only) */}
      <CollapsibleCard title="הוצאות נוספות" style={{ marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          הוצאות אלו מופחתות מהמפיק בלבד ולא מהמועדון.
        </div>
        <div className="form-row">
          <div>
            <label>אקו"ם (זכויות יוצרים)</label>
            <input
              type="number"
              dir="ltr"
              value={acum}
              onChange={(e) => setAcum(e.target.value)}
              onBlur={saveAcum}
            />
          </div>
          <div>
            <label>הקלטת סטריאו</label>
            <input
              type="number"
              dir="ltr"
              value={stereoRecord}
              onChange={(e) => setStereoRecord(e.target.value)}
              onBlur={saveStereoRecord}
            />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>הקלטת ערוצים</label>
            <input
              type="number"
              dir="ltr"
              value={channelsRecord}
              onChange={(e) => setChannelsRecord(e.target.value)}
              onBlur={saveChannelsRecord}
            />
          </div>
          <div>
            <label>תאורן</label>
            <input
              type="number"
              dir="ltr"
              value={lightman}
              onChange={(e) => setLightman(e.target.value)}
              onBlur={saveLightman}
            />
          </div>
        </div>

        {extraExpenses.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {extraExpenses.map((e) => (
              <ExtraExpenseRowEditor
                key={e.id}
                row={e}
                onSave={handleUpdateExtraExpense}
                onDelete={handleDeleteExtraExpense}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddExtraExpense}
          >
            + הוסף הוצאה
          </button>
        </div>

        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          סה"כ:{" "}
          <span dir="ltr">{formatMoney(additionalExpensesTotal)}</span>
        </div>
      </CollapsibleCard>

      {/* Campaign */}
      <CollapsibleCard title="קמפיין" style={{ marginBottom: 16 }}>
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
      </CollapsibleCard>

      {/* Staff (per-event workers) */}
      <EventWorkersCard
        eventId={eventId}
        workers={workers}
        staffList={staffList}
        jobTitles={jobTitles}
        staffTotal={staffTotal}
        onChanged={reloadWorkers}
      />

      {/* Summary strip */}
      <CollapsibleCard title="סיכום כולל" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            fontSize: 14,
          }}
        >
          {/* הכנסות */}
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            <h3 style={{ fontSize: 14, margin: 0, marginBottom: 4 }}>
              הכנסות
            </h3>
            <div>
              הכנסות כרטיסים ברוטו:{" "}
              <span dir="ltr">{formatMoney(totalTicketRevenue)}</span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
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
              דיל: <span dir="ltr">{dealLabelText}</span>
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
              הכנסות בר ברוטו:{" "}
              <span dir="ltr">{formatMoney(barIncome)}</span>
            </div>
            {clubOthersIncome > 0 && (
              <div>
                החזר הוצאות (סטריאו / ערוצים / תאורן):{" "}
                <span dir="ltr">{formatMoney(clubOthersIncome)}</span>
              </div>
            )}
            <div
              style={{
                fontWeight: 600,
                paddingTop: 8,
                borderTop: "1px solid var(--border)",
              }}
            >
              סה"כ הכנסות למועדון:{" "}
              <span dir="ltr">{formatMoney(clubTotalRevenue)}</span>
            </div>
          </div>

          {/* הוצאות */}
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            <h3 style={{ fontSize: 14, margin: 0, marginBottom: 4 }}>
              הוצאות
            </h3>
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
              מע"מ בר ({Math.round(VAT_RATE * 100)}%):{" "}
              <span dir="ltr">{formatMoney(barVatExpense)}</span>
            </div>
            <div>
              הוצאות בר (25%):{" "}
              <span dir="ltr">{formatMoney(barOperatingExpense)}</span>
            </div>
            {extraExpenses.map((e) => (
              <div key={e.id}>
                <span className="row-value" dir="auto">
                  {e.name?.trim() || "הוצאה ללא שם"}
                </span>
                : <span dir="ltr">{formatMoney(e.amount)}</span>
              </div>
            ))}
            <div
              style={{
                fontWeight: 600,
                paddingTop: 8,
                borderTop: "1px solid var(--border)",
              }}
            >
              סה"כ הוצאות: <span dir="ltr">{formatMoney(expenses)}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          נטו למועדון: <span dir="ltr">{formatMoney(clubNet)}</span>
        </div>
      </CollapsibleCard>

      {forecast && actualAggregate && (
        <ForecastVsActualCard
          forecast={forecast}
          actual={actualAggregate}
          event={event}
          staffCostByType={staffCostByType}
        />
      )}

      {/* Producer summary */}
      <CollapsibleCard
        style={{ marginBottom: 16 }}
        title={
          <h2 style={{ margin: 0 }}>
            סיכום מפיק
            {event.producer_name && (
              <span
                className="row-value muted"
                dir="auto"
                style={{ fontWeight: 400, fontSize: 14, marginInlineStart: 8 }}
              >
                — {event.producer_name}
              </span>
            )}
          </h2>
        }
        headerExtra={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-sm"
              onClick={async () => {
                if (!summary || exportingInvoice) return;
                setExportingInvoice(true);
                try {
                  await downloadProducerInvoice(event, summary, tickets);
                } catch (err) {
                  console.error("invoice export failed", err);
                  await ask(
                    `ייצוא סיכום האירוע נכשל: ${
                      err instanceof Error ? err.message : String(err)
                    }`,
                  );
                } finally {
                  setExportingInvoice(false);
                }
              }}
              disabled={!summary || exportingInvoice}
            >
              {exportingInvoice ? "מייצא…" : "ייצוא סיכום אירוע למפיק (PDF)"}
            </button>
            {senderState.status !== "not-allowed" && (
              <button
                className="btn btn-sm"
                onClick={async () => {
                  if (senderState.status === "no-token") {
                    const ok = await ask(
                      'כדי לשלוח מייל יש להתחבר מחדש עם Google (לאישור הרשאת שליחת דואר). להתנתק עכשיו?',
                    );
                    if (ok) await supabase.auth.signOut();
                    return;
                  }
                  if (!producerEmail) return;
                  setSendInvoiceOpen(true);
                }}
                disabled={
                  !summary ||
                  (senderState.status === "ready" && !producerEmail)
                }
                title={
                  senderState.status === "no-token"
                    ? "יש להתחבר מחדש עם Google"
                    : !producerEmail
                      ? "למפיק אין כתובת מייל"
                      : undefined
                }
              >
                שלח למפיק במייל
              </button>
            )}
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            fontSize: 14,
          }}
        >
          {/* הכנסות מפיק */}
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            <h3 style={{ fontSize: 14, margin: 0, marginBottom: 4 }}>
              הכנסות
            </h3>
            <div className="muted" style={{ fontSize: 13 }}>
              בסיס לחלוקה:{" "}
              <span dir="ltr">{formatMoney(ticketBaseForDeal)}</span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              דיל: <span dir="ltr">{producerDealLabelText}</span>
            </div>
            <div
              style={{
                fontWeight: 600,
                paddingTop: 8,
                borderTop: "1px solid var(--border)",
              }}
            >
              הכנסות כרטיסים למפיק:{" "}
              <span dir="ltr">{formatMoney(producerTicketShare)}</span>
            </div>
          </div>

          {/* הוצאות מפיק */}
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            <h3 style={{ fontSize: 14, margin: 0, marginBottom: 4 }}>
              הוצאות
            </h3>
            <div>
              הוצאות קמפיין (חלק המפיק):{" "}
              <span dir="ltr">{formatMoney(producerCampaignExpense)}</span>
              {campaignAmountN > 0 && (
                <span className="muted" style={{ fontSize: 13 }}>
                  {" "}
                  ({producerCampaignPct}% מתוך{" "}
                  <span dir="ltr">{formatMoney(campaignAmountN)}</span>)
                </span>
              )}
            </div>
            <div>
              אקו"ם: <span dir="ltr">{formatMoney(acumN)}</span>
            </div>
            <div>
              הקלטת סטריאו:{" "}
              <span dir="ltr">{formatMoney(stereoRecordN)}</span>
            </div>
            <div>
              הקלטת ערוצים:{" "}
              <span dir="ltr">{formatMoney(channelsRecordN)}</span>
            </div>
            <div>
              תאורן: <span dir="ltr">{formatMoney(lightmanN)}</span>
            </div>
            <div
              style={{
                fontWeight: 600,
                paddingTop: 8,
                borderTop: "1px solid var(--border)",
              }}
            >
              סה"כ הוצאות:{" "}
              <span dir="ltr">{formatMoney(producerExpenses)}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            נטו למפיק (כולל מע"מ):{" "}
            <span dir="ltr">{formatMoney(producerNet)}</span>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            נטו למפיק (לא כולל מע"מ):{" "}
            <span dir="ltr">{formatMoney(producerNetExVat)}</span>
            <span style={{ marginInlineStart: 6 }}>
              (מע"מ <span dir="ltr">{Math.round(VAT_RATE * 100)}%</span>)
            </span>
          </div>
        </div>
      </CollapsibleCard>

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
      {sender && producerEmail && summary && (
        <SendInvoiceModal
          open={sendInvoiceOpen}
          event={event}
          summary={summary}
          tickets={tickets}
          producerEmail={producerEmail}
          sender={sender}
          onClose={() => setSendInvoiceOpen(false)}
          onSent={() => setSendInvoiceOpen(false)}
        />
      )}
      <datalist id="ticket-sources">
        {knownSources.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
