import type { ShiftRow, ShiftWithStaff } from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

const SELECT =
  "*, staff:staff(id, full_name), event:events(id, name)";

type ShiftRowWithJoin = ShiftRow & {
  staff?: { id: number; full_name: string } | null;
  event?: { id: number; name: string } | null;
};

function normalize(row: ShiftRowWithJoin): ShiftWithStaff {
  const { staff, event, ...rest } = row;
  return {
    ...rest,
    staff_name: staff?.full_name ?? null,
    event_name: event?.name ?? "",
  };
}

export async function listShiftsForEvent(
  eventId: number,
): Promise<ShiftWithStaff[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("shifts")
      .select(SELECT)
      .eq("event_id", eventId)
      .order("starts_at", { ascending: true });
    if (error) throw error;
    return (data as ShiftRowWithJoin[] | null)?.map(normalize) ?? [];
  });
}

export async function listTodaysShifts(): Promise<ShiftWithStaff[]> {
  return withRetry(async () => {
    // Today's shifts = any shift whose start or end falls on today's local date,
    // or that spans midnight.
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const { data, error } = await supabase
      .from("shifts")
      .select(SELECT)
      .or(
        `and(starts_at.gte.${start.toISOString()},starts_at.lte.${end.toISOString()}),and(ends_at.gte.${start.toISOString()},ends_at.lte.${end.toISOString()})`,
      )
      .order("starts_at", { ascending: true });
    if (error) throw error;
    return (data as ShiftRowWithJoin[] | null)?.map(normalize) ?? [];
  });
}

export interface ShiftInput {
  event_id: number;
  staff_id: number | null;
  starts_at: string | null;
  ends_at: string | null;
  position: string | null;
  notes: string | null;
}

export async function createShift(input: ShiftInput): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("shifts")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  });
}

export async function updateShift(id: number, input: ShiftInput): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("shifts").update(input).eq("id", id);
    if (error) throw error;
  });
}

export async function deleteShift(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) throw error;
  });
}

export type { ShiftRow };
