import type { EventWithProducer, PredictedAggregate } from "../../db/types";
import { clubTicketShareOf } from "../events/dealCalc";
import type { SummaryAggregate } from "../summaries/summariesRepo";

export interface DerivedTotals {
  ticketsCount: number;
  ticketsRevenue: number;
  clubTicketIncome: number;
  barTotal: number;
  counter: number | null;
  clubTotalRevenue: number;
  expenses: number;
  clubNet: number;
}

type AggregateShape = Pick<
  SummaryAggregate,
  | "tickets_count"
  | "tickets_revenue"
  | "presale_revenue"
  | "box_office_revenue"
  | "presale_commissions"
  | "ozen_commission"
  | "bar_total"
  | "counter"
>;

export function deriveTotals(
  event: EventWithProducer,
  agg: AggregateShape | PredictedAggregate,
  staffCostByType: Map<string, number>,
): DerivedTotals {
  const ticketBase =
    agg.presale_revenue - agg.presale_commissions + agg.box_office_revenue;
  const clubTicketShare = clubTicketShareOf(event, ticketBase);
  const clubTicketIncome = clubTicketShare + agg.ozen_commission;
  const clubTotalRevenue = clubTicketIncome + agg.bar_total;
  const staffCost = event.type
    ? staffCostByType.get(`${event.type}|${event.sub_type ?? ""}`) ?? 0
    : 0;
  const campaignPct = event.campaign ?? 0;
  const campaignAmount = event.campaign_amount ?? 0;
  const clubCampaignExpense = campaignAmount * (campaignPct / 100);
  const expenses = staffCost + clubCampaignExpense;
  return {
    ticketsCount: agg.tickets_count,
    ticketsRevenue: agg.tickets_revenue,
    clubTicketIncome,
    barTotal: agg.bar_total,
    counter: agg.counter,
    clubTotalRevenue,
    expenses,
    clubNet: clubTotalRevenue - expenses,
  };
}
