-- Read-only pre-check for db/migrations/0006_flight_lifecycle.sql (ADR 0001 §3). Run it against the
-- target before applying 0006; any row returned would make the migration's assertions abort it
-- (or the projection seed skip a country). Fix the reference data or the offending rows first.
-- It never writes. Kept to four compound terms: D1 rejects larger compound SELECTs.
SELECT CASE WHEN is_upcoming NOT IN (0, 1) THEN 'invalid_upcoming_flag' ELSE 'malformed_upcoming_date' END AS problem,
       user_id, CAST(id AS TEXT) AS ref
FROM flights
WHERE is_upcoming NOT IN (0, 1) OR (is_upcoming = 1 AND strftime('%Y-%m-%dT%H:%M:%fZ', date, '+8 days') IS NULL)
UNION ALL
SELECT CASE WHEN country_code = '' THEN 'empty_visit_country' ELSE 'noncanonical_visit_country' END, user_id, airport_iata
FROM visits WHERE length(country_code) <> 2
UNION ALL
SELECT 'noncanonical_claim_country', user_id, country_code FROM country_claims WHERE length(country_code) <> 2
UNION ALL
SELECT 'noncanonical_ground_country', user_id, country_code FROM ground_visits WHERE length(country_code) <> 2
