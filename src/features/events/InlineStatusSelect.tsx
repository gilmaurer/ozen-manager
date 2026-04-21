import type { EventStatus } from "../../db/types";
import { EVENT_STATUS_LABELS, EVENT_STATUS_OPTIONS } from "./labels";

interface Props {
  value: EventStatus;
  onChange: (next: EventStatus) => void;
  disabled?: boolean;
}

export function InlineStatusSelect({ value, onChange, disabled }: Props) {
  return (
    <select
      className={`badge badge-${value} status-select`}
      value={value}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as EventStatus)}
    >
      {EVENT_STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {EVENT_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
