import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

export const COLOR_TOKENS = [
  "gray",
  "purple",
  "green",
  "orange",
  "red",
  "yellow",
  "green-muted",
] as const;

export const COLOR_LABELS: Record<string, string> = {
  gray: "אפור",
  purple: "סגול",
  green: "ירוק",
  orange: "כתום",
  red: "אדום",
  yellow: "צהוב",
  "green-muted": "ירוק רך",
};

function slugify(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^\w֐-׿]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `${slug || "opt"}_${suffix}`;
}

export async function createStatus(label: string, color: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_statuses")
      .insert({ code: slugify(label), label: label.trim(), color });
    if (error) throw error;
  });
}

export async function updateStatus(
  id: number,
  patch: { label?: string; color?: string },
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_statuses")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  });
}

export async function deleteStatus(id: number, code: string): Promise<void> {
  const { count, error: countErr } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("status", code);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) {
    throw new Error(`הסטטוס בשימוש ב-${count} אירועים.`);
  }
  const { error } = await supabase.from("event_statuses").delete().eq("id", id);
  if (error) throw error;
}

export async function createType(label: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_types")
      .insert({ code: slugify(label), label: label.trim() });
    if (error) throw error;
  });
}

export async function updateType(
  id: number,
  patch: { label?: string },
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("event_types")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  });
}

export async function deleteType(id: number, code: string): Promise<void> {
  const { count, error: countErr } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("type", code);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) {
    throw new Error(`הסוג בשימוש ב-${count} אירועים.`);
  }
  const { error } = await supabase.from("event_types").delete().eq("id", id);
  if (error) throw error;
}
