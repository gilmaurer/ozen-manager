import type { StaffRow } from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

export async function listStaff(): Promise<StaffRow[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .order("active", { ascending: false })
      .order("full_name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as StaffRow[];
  });
}

export interface StaffInput {
  full_name: string;
  role: string | null;
  phone: string | null;
  hourly_rate: number | null;
  active: boolean;
}

export async function createStaff(input: StaffInput): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("staff")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  });
}

export async function updateStaff(id: number, input: StaffInput): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("staff").update(input).eq("id", id);
    if (error) throw error;
  });
}

export async function toggleStaffActive(
  id: number,
  active: boolean,
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("staff")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
  });
}

export async function deleteStaff(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) throw error;
  });
}
