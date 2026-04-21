import type { EventStatus, EventType } from "../../db/types";

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "טיוטה",
  signed: "נחתם",
  active: "פעיל",
  waiting_invoice: "ממתין לחשבונית",
  wait_payment: "ממתין לתשלום",
  wait_summary: "ממתין לסיכום",
  done: "הסתיים",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  party: "מסיבה",
  standup: "סטנדאפ",
  concert: "הופעה",
  lecture: "הרצאה",
  private_event: "אירוע פרטי",
};

export const EVENT_STATUS_OPTIONS: EventStatus[] = [
  "draft",
  "signed",
  "active",
  "waiting_invoice",
  "wait_payment",
  "wait_summary",
  "done",
];

export const EVENT_TYPE_OPTIONS: EventType[] = [
  "party",
  "standup",
  "concert",
  "lecture",
  "private_event",
];

export function eventTypeLabel(type: EventType | null | undefined): string {
  return type ? EVENT_TYPE_LABELS[type] : "—";
}
