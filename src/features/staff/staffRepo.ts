import { getDb } from "../../db/client";
import type { StaffRow } from "../../db/types";

export async function listStaff(): Promise<StaffRow[]> {
  const db = await getDb();
  return db.select<StaffRow[]>(
    "SELECT * FROM staff ORDER BY active DESC, full_name ASC",
  );
}

export interface StaffInput {
  full_name: string;
  role: string | null;
  phone: string | null;
  hourly_rate: number | null;
  active: number;
}

export async function createStaff(input: StaffInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO staff (full_name, role, phone, hourly_rate, active)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.full_name, input.role, input.phone, input.hourly_rate, input.active],
  );
  return res.lastInsertId as number;
}

export async function updateStaff(id: number, input: StaffInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE staff
        SET full_name = $1, role = $2, phone = $3,
            hourly_rate = $4, active = $5
      WHERE id = $6`,
    [input.full_name, input.role, input.phone, input.hourly_rate, input.active, id],
  );
}

export async function toggleStaffActive(id: number, active: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE staff SET active = $1 WHERE id = $2", [active, id]);
}

export async function deleteStaff(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM staff WHERE id = $1", [id]);
}
