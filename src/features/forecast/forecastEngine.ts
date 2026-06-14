import type { EventWithProducer } from "../../db/types";
import type { SummaryAggregate } from "../summaries/summariesRepo";

export type ForecastBasis = "name_producer" | "producer" | "type" | "none";

export interface ForecastResult {
  basis: ForecastBasis;
  sources: number[];
  predicted: SummaryAggregate | null;
}

function dateNDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function normName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function isFinished(
  e: EventWithProducer,
  cutoffIso: string,
  summaries: Map<number, SummaryAggregate>,
): boolean {
  return e.date < cutoffIso && summaries.has(e.id);
}

function averageAggregates(
  events: EventWithProducer[],
  summaries: Map<number, SummaryAggregate>,
): SummaryAggregate | null {
  if (events.length === 0) return null;
  const aggs = events
    .map((e) => summaries.get(e.id))
    .filter((a): a is SummaryAggregate => !!a);
  if (aggs.length === 0) return null;

  const n = aggs.length;
  const sum = (key: keyof SummaryAggregate) =>
    aggs.reduce((acc, a) => acc + ((a[key] as number) ?? 0), 0);

  const counters = aggs
    .map((a) => a.counter)
    .filter((c): c is number => typeof c === "number");
  const counterAvg =
    counters.length > 0
      ? counters.reduce((a, b) => a + b, 0) / counters.length
      : null;

  return {
    event_id: 0,
    tickets_count: sum("tickets_count") / n,
    tickets_revenue: sum("tickets_revenue") / n,
    presale_revenue: sum("presale_revenue") / n,
    box_office_revenue: sum("box_office_revenue") / n,
    presale_commissions: sum("presale_commissions") / n,
    ozen_commission: sum("ozen_commission") / n,
    bar_total: sum("bar_total") / n,
    bar_gross: sum("bar_gross") / n,
    counter: counterAvg,
    acum: sum("acum") / n,
    stereo_record: sum("stereo_record") / n,
    channels_record: sum("channels_record") / n,
    lightman: sum("lightman") / n,
    extra_expenses_total: sum("extra_expenses_total") / n,
    producer_additional_expenses: sum("producer_additional_expenses") / n,
    club_extra_expenses: sum("club_extra_expenses") / n,
  };
}

function pickLatest(events: EventWithProducer[], n: number): EventWithProducer[] {
  return [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
}

export function predictEvent(
  event: EventWithProducer,
  history: EventWithProducer[],
  summaries: Map<number, SummaryAggregate>,
  effectiveDate: Date = new Date(),
): ForecastResult {
  if (!event.type) {
    return { basis: "none", sources: [], predicted: null };
  }
  const cutoffIso = effectiveDate.toISOString().slice(0, 10);
  const cutoff3mo = dateNDaysAgo(effectiveDate, 90);
  const cutoff2mo = dateNDaysAgo(effectiveDate, 60);

  const eligible = history.filter((e) => isFinished(e, cutoffIso, summaries));

  const sameTypeAndSub = eligible.filter(
    (e) => e.type === event.type && (e.sub_type ?? null) === (event.sub_type ?? null),
  );

  // Tier 1: type + sub_type + producer + name
  if (event.producer_id != null && normName(event.name)) {
    const tier1 = sameTypeAndSub.filter(
      (e) =>
        e.producer_id === event.producer_id &&
        normName(e.name) === normName(event.name),
    );
    if (tier1.length > 0) {
      const inWindow = tier1.filter((e) => e.date >= cutoff3mo);
      if (inWindow.length > 0) {
        return {
          basis: "name_producer",
          sources: inWindow.map((e) => e.id),
          predicted: averageAggregates(inWindow, summaries),
        };
      }
      const latest = pickLatest(tier1, 1);
      return {
        basis: "name_producer",
        sources: latest.map((e) => e.id),
        predicted: averageAggregates(latest, summaries),
      };
    }
  }

  // Tier 2: type + sub_type + producer
  if (event.producer_id != null) {
    const tier2 = sameTypeAndSub.filter(
      (e) => e.producer_id === event.producer_id,
    );
    if (tier2.length > 0) {
      const inWindow = tier2.filter((e) => e.date >= cutoff3mo);
      if (inWindow.length > 0) {
        return {
          basis: "producer",
          sources: inWindow.map((e) => e.id),
          predicted: averageAggregates(inWindow, summaries),
        };
      }
      const latest3 = pickLatest(tier2, 3);
      return {
        basis: "producer",
        sources: latest3.map((e) => e.id),
        predicted: averageAggregates(latest3, summaries),
      };
    }
  }

  // Tier 3: type + sub_type, last 2 months
  const tier3 = sameTypeAndSub.filter((e) => e.date >= cutoff2mo);
  if (tier3.length > 0) {
    return {
      basis: "type",
      sources: tier3.map((e) => e.id),
      predicted: averageAggregates(tier3, summaries),
    };
  }

  return { basis: "none", sources: [], predicted: null };
}

export function predictAll(
  events: EventWithProducer[],
  summaries: Map<number, SummaryAggregate>,
  effectiveDate: Date = new Date(),
): Map<number, ForecastResult> {
  const out = new Map<number, ForecastResult>();
  for (const e of events) {
    out.set(e.id, predictEvent(e, events, summaries, effectiveDate));
  }
  return out;
}

export function basisLabel(basis: ForecastBasis): string {
  switch (basis) {
    case "name_producer":
      return "שם + מפיק";
    case "producer":
      return "מפיק";
    case "type":
      return "סוג בלבד";
    case "none":
      return "אין נתונים";
  }
}
