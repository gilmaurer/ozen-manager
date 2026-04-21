-- 1. Create producers table (case-insensitive unique on name).
CREATE TABLE producers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL COLLATE NOCASE UNIQUE,
  phone      TEXT,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seed producers from current distinct events.producer values.
INSERT OR IGNORE INTO producers (name)
SELECT DISTINCT TRIM(producer)
FROM events
WHERE producer IS NOT NULL AND TRIM(producer) <> '';

-- 3. Add FK column to events (RESTRICT: can't drop a producer that has events).
ALTER TABLE events ADD COLUMN producer_id INTEGER REFERENCES producers(id) ON DELETE RESTRICT;

-- 4. Backfill producer_id by matching on name (NOCASE via the producers.name collation).
UPDATE events
SET producer_id = (
  SELECT id FROM producers WHERE producers.name = events.producer
)
WHERE producer IS NOT NULL AND TRIM(producer) <> '';

-- 5. Drop the now-redundant text column.
ALTER TABLE events DROP COLUMN producer;

CREATE INDEX IF NOT EXISTS idx_events_producer_id ON events(producer_id);
