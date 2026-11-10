-- A manual air visit records country evidence without creating a canonical flight.
-- Rebuild to widen the original entry_method CHECK; preserve all historical evidence verbatim.
CREATE TABLE ground_visits_air (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  visit_year   INTEGER,
  note         TEXT CHECK (note IS NULL OR length(note) <= 200),
  entry_method TEXT CHECK (entry_method IS NULL OR entry_method IN ('air','land','sea')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  mode         TEXT CHECK (mode IS NULL OR (mode IN ('rail','road') AND entry_method IS 'land')),
  linked_flight_id INTEGER REFERENCES flights(id) ON DELETE SET NULL
);

INSERT INTO ground_visits_air (id,user_id,country_code,visit_year,note,entry_method,created_at,mode)
  SELECT id,user_id,country_code,visit_year,note,entry_method,created_at,mode FROM ground_visits;

DROP TABLE ground_visits;
ALTER TABLE ground_visits_air RENAME TO ground_visits;
CREATE INDEX idx_ground_visits_user_country ON ground_visits(user_id, country_code);
