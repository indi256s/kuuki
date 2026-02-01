-- Add aircraft_lookup_attempts column to flights table
-- Tracks how many times we've tried to look up the aircraft type
ALTER TABLE flights
ADD COLUMN IF NOT EXISTS aircraft_lookup_attempts INTEGER DEFAULT 0;

-- Create user_aircraft table for storing user-specific aircraft types
-- This allows storing aircraft types that aren't in our static database
CREATE TABLE IF NOT EXISTS user_aircraft (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  icao VARCHAR(4) NOT NULL,
  iata VARCHAR(3),
  name VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(50),
  model VARCHAR(50),
  type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, icao)
);

-- Enable RLS on user_aircraft
ALTER TABLE user_aircraft ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own aircraft
CREATE POLICY "Users can view own aircraft" ON user_aircraft
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own aircraft
CREATE POLICY "Users can insert own aircraft" ON user_aircraft
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own aircraft
CREATE POLICY "Users can update own aircraft" ON user_aircraft
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own aircraft
CREATE POLICY "Users can delete own aircraft" ON user_aircraft
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_aircraft_user_id ON user_aircraft(user_id);
CREATE INDEX IF NOT EXISTS idx_user_aircraft_icao ON user_aircraft(icao);

-- Create index on flights for pending aircraft lookup queries
CREATE INDEX IF NOT EXISTS idx_flights_pending_aircraft
  ON flights(user_id, aircraft_icao, aircraft_lookup_attempts)
  WHERE aircraft_icao IS NULL AND aircraft_lookup_attempts < 3;

-- Comment explaining the column
COMMENT ON COLUMN flights.aircraft_lookup_attempts IS 'Number of times AI enrichment has tried to identify the aircraft type';
COMMENT ON TABLE user_aircraft IS 'User-specific aircraft types discovered via AI enrichment or manual entry';
