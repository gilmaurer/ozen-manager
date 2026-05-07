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

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthsAroundToday(before = 3, after = 3): Date[] {
  const today = startOfMonth(new Date());
  const list: Date[] = [];
  for (let i = -before; i <= after; i += 1) {
    list.push(new Date(today.getFullYear(), today.getMonth() + i, 1));
  }
  return list;
}

export function fromMonthKey(key: string): Date | null {
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}
