import type { EventTypeStaffRow } from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

export async function listEventTypeStaff(
  eventTypeCode: string,
  subTypeCode: string | null = null,
): Promise<EventTypeStaffRow[]> {
  return withRetry(async () => {
    let query = supabase
      .from("event_type_staff")
      .select("*")
      .eq("event_type_code", eventTypeCode)
      .order("id", { ascending: true });
    query = subTypeCode == null
      ? query.is("sub_type", null)
      : query.eq("sub_type", subTypeCode);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as EventTypeStaffRow[];
  });
}

export async function listAllEventTypeStaff(): Promise<EventTypeStaffRow[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("event_type_staff")
      .select("*")
      .order("event_type_code", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []) as EventTypeStaffRow[];
  });
}

export interface EventTypeStaffInput {
  event_type_code: string;
  sub_type: string | null;
  role: string;
  quantity: number;
  cost: number;
}

export async function createEventTypeStaff(
  input: EventTypeStaffInput,
): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("event_type_staff")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  });
}

export async function updateEventTypeStaff(
  id: number,
  patch: { role?: string; quantity?: number; cost?: number },
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_type_staff")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  });
}

export async function deleteEventTypeStaff(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_type_staff")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
}
