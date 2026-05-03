import { invoke } from "@tauri-apps/api/core";
import * as XLSX from "xlsx";
import { supabase } from "../db/supabase";

const MISSING_TOKEN = "missing Google access token";

export type BackupResult =
  | { ok: true }
  | { ok: false; disabled: true }
  | { ok: false; disabled: false; message: string };

async function fetchAll(): Promise<{
  events: Record<string, unknown>[];
  producers: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  shifts: Record<string, unknown>[];
}> {
  const [events, producers, staff, shifts] = await Promise.all([
    supabase.from("events").select("*"),
    supabase.from("producers").select("*"),
    supabase.from("staff").select("*"),
    supabase.from("shifts").select("*"),
  ]);
  if (events.error) throw events.error;
  if (producers.error) throw producers.error;
  if (staff.error) throw staff.error;
  if (shifts.error) throw shifts.error;
  return {
    events: (events.data ?? []) as Record<string, unknown>[],
    producers: (producers.data ?? []) as Record<string, unknown>[],
    staff: (staff.data ?? []) as Record<string, unknown>[],
    shifts: (shifts.data ?? []) as Record<string, unknown>[],
  };
}

async function generateXlsxBytes(): Promise<Uint8Array> {
  const tables = await fetchAll();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.events), "events");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.producers), "producers");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.staff), "staff");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.shifts), "shifts");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf as ArrayBuffer);
}

export async function runBackup(): Promise<BackupResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.provider_token ?? "";
    if (!token) {
      return {
        ok: false,
        disabled: false,
        message:
          "אין הרשאת גישה ל-Google Drive. התנתק והתחבר מחדש כדי לאשר את ההרשאה.",
      };
    }
    const bytes = await generateXlsxBytes();
    await invoke("drive_backup", {
      xlsxBytes: Array.from(bytes),
      accessToken: token,
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
