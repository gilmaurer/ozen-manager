import { useEnums } from "../services/enums";

export function StatusBadge({ status }: { status: string }) {
  const { statusByCode } = useEnums();
  const s = statusByCode[status];
  const label = s?.label ?? status;
  const color = s?.color ?? "gray";
  return <span className={`badge badge-color-${color}`}>{label}</span>;
}

export function statusLabel(status: string, byCode: Record<string, { label: string }>): string {
  return byCode[status]?.label ?? status;
}
