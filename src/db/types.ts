export type EventStatus = string;
export type EventType = string;

export interface EventRow {
  id: number;
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
  created_at: string;
}

export interface EventWithProducer extends EventRow {
  producer_name: string | null;
  has_summary: boolean;
}

export interface EventTypeStaffRow {
  id: number;
  event_type_code: string;
  sub_type: string | null;
  role: string;
  quantity: number;
  cost: number;
}

export interface EventSummaryRow {
  id: number;
  event_id: number;
  counter: number | null;
  bar_cash: number;
  bar_credit: number;
  bar_expenses: number;
  created_at: string;
  updated_at: string;
}

export interface SummaryTicketRow {
  id: number;
  summary_id: number;
  kind: "presale" | "box_office";
  price: number;
  quantity: number;
  source: string;
  commission: number;
}

export interface ProducerRow {
  id: number;
  name: string;
  phone: string | null;
  created_at: string;
}

export interface StaffRow {
  id: number;
  full_name: string;
  role: string | null;
  phone: string | null;
  hourly_rate: number | null;
  active: boolean;
  created_at: string;
}

export interface ShiftRow {
  id: number;
  event_id: number;
  staff_id: number | null;
  starts_at: string | null;
  ends_at: string | null;
  position: string | null;
  notes: string | null;
}

export interface ShiftWithStaff extends ShiftRow {
  staff_name: string | null;
  event_name: string;
}
