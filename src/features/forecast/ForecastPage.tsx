import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePersistentState } from "../../hooks/usePersistentState";
import type {
  EventStatus,
  EventType,
  EventWithProducer,
} from "../../db/types";
import { listEvents } from "../events/eventsRepo";
import { formatDate } from "../../utils/format";
import {
  MONTH_FMT,
  fromMonthKey,
  monthBounds,
  monthKeyOf,
  monthsAroundToday,
  startOfMonth,
} from "../events/monthNav";
import { clubTicketShareOf, dealLabel } from "../events/dealCalc";
import { useEnums } from "../../services/enums";
import {
  listSummaryAggregates,
  SummaryAggregate,
} from "../summaries/summariesRepo";
import { listAllEventTypeStaff } from "../summaries/settingsRepo";
import {
  ForecastResult,
  basisLabel,
  predictAll,
} from "./forecastEngine";

interface Filters {
  q: string;
  status: EventStatus | "";
  type: EventType | "";
  producer: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  q: "",
  status: "",
  type: "",
  producer: "",
  from: "",
  to: "",
};

function filtersActive(f: Filters): boolean {
  return (
    f.q !== "" ||
    f.status !== "" ||
    f.type !== "" ||
    f.producer !== "" ||
    f.from !== "" ||
    f.to !== ""
  );
}

type Scope = "upcoming" | "all";

type ForecastSortKey =
  | "name"
  | "date"
  | "type"
  | "producer"
  | "ticketsCount"
  | "ticketsRevenue"
  | "clubTicketIncome"
  | "barTotal"
  | "counter"
  | "barPerHead"
  | "clubTotalRevenue"
  | "expenses"
  | "net";

type ForecastSort = { key: ForecastSortKey; dir: "asc" | "desc" };

const SCOPE_STORAGE_KEY = "ozen.forecast.scope";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function matches(
  f: Filters,
  e: EventWithProducer,
  applyDateRange: boolean,
): boolean {
  if (f.q && !e.name.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.status && e.status !== f.status) return false;
  if (f.type && e.type !== f.type) return false;
  if (
    f.producer &&
    !(e.producer_name ?? "")
      .toLowerCase()
      .includes(f.producer.toLowerCase())
  )
    return false;
  if (applyDateRange) {
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
  }
  return true;
}

export function ForecastPage() {
  const [events, setEvents] = useState<EventWithProducer[]>([]);
  const [staffCostByType, setStaffCostByType] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [forecasts, setForecasts] = useState<Map<number, ForecastResult>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>(() => {
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY);
    return saved === "all" ? "all" : "upcoming";
  });
  const [filters, setFilters] = usePersistentState<Filters>(
    "forecast.filters",
    EMPTY_FILTERS,
  );
  const [allTimes, setAllTimes] = usePersistentState("forecast.allTimes", false);
  const [monthCursor, setMonthCursor] = usePersistentState<Date>(
    "forecast.monthCursor",
    () => startOfMonth(new Date()),
  );
  const [sort, setSort] = usePersistentState<ForecastSort>("forecast.sort", {
    key: "date",
    dir: "asc",
  });
  const { statuses, types, typeByCode } = useEnums();

  useEffect(() => {
    localStorage.setItem(SCOPE_STORAGE_KEY, scope);
  }, [scope]);

  async function refresh() {
    setLoading(true);
    const [evs, aggs, staffRows] = await Promise.all([
      listEvents(),
      listSummaryAggregates().catch(() => new Map<number, SummaryAggregate>()),
      listAllEventTypeStaff().catch(() => []),
    ]);
    const staffMap = new Map<string, number>();
    for (const r of staffRows) {
      const key = `${r.event_type_code}|${r.sub_type ?? ""}`;
      staffMap.set(key, (staffMap.get(key) ?? 0) + r.cost);
    }
    setEvents(evs);
    setStaffCostByType(staffMap);
    setForecasts(predictAll(evs, aggs));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredEvents = useMemo(() => {
    const today = todayIso();
    const applyMonth =
      !allTimes && filters.from === "" && filters.to === "";
    const applyDateRange = !allTimes;
    const { start, end } = monthBounds(monthCursor);
    return events.filter((e) => {
      if (e.has_summary) return false;
      if (scope === "upcoming" && e.date < today) return false;
      if (!matches(filters, e, applyDateRange)) return false;
      if (applyMonth && (e.date < start || e.date > end)) return false;
      return true;
    });
  }, [events, filters, scope, monthCursor, allTimes]);

  const rows = useMemo(() => {
    return filteredEvents.map((e) => {
      const fc = forecasts.get(e.id);
      const a = fc?.predicted ?? null;
      const ticketsRevenue = a?.tickets_revenue ?? 0;
      const presaleRevenue = a?.presale_revenue ?? 0;
      const boxOfficeRevenue = a?.box_office_revenue ?? 0;
      const presaleCommissions = a?.presale_commissions ?? 0;
      const ozenCommission = a?.ozen_commission ?? 0;
      const barTotal = a?.bar_total ?? 0;
      const ticketBase = presaleRevenue - presaleCommissions + boxOfficeRevenue;
      const clubTicketShare = clubTicketShareOf(e, ticketBase);
      const clubTicketIncome = clubTicketShare + ozenCommission;
      const clubTotalRevenue = clubTicketIncome + barTotal;
      const staffCost = e.type
        ? staffCostByType.get(`${e.type}|${e.sub_type ?? ""}`) ?? 0
        : 0;
      const campaignPct = e.campaign ?? 0;
      const campaignAmount = e.campaign_amount ?? 0;
      const clubCampaignExpense = campaignAmount * ((100 - campaignPct) / 100);
      const expenses = staffCost + clubCampaignExpense;
      const net = clubTotalRevenue - expenses;
      const counter = a?.counter ?? null;
      return {
        event: e,
        fc,
        agg: a,
        ticketsRevenue,
        barTotal,
        clubTicketIncome,
        clubTotalRevenue,
        expenses,
        net,
        counter,
        ticketsCount: a?.tickets_count ?? 0,
        barPerHead: counter && counter > 0 ? (a?.bar_gross ?? 0) / counter : 0,
      };
    });
  }, [filteredEvents, forecasts, staffCostByType]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sort.key) {
        case "name":
          av = a.event.name;
          bv = b.event.name;
          break;
        case "date":
          av = a.event.date;
          bv = b.event.date;
          break;
        case "type":
          av = a.event.type ?? "";
          bv = b.event.type ?? "";
          break;
        case "producer":
          av = a.event.producer_name ?? "";
          bv = b.event.producer_name ?? "";
          break;
        case "ticketsCount":
          av = a.ticketsCount;
          bv = b.ticketsCount;
          break;
        case "ticketsRevenue":
          av = a.ticketsRevenue;
          bv = b.ticketsRevenue;
          break;
        case "clubTicketIncome":
          av = a.clubTicketIncome;
          bv = b.clubTicketIncome;
          break;
        case "barTotal":
          av = a.barTotal;
          bv = b.barTotal;
          break;
        case "counter":
          av = a.counter ?? 0;
          bv = b.counter ?? 0;
          break;
        case "barPerHead":
          av = a.barPerHead;
          bv = b.barPerHead;
          break;
        case "clubTotalRevenue":
          av = a.clubTotalRevenue;
          bv = b.clubTotalRevenue;
          break;
        case "expenses":
          av = a.expenses;
          bv = b.expenses;
          break;
        case "net":
          av = a.net;
          bv = b.net;
          break;
      }
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "he");
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSort(key: ForecastSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }

  function sortArrow(key: ForecastSortKey): string {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? " ↑" : " ↓";
  }

  const hasFilters = filtersActive(filters);
  const showEmpty = !loading && events.length === 0;
  const showNoMatches =
    !loading && events.length > 0 && filteredEvents.length === 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 8 }}>צפי</h1>
          <div className="view-toggle">
            <button
              className={scope === "upcoming" ? "active" : ""}
              onClick={() => setScope("upcoming")}
            >
              עתידיים
            </button>
            <button
              className={scope === "all" ? "active" : ""}
              onClick={() => setScope("all")}
            >
              כל האירועים ללא סיכום
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">טוען…</div>
        ) : showEmpty ? (
          <div className="empty">אין אירועים עדיין.</div>
        ) : (
          <>
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
                {MONTH_FMT.format(monthCursor)}
                {(filters.from !== "" || filters.to !== "") && (
                  <span
                    className="muted"
                    style={{ fontSize: 13, marginInlineStart: 8 }}
                  >
                    (סינון תאריכים פעיל)
                  </span>
                )}
              </div>
            </div>
            <div className="filter-bar">
              <input
                className="filter-search"
                type="text"
                placeholder="חיפוש לפי שם"
                dir="auto"
                value={filters.q}
                onChange={(e) => updateFilter("q", e.target.value)}
              />
              <select
                value={filters.status}
                onChange={(e) =>
                  updateFilter("status", e.target.value as EventStatus | "")
                }
              >
                <option value="">כל הסטטוסים</option>
                {statuses.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
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
                aria-label="מתאריך"
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
                aria-label="עד תאריך"
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
                title="הצג צפי לכל האירועים"
              >
                כל האירועים
              </button>
              {hasFilters && (
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

            {!showNoMatches && (
              <div
                className="muted"
                style={{ margin: "0 0 8px", fontSize: 13 }}
              >
                סה"כ: {filteredEvents.length} אירועים
              </div>
            )}
            {showNoMatches ? (
              <div className="empty">אין תוצאות לסינון.</div>
            ) : (
              <table className="centered">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("name")}>
                        שם{sortArrow("name")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("date")}>
                        תאריך{sortArrow("date")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("type")}>
                        סוג{sortArrow("type")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("producer")}>
                        מפיק{sortArrow("producer")}
                      </button>
                    </th>
                    <th>מבוסס על</th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("ticketsCount")}>
                        כרטיסים{sortArrow("ticketsCount")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("ticketsRevenue")}>
                        הכנסות כרטיסים{sortArrow("ticketsRevenue")}
                      </button>
                    </th>
                    <th>דיל</th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("clubTicketIncome")}>
                        חלק המועדון מכרטיסים{sortArrow("clubTicketIncome")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("barTotal")}>
                        בר{sortArrow("barTotal")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("counter")}>
                        מונה{sortArrow("counter")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("barPerHead")}>
                        בר לראש{sortArrow("barPerHead")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("clubTotalRevenue")}>
                        סה"כ הכנסות למועדון{sortArrow("clubTotalRevenue")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("expenses")}>
                        הוצאות{sortArrow("expenses")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => toggleSort("net")}>
                        נטו למועדון{sortArrow("net")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => {
                    const e = row.event;
                    const fc = row.fc;
                    const a = row.agg;
                    const {
                      ticketsRevenue,
                      barTotal,
                      clubTicketIncome,
                      clubTotalRevenue,
                      expenses,
                      net,
                      counter,
                    } = row;
                    const noData = !fc || fc.basis === "none" || !a;
                    if (noData) {
                      return (
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
                          <td
                            className="muted"
                            dir="ltr"
                            style={{ textAlign: "start" }}
                          >
                            {formatDate(e.date)}
                          </td>
                          <td>
                            {e.type ? typeByCode[e.type]?.label ?? e.type : "—"}
                          </td>
                          <td>
                            {e.producer_name && e.producer_id != null ? (
                              <Link
                                to={`/producers/${e.producer_id}`}
                                className="row-value"
                                dir="auto"
                              >
                                {e.producer_name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td colSpan={11} className="muted">
                            אין נתונים היסטוריים
                          </td>
                        </tr>
                      );
                    }
                    return (
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
                        <td
                          className="muted"
                          dir="ltr"
                          style={{ textAlign: "start" }}
                        >
                          {formatDate(e.date)}
                        </td>
                        <td>
                          {e.type ? typeByCode[e.type]?.label ?? e.type : "—"}
                        </td>
                        <td>
                          {e.producer_name && e.producer_id != null ? (
                            <Link
                              to={`/producers/${e.producer_id}`}
                              className="row-value"
                              dir="auto"
                            >
                              {e.producer_name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {basisLabel(fc!.basis)}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            ממוצע מ-{fc!.sources.length}{" "}
                            {fc!.sources.length === 1 ? "אירוע" : "אירועים"}
                          </div>
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {Math.round(a!.tickets_count).toLocaleString("he-IL")}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {Math.round(ticketsRevenue).toLocaleString("he-IL")}
                          {" ₪"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {dealLabel(e)}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {Math.round(clubTicketIncome).toLocaleString("he-IL")}
                          {" ₪"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {Math.round(barTotal).toLocaleString("he-IL")}
                          {" ₪"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {counter != null ? Math.round(counter) : "—"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {row.barPerHead > 0
                            ? `${row.barPerHead.toLocaleString("he-IL", {
                                maximumFractionDigits: 2,
                              })} ₪`
                            : "—"}
                        </td>
                        <td
                          dir="ltr"
                          style={{ textAlign: "start", fontWeight: 600 }}
                        >
                          {Math.round(clubTotalRevenue).toLocaleString("he-IL")}
                          {" ₪"}
                        </td>
                        <td dir="ltr" style={{ textAlign: "start" }}>
                          {Math.round(expenses).toLocaleString("he-IL")}
                          {" ₪"}
                        </td>
                        <td
                          dir="ltr"
                          style={{ textAlign: "start", fontWeight: 600 }}
                        >
                          {Math.round(net).toLocaleString("he-IL")}
                          {" ₪"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  );
}
