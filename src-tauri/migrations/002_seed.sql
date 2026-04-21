-- Events: mix of Hebrew and English names, relative dates so seed always feels fresh.
INSERT INTO events (name, starts_at, ends_at, venue_area, notes, status) VALUES
  ('ערב טראנס',          datetime('now', '+3 hours'),  datetime('now', '+9 hours'),  'מועדון ראשי',  'DJ אורח מברלין', 'published'),
  ('Techno Night',        datetime('now', '+3 days', 'start of day', '+22 hours'), datetime('now', '+4 days', 'start of day', '+4 hours'), 'Main Floor',   'Lineup TBD',    'published'),
  ('מסיבת שנות ה־90',     datetime('now', '+7 days', 'start of day', '+22 hours'), datetime('now', '+8 days', 'start of day', '+3 hours'), 'קומה עליונה', 'dress code: retro', 'draft'),
  ('Ladies Night',        datetime('now', '+10 days', 'start of day', '+22 hours'), datetime('now', '+11 days', 'start of day', '+4 hours'), 'Lounge',      'כניסה חינם עד חצות', 'published'),
  ('Opening Party',       datetime('now', '-14 days', 'start of day', '+22 hours'), datetime('now', '-13 days', 'start of day', '+4 hours'), 'מועדון ראשי', 'past event',   'archived');

-- Staff: mix of Hebrew and English names; role labels in Hebrew.
INSERT INTO staff (full_name, role, phone, hourly_rate, active) VALUES
  ('יוסי כהן',     'ברמן',          '050-1234567', 55.0, 1),
  ('David Levi',    'DJ',            '052-2345678', 80.0, 1),
  ('מיכל רוזן',     'מלצרית',        '054-3456789', 50.0, 1),
  ('Sarah K.',      'מנהל משמרת',    '053-4567890', 90.0, 1),
  ('אבי מזרחי',     'אבטחה',         '050-5678901', 65.0, 1),
  ('Tom Fischer',   'דלת',           '052-6789012', 60.0, 0);

-- Shifts: at least one today, distributed across upcoming events.
-- Event 1 ("ערב טראנס") — today
INSERT INTO shifts (event_id, staff_id, starts_at, ends_at, position, notes) VALUES
  (1, 1, datetime('now', '+2 hours'), datetime('now', '+10 hours'), 'בר ראשי', NULL),
  (1, 2, datetime('now', '+3 hours'), datetime('now', '+9 hours'),  'DJ booth', 'Main set'),
  (1, 5, datetime('now', '+2 hours'), datetime('now', '+10 hours'), 'כניסה',   NULL);

-- Event 2 ("Techno Night")
INSERT INTO shifts (event_id, staff_id, starts_at, ends_at, position, notes) VALUES
  (2, 3, datetime('now', '+3 days', 'start of day', '+21 hours'), datetime('now', '+4 days', 'start of day', '+4 hours'), 'Waitress floor 1', NULL),
  (2, 4, datetime('now', '+3 days', 'start of day', '+21 hours'), datetime('now', '+4 days', 'start of day', '+4 hours'), 'Shift lead',       NULL),
  (2, 5, datetime('now', '+3 days', 'start of day', '+21 hours'), datetime('now', '+4 days', 'start of day', '+4 hours'), 'אבטחה',           NULL);

-- Event 3 ("מסיבת שנות ה־90")
INSERT INTO shifts (event_id, staff_id, starts_at, ends_at, position, notes) VALUES
  (3, 1, datetime('now', '+7 days', 'start of day', '+21 hours'), datetime('now', '+8 days', 'start of day', '+3 hours'), 'בר עליון',  NULL),
  (3, 3, datetime('now', '+7 days', 'start of day', '+21 hours'), datetime('now', '+8 days', 'start of day', '+3 hours'), 'floor', NULL);

-- Event 4 ("Ladies Night")
INSERT INTO shifts (event_id, staff_id, starts_at, ends_at, position, notes) VALUES
  (4, 2, datetime('now', '+10 days', 'start of day', '+21 hours'), datetime('now', '+11 days', 'start of day', '+4 hours'), 'DJ',  NULL),
  (4, 4, datetime('now', '+10 days', 'start of day', '+21 hours'), datetime('now', '+11 days', 'start of day', '+4 hours'), 'Shift lead', NULL);
