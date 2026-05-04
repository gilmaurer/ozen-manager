import { useEnums } from "../../services/enums";

interface Props {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  allowedCodes?: readonly string[];
}

export function InlineStatusSelect({
  value,
  onChange,
  disabled,
  allowedCodes,
}: Props) {
  const { statuses, statusByCode } = useEnums();
  const current = statusByCode[value];
  const color = current?.color ?? "gray";
  const options = allowedCodes
    ? statuses.filter((s) => allowedCodes.includes(s.code))
    : statuses;
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
      {options.map((s) => (
        <option key={s.code} value={s.code}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
