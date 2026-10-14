-- The aircraft picker already offers AT76; admit it on existing databases too.
INSERT INTO aircraft_reference
  (icao, iata, name, manufacturer, model, type, engine_type, engine_count)
VALUES
  ('AT76', NULL, 'ATR 72-600', 'ATR', '72-600', 'turboprop', 'turboprop', 2)
ON CONFLICT (icao) DO NOTHING;
