-- Wipe event rows (cascades to shifts via FK ON DELETE CASCADE).
DELETE FROM events;

-- Drop starts_at index before dropping the column it covers.
DROP INDEX IF EXISTS idx_events_starts_at;

-- Drop legacy columns.
ALTER TABLE events DROP COLUMN starts_at;
ALTER TABLE events DROP COLUMN ends_at;
ALTER TABLE events DROP COLUMN venue_area;

-- New fields.
ALTER TABLE events ADD COLUMN date        TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN type        TEXT;
ALTER TABLE events ADD COLUMN producer    TEXT;
ALTER TABLE events ADD COLUMN deal        TEXT;
ALTER TABLE events ADD COLUMN ticket_link TEXT;

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Re-seed with rows spanning past/today/future and all new statuses.
INSERT INTO events (name, date, type, producer, status, deal, ticket_link, notes) VALUES
  ('ערב טראנס',         date('now'),                 'party',         'דני פרודקשן',  'signed',           '8000 ₪ + 10% מהבר',  'https://tickets.example/trance',  'DJ אורח מברלין'),
  ('Techno Night',       date('now', '+3 days'),      'party',         'Noam Events',  'draft',            'בהמתנה לחוזה',        NULL,                               NULL),
  ('סטנדאפ של שחר',      date('now', '+7 days'),      'standup',       'מפיקים בע"מ',  'waiting_invoice',  '5000 ₪ פיקס',         'https://tickets.example/shahar',   'dress code: smart'),
  ('הרצאה: היסטוריה',    date('now', '+14 days'),     'lecture',       'Gil',          'draft',            NULL,                   NULL,                               NULL),
  ('Opening Party',      date('now', '-14 days'),     'concert',       'Noam Events',  'done',             '12000 ₪',              NULL,                               'past event');
