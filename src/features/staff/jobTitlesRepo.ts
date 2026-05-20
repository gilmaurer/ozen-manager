import type { JobTitleRow } from "../../db/types";
import { supabase } from "../../db/supabase";
import { withRetry } from "../../services/network";

export async function listJobTitles(): Promise<JobTitleRow[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("job_titles")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as JobTitleRow[];
  });
}

export interface JobTitleInput {
  name: string;
  default_rate: number | null;
}

export async function createJobTitle(input: JobTitleInput): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("job_titles")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  });
}

export async function updateJobTitle(
  id: number,
  patch: Partial<JobTitleInput>,
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("job_titles").update(patch).eq("id", id);
    if (error) throw error;
  });
}

export async function deleteJobTitle(id: number): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.from("job_titles").delete().eq("id", id);
    if (error) throw error;
  });
}
