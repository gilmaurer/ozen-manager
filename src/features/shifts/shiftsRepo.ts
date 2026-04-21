import { getDb } from "../../db/client";
import type { ShiftRow, ShiftWithStaff } from "../../db/types";

export async function listShiftsForEvent(eventId: number): Promise<ShiftWithStaff[]> {
  const db = await getDb();
  return db.select<ShiftWithStaff[]>(
    `SELECT s.*, st.full_name AS staff_name, e.name AS event_name
       FROM shifts s
       LEFT JOIN staff st ON st.id = s.staff_id
       JOIN events e ON e.id = s.event_id
      WHERE s.event_id = $1
      ORDER BY s.starts_at ASC`,
    [eventId],
  );
}

export async function listTodaysShifts(): Promise<ShiftWithStaff[]> {
  const db = await getDb();
  return db.select<ShiftWithStaff[]>(
    `SELECT s.*, st.full_name AS staff_name, e.name AS event_name
       FROM shifts s
       LEFT JOIN staff st ON st.id = s.staff_id
       JOIN events e ON e.id = s.event_id
      WHERE date(s.starts_at) = date('now', 'localtime')
         OR date(s.ends_at)   = date('now', 'localtime')
         OR (s.starts_at <= datetime('now') AND s.ends_at >= datetime('now'))
      ORDER BY s.starts_at ASC`,
  );
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
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO shifts (event_id, staff_id, starts_at, ends_at, position, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.event_id,
      input.staff_id,
      input.starts_at,
      input.ends_at,
      input.position,
      input.notes,
    ],
  );
  return res.lastInsertId as number;
}

export async function updateShift(id: number, input: ShiftInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE shifts
        SET event_id = $1, staff_id = $2, starts_at = $3,
            ends_at = $4, position = $5, notes = $6
      WHERE id = $7`,
    [
      input.event_id,
      input.staff_id,
      input.starts_at,
      input.ends_at,
      input.position,
      input.notes,
      id,
    ],
  );
}

export async function deleteShift(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM shifts WHERE id = $1", [id]);
}

export type { ShiftRow };
