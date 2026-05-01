import type { EventSummaryRow, SummaryTicketRow } from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

export const OZEN_SOURCE = "אתר האוזן";
export const OZEN_COMMISSION_RATE = 0.06;
export const VAT_RATE = 0.18;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ozenCommission(price: number, quantity: number): number {
  return round2(price * quantity * OZEN_COMMISSION_RATE);
}

export async function getSummaryForEvent(
  eventId: number,
): Promise<EventSummaryRow | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("event_summaries")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) throw error;
    return data as EventSummaryRow | null;
  });
}

export async function ensureSummaryForEvent(
  eventId: number,
): Promise<EventSummaryRow> {
  const existing = await getSummaryForEvent(eventId);
  if (existing) return existing;
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("event_summaries")
      .insert({ event_id: eventId })
      .select("*")
      .single();
    if (error) throw error;
    return data as EventSummaryRow;
  });
}

export interface SummaryPatch {
  counter?: number | null;
  bar_cash?: number;
  bar_credit?: number;
  bar_expenses?: number;
  acum?: number;
  stereo_record?: number;
  channels_record?: number;
  lightman?: number;
}

export async function updateSummary(
  id: number,
  patch: SummaryPatch,
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_summaries")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  });
}

export async function deleteSummary(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_summaries")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
}

export async function listTickets(
  summaryId: number,
): Promise<SummaryTicketRow[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("summary_tickets")
      .select("*")
      .eq("summary_id", summaryId)
      .order("kind", { ascending: true })
      .order("price", { ascending: true });
    if (error) throw error;
    return (data ?? []) as SummaryTicketRow[];
  });
}

export interface TicketInput {
  summary_id: number;
  kind: "presale" | "box_office";
  price: number;
  quantity: number;
  source: string;
  commission: number;
}

export async function insertTicket(input: TicketInput): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("summary_tickets")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  });
}

export async function updateTicket(
  id: number,
  patch: {
    price?: number;
    quantity?: number;
    source?: string;
    commission?: number;
  },
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("summary_tickets")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  });
}

export async function deleteTicket(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("summary_tickets")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
}

export interface SummaryAggregate {
  event_id: number;
  tickets_count: number;
  tickets_revenue: number;
  presale_revenue: number;
  box_office_revenue: number;
  presale_commissions: number;
  ozen_commission: number;
  bar_total: number;
  counter: number | null;
}

export async function listSummaryAggregates(): Promise<
  Map<number, SummaryAggregate>
> {
  const [sumsRes, ticketsRes] = await Promise.all([
    supabase.from("event_summaries").select("*"),
    supabase.from("summary_tickets").select("*"),
  ]);
  if (sumsRes.error) throw sumsRes.error;
  if (ticketsRes.error) throw ticketsRes.error;
  const summaries = (sumsRes.data ?? []) as EventSummaryRow[];
  const tickets = (ticketsRes.data ?? []) as SummaryTicketRow[];

  interface TicketAgg {
    count: number;
    revenue: number;
    presale_revenue: number;
    box_office_revenue: number;
    presale_commissions: number;
    ozen_commission: number;
  }
  const empty = (): TicketAgg => ({
    count: 0,
    revenue: 0,
    presale_revenue: 0,
    box_office_revenue: 0,
    presale_commissions: 0,
    ozen_commission: 0,
  });
  const ticketsBySummary = new Map<number, TicketAgg>();
  for (const t of tickets) {
    const prev = ticketsBySummary.get(t.summary_id) ?? empty();
    const rev = t.price * t.quantity;
    prev.count += t.quantity;
    prev.revenue += rev;
    if (t.kind === "presale") {
      const isOzen = t.source === OZEN_SOURCE;
      const comm = isOzen
        ? ozenCommission(t.price, t.quantity)
        : t.commission ?? 0;
      prev.presale_revenue += rev;
      prev.presale_commissions += comm;
      if (isOzen) prev.ozen_commission += comm;
    } else {
      prev.box_office_revenue += rev;
    }
    ticketsBySummary.set(t.summary_id, prev);
  }

  const byEventId = new Map<number, SummaryAggregate>();
  for (const s of summaries) {
    const agg = ticketsBySummary.get(s.id) ?? empty();
    byEventId.set(s.event_id, {
      event_id: s.event_id,
      tickets_count: agg.count,
      tickets_revenue: agg.revenue,
      presale_revenue: agg.presale_revenue,
      box_office_revenue: agg.box_office_revenue,
      presale_commissions: agg.presale_commissions,
      ozen_commission: agg.ozen_commission,
      bar_total:
        (s.bar_cash ?? 0) + (s.bar_credit ?? 0) - (s.bar_expenses ?? 0),
      counter: s.counter,
    });
  }
  return byEventId;
}

export async function replacePresaleTickets(
  summaryId: number,
  rows: Array<{ price: number; quantity: number }>,
): Promise<void> {
  const { error: delErr } = await supabase
    .from("summary_tickets")
    .delete()
    .eq("summary_id", summaryId)
    .eq("kind", "presale");
  if (delErr) throw delErr;
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    summary_id: summaryId,
    kind: "presale" as const,
    price: r.price,
    quantity: r.quantity,
    source: OZEN_SOURCE,
    commission: ozenCommission(r.price, r.quantity),
  }));
  const { error: insErr } = await supabase
    .from("summary_tickets")
    .insert(payload);
  if (insErr) throw insErr;
}
