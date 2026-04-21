export type EventStatus = "draft" | "published" | "archived";

export interface EventRow {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string | null;
  venue_area: string | null;
  notes: string | null;
  status: EventStatus;
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
