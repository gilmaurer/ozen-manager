import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { EventStatus, EventWithProducer } from "../../db/types";
import { formatDate } from "../../utils/format";
import { eventTypeLabel } from "./labels";
import { InlineStatusSelect } from "./InlineStatusSelect";

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: EventWithProducer[];
}

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

const MONTH_FMT = new Intl.DateTimeFormat("he-IL", {
  month: "long",
  year: "numeric",
});

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function todayIso(): string {
  const d = new Date();
  return toIso(d);
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Props {
  events: EventWithProducer[];
  onStatusChange: (event: EventWithProducer, next: EventStatus) => void;
}

export function EventsCalendar({ events, onStatusChange }: Props) {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));

  const { weeks, monthEvents } = useMemo(() => {
    const byDate = new Map<string, EventWithProducer[]>();
    for (const e of events) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }

    const today = todayIso();
    const firstDayOffset = cursor.getDay();
    const gridStart = new Date(cursor);
    gridStart.setDate(cursor.getDate() - firstDayOffset);

    const weeks: Cell[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + w * 7 + d);
        const iso = toIso(day);
        row.push({
          iso,
          day: day.getDate(),
          inMonth: day.getMonth() === cursor.getMonth(),
          isToday: iso === today,
          events: byDate.get(iso) ?? [],
        });
      }
      weeks.push(row);
    }

    const monthStart = toIso(cursor);
    const monthEndDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const monthEnd = toIso(monthEndDate);
    const monthEvents = events
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .sort((a, b) => a.date.localeCompare(b.date));

    return { weeks, monthEvents };
  }, [events, cursor]);

  function shift(delta: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  function goToday() {
    setCursor(startOfMonth(new Date()));
  }

  return (
    <>
      <div className="calendar-header">
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => shift(1)}>
            ›
          </button>
          <button className="btn btn-secondary btn-sm" onClick={goToday}>
            היום
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => shift(-1)}>
            ‹
          </button>
        </div>
        <div className="month-label">{MONTH_FMT.format(cursor)}</div>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
        {weeks.flatMap((row) =>
          row.map((cell) => (
            <div
              key={cell.iso}
              className={[
                "calendar-cell",
                cell.inMonth ? "" : "other-month",
                cell.isToday ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="day-num">{cell.day}</div>
              {cell.events.slice(0, 3).map((e) => (
                <Link
                  key={e.id}
                  to={`/events/${e.id}`}
                  className={`calendar-event badge badge-${e.status}`}
                  dir="auto"
                  title={e.name}
                >
                  {e.name}
                </Link>
              ))}
              {cell.events.length > 3 && (
                <div className="calendar-more">
                  +{cell.events.length - 3} נוספים
                </div>
              )}
            </div>
          )),
        )}
      </div>

      <div className="calendar-agenda">
        <h3>אירועי החודש</h3>
        {monthEvents.length === 0 ? (
          <div className="empty">אין אירועים בחודש זה.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>תאריך</th>
                <th>שם</th>
                <th>סוג</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {monthEvents.map((e) => (
                <tr key={e.id}>
                  <td className="muted">{formatDate(e.date)}</td>
                  <td>
                    <Link
                      to={`/events/${e.id}`}
                      className="row-value"
                      dir="auto"
                    >
                      {e.name}
                    </Link>
                  </td>
                  <td>{eventTypeLabel(e.type)}</td>
                  <td>
                    <InlineStatusSelect
                      value={e.status}
                      onChange={(next) => onStatusChange(e, next)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
