import type { ProducerRow } from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

export type ProducerWithCount = ProducerRow & { event_count: number };

export interface ProducerInput {
  name: string;
  phone: string | null;
  email: string | null;
}

export async function listProducers(): Promise<ProducerWithCount[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("producers")
      .select("*, events(id)")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((p) => {
      const { events, ...rest } = p as ProducerRow & { events: { id: number }[] };
      return { ...rest, event_count: events?.length ?? 0 };
    });
  });
}

export async function getProducer(id: number): Promise<ProducerRow | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("producers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as ProducerRow | null;
  });
}

export async function createProducer(input: ProducerInput): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("producers")
      .insert({
        name: input.name.trim(),
        phone: input.phone,
        email: input.email,
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  });
}

export async function updateProducer(
  id: number,
  input: ProducerInput,
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("producers")
      .update({
        name: input.name.trim(),
        phone: input.phone,
        email: input.email,
      })
      .eq("id", id);
    if (error) throw error;
  });
}

export async function deleteProducer(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("producers").delete().eq("id", id);
    if (error) throw error;
  });
}

export async function countEventsByProducer(id: number): Promise<number> {
  return withRetry(async () => {
    const { count, error } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("producer_id", id);
    if (error) throw error;
    return count ?? 0;
  });
}

export async function findProducerByName(
  name: string,
): Promise<ProducerRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("producers")
      .select("*")
      .ilike("name", trimmed)
      .maybeSingle();
    if (error) throw error;
    return data as ProducerRow | null;
  });
}

export async function resolveOrCreateProducerByName(
  name: string,
): Promise<number> {
  const existing = await findProducerByName(name);
  if (existing) return existing.id;
  return createProducer({ name, phone: null, email: null });
}
