-- Auto-update enrichment_status when aircraft_icao is set
CREATE OR REPLACE FUNCTION trigger_update_enrichment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.aircraft_icao IS NOT NULL AND OLD.aircraft_icao IS DISTINCT FROM NEW.aircraft_icao THEN
    NEW.enrichment_status := 'enriched';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS flights_enrichment_status_trigger ON flights;
CREATE TRIGGER flights_enrichment_status_trigger
BEFORE UPDATE ON flights
FOR EACH ROW EXECUTE FUNCTION trigger_update_enrichment_status();
