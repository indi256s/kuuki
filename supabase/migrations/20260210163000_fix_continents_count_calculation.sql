CREATE OR REPLACE FUNCTION recalculate_user_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_flights INT;
  v_total_distance BIGINT;
  v_countries INT;
  v_cities INT;
  v_airlines INT;
  v_aircraft INT;
  v_continents INT;
  v_longest_flight INT;
  v_has_night_departure BOOLEAN;
  v_airports INT;
  v_total_duration BIGINT;
BEGIN
  -- Count completed flights + aggregates
  SELECT
    COUNT(*),
    COALESCE(SUM(distance_km), 0),
    COALESCE(MAX(duration_minutes), 0),
    COALESCE(SUM(duration_minutes), 0)
  INTO v_total_flights, v_total_distance, v_longest_flight, v_total_duration
  FROM flights
  WHERE user_id = p_user_id AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  -- Count unique airlines
  SELECT COUNT(DISTINCT airline_iata) INTO v_airlines
  FROM flights
  WHERE user_id = p_user_id
    AND airline_iata IS NOT NULL
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  -- Count unique aircraft
  SELECT COUNT(DISTINCT aircraft_icao) INTO v_aircraft
  FROM flights
  WHERE user_id = p_user_id
    AND aircraft_icao IS NOT NULL
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  -- Count unique airports from visits table
  SELECT COUNT(DISTINCT airport_iata) INTO v_airports
  FROM visits
  WHERE user_id = p_user_id
    AND airport_iata IS NOT NULL;

  -- Count countries from visits table
  SELECT COUNT(DISTINCT country_code) INTO v_countries
  FROM visits
  WHERE user_id = p_user_id;

  IF v_countries = 0 OR v_countries IS NULL THEN
    v_countries := 0;
  END IF;

  -- Count cities from visits
  SELECT COUNT(DISTINCT city) INTO v_cities
  FROM visits
  WHERE user_id = p_user_id;

  IF v_cities IS NULL THEN
    v_cities := 0;
  END IF;

  -- Count continents from country codes in visits
  SELECT COUNT(DISTINCT
    CASE
      WHEN country_code IN ('US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'JM', 'HT', 'DO', 'PR', 'BS', 'TT', 'BB') THEN 'NA'
      WHEN country_code IN ('BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR') THEN 'SA'
      WHEN country_code IN ('GB', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'PL', 'CZ', 'HU', 'RO', 'BG', 'GR', 'SE', 'NO', 'DK', 'FI', 'IE', 'LU', 'SK', 'SI', 'HR', 'RS', 'UA', 'BY', 'LT', 'LV', 'EE', 'MD', 'AL', 'MK', 'ME', 'BA', 'XK', 'IS', 'MT', 'CY', 'MC', 'SM', 'AD', 'LI', 'VA') THEN 'EU'
      WHEN country_code IN ('RU', 'CN', 'JP', 'KR', 'IN', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK', 'MO', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'MN', 'NP', 'BD', 'LK', 'PK', 'AF', 'IR', 'IQ', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'LB', 'SY', 'IL', 'PS', 'TR', 'GE', 'AM', 'AZ', 'MM', 'LA', 'KH', 'BN', 'TL') THEN 'AS'
      WHEN country_code IN ('AU', 'NZ', 'FJ', 'PG', 'NC', 'PF', 'WS', 'TO', 'VU', 'SB', 'GU', 'FM', 'MH', 'PW', 'KI', 'NR', 'TV', 'CK', 'NU', 'TK', 'WF', 'AS') THEN 'OC'
      WHEN country_code IN ('ZA', 'EG', 'MA', 'DZ', 'TN', 'LY', 'NG', 'KE', 'ET', 'GH', 'TZ', 'UG', 'SD', 'SS', 'SN', 'CI', 'CM', 'ZW', 'AO', 'MZ', 'MG', 'ZM', 'BW', 'NA', 'MU', 'RE', 'RW', 'BJ', 'TG', 'ML', 'BF', 'NE', 'TD', 'SO', 'DJ', 'ER', 'MW', 'LS', 'SZ', 'GM', 'GN', 'GW', 'SL', 'LR', 'GA', 'CG', 'CD', 'CF', 'GQ', 'ST', 'CV', 'KM', 'SC', 'YT') THEN 'AF'
      ELSE 'OTHER'
    END
  ) INTO v_continents
  FROM visits
  WHERE user_id = p_user_id AND country_code IS NOT NULL;

  -- Check for night departures (00:00-05:00)
  SELECT EXISTS(
    SELECT 1 FROM flights
    WHERE user_id = p_user_id
      AND departure_time IS NOT NULL
      AND (departure_time::time >= '00:00:00' AND departure_time::time < '05:00:00')
      AND (is_upcoming IS NULL OR is_upcoming = FALSE)
  ) INTO v_has_night_departure;

  -- Upsert stats
  INSERT INTO user_stats (
    user_id, total_flights, total_distance_km, countries_count, cities_count,
    airlines_count, aircraft_count, continents_count, longest_flight_minutes,
    has_night_departure, airports_count, total_duration_minutes, updated_at
  ) VALUES (
    p_user_id, v_total_flights, v_total_distance, v_countries, v_cities,
    v_airlines, v_aircraft, v_continents, v_longest_flight,
    v_has_night_departure, v_airports, v_total_duration, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_flights = EXCLUDED.total_flights,
    total_distance_km = EXCLUDED.total_distance_km,
    countries_count = EXCLUDED.countries_count,
    cities_count = EXCLUDED.cities_count,
    airlines_count = EXCLUDED.airlines_count,
    aircraft_count = EXCLUDED.aircraft_count,
    continents_count = EXCLUDED.continents_count,
    longest_flight_minutes = EXCLUDED.longest_flight_minutes,
    has_night_departure = EXCLUDED.has_night_departure,
    airports_count = EXCLUDED.airports_count,
    total_duration_minutes = EXCLUDED.total_duration_minutes,
    updated_at = NOW();
END;
$$;
