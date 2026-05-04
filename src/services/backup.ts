import { invoke } from "@tauri-apps/api/core";
import * as XLSX from "xlsx";
import { supabase } from "../db/supabase";
import { withFreshProviderToken } from "./googleReauth";

const MISSING_TOKEN = "missing Google access token";
const PAYMENT_STATUSES = ["waiting_invoice", "waiting_payment", "done"];

export type BackupResult =
  | { ok: true }
  | { ok: false; disabled: true }
  | { ok: false; disabled: false; message: string };

type Row = Record<string, unknown>;

async function fetchAll(): Promise<{
  events: Row[];
  producers: Row[];
  event_summaries: Row[];
  summary_tickets: Row[];
  payments: Row[];
}> {
  const [events, producers, eventSummaries, summaryTickets] = await Promise.all([
    supabase.from("events").select("*"),
    supabase.from("producers").select("*"),
    supabase.from("event_summaries").select("*"),
    supabase.from("summary_tickets").select("*"),
  ]);
  if (events.error) throw events.error;
  if (producers.error) throw producers.error;
  if (eventSummaries.error) throw eventSummaries.error;
  if (summaryTickets.error) throw summaryTickets.error;

  const eventsRows = (events.data ?? []) as Row[];
  const payments = eventsRows.filter((e) =>
    PAYMENT_STATUSES.includes(String(e.status)),
  );

  return {
    events: eventsRows,
    producers: (producers.data ?? []) as Row[],
    event_summaries: (eventSummaries.data ?? []) as Row[],
    summary_tickets: (summaryTickets.data ?? []) as Row[],
    payments,
  };
}

async function generateXlsxBytes(): Promise<Uint8Array> {
  const tables = await fetchAll();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.events), "events");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tables.event_summaries),
    "event_summaries",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tables.summary_tickets),
    "summary_tickets",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.payments), "payments");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.producers), "producers");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf as ArrayBuffer);
}

export async function runBackup(): Promise<BackupResult> {
  try {
    const bytes = await generateXlsxBytes();
    await withFreshProviderToken(async (token) => {
      await invoke("drive_backup", {
        xlsxBytes: Array.from(bytes),
        accessToken: token,
      });
    });
    return { ok: true };
  } catch (e: unknown) {
    const message =
      typeof e === "string"
        ? e
        : (e as { message?: string })?.message ?? String(e);
    if (message.includes(MISSING_TOKEN)) {
      return {
        ok: false,
        disabled: false,
        message:
          "אין הרשאת גישה ל-Google Drive. התנתק והתחבר מחדש כדי לאשר את ההרשאה.",
      };
    }
    return { ok: false, disabled: false, message };
  }
}
