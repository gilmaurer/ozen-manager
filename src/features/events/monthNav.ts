export const MONTH_FMT = new Intl.DateTimeFormat("he-IL", {
  month: "long",
  year: "numeric",
});

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthBounds(cursor: Date): { start: string; end: string } {
  const start = toIso(cursor);
  const endDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return { start, end: toIso(endDate) };
}
