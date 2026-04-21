import { getDb } from "../../db/client";
import type {
  EventStatus,
  EventType,
  EventWithProducer,
} from "../../db/types";

const SELECT_WITH_PRODUCER = `
  SELECT events.*, producers.name AS producer_name
  FROM events
  LEFT JOIN producers ON events.producer_id = producers.id
`;

export async function listEvents(): Promise<EventWithProducer[]> {
  const db = await getDb();
  return db.select<EventWithProducer[]>(
    `${SELECT_WITH_PRODUCER} ORDER BY events.date ASC, events.id ASC`,
  );
}

export async function listUpcomingEvents(
  days = 14,
): Promise<EventWithProducer[]> {
  const db = await getDb();
  return db.select<EventWithProducer[]>(
    `${SELECT_WITH_PRODUCER}
     WHERE events.date >= date('now')
       AND events.date <= date('now', '+' || $1 || ' days')
     ORDER BY events.date ASC`,
    [days],
  );
}

export async function getEvent(
  id: number,
): Promise<EventWithProducer | null> {
  const db = await getDb();
  const rows = await db.select<EventWithProducer[]>(
    `${SELECT_WITH_PRODUCER} WHERE events.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listEventsByProducer(
  producerId: number,
): Promise<EventWithProducer[]> {
  const db = await getDb();
  return db.select<EventWithProducer[]>(
    `${SELECT_WITH_PRODUCER}
     WHERE events.producer_id = $1
     ORDER BY events.date ASC`,
    [producerId],
  );
}

export interface EventInput {
  name: string;
  date: string;
  type: EventType | null;
  producer_id: number | null;
  status: EventStatus;
  deal: string | null;
  ticket_link: string | null;
  notes: string | null;
}

export async function createEvent(input: EventInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO events (name, date, type, producer_id, status, deal, ticket_link, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.name,
      input.date,
      input.type,
      input.producer_id,
      input.status,
      input.deal,
      input.ticket_link,
      input.notes,
    ],
  );
  return res.lastInsertId as number;
}

export async function updateEvent(id: number, input: EventInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE events
        SET name = $1, date = $2, type = $3, producer_id = $4,
            status = $5, deal = $6, ticket_link = $7, notes = $8
      WHERE id = $9`,
    [
      input.name,
      input.date,
      input.type,
      input.producer_id,
      input.status,
      input.deal,
      input.ticket_link,
      input.notes,
      id,
    ],
  );
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM events WHERE id = $1", [id]);
}
