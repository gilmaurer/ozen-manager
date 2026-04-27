import type {
  EventStatus,
  EventType,
  EventWithProducer,
} from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

const SELECT = "*, producer:producers(id, name), summary:event_summaries(id)";

type EventRowWithJoin = Omit<EventWithProducer, "producer_name" | "has_summary"> & {
  producer?: { id: number; name: string } | null;
  summary?: { id: number }[] | { id: number } | null;
};

function normalize(row: EventRowWithJoin): EventWithProducer {
  const { producer, summary, ...rest } = row;
  const has_summary = Array.isArray(summary) ? summary.length > 0 : !!summary;
  return { ...rest, producer_name: producer?.name ?? null, has_summary };
}

export async function listEvents(): Promise<EventWithProducer[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("events")
      .select(SELECT)
      .order("date", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return (data as EventRowWithJoin[] | null)?.map(normalize) ?? [];
  });
}

export async function listUpcomingEvents(
  days = 14,
): Promise<EventWithProducer[]> {
  return withRetry(async () => {
    const today = new Date();
    const until = new Date();
    until.setDate(today.getDate() + days);
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("events")
      .select(SELECT)
      .gte("date", toIso(today))
      .lte("date", toIso(until))
      .order("date", { ascending: true });
    if (error) throw error;
    return (data as EventRowWithJoin[] | null)?.map(normalize) ?? [];
  });
}

export async function getEvent(
  id: number,
): Promise<EventWithProducer | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("events")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? normalize(data as EventRowWithJoin) : null;
  });
}

export async function listEventsByProducer(
  producerId: number,
): Promise<EventWithProducer[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("events")
      .select(SELECT)
      .eq("producer_id", producerId)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data as EventRowWithJoin[] | null)?.map(normalize) ?? [];
  });
}

export interface EventInput {
  name: string;
  date: string;
  start_time: string | null;
  type: EventType | null;
  sub_type: string | null;
  producer_id: number | null;
  status: EventStatus;
  deal: number | null;
  campaign: number | null;
  campaign_amount: number | null;
  ticket_link: string | null;
  notes: string | null;
}

export async function createEvent(input: EventInput): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("events")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  });
}

export async function updateEvent(id: number, input: EventInput): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("events").update(input).eq("id", id);
    if (error) throw error;
  });
}

export async function deleteEvent(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
  });
}
