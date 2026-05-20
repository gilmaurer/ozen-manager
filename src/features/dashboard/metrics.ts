import type { EventWithProducer } from "../../db/types";
import { clubTicketShareOf } from "../events/dealCalc";
import type { SummaryAggregate } from "../summaries/summariesRepo";

export interface ClubTakeBreakdown {
  ticketsClub: number;
  bar: number;
  commission: number;
  campaign: number;
  others: number;
  total: number;
}

const EMPTY: ClubTakeBreakdown = {
  ticketsClub: 0,
  bar: 0,
  commission: 0,
  campaign: 0,
  others: 0,
  total: 0,
};

export function clubTakeBreakdown(
  event: EventWithProducer,
  aggs: Map<number, SummaryAggregate>,
): ClubTakeBreakdown {
  const a = aggs.get(event.id);
  if (!a) return EMPTY;
  const ticketBase =
    (a.presale_revenue ?? 0) -
    (a.presale_commissions ?? 0) +
    (a.box_office_revenue ?? 0);
  const ticketsClub = clubTicketShareOf(event, ticketBase);
  const bar = a.bar_total ?? 0;
  const commission = a.ozen_commission ?? 0;
  const campaignAmt = event.campaign_amount ?? 0;
  const campaignPct = event.campaign ?? 0;
  const campaign = campaignAmt * (campaignPct / 100);
  const others =
    (a.acum ?? 0) +
    (a.stereo_record ?? 0) +
    (a.channels_record ?? 0) +
    (a.lightman ?? 0);
  const total = ticketsClub + bar + commission + campaign + others;
  return { ticketsClub, bar, commission, campaign, others, total };
}

export function clubTakeOf(
  event: EventWithProducer,
  aggs: Map<number, SummaryAggregate>,
): number {
  return clubTakeBreakdown(event, aggs).total;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("he-IL", { month: "short", year: "numeric" });
}

export function ageDays(iso: string, today = new Date()): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const eventUtc = Date.UTC(y, m - 1, d);
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.floor((todayUtc - eventUtc) / 86_400_000);
}

export type AgeBucket = "0-30" | "31-60" | "61-90" | "90+";
export const AGE_BUCKETS: AgeBucket[] = ["0-30", "31-60", "61-90", "90+"];
export const AGE_BUCKET_LABEL: Record<AgeBucket, string> = {
  "0-30": "0–30 ימים",
  "31-60": "31–60 ימים",
  "61-90": "61–90 ימים",
  "90+": "90+ ימים",
};

export function ageBucket(days: number): AgeBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}
