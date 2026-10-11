CREATE TABLE gardens (
  garden_key TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  requested_year INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  next_refresh_at INTEGER NOT NULL,
  lock_until INTEGER NOT NULL DEFAULT 0,
  lock_token TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  CHECK (requested_year = 0 OR requested_year BETWEEN 2008 AND 2100)
);
CREATE INDEX gardens_due ON gardens(next_refresh_at, lock_until);
