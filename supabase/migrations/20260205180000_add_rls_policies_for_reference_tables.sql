-- RLS Policies for Reference Tables
-- These tables contain static reference data that should be publicly readable
-- No INSERT/UPDATE/DELETE policies = only service role can modify

-- 1. _code_adjectives (invite code word list)
CREATE POLICY "Allow public read access to code adjectives"
  ON _code_adjectives FOR SELECT USING (true);

-- 2. _code_nouns (invite code word list)
CREATE POLICY "Allow public read access to code nouns"
  ON _code_nouns FOR SELECT USING (true);

-- 3. aircraft_reference (aircraft type lookup)
CREATE POLICY "Allow public read access to aircraft reference"
  ON aircraft_reference FOR SELECT USING (true);

-- 4. airports_reference (airport lookup)
CREATE POLICY "Allow public read access to airports reference"
  ON airports_reference FOR SELECT USING (true);
