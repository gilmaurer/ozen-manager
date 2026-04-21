import type { EventStatus } from "../db/types";
import { EVENT_STATUS_LABELS } from "../features/events/labels";

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`badge badge-${status}`}>{EVENT_STATUS_LABELS[status]}</span>
  );
}

export function statusLabel(status: EventStatus): string {
  return EVENT_STATUS_LABELS[status];
}
