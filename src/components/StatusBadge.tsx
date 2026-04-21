import type { EventStatus } from "../db/types";

const LABELS: Record<EventStatus, string> = {
  draft: "טיוטה",
  published: "מפורסם",
  archived: "בארכיון",
};

export function StatusBadge({ status }: { status: EventStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}

export function statusLabel(status: EventStatus): string {
  return LABELS[status];
}
