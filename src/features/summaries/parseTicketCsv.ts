import * as XLSX from "xlsx";

export interface ParsedTicketRow {
  price: number;
  quantity: number;
}

export interface ParseResult {
  rows: ParsedTicketRow[];
  totalTickets: number;
  totalRevenue: number;
  skippedCount: number;
  warning?: string;
}

function findKey(
  row: Record<string, unknown>,
  target: string,
): string | undefined {
  const lower = target.toLowerCase();
  return Object.keys(row).find((k) => k.trim().toLowerCase() === lower);
}

function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function parseTicketCsv(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (rows.length === 0) {
    return { rows: [], totalTickets: 0, totalRevenue: 0, skippedCount: 0 };
  }

  const sample = rows[0];
  const statusKey = findKey(sample, "Order Status");
  const priceKey = findKey(sample, "Ticket Total");

  let warning: string | undefined;
  if (!statusKey) warning = "לא נמצאה עמודת Order Status — נטענו כל השורות";
  if (!priceKey) {
    return {
      rows: [],
      totalTickets: 0,
      totalRevenue: 0,
      skippedCount: rows.length,
      warning: "לא נמצאה עמודת Ticket Total בקובץ",
    };
  }

  const byPrice = new Map<number, number>();
  let skippedCount = 0;

  for (const row of rows) {
    if (statusKey) {
      const status = String(row[statusKey] ?? "").trim().toLowerCase();
      if (status !== "completed") {
        skippedCount++;
        continue;
      }
    }
    const raw = parsePrice(row[priceKey]);
    if (raw == null) {
      skippedCount++;
      continue;
    }
    const price = Math.round(raw * 100) / 100;
    byPrice.set(price, (byPrice.get(price) ?? 0) + 1);
  }

  const parsed: ParsedTicketRow[] = Array.from(byPrice.entries())
    .map(([price, quantity]) => ({ price, quantity }))
    .sort((a, b) => b.price - a.price);

  const totalTickets = parsed.reduce((s, r) => s + r.quantity, 0);
  const totalRevenue = parsed.reduce((s, r) => s + r.price * r.quantity, 0);

  return { rows: parsed, totalTickets, totalRevenue, skippedCount, warning };
}
