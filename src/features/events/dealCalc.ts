import type { EventRow } from "../../db/types";

type DealFields = Pick<EventRow, "deal_type" | "deal" | "deal_fit_price">;

export function clubTicketShareOf(
  event: DealFields,
  ticketBase: number,
): number {
  if (event.deal_type === "fit_price") {
    return event.deal_fit_price ?? 0;
  }
  const pct = event.deal ?? 0;
  return ticketBase * (pct / 100);
}

export function dealLabel(event: DealFields): string {
  if (event.deal_type === "fit_price") {
    if (event.deal_fit_price == null) return "—";
    return `${event.deal_fit_price.toLocaleString("he-IL")} ₪ (קבוע)`;
  }
  if (event.deal == null) return "—";
  return `${event.deal}%`;
}
