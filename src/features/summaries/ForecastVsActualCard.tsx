import type {
  EventForecastRow,
  EventWithProducer,
  PredictedAggregate,
} from "../../db/types";
import type { SummaryAggregate } from "./summariesRepo";
import { deriveTotals, type DerivedTotals } from "../forecast/forecastDerive";
import { basisLabel } from "../forecast/forecastEngine";
import { formatDate } from "../../utils/format";
import { CollapsibleCard } from "../../components/CollapsibleCard";

interface Props {
  forecast: EventForecastRow;
  actual: SummaryAggregate;
  event: EventWithProducer;
  staffCostByType: Map<string, number>;
}

const NEUTRAL_COLOR = "var(--text-muted)";
const GOOD_COLOR = "#16a34a";
const BAD_COLOR = "var(--danger)";

function fmtMoney(n: number): string {
  return `${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })} ₪`;
}

function fmtCount(n: number | null): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("he-IL");
}

interface Row {
  label: string;
  predicted: number | null;
  actual: number | null;
  isExpense: boolean;
  isCount?: boolean;
}

function deltaColor(
  delta: number,
  pct: number | null,
  isExpense: boolean,
): string {
  if (pct !== null && Math.abs(pct) < 10) return NEUTRAL_COLOR;
  if (isExpense) return delta < 0 ? GOOD_COLOR : BAD_COLOR;
  return delta > 0 ? GOOD_COLOR : BAD_COLOR;
}

export function ForecastVsActualCard({
  forecast,
  actual,
  event,
  staffCostByType,
}: Props) {
  const cardStyle = { marginBottom: 16 };

  if (forecast.basis === "none" || !forecast.predicted) {
    return (
      <CollapsibleCard
        title="צפי מול ביצוע"
        defaultOpen={false}
        style={cardStyle}
      >
        <div className="muted">
          לא היה מספיק מידע היסטורי כדי לחזות אירוע זה.
        </div>
      </CollapsibleCard>
    );
  }

  const predictedTotals: DerivedTotals = deriveTotals(
    event,
    forecast.predicted as PredictedAggregate,
    staffCostByType,
  );
  const actualTotals: DerivedTotals = deriveTotals(
    event,
    actual,
    staffCostByType,
  );

  const rows: Row[] = [
    {
      label: "כרטיסים שנמכרו",
      predicted: predictedTotals.ticketsCount,
      actual: actualTotals.ticketsCount,
      isExpense: false,
      isCount: true,
    },
    {
      label: "הכנסות כרטיסים",
      predicted: predictedTotals.ticketsRevenue,
      actual: actualTotals.ticketsRevenue,
      isExpense: false,
    },
    {
      label: "חלק המועדון מכרטיסים",
      predicted: predictedTotals.clubTicketIncome,
      actual: actualTotals.clubTicketIncome,
      isExpense: false,
    },
    {
      label: "הכנסות בר",
      predicted: predictedTotals.barTotal,
      actual: actualTotals.barTotal,
      isExpense: false,
    },
    {
      label: "מונה",
      predicted: predictedTotals.counter,
      actual: actualTotals.counter,
      isExpense: false,
      isCount: true,
    },
    {
      label: 'סה"כ הכנסות למועדון',
      predicted: predictedTotals.clubTotalRevenue,
      actual: actualTotals.clubTotalRevenue,
      isExpense: false,
    },
    {
      label: 'סה"כ הוצאות',
      predicted: predictedTotals.expenses,
      actual: actualTotals.expenses,
      isExpense: true,
    },
    {
      label: "נטו למועדון",
      predicted: predictedTotals.clubNet,
      actual: actualTotals.clubNet,
      isExpense: false,
    },
  ];

  const sourceCount = forecast.sources.length;

  return (
    <CollapsibleCard
      title="צפי מול ביצוע"
      defaultOpen={false}
      style={cardStyle}
    >
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        מבוסס על: {basisLabel(forecast.basis)} · ממוצע מ-{sourceCount}{" "}
        {sourceCount === 1 ? "אירוע" : "אירועים"} · נכון לתאריך{" "}
        <span dir="ltr">{formatDate(forecast.effective_date)}</span>
      </div>
      <table className="centered">
        <thead>
          <tr>
            <th>שדה</th>
            <th>צפי</th>
            <th>ביצוע</th>
            <th>פער ₪</th>
            <th>פער %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = r.predicted;
            const a = r.actual;
            if (p == null || a == null) {
              return (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td dir="ltr" style={{ textAlign: "start" }}>
                    {r.isCount ? fmtCount(p) : p == null ? "—" : fmtMoney(p)}
                  </td>
                  <td dir="ltr" style={{ textAlign: "start" }}>
                    {r.isCount ? fmtCount(a) : a == null ? "—" : fmtMoney(a)}
                  </td>
                  <td className="muted">—</td>
                  <td className="muted">—</td>
                </tr>
              );
            }
            const delta = a - p;
            const pct = p === 0 ? null : (delta / p) * 100;
            const color = deltaColor(delta, pct, r.isExpense);
            const sign = delta > 0 ? "+" : "";
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td dir="ltr" style={{ textAlign: "start" }}>
                  {r.isCount ? fmtCount(p) : fmtMoney(p)}
                </td>
                <td dir="ltr" style={{ textAlign: "start" }}>
                  {r.isCount ? fmtCount(a) : fmtMoney(a)}
                </td>
                <td dir="ltr" style={{ textAlign: "start", color }}>
                  {sign}
                  {r.isCount
                    ? Math.round(delta).toLocaleString("he-IL")
                    : fmtMoney(delta)}
                </td>
                <td dir="ltr" style={{ textAlign: "start", color }}>
                  {pct == null
                    ? "—"
                    : `${sign}${pct.toLocaleString("he-IL", {
                        maximumFractionDigits: 1,
                      })}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </CollapsibleCard>
  );
}
