import { useEnums } from "../../services/enums";

interface Props {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function InlineStatusSelect({ value, onChange, disabled }: Props) {
  const { statuses, statusByCode } = useEnums();
  const current = statusByCode[value];
  const color = current?.color ?? "gray";
  return (
    <select
      className={`badge badge-color-${color} status-select`}
      value={value}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    >
      {!current && (
        <option value={value}>{value}</option>
      )}
      {statuses.map((s) => (
        <option key={s.code} value={s.code}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
