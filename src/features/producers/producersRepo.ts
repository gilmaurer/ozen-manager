import { getDb } from "../../db/client";
import type { ProducerRow } from "../../db/types";

export type ProducerWithCount = ProducerRow & { event_count: number };

export interface ProducerInput {
  name: string;
  phone: string | null;
}

export async function listProducers(): Promise<ProducerWithCount[]> {
  const db = await getDb();
  return db.select<ProducerWithCount[]>(
    `SELECT producers.*, COUNT(events.id) AS event_count
     FROM producers
     LEFT JOIN events ON events.producer_id = producers.id
     GROUP BY producers.id
     ORDER BY producers.name COLLATE NOCASE ASC`,
  );
}

export async function getProducer(id: number): Promise<ProducerRow | null> {
  const db = await getDb();
  const rows = await db.select<ProducerRow[]>(
    "SELECT * FROM producers WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createProducer(input: ProducerInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO producers (name, phone) VALUES ($1, $2)`,
    [input.name.trim(), input.phone],
  );
  return res.lastInsertId as number;
}

export async function updateProducer(
  id: number,
  input: ProducerInput,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE producers SET name = $1, phone = $2 WHERE id = $3`,
    [input.name.trim(), input.phone, id],
  );
}

export async function deleteProducer(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM producers WHERE id = $1", [id]);
}

export async function countEventsByProducer(id: number): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>(
    "SELECT COUNT(*) AS c FROM events WHERE producer_id = $1",
    [id],
  );
  return rows[0]?.c ?? 0;
}

export async function findProducerByName(
  name: string,
): Promise<ProducerRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const db = await getDb();
  const rows = await db.select<ProducerRow[]>(
    "SELECT * FROM producers WHERE name = $1 COLLATE NOCASE",
    [trimmed],
  );
  return rows[0] ?? null;
}

export async function resolveOrCreateProducerByName(
  name: string,
): Promise<number> {
  const existing = await findProducerByName(name);
  if (existing) return existing.id;
  return createProducer({ name, phone: null });
}
