-- ===== RSVP — FinanceApp v2 =====
-- Execute no SQL Editor do Supabase
CREATE TABLE IF NOT EXISTS rsvps (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  confirmedat TEXT DEFAULT (now()::text)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_name ON rsvps(name);
CREATE INDEX IF NOT EXISTS idx_rsvps_confirmedat ON rsvps(confirmedat);
