import { getDb } from "../../db/client";
import type { EventRow, EventStatus } from "../../db/types";

export async function listEvents(): Promise<EventRow[]> {
  const db = await getDb();
  return db.select<EventRow[]>("SELECT * FROM events ORDER BY starts_at ASC");
}

export async function listUpcomingEvents(days = 14): Promise<EventRow[]> {
  const db = await getDb();
  return db.select<EventRow[]>(
    `SELECT * FROM events
     WHERE starts_at >= datetime('now')
       AND starts_at <= datetime('now', '+' || $1 || ' days')
     ORDER BY starts_at ASC`,
    [days],
  );
}

export async function getEvent(id: number): Promise<EventRow | null> {
  const db = await getDb();
  const rows = await db.select<EventRow[]>(
    "SELECT * FROM events WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

export interface EventInput {
  name: string;
  starts_at: string;
  ends_at: string | null;
  venue_area: string | null;
  notes: string | null;
  status: EventStatus;
}

export async function createEvent(input: EventInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO events (name, starts_at, ends_at, venue_area, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.name,
      input.starts_at,
      input.ends_at,
      input.venue_area,
      input.notes,
      input.status,
    ],
  );
  return res.lastInsertId as number;
}

export async function updateEvent(id: number, input: EventInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE events
        SET name = $1, starts_at = $2, ends_at = $3,
            venue_area = $4, notes = $5, status = $6
      WHERE id = $7`,
    [
      input.name,
      input.starts_at,
      input.ends_at,
      input.venue_area,
      input.notes,
      input.status,
      id,
    ],
  );
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM events WHERE id = $1", [id]);
}
