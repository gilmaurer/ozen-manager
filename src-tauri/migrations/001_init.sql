CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    starts_at   TEXT    NOT NULL,
    ends_at     TEXT,
    venue_area  TEXT,
    notes       TEXT,
    status      TEXT    NOT NULL DEFAULT 'draft',
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);

CREATE TABLE IF NOT EXISTS staff (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name    TEXT    NOT NULL,
    role         TEXT,
    phone        TEXT,
    hourly_rate  REAL,
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shifts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    staff_id   INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    starts_at  TEXT,
    ends_at    TEXT,
    position   TEXT,
    notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_shifts_event_id ON shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_shifts_starts_at ON shifts(starts_at);
