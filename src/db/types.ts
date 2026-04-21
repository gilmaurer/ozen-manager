export type EventStatus =
  | "draft"
  | "signed"
  | "active"
  | "waiting_invoice"
  | "wait_payment"
  | "wait_summary"
  | "done";

export type EventType =
  | "party"
  | "standup"
  | "concert"
  | "lecture"
  | "private_event";

export interface EventRow {
  id: number;
  name: string;
  date: string;
  type: EventType | null;
  producer_id: number | null;
  status: EventStatus;
  deal: string | null;
  ticket_link: string | null;
  notes: string | null;
  created_at: string;
}

export interface EventWithProducer extends EventRow {
  producer_name: string | null;
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
  active: number;
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
