const DATE_FMT = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const TIME_FMT = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});

function parseDb(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined): string {
  const d = parseDb(value);
  return d ? DATE_FMT.format(d) : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  const d = parseDb(value);
  return d ? DATETIME_FMT.format(d) : "—";
}

export function formatTime(value: string | null | undefined): string {
  const d = parseDb(value);
  return d ? TIME_FMT.format(d) : "—";
}

export function toInputLocal(value: string | null | undefined): string {
  const d = parseDb(value);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromInputLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
