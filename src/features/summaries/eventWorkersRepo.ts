import type { EventWorkerRow, EventWorkerWithDetails } from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

const SELECT =
  "*, staff:staff(id, full_name, job_title_ids), job_title:job_titles(id, name)";

type EventWorkerRowWithJoin = EventWorkerRow & {
  staff?: { id: number; full_name: string; job_title_ids: number[] | null } | null;
  job_title?: { id: number; name: string } | null;
};

function normalize(row: EventWorkerRowWithJoin): EventWorkerWithDetails {
  const { staff, job_title, ...rest } = row;
  return {
    ...rest,
    staff_name: staff?.full_name ?? "",
    job_title_name: job_title?.name ?? "",
    staff_job_title_ids: staff?.job_title_ids ?? [],
  };
}

export async function listEventWorkers(
  eventId: number,
): Promise<EventWorkerWithDetails[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("event_workers")
      .select(SELECT)
      .eq("event_id", eventId)
      .order("id", { ascending: true });
    if (error) throw error;
    return (data as EventWorkerRowWithJoin[] | null)?.map(normalize) ?? [];
  });
}

export interface EventWorkerInput {
  event_id: number;
  staff_id: number;
  job_title_id: number;
  rate: number;
  hours: number | null;
  notes: string | null;
}

export async function createEventWorker(
  input: EventWorkerInput,
): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("event_workers")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  });
}

export async function updateEventWorker(
  id: number,
  patch: Partial<EventWorkerInput>,
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_workers")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  });
}

export async function deleteEventWorker(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_workers")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
}

export function workerCost(rate: number, hours: number | null): number {
  if (hours == null) return rate;
  return rate * hours;
}
