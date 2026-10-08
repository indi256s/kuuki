ALTER TABLE flights ADD COLUMN duration_source TEXT
  CHECK (duration_source IS NULL OR duration_source IN ('times','route_median','schedule','estimate'));
ALTER TABLE flights ADD COLUMN zones_overflown INTEGER
  CHECK (zones_overflown IS NULL OR zones_overflown >= 0);
ALTER TABLE profiles ADD COLUMN overview_prefs TEXT
  CHECK (overview_prefs IS NULL OR (json_valid(overview_prefs) AND length(overview_prefs) <= 8192));
CREATE INDEX idx_flights_route_times ON flights(origin, destination, duration_minutes)
  WHERE duration_source = 'times';
