import type { EventForecastRow, PredictedAggregate } from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";
import { getEvent, listEvents } from "../events/eventsRepo";
import { listSummaryAggregates } from "../summaries/summariesRepo";
import { predictEvent } from "./forecastEngine";

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function minDateIso(a: Date, bIso: string): Date {
  const aIso = a.toISOString().slice(0, 10);
  const earlierIso = aIso < bIso ? aIso : bIso;
  return new Date(`${earlierIso}T00:00:00Z`);
}

export async function getForecast(
  eventId: number,
): Promise<EventForecastRow | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("event_forecasts")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) throw error;
    return (data as EventForecastRow | null) ?? null;
  });
}

export async function freezeForecast(
  eventId: number,
): Promise<EventForecastRow | null> {
  const existing = await getForecast(eventId);
  if (existing) return existing;

  const event = await getEvent(eventId);
  if (!event) return null;

  const [history, summaries] = await Promise.all([
    listEvents(),
    listSummaryAggregates(),
  ]);

  const effectiveDate = minDateIso(todayDate(), event.date);
  const result = predictEvent(event, history, summaries, effectiveDate);

  const predicted: PredictedAggregate | null = result.predicted
    ? {
        tickets_count: result.predicted.tickets_count,
        tickets_revenue: result.predicted.tickets_revenue,
        presale_revenue: result.predicted.presale_revenue,
        box_office_revenue: result.predicted.box_office_revenue,
        presale_commissions: result.predicted.presale_commissions,
        ozen_commission: result.predicted.ozen_commission,
        bar_total: result.predicted.bar_total,
        counter: result.predicted.counter,
        acum: result.predicted.acum,
        stereo_record: result.predicted.stereo_record,
        channels_record: result.predicted.channels_record,
        lightman: result.predicted.lightman,
        extra_expenses_total: result.predicted.extra_expenses_total,
        producer_additional_expenses:
          result.predicted.producer_additional_expenses,
        club_extra_expenses: result.predicted.club_extra_expenses,
      }
    : null;

  const row = {
    event_id: eventId,
    basis: result.basis,
    sources: result.sources,
    predicted,
    effective_date: effectiveDate.toISOString().slice(0, 10),
  };

  return withRetry(async () => {
    const { data, error } = await supabase
      .from("event_forecasts")
      .insert(row)
      .select("*")
      .single();
    if (error) {
      // Unique-violation (concurrent insert) — read the winner.
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        const winner = await getForecast(eventId);
        if (winner) return winner;
      }
      throw error;
    }
    return data as EventForecastRow;
  });
}
