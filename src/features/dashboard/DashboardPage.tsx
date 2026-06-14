import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EventType, EventWithProducer } from "../../db/types";
import { listEvents } from "../events/eventsRepo";
import {
  listSummaryAggregates,
  SummaryAggregate,
} from "../summaries/summariesRepo";
import {
  MONTH_FMT,
  fromMonthKey,
  monthBounds,
  monthKeyOf,
  monthsAroundToday,
  startOfMonth,
} from "../events/monthNav";
import { formatDate } from "../../utils/format";
import { useEnums } from "../../services/enums";
import {
  ageDays,
  clubTakeBreakdown,
  forecastClubBreakdown,
  monthKey,
  monthLabel,
} from "./metrics";
import {
  ForecastResult,
  predictAll,
} from "../forecast/forecastEngine";
import { listAllEventTypeStaff } from "../summaries/settingsRepo";
import { useTheme } from "../../services/useTheme";

interface Filters {
  type: EventType | "";
  producer: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { type: "", producer: "", from: "", to: "" };

function filtersActive(f: Filters): boolean {
  return f.type !== "" || f.producer !== "" || f.from !== "" || f.to !== "";
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("he-IL");
}

const OUTSTANDING_STATUSES = new Set([
  "waiting_invoice",
  "waiting_payment",
  "ממתין_לתשלום_לאוזן_4689",
]);

const COLORS = {
  tickets: "#7c5cff",
  bar: "#2ec27e",
  commission: "#f4a261",
  others: "#8b93a7",
  attendance: "#7c5cff",
  perHead: "#f4a261",
};

function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    return {
      grid: v("--border"),
      axis: v("--text-muted"),
      tooltipBg: v("--bg-panel"),
      tooltipBorder: v("--border"),
      cursor: theme === "light"
        ? "rgba(107,70,224,0.08)"
        : "rgba(124,92,255,0.08)",
    };
  }, [theme]);
}

export function DashboardPage() {
  const chart = useChartColors();
  const { types, typeByCode, statusByCode } = useEnums();
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [aggs, setAggs] = useState<Map<number, SummaryAggregate>>(
    () => new Map(),
  );
  const [forecasts, setForecasts] = useState<Map<number, ForecastResult>>(
    () => new Map(),
  );
  const [staffCostByType, setStaffCostByType] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = usePersistentState<Filters>(
    "dashboard.filters",
    EMPTY_FILTERS,
  );
  const [allTimes, setAllTimes] = usePersistentState("dashboard.allTimes", false);
  const [monthCursor, setMonthCursor] = usePersistentState<Date>(
    "dashboard.monthCursor",
    () => startOfMonth(new Date()),
  );

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [all, a, staffRows] = await Promise.all([
        listEvents(),
        listSummaryAggregates().catch(
          () => new Map<number, SummaryAggregate>(),
        ),
        listAllEventTypeStaff().catch(() => []),
      ]);
      const staffMap = new Map<string, number>();
      for (const r of staffRows) {
        const key = `${r.event_type_code}|${r.sub_type ?? ""}`;
        staffMap.set(key, (staffMap.get(key) ?? 0) + r.cost);
      }
      setEvents(all);
      setAggs(a);
      setStaffCostByType(staffMap);
      setForecasts(predictAll(all, a));
      setLoading(false);
    })();
  }, []);

  const windowActive = !allTimes;
  const customRange = filters.from !== "" || filters.to !== "";
  const applyMonth = windowActive && !customRange;
  const { start: monthStart, end: monthEnd } = monthBounds(monthCursor);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filters.type && e.type !== filters.type) return false;
      if (
        filters.producer &&
        !(e.producer_name ?? "")
          .toLowerCase()
          .includes(filters.producer.toLowerCase())
      )
        return false;
      if (windowActive) {
        if (applyMonth) {
          if (e.date < monthStart || e.date > monthEnd) return false;
        } else {
          if (filters.from && e.date < filters.from) return false;
          if (filters.to && e.date > filters.to) return false;
        }
      }
      return true;
    });
  }, [events, filters, windowActive, applyMonth, monthStart, monthEnd]);

  const eventsWithSummary = useMemo(
    () => filteredEvents.filter((e) => aggs.has(e.id)),
    [filteredEvents, aggs],
  );

  // --- Aggregations -----------------------------------------------------

  const kpi = useMemo(() => {
    let total = 0;
    let attended = 0;
    let attendanceEvents = 0;
    let barPerHeadSum = 0;
    let barPerHeadCount = 0;
    for (const e of eventsWithSummary) {
      const br = clubTakeBreakdown(e, aggs);
      total += br.total;
      const a = aggs.get(e.id);
      if (a?.counter != null && a.counter > 0) {
        attended += a.counter;
        attendanceEvents += 1;
        barPerHeadSum += (a.bar_gross ?? 0) / a.counter;
        barPerHeadCount += 1;
      }
    }
    const count = eventsWithSummary.length;
    return {
      total,
      count,
      avgIncome: count ? total / count : 0,
      avgAttendance: attendanceEvents ? attended / attendanceEvents : 0,
      avgBarPerHead: barPerHeadCount ? barPerHeadSum / barPerHeadCount : 0,
    };
  }, [eventsWithSummary, aggs]);

  const incomeOverTime = useMemo(() => {
    const buckets = new Map<
      string,
      {
        key: string;
        label: string;
        tickets: number;
        bar: number;
        commission: number;
        others: number;
      }
    >();
    for (const e of eventsWithSummary) {
      const key = monthKey(e.date);
      const cur = buckets.get(key) ?? {
        key,
        label: monthLabel(key),
        tickets: 0,
        bar: 0,
        commission: 0,
        others: 0,
      };
      const br = clubTakeBreakdown(e, aggs);
      cur.tickets += br.ticketsClub;
      cur.bar += br.bar;
      cur.commission += br.commission;
      cur.others += br.others;
      buckets.set(key, cur);
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }, [eventsWithSummary, aggs]);

  const incomeByType = useMemo(() => {
    const byCode = new Map<string, { total: number; count: number }>();
    for (const e of eventsWithSummary) {
      const code = e.type ?? "—";
      const cur = byCode.get(code) ?? { total: 0, count: 0 };
      cur.total += clubTakeBreakdown(e, aggs).total;
      cur.count += 1;
      byCode.set(code, cur);
    }
    return Array.from(byCode.entries())
      .map(([code, v]) => ({
        code,
        label: code === "—" ? "ללא סוג" : typeByCode[code]?.label ?? code,
        total: v.total,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [eventsWithSummary, aggs, typeByCode]);

  const topEvents = useMemo(() => {
    return eventsWithSummary
      .map((e) => {
        const br = clubTakeBreakdown(e, aggs);
        const a = aggs.get(e.id);
        return {
          event: e,
          total: br.total,
          bar: br.bar,
          counter: a?.counter ?? null,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [eventsWithSummary, aggs]);

  const topProducers = useMemo(() => {
    const byId = new Map<
      number,
      { id: number; name: string; total: number; count: number }
    >();
    for (const e of eventsWithSummary) {
      if (e.producer_id == null) continue;
      const cur = byId.get(e.producer_id) ?? {
        id: e.producer_id,
        name: e.producer_name ?? `#${e.producer_id}`,
        total: 0,
        count: 0,
      };
      cur.total += clubTakeBreakdown(e, aggs).total;
      cur.count += 1;
      byId.set(e.producer_id, cur);
    }
    return Array.from(byId.values())
      .map((p) => ({ ...p, avg: p.total / Math.max(1, p.count) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);
  }, [eventsWithSummary, aggs]);

  const attendanceTrend = useMemo(() => {
    return eventsWithSummary
      .map((e) => {
        const a = aggs.get(e.id);
        const counter = a?.counter ?? null;
        const bar = a?.bar_gross ?? 0;
        return {
          id: e.id,
          name: e.name,
          date: e.date,
          counter,
          perHead: counter && counter > 0 ? bar / counter : null,
        };
      })
      .filter((r) => r.counter != null && r.counter > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [eventsWithSummary, aggs]);

  const outstanding = useMemo(() => {
    const open = filteredEvents.filter(
      (e) =>
        e.deal_type === "fit_price" && OUTSTANDING_STATUSES.has(e.status),
    );
    const rows = open.map((e) => ({
      event: e,
      total: e.deal_fit_price ?? 0,
      age: ageDays(e.date),
    }));
    return { rows };
  }, [filteredEvents]);

  // --- Forecast aggregations -------------------------------------------

  const upcomingForecastEvents = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return filteredEvents.filter(
      (e) => !e.has_summary && e.date >= todayIso,
    );
  }, [filteredEvents]);

  const forecastableEvents = useMemo(
    () =>
      upcomingForecastEvents.filter((e) => {
        const fc = forecasts.get(e.id);
        return fc && fc.basis !== "none" && fc.predicted;
      }),
    [upcomingForecastEvents, forecasts],
  );

  const forecastKpi = useMemo(() => {
    let total = 0;
    let net = 0;
    let attended = 0;
    let attendanceEvents = 0;
    for (const e of forecastableEvents) {
      const fc = forecasts.get(e.id);
      const br = forecastClubBreakdown(e, fc?.predicted ?? null, staffCostByType);
      total += br.total;
      net += br.net;
      const counter = fc?.predicted?.counter;
      if (counter != null && counter > 0) {
        attended += counter;
        attendanceEvents += 1;
      }
    }
    const count = forecastableEvents.length;
    return {
      total,
      count,
      avgIncome: count ? total / count : 0,
      avgAttendance: attendanceEvents ? attended / attendanceEvents : 0,
      avgNet: count ? net / count : 0,
    };
  }, [forecastableEvents, forecasts, staffCostByType]);

  const forecastIncomeOverTime = useMemo(() => {
    const buckets = new Map<
      string,
      {
        key: string;
        label: string;
        tickets: number;
        bar: number;
        commission: number;
        others: number;
      }
    >();
    for (const e of forecastableEvents) {
      const fc = forecasts.get(e.id);
      const br = forecastClubBreakdown(e, fc?.predicted ?? null, staffCostByType);
      const key = monthKey(e.date);
      const cur = buckets.get(key) ?? {
        key,
        label: monthLabel(key),
        tickets: 0,
        bar: 0,
        commission: 0,
        others: 0,
      };
      cur.tickets += br.ticketsClub;
      cur.bar += br.bar;
      cur.commission += br.commission;
      cur.others += br.others;
      buckets.set(key, cur);
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }, [forecastableEvents, forecasts, staffCostByType]);

  const forecastIncomeByType = useMemo(() => {
    const byCode = new Map<string, { total: number; count: number }>();
    for (const e of forecastableEvents) {
      const fc = forecasts.get(e.id);
      const br = forecastClubBreakdown(e, fc?.predicted ?? null, staffCostByType);
      const code = e.type ?? "—";
      const cur = byCode.get(code) ?? { total: 0, count: 0 };
      cur.total += br.total;
      cur.count += 1;
      byCode.set(code, cur);
    }
    return Array.from(byCode.entries())
      .map(([code, v]) => ({
        code,
        label: code === "—" ? "ללא סוג" : typeByCode[code]?.label ?? code,
        total: v.total,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [forecastableEvents, forecasts, staffCostByType, typeByCode]);

  const forecastTopEvents = useMemo(() => {
    return forecastableEvents
      .map((e) => {
        const fc = forecasts.get(e.id);
        const br = forecastClubBreakdown(e, fc?.predicted ?? null, staffCostByType);
        return {
          event: e,
          total: br.total,
          net: br.net,
          counter: fc?.predicted?.counter ?? null,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [forecastableEvents, forecasts, staffCostByType]);

  const forecastTopProducers = useMemo(() => {
    const byId = new Map<
      number,
      { id: number; name: string; total: number; count: number }
    >();
    for (const e of forecastableEvents) {
      if (e.producer_id == null) continue;
      const fc = forecasts.get(e.id);
      const br = forecastClubBreakdown(e, fc?.predicted ?? null, staffCostByType);
      const cur = byId.get(e.producer_id) ?? {
        id: e.producer_id,
        name: e.producer_name ?? `#${e.producer_id}`,
        total: 0,
        count: 0,
      };
      cur.total += br.total;
      cur.count += 1;
      byId.set(e.producer_id, cur);
    }
    return Array.from(byId.values())
      .map((p) => ({ ...p, avg: p.total / Math.max(1, p.count) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);
  }, [forecastableEvents, forecasts, staffCostByType]);

  // --- UI ---------------------------------------------------------------

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>לוח בקרה</h1>
        </div>
        <div className="empty">טוען…</div>
      </>
    );
  }

  const filterBar = (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="calendar-header" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setAllTimes(false);
              setMonthCursor(
                new Date(
                  monthCursor.getFullYear(),
                  monthCursor.getMonth() + 1,
                  1,
                ),
              );
            }}
          >
            ›
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setAllTimes(false);
              setMonthCursor(startOfMonth(new Date()));
            }}
          >
            היום
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setAllTimes(false);
              setMonthCursor(
                new Date(
                  monthCursor.getFullYear(),
                  monthCursor.getMonth() - 1,
                  1,
                ),
              );
            }}
          >
            ‹
          </button>
        </div>
        <div className="month-label">
          {allTimes
            ? "כל הזמנים"
            : customRange
              ? "טווח מותאם"
              : MONTH_FMT.format(monthCursor)}
        </div>
      </div>
      <div className="filter-bar">
        <select
          value={filters.type}
          onChange={(e) =>
            updateFilter("type", e.target.value as EventType | "")
          }
        >
          <option value="">כל הסוגים</option>
          {types.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          className="filter-search"
          type="text"
          placeholder="חיפוש לפי מפיק"
          dir="auto"
          value={filters.producer}
          onChange={(e) => updateFilter("producer", e.target.value)}
        />
        <select
          value={monthKeyOf(monthCursor)}
          onChange={(e) => {
            const d = fromMonthKey(e.target.value);
            if (!d) return;
            setAllTimes(false);
            updateFilter("from", "");
            updateFilter("to", "");
            setMonthCursor(d);
          }}
          aria-label="בחר חודש"
        >
          {!monthsAroundToday().some(
            (d) => monthKeyOf(d) === monthKeyOf(monthCursor),
          ) && (
            <option value={monthKeyOf(monthCursor)}>
              {MONTH_FMT.format(monthCursor)}
            </option>
          )}
          {monthsAroundToday().map((d) => (
            <option key={monthKeyOf(d)} value={monthKeyOf(d)}>
              {MONTH_FMT.format(d)}
            </option>
          ))}
        </select>
        <span className="filter-date-label">מ</span>
        <input
          className="filter-date"
          type="date"
          value={filters.from}
          onChange={(e) => {
            setAllTimes(false);
            updateFilter("from", e.target.value);
          }}
        />
        <span className="filter-date-label">עד</span>
        <input
          className="filter-date"
          type="date"
          value={filters.to}
          onChange={(e) => {
            setAllTimes(false);
            updateFilter("to", e.target.value);
          }}
        />
        <button
          className={`btn btn-secondary btn-sm${allTimes ? " active" : ""}`}
          onClick={() => {
            setAllTimes((prev) => !prev);
            if (!allTimes) {
              updateFilter("from", "");
              updateFilter("to", "");
            }
          }}
        >
          כל הזמנים
        </button>
        {(filtersActive(filters) || allTimes) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setAllTimes(false);
            }}
          >
            נקה סינון
          </button>
        )}
      </div>
    </div>
  );

  const hasIncomeData = eventsWithSummary.length > 0;

  return (
    <>
      <div className="page-header">
        <h1>לוח בקרה</h1>
      </div>

      {filterBar}

      <div className="dashboard-stack">
        {/* Tile 1 — KPI row */}
        <div className="kpi-grid">
          <KpiTile label='סה"כ הכנסות למועדון' value={fmtMoney(kpi.total)} />
          <KpiTile label="מספר אירועים" value={fmtNumber(kpi.count)} />
          <KpiTile label="ממוצע הכנסה לאירוע" value={fmtMoney(kpi.avgIncome)} />
          <KpiTile
            label="ממוצע משתתפים לאירוע"
            value={fmtNumber(kpi.avgAttendance)}
          />
          <KpiTile label="ממוצע בר לראש" value={fmtMoney(kpi.avgBarPerHead)} />
        </div>

        {/* Tile 2 — Income over time */}
        <div className="card">
          <h2>הכנסות לפי חודש</h2>
          {incomeOverTime.length === 0 ? (
            <div className="empty">אין נתוני הכנסה בטווח זה.</div>
          ) : (
            <div className="chart-wrap" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="label" stroke={chart.axis} />
                  <YAxis
                    stroke={chart.axis}
                    tickFormatter={(v) =>
                      Math.round(Number(v)).toLocaleString("he-IL")
                    }
                  />
                  <Tooltip
                    formatter={(v) => fmtMoney(Number(v))}
                    contentStyle={{
                      background: chart.tooltipBg,
                      border: `1px solid ${chart.tooltipBorder}`,
                    }}
                    cursor={{ fill: chart.cursor }}
                  />
                  <Legend />
                  <Bar
                    dataKey="tickets"
                    name="כרטיסים (חלק המועדון)"
                    stackId="a"
                    fill={COLORS.tickets}
                  />
                  <Bar
                    dataKey="bar"
                    name="בר"
                    stackId="a"
                    fill={COLORS.bar}
                  />
                  <Bar
                    dataKey="commission"
                    name="עמלת אתר האוזן"
                    stackId="a"
                    fill={COLORS.commission}
                  />
                  <Bar
                    dataKey="others"
                    name="אחר"
                    stackId="a"
                    fill={COLORS.others}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tile 3 — Income by event type */}
        <div className="card">
          <h2>הכנסות לפי סוג אירוע</h2>
            {incomeByType.length === 0 ? (
              <div className="empty">אין נתונים.</div>
            ) : (
              <div
                className="chart-wrap"
                style={{ height: Math.max(220, incomeByType.length * 40 + 40) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={incomeByType}
                    margin={{ left: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis
                      type="number"
                      stroke={chart.axis}
                      tickFormatter={(v) =>
                        Math.round(Number(v)).toLocaleString("he-IL")
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      stroke={chart.axis}
                      width={110}
                    />
                    <Tooltip
                      formatter={(v, _n, p) => [
                        `${fmtMoney(Number(v))} · ${(p as { payload: { count: number } }).payload.count} אירועים`,
                        "סה\"כ",
                      ]}
                      contentStyle={{
                        background: chart.tooltipBg,
                        border: `1px solid ${chart.tooltipBorder}`,
                      }}
                      cursor={{ fill: chart.cursor }}
                    />
                    <Bar dataKey="total" fill={COLORS.tickets} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>

        {/* Tiles 4 + 5 side-by-side */}
        <div className="card-grid">
          <div className="card">
            <h2>אירועים מובילים</h2>
            {topEvents.length === 0 ? (
              <div className="empty">אין נתוני הכנסה בטווח זה.</div>
            ) : (
              <table className="centered">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>תאריך</th>
                    <th>מפיק</th>
                    <th>משתתפים</th>
                    <th>בר</th>
                    <th>סה"כ למועדון</th>
                  </tr>
                </thead>
                <tbody>
                  {topEvents.map((r) => (
                    <tr key={r.event.id}>
                      <td>
                        <Link
                          to={`/events/${r.event.id}`}
                          className="row-value"
                          dir="auto"
                        >
                          {r.event.name}
                        </Link>
                      </td>
                      <td
                        className="muted"
                        dir="ltr"
                        style={{ textAlign: "start" }}
                      >
                        {formatDate(r.event.date)}
                      </td>
                      <td className="row-value" dir="auto">
                        {r.event.producer_name ?? "—"}
                      </td>
                      <td dir="ltr" style={{ textAlign: "start" }}>
                        {r.counter == null ? "—" : fmtNumber(r.counter)}
                      </td>
                      <td dir="ltr" style={{ textAlign: "start" }}>
                        {fmtMoney(r.bar)}
                      </td>
                      <td
                        dir="ltr"
                        style={{ textAlign: "start", fontWeight: 600 }}
                      >
                        {fmtMoney(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>מפיקים מובילים</h2>
            {topProducers.length === 0 ? (
              <div className="empty">אין נתוני הכנסה בטווח זה.</div>
            ) : (
              <table className="centered">
                <thead>
                  <tr>
                    <th>מפיק</th>
                    <th>אירועים</th>
                    <th>סה"כ למועדון</th>
                    <th>ממוצע לאירוע</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducers.map((p) => (
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
                      <td>{fmtNumber(p.count)}</td>
                      <td
                        dir="ltr"
                        style={{ textAlign: "start", fontWeight: 600 }}
                      >
                        {fmtMoney(p.total)}
                      </td>
                      <td dir="ltr" style={{ textAlign: "start" }}>
                        {fmtMoney(p.total / Math.max(1, p.count))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Tile 7 — Attendance + bar-per-head */}
        <div className="card">
          <h2>משתתפים ובר לראש</h2>
          {attendanceTrend.length === 0 ? (
            <div className="empty">אין נתוני משתתפים בטווח זה.</div>
          ) : (
            <div className="chart-wrap" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis
                    dataKey="date"
                    stroke={chart.axis}
                    tickFormatter={(v) => formatDate(String(v))}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke={COLORS.attendance}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke={COLORS.perHead}
                    tickFormatter={(v) =>
                      Math.round(Number(v)).toLocaleString("he-IL")
                    }
                  />
                  <Tooltip
                    labelFormatter={(v) => formatDate(String(v))}
                    contentStyle={{
                      background: chart.tooltipBg,
                      border: `1px solid ${chart.tooltipBorder}`,
                    }}
                    formatter={(v, name) => {
                      if (name === "משתתפים")
                        return [fmtNumber(Number(v)), name];
                      return [fmtMoney(Number(v)), name];
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="counter"
                    name="משתתפים"
                    fill={COLORS.attendance}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="perHead"
                    name="בר לראש"
                    stroke={COLORS.perHead}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Forecast section — aggregations for upcoming events without summaries */}
        <h2 style={{ marginTop: 8, marginBottom: 0 }}>צפי</h2>

        <div className="kpi-grid">
          <KpiTile label='סה"כ הכנסות צפויות' value={fmtMoney(forecastKpi.total)} />
          <KpiTile label="מספר אירועים עתידיים" value={fmtNumber(forecastKpi.count)} />
          <KpiTile
            label="ממוצע הכנסה צפויה לאירוע"
            value={fmtMoney(forecastKpi.avgIncome)}
          />
          <KpiTile
            label="ממוצע משתתפים צפוי"
            value={fmtNumber(forecastKpi.avgAttendance)}
          />
          <KpiTile label="ממוצע נטו צפוי לאירוע" value={fmtMoney(forecastKpi.avgNet)} />
        </div>

        <div className="card">
          <h2>צפי הכנסות לפי חודש</h2>
          {forecastIncomeOverTime.length === 0 ? (
            <div className="empty">אין אירועים עתידיים בטווח זה.</div>
          ) : (
            <div className="chart-wrap" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastIncomeOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="label" stroke={chart.axis} />
                  <YAxis
                    stroke={chart.axis}
                    tickFormatter={(v) =>
                      Math.round(Number(v)).toLocaleString("he-IL")
                    }
                  />
                  <Tooltip
                    formatter={(v) => fmtMoney(Number(v))}
                    contentStyle={{
                      background: chart.tooltipBg,
                      border: `1px solid ${chart.tooltipBorder}`,
                    }}
                    cursor={{ fill: chart.cursor }}
                  />
                  <Legend />
                  <Bar
                    dataKey="tickets"
                    name="כרטיסים (חלק המועדון)"
                    stackId="a"
                    fill={COLORS.tickets}
                  />
                  <Bar
                    dataKey="bar"
                    name="בר"
                    stackId="a"
                    fill={COLORS.bar}
                  />
                  <Bar
                    dataKey="commission"
                    name="עמלת אתר האוזן"
                    stackId="a"
                    fill={COLORS.commission}
                  />
                  <Bar
                    dataKey="others"
                    name="אחר"
                    stackId="a"
                    fill={COLORS.others}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h2>צפי הכנסות לפי סוג אירוע</h2>
          {forecastIncomeByType.length === 0 ? (
            <div className="empty">אין אירועים עתידיים בטווח זה.</div>
          ) : (
            <div
              className="chart-wrap"
              style={{ height: Math.max(220, forecastIncomeByType.length * 40 + 40) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={forecastIncomeByType}
                  margin={{ left: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis
                    type="number"
                    stroke={chart.axis}
                    tickFormatter={(v) =>
                      Math.round(Number(v)).toLocaleString("he-IL")
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    stroke={chart.axis}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v, _n, p) => [
                      `${fmtMoney(Number(v))} · ${(p as { payload: { count: number } }).payload.count} אירועים`,
                      "סה\"כ",
                    ]}
                    contentStyle={{
                      background: chart.tooltipBg,
                      border: `1px solid ${chart.tooltipBorder}`,
                    }}
                    cursor={{ fill: chart.cursor }}
                  />
                  <Bar dataKey="total" fill={COLORS.tickets} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-grid">
          <div className="card">
            <h2>אירועים מובילים — צפי</h2>
            {forecastTopEvents.length === 0 ? (
              <div className="empty">אין אירועים עתידיים בטווח זה.</div>
            ) : (
              <table className="centered">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>תאריך</th>
                    <th>מפיק</th>
                    <th>משתתפים צפויים</th>
                    <th>נטו צפוי</th>
                    <th>סה"כ צפוי למועדון</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastTopEvents.map((r) => (
                    <tr key={r.event.id}>
                      <td>
                        <Link
                          to={`/events/${r.event.id}`}
                          className="row-value"
                          dir="auto"
                        >
                          {r.event.name}
                        </Link>
                      </td>
                      <td
                        className="muted"
                        dir="ltr"
                        style={{ textAlign: "start" }}
                      >
                        {formatDate(r.event.date)}
                      </td>
                      <td className="row-value" dir="auto">
                        {r.event.producer_name ?? "—"}
                      </td>
                      <td dir="ltr" style={{ textAlign: "start" }}>
                        {r.counter == null ? "—" : fmtNumber(r.counter)}
                      </td>
                      <td dir="ltr" style={{ textAlign: "start" }}>
                        {fmtMoney(r.net)}
                      </td>
                      <td
                        dir="ltr"
                        style={{ textAlign: "start", fontWeight: 600 }}
                      >
                        {fmtMoney(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>מפיקים מובילים — צפי</h2>
            {forecastTopProducers.length === 0 ? (
              <div className="empty">אין אירועים עתידיים בטווח זה.</div>
            ) : (
              <table className="centered">
                <thead>
                  <tr>
                    <th>מפיק</th>
                    <th>אירועים עתידיים</th>
                    <th>סה"כ צפוי למועדון</th>
                    <th>ממוצע צפוי לאירוע</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastTopProducers.map((p) => (
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
                      <td>{fmtNumber(p.count)}</td>
                      <td
                        dir="ltr"
                        style={{ textAlign: "start", fontWeight: 600 }}
                      >
                        {fmtMoney(p.total)}
                      </td>
                      <td dir="ltr" style={{ textAlign: "start" }}>
                        {fmtMoney(p.total / Math.max(1, p.count))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Tile 8 — Outstanding payments */}
        <div className="card">
          <h2>תשלומים פתוחים</h2>
          {outstanding.rows.length === 0 ? (
            <div className="empty">אין תשלומים פתוחים בטווח זה.</div>
          ) : (
            <>
              <div
                className="kpi-tile"
                style={{ marginBottom: 12, maxWidth: 280 }}
              >
                <span className="kpi-label">סה"כ תשלומים פתוחים לאוזן</span>
                <span className="kpi-value" dir="ltr">
                  {fmtMoney(
                    outstanding.rows.reduce((sum, r) => sum + r.total, 0),
                  )}
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {outstanding.rows.length} אירועים
                </span>
              </div>
              <table className="centered">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>תאריך</th>
                    <th>מפיק</th>
                    <th>סטטוס</th>
                    <th>סה"כ למועדון</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.rows
                    .slice()
                    .sort((a, b) => b.age - a.age)
                    .slice(0, 20)
                    .map((r) => (
                      <tr key={r.event.id}>
                        <td>
                          <Link
                            to={`/events/${r.event.id}/summary`}
                            className="row-value"
                            dir="auto"
                          >
                            {r.event.name}
                          </Link>
                        </td>
                        <td
                          className="muted"
                          dir="ltr"
                          style={{ textAlign: "start" }}
                        >
                          {formatDate(r.event.date)}
                        </td>
                        <td className="row-value" dir="auto">
                          {r.event.producer_name ?? "—"}
                        </td>
                        <td>
                          {statusByCode[r.event.status]?.label ?? r.event.status}
                        </td>
                        <td
                          dir="ltr"
                          style={{ textAlign: "start", fontWeight: 600 }}
                        >
                          {fmtMoney(r.total)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {!hasIncomeData && (
          <div
            className="muted"
            style={{ fontSize: 12, textAlign: "center", padding: 8 }}
          >
            חישוב הכנסות מבוסס על אירועים עם סיכום שהוזן. אירועים ללא סיכום אינם
            נכללים בטילים המבוססי הכנסה.
          </div>
        )}
      </div>
    </>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-tile">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" dir="ltr">
        {value}
      </span>
    </div>
  );
}
