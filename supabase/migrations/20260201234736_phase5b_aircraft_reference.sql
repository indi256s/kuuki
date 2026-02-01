-- Phase 5b: Aircraft Reference Table & Advanced Stats Updates
-- Adds aircraft_reference table for proper manufacturer/type lookups
-- Updates compute functions to use the reference table instead of pattern matching
-- Adds aircraft_type_breakdown and region_breakdown columns

-- ============================================================================
-- 1. Aircraft Reference Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS aircraft_reference (
  icao TEXT PRIMARY KEY,
  iata TEXT,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- widebody|narrowbody|regional|bizjet|turboprop|piston
  engine_type TEXT NOT NULL,  -- jet|turboprop|piston
  engine_count INTEGER NOT NULL
);

-- Create index for fast manufacturer lookups
CREATE INDEX IF NOT EXISTS idx_aircraft_reference_manufacturer ON aircraft_reference(manufacturer);
CREATE INDEX IF NOT EXISTS idx_aircraft_reference_type ON aircraft_reference(type);

-- ============================================================================
-- 2. Seed Aircraft Data (215 aircraft types)
-- ============================================================================

INSERT INTO aircraft_reference (icao, iata, manufacturer, model, name, type, engine_type, engine_count) VALUES
  ('A124', 'A4F', 'Antonov', 'AN-124 Ruslan', 'Antonov AN-124 Ruslan', 'widebody', 'jet', 4),
  ('A140', 'A40', 'Antonov', 'AN-140', 'Antonov AN-140', 'turboprop', 'turboprop', 2),
  ('A148', 'A81', 'Antonov', 'An-148', 'Antonov An-148', 'regional', 'jet', 2),
  ('A158', 'A58', 'Antonov', 'An-158', 'Antonov An-158', 'regional', 'jet', 2),
  ('A19N', '31N', 'Airbus', 'A319neo', 'Airbus A319neo', 'narrowbody', 'jet', 2),
  ('A20N', '32N', 'Airbus', 'A320neo', 'Airbus A320neo', 'narrowbody', 'jet', 2),
  ('A21N', '32Q', 'Airbus', 'A321neo', 'Airbus A321neo', 'narrowbody', 'jet', 2),
  ('A225', 'A25', 'Antonov', 'An-225 Mriya', 'Antonov An-225 Mriya', 'widebody', 'jet', 6),
  ('A306', 'AB6', 'Airbus', 'A300-600', 'Airbus A300-600', 'widebody', 'jet', 2),
  ('A30B', 'AB3', 'Airbus', 'A300', 'Airbus A300', 'widebody', 'jet', 2),
  ('A310', '310', 'Airbus', 'A310', 'Airbus A310', 'widebody', 'jet', 2),
  ('A318', '318', 'Airbus', 'A318', 'Airbus A318', 'narrowbody', 'jet', 2),
  ('A319', '319', 'Airbus', 'A319', 'Airbus A319', 'narrowbody', 'jet', 2),
  ('A320', '320', 'Airbus', 'A320', 'Airbus A320', 'narrowbody', 'jet', 2),
  ('A321', '321', 'Airbus', 'A321', 'Airbus A321', 'narrowbody', 'jet', 2),
  ('A332', '332', 'Airbus', 'A330-200', 'Airbus A330-200', 'widebody', 'jet', 2),
  ('A333', '333', 'Airbus', 'A330-300', 'Airbus A330-300', 'widebody', 'jet', 2),
  ('A338', '338', 'Airbus', 'A330-800neo', 'Airbus A330-800neo', 'widebody', 'jet', 2),
  ('A339', '339', 'Airbus', 'A330-900neo', 'Airbus A330-900neo', 'widebody', 'jet', 2),
  ('A342', '342', 'Airbus', 'A340-200', 'Airbus A340-200', 'widebody', 'jet', 4),
  ('A343', '343', 'Airbus', 'A340-300', 'Airbus A340-300', 'widebody', 'jet', 4),
  ('A345', '345', 'Airbus', 'A340-500', 'Airbus A340-500', 'widebody', 'jet', 4),
  ('A346', '346', 'Airbus', 'A340-600', 'Airbus A340-600', 'widebody', 'jet', 4),
  ('A359', '359', 'Airbus', 'A350-900', 'Airbus A350-900', 'widebody', 'jet', 2),
  ('A35K', '351', 'Airbus', 'A350-1000', 'Airbus A350-1000', 'widebody', 'jet', 2),
  ('A388', '388', 'Airbus', 'A380-800', 'Airbus A380-800', 'widebody', 'jet', 4),
  ('A3ST', 'ABB', 'Airbus', 'A300-600ST Super Transporter / Beluga', 'Airbus A300-600ST Super Transporter / Beluga', 'widebody', 'jet', 2),
  ('A748', 'HS7', 'Hawker Siddeley', 'HS 748', 'Hawker Siddeley HS 748', 'turboprop', 'turboprop', 2),
  ('AC68', 'ACP', 'Gulfstream', 'Gulfstream/Rockwell (Aero) Commander', 'Gulfstream/Rockwell (Aero) Commander', 'piston', 'jet', 2),
  ('AC90', 'ACT', 'Gulfstream', 'Gulfstream/Rockwell (Aero) Turbo Commander', 'Gulfstream/Rockwell (Aero) Turbo Commander', 'turboprop', 'turboprop', 2),
  ('AN12', 'ANF', 'Antonov', 'AN-12', 'Antonov AN-12', 'widebody', 'jet', 2),
  ('AN24', 'AN4', 'Antonov', 'AN-24', 'Antonov AN-24', 'turboprop', 'turboprop', 2),
  ('AN26', 'A26', 'Antonov', 'AN-26', 'Antonov AN-26', 'turboprop', 'turboprop', 2),
  ('AN28', 'A28', 'Antonov', 'AN-28', 'Antonov AN-28', 'turboprop', 'turboprop', 2),
  ('AN30', 'A30', 'Antonov', 'AN-30', 'Antonov AN-30', 'turboprop', 'turboprop', 2),
  ('AN32', 'A32', 'Antonov', 'AN-32', 'Antonov AN-32', 'turboprop', 'turboprop', 2),
  ('AN72', 'AN7', 'Antonov', 'AN-72', 'Antonov AN-72', 'turboprop', 'turboprop', 2),
  ('AT43', 'AT4', 'ATR', '42-300', 'Aerospatiale/Alenia ATR 42-300', 'turboprop', 'turboprop', 2),
  ('AT45', 'AT5', 'ATR', '42-500', 'Aerospatiale/Alenia ATR 42-500', 'turboprop', 'turboprop', 2),
  ('AT46', 'ATR', 'ATR', '42-600', 'Aerospatiale/Alenia ATR 42-600', 'turboprop', 'turboprop', 2),
  ('AT72', 'AT7', 'ATR', '72', 'Aerospatiale/Alenia ATR 72', 'turboprop', 'turboprop', 2),
  ('ATP', 'ATP', 'BAE Systems', 'ATP', 'British Aerospace ATP', 'turboprop', 'turboprop', 2),
  ('B190', 'BEH', 'Beechcraft', '1900', 'Beechcraft 1900', 'turboprop', 'turboprop', 2),
  ('B37M', '7M7', 'Boeing', '737 MAX 7', 'Boeing 737 MAX 7', 'narrowbody', 'jet', 2),
  ('B38M', '7M8', 'Boeing', '737 MAX 8', 'Boeing 737 MAX 8', 'narrowbody', 'jet', 2),
  ('B39M', '7M9', 'Boeing', '737 MAX 9', 'Boeing 737 MAX 9', 'narrowbody', 'jet', 2),
  ('B461', '141', 'BAE Systems', '146-100', 'BAe 146-100', 'narrowbody', 'jet', 2),
  ('B462', '142', 'BAE Systems', '146-200', 'BAe 146-200', 'narrowbody', 'jet', 2),
  ('B463', '143', 'BAE Systems', '146-300', 'BAe 146-300', 'narrowbody', 'jet', 2),
  ('B703', '703', 'Boeing', '707', 'Boeing 707', 'narrowbody', 'jet', 2),
  ('B712', '717', 'Boeing', '717', 'Boeing 717', 'narrowbody', 'jet', 2),
  ('B720', 'B72', 'Boeing', '720B', 'Boeing 720B', 'narrowbody', 'jet', 2),
  ('B721', '721', 'Boeing', '727-100', 'Boeing 727-100', 'narrowbody', 'jet', 3),
  ('B722', '722', 'Boeing', '727-200', 'Boeing 727-200', 'narrowbody', 'jet', 3),
  ('B732', '732', 'Boeing', '737-200', 'Boeing 737-200', 'narrowbody', 'jet', 2),
  ('B733', '733', 'Boeing', '737-300', 'Boeing 737-300', 'narrowbody', 'jet', 2),
  ('B734', '734', 'Boeing', '737-400', 'Boeing 737-400', 'narrowbody', 'jet', 2),
  ('B735', '735', 'Boeing', '737-500', 'Boeing 737-500', 'narrowbody', 'jet', 2),
  ('B736', '736', 'Boeing', '737-600', 'Boeing 737-600', 'narrowbody', 'jet', 2),
  ('B737', '73G', 'Boeing', '737-700', 'Boeing 737-700', 'narrowbody', 'jet', 2),
  ('B738', '738', 'Boeing', '737-800', 'Boeing 737-800', 'narrowbody', 'jet', 2),
  ('B739', '739', 'Boeing', '737-900', 'Boeing 737-900', 'narrowbody', 'jet', 2),
  ('B741', '741', 'Boeing', '747-100', 'Boeing 747-100', 'widebody', 'jet', 4),
  ('B742', '742', 'Boeing', '747-200', 'Boeing 747-200', 'widebody', 'jet', 4),
  ('B743', '743', 'Boeing', '747-300', 'Boeing 747-300', 'widebody', 'jet', 4),
  ('B744', '744', 'Boeing', '747-400', 'Boeing 747-400', 'widebody', 'jet', 4),
  ('B748', '748', 'Boeing', '747-8', 'Boeing 747-8', 'widebody', 'jet', 4),
  ('B74D', '74J', 'Boeing', '747-400D', 'Boeing 747-400D', 'widebody', 'jet', 4),
  ('B74R', '74R', 'Boeing', '747SR', 'Boeing 747SR', 'widebody', 'jet', 4),
  ('B74S', '74L', 'Boeing', '747SP', 'Boeing 747SP', 'widebody', 'jet', 4),
  ('B752', '752', 'Boeing', '757-200', 'Boeing 757-200', 'narrowbody', 'jet', 2),
  ('B753', '753', 'Boeing', '757-300', 'Boeing 757-300', 'narrowbody', 'jet', 2),
  ('B762', '762', 'Boeing', '767-200', 'Boeing 767-200', 'widebody', 'jet', 2),
  ('B763', '763', 'Boeing', '767-300', 'Boeing 767-300', 'widebody', 'jet', 2),
  ('B764', '764', 'Boeing', '767-400', 'Boeing 767-400', 'widebody', 'jet', 2),
  ('B772', '772', 'Boeing', '777-200', 'Boeing 777-200', 'widebody', 'jet', 2),
  ('B773', '773', 'Boeing', '777-300', 'Boeing 777-300', 'widebody', 'jet', 2),
  ('B778', '778', 'Boeing', '777-8', 'Boeing 777-8', 'widebody', 'jet', 2),
  ('B779', '779', 'Boeing', '777-9', 'Boeing 777-9', 'widebody', 'jet', 2),
  ('B77L', '77L', 'Boeing', '777-200LR', 'Boeing 777-200LR', 'widebody', 'jet', 2),
  ('B77W', '77W', 'Boeing', '777-300ER', 'Boeing 777-300ER', 'widebody', 'jet', 2),
  ('B788', '788', 'Boeing', '787-8', 'Boeing 787-8', 'widebody', 'jet', 2),
  ('B789', '789', 'Boeing', '787-9', 'Boeing 787-9', 'widebody', 'jet', 2),
  ('B78X', '78J', 'Boeing', '787-10', 'Boeing 787-10', 'widebody', 'jet', 2),
  ('BA11', 'B11', 'BAE Systems', '(BAC) One Eleven', 'British Aerospace (BAC) One Eleven', 'narrowbody', 'jet', 2),
  ('BCS1', 'CS1', 'Bombardier', 'CS100', 'Bombardier CS100', 'narrowbody', 'jet', 2),
  ('BCS3', 'CS3', 'Bombardier', 'CS300', 'Bombardier CS300', 'narrowbody', 'jet', 2),
  ('BELF', 'SHB', 'Shorts', 'SC-5 Belfast', 'Shorts SC-5 Belfast', 'widebody', 'jet', 2),
  ('BLCF', '74B', 'Boeing', '747 LCF Dreamlifter', 'Boeing 747 LCF Dreamlifter', 'widebody', 'jet', 4),
  ('BN2P', 'BNI', 'Pilatus', 'Britten-Norman BN-2A/B Islander', 'Pilatus Britten-Norman BN-2A/B Islander', 'turboprop', 'turboprop', 2),
  ('C130', 'LOH', 'Lockheed', 'L-182 / 282 / 382 (L-100) Hercules', 'Lockheed L-182 / 282 / 382 (L-100) Hercules', 'turboprop', 'turboprop', 4),
  ('C172', 'CN1', 'Cessna', '172', 'Cessna 172', 'piston', 'piston', 2),
  ('C182', 'CN2', 'Cessna', '182 Skylane', 'Cessna 182 Skylane', 'piston', 'piston', 2),
  ('C208', 'CN3', 'Cessna', '208 Caravan', 'Cessna 208 Caravan', 'piston', 'piston', 2),
  ('C210', 'CN4', 'Cessna', '210 Centurion', 'Cessna 210 Centurion', 'piston', 'piston', 2),
  ('C25B', 'CNJ', 'Cessna', 'Citation CJ3', 'Cessna Citation CJ3', 'bizjet', 'jet', 2),
  ('C25C', 'CJ4', 'Cessna', 'Citation CJ4', 'Cessna Citation CJ4', 'bizjet', 'jet', 2),
  ('C500', 'C1I', 'Cessna', 'Citation I', 'Cessna Citation I', 'bizjet', 'jet', 2),
  ('C510', 'CMU', 'Cessna', 'Citation Mustang', 'Cessna Citation Mustang', 'bizjet', 'jet', 2),
  ('C550', 'C2I', 'Cessna', 'Citation II', 'Cessna Citation II', 'bizjet', 'jet', 2),
  ('C56X', 'CXL', 'Cessna', 'Citation Excel', 'Cessna Citation Excel', 'bizjet', 'jet', 2),
  ('C680', 'CSV', 'Cessna', 'Citation Sovereign', 'Cessna Citation Sovereign', 'bizjet', 'jet', 2),
  ('C750', 'CTX', 'Cessna', 'Citation X', 'Cessna Citation X', 'bizjet', 'jet', 2),
  ('CL44', 'CL4', 'Bombardier', 'CL-44', 'Canadair CL-44', 'piston', 'piston', 2),
  ('CL60', 'CCJ', 'Bombardier', 'Challenger', 'Canadair Challenger', 'bizjet', 'jet', 2),
  ('CONC', 'SSC', 'Concorde', 'Concorde', 'Concorde', 'narrowbody', 'jet', 4),
  ('CONI', 'L49', 'Lockheed', 'L-1049 Super Constellation', 'Lockheed L-1049 Super Constellation', 'piston', 'piston', 4),
  ('CRJ1', 'CR1', 'Bombardier', 'Regional Jet 100', 'Canadair Regional Jet 100', 'regional', 'jet', 2),
  ('CRJ2', 'CR2', 'Bombardier', 'Regional Jet 200', 'Canadair Regional Jet 200', 'regional', 'jet', 2),
  ('CRJ7', 'CR7', 'Bombardier', 'Regional Jet 700', 'Canadair Regional Jet 700', 'regional', 'jet', 2),
  ('CRJ9', 'CR9', 'Bombardier', 'Regional Jet 900', 'Canadair Regional Jet 900', 'regional', 'jet', 2),
  ('CRJX', 'CRK', 'Bombardier', 'Regional Jet 1000', 'Canadair Regional Jet 1000', 'regional', 'jet', 2),
  ('D228', 'D28', 'Fairchild Dornier', 'Do.228', 'Fairchild Dornier Do.228', 'turboprop', 'turboprop', 2),
  ('D328', 'D38', 'Fairchild Dornier', 'Do.328', 'Fairchild Dornier Do.328', 'turboprop', 'turboprop', 2),
  ('DC10', 'D10', 'McDonnell Douglas', 'DC-10', 'Douglas DC-10', 'widebody', 'jet', 3),
  ('DC3', 'D3F', 'Douglas', 'DC-3', 'Douglas DC-3', 'piston', 'piston', 2),
  ('DC6', 'D6F', 'Douglas', 'DC-6', 'Douglas DC-6', 'piston', 'piston', 4),
  ('DC85', 'D8T', 'McDonnell Douglas', 'DC-8-50', 'Douglas DC-8-50', 'narrowbody', 'jet', 2),
  ('DC86', 'D8L', 'McDonnell Douglas', 'DC-8-62', 'Douglas DC-8-62', 'narrowbody', 'jet', 2),
  ('DC87', 'D8Q', 'McDonnell Douglas', 'DC-8-72', 'Douglas DC-8-72', 'narrowbody', 'jet', 2),
  ('DC91', 'D91', 'McDonnell Douglas', 'DC-9-10', 'Douglas DC-9-10', 'narrowbody', 'jet', 2),
  ('DC92', 'D92', 'McDonnell Douglas', 'DC-9-20', 'Douglas DC-9-20', 'narrowbody', 'jet', 2),
  ('DC93', 'D93', 'McDonnell Douglas', 'DC-9-30', 'Douglas DC-9-30', 'narrowbody', 'jet', 2),
  ('DC94', 'D94', 'McDonnell Douglas', 'DC-9-40', 'Douglas DC-9-40', 'narrowbody', 'jet', 2),
  ('DC95', 'D95', 'McDonnell Douglas', 'DC-9-50', 'Douglas DC-9-50', 'narrowbody', 'jet', 2),
  ('DH2T', 'DHR', 'De Havilland', 'DHC-2 Turbo-Beaver', 'De Havilland Canada DHC-2 Turbo-Beaver', 'turboprop', 'turboprop', 2),
  ('DH8A', 'DH1', 'De Havilland', 'DHC-8-100 Dash 8 / 8Q', 'De Havilland Canada DHC-8-100 Dash 8 / 8Q', 'turboprop', 'turboprop', 2),
  ('DH8B', 'DH2', 'De Havilland', 'DHC-8-200 Dash 8 / 8Q', 'De Havilland Canada DHC-8-200 Dash 8 / 8Q', 'turboprop', 'turboprop', 2),
  ('DH8C', 'DH3', 'De Havilland', 'DHC-8-300 Dash 8', 'De Havilland Canada DHC-8-300 Dash 8', 'turboprop', 'turboprop', 2),
  ('DH8D', 'DH4', 'De Havilland', 'DHC-8-400 Dash 8Q', 'De Havilland Canada DHC-8-400 Dash 8Q', 'turboprop', 'turboprop', 2),
  ('DHC2', 'DHP', 'De Havilland', 'DHC-2 Beaver', 'De Havilland Canada DHC-2 Beaver', 'turboprop', 'turboprop', 2),
  ('DHC3', 'DHL', 'De Havilland', 'DHC-3 Otter', 'De Havilland Canada DHC-3 Otter', 'turboprop', 'turboprop', 2),
  ('DHC4', 'DHC', 'De Havilland', 'DHC-4 Caribou', 'De Havilland Canada DHC-4 Caribou', 'turboprop', 'turboprop', 2),
  ('DHC6', 'DHT', 'De Havilland', 'DHC-6 Twin Otter', 'De Havilland Canada DHC-6 Twin Otter', 'turboprop', 'turboprop', 2),
  ('DHC7', 'DH7', 'De Havilland', 'DHC-7 Dash 7', 'De Havilland Canada DHC-7 Dash 7', 'turboprop', 'turboprop', 2),
  ('DOVE', 'DHD', 'De Havilland', 'DH.104 Dove', 'De Havilland DH.104 Dove', 'turboprop', 'turboprop', 2),
  ('E110', 'EMB', 'Embraer', 'EMB 110 Bandeirante', 'Embraer EMB 110 Bandeirante', 'turboprop', 'turboprop', 2),
  ('E120', 'EM2', 'Embraer', 'EMB 120 Brasilia', 'Embraer EMB 120 Brasilia', 'turboprop', 'turboprop', 2),
  ('E135', 'ER3', 'Embraer', 'RJ135/RJ140', 'Embraer RJ135/RJ140', 'regional', 'jet', 2),
  ('E145', 'ER4', 'Embraer', 'RJ145', 'Embraer RJ145', 'regional', 'jet', 2),
  ('E170', 'E70', 'Embraer', '170', 'Embraer 170', 'narrowbody', 'jet', 2),
  ('E190', 'E90', 'Embraer', '190', 'Embraer 190', 'narrowbody', 'jet', 2),
  ('E195', 'E95', 'Embraer', '195', 'Embraer 195', 'narrowbody', 'jet', 2),
  ('E290', '290', 'Embraer', 'E190-E2', 'Embraer E190-E2', 'narrowbody', 'jet', 2),
  ('E295', '295', 'Embraer', 'E195-E2', 'Embraer E195-E2', 'narrowbody', 'jet', 2),
  ('E35L', 'EL6', 'Embraer', 'Legacy 600', 'Embraer Legacy 600', 'bizjet', 'jet', 2),
  ('E50P', 'EP1', 'Embraer', 'Phenom 100', 'Embraer Phenom 100', 'bizjet', 'jet', 2),
  ('E55P', 'EP3', 'Embraer', 'Phenom 300', 'Embraer Phenom 300', 'bizjet', 'jet', 2),
  ('E75L', 'E7L', 'Embraer', '175 (long wing)', 'Embraer 175 (long wing)', 'narrowbody', 'jet', 2),
  ('E75S', 'E7S', 'Embraer', '175 (short wing)', 'Embraer 175 (short wing)', 'narrowbody', 'jet', 2),
  ('F100', '100', 'Fokker', '100', 'Fokker 100', 'narrowbody', 'jet', 2),
  ('F27', 'F27', 'Fokker', 'F27 Friendship', 'Fokker F27 Friendship', 'turboprop', 'turboprop', 2),
  ('F28', 'F21', 'Fokker', 'F28 Fellowship', 'Fokker F28 Fellowship', 'narrowbody', 'jet', 2),
  ('F2TH', 'D20', 'Dassault', 'Falcon 2000', 'Dassault Falcon 2000', 'bizjet', 'jet', 2),
  ('F50', 'F50', 'Fokker', '50', 'Fokker 50', 'turboprop', 'turboprop', 2),
  ('F70', 'F70', 'Fokker', '70', 'Fokker 70', 'narrowbody', 'jet', 2),
  ('F900', 'DF9', 'Dassault', 'Falcon 900', 'Dassault Falcon 900', 'bizjet', 'jet', 2),
  ('FA50', 'DF3', 'Dassault', 'Falcon 50', 'Dassault Falcon 50', 'bizjet', 'jet', 2),
  ('FA7X', 'DF7', 'Dassault', 'Falcon 7X', 'Dassault Falcon 7X', 'bizjet', 'jet', 2),
  ('G159', 'GRS', 'Gulfstream', 'Aerospace G-159 Gulfstream I', 'Gulfstream Aerospace G-159 Gulfstream I', 'bizjet', 'jet', 2),
  ('G280', 'GR3', 'Gulfstream', 'G280', 'Gulfstream G280', 'bizjet', 'jet', 2),
  ('GLEX', 'CCX', 'Bombardier', 'Global Express', 'Bombardier Global Express', 'bizjet', 'jet', 2),
  ('GLF4', 'GJ4', 'Gulfstream', 'IV', 'Gulfstream IV', 'bizjet', 'jet', 2),
  ('GLF5', 'GJ5', 'Gulfstream', 'V', 'Gulfstream V', 'bizjet', 'jet', 2),
  ('GLF6', 'GJ6', 'Gulfstream', 'G650', 'Gulfstream G650', 'bizjet', 'jet', 2),
  ('H25B', 'H25', 'BAE Systems', '125 series / Hawker/Raytheon 700/800/800XP/850/900', 'British Aerospace 125 series / Hawker/Raytheon 700/800/800XP/850/900', 'bizjet', 'jet', 2),
  ('H25C', 'H2C', 'BAE Systems', '125-1000 series / Hawker/Raytheon 1000', 'British Aerospace 125-1000 series / Hawker/Raytheon 1000', 'bizjet', 'jet', 2),
  ('HERN', 'DHH', 'De Havilland', 'DH.114 Heron', 'De Havilland DH.114 Heron', 'turboprop', 'turboprop', 2),
  ('I114', 'I14', 'Ilyushin', 'IL114', 'Ilyushin IL114', 'turboprop', 'turboprop', 2),
  ('IL18', 'IL8', 'Ilyushin', 'IL18', 'Ilyushin IL18', 'turboprop', 'turboprop', 4),
  ('IL62', 'IL6', 'Ilyushin', 'IL62', 'Ilyushin IL62', 'widebody', 'jet', 4),
  ('IL76', 'IL7', 'Ilyushin', 'IL76', 'Ilyushin IL76', 'widebody', 'jet', 4),
  ('IL86', 'ILW', 'Ilyushin', 'IL86', 'Ilyushin IL86', 'widebody', 'jet', 4),
  ('IL96', 'I93', 'Ilyushin', 'IL96', 'Ilyushin IL96', 'widebody', 'jet', 4),
  ('J328', 'FRJ', 'Fairchild Dornier', '328JET', 'Fairchild Dornier 328JET', 'regional', 'jet', 2),
  ('JS31', 'J31', 'BAE Systems', 'Jetstream 31', 'British Aerospace Jetstream 31', 'turboprop', 'turboprop', 2),
  ('JS32', 'J32', 'BAE Systems', 'Jetstream 32', 'British Aerospace Jetstream 32', 'turboprop', 'turboprop', 2),
  ('JS41', 'J41', 'BAE Systems', 'Jetstream 41', 'British Aerospace Jetstream 41', 'turboprop', 'turboprop', 2),
  ('L101', 'L10', 'Lockheed', 'L-1011 Tristar', 'Lockheed L-1011 Tristar', 'widebody', 'jet', 3),
  ('L188', 'LOE', 'Lockheed', 'L-188 Electra', 'Lockheed L-188 Electra', 'turboprop', 'turboprop', 2),
  ('LJ35', 'LR3', 'Learjet', '35', 'Learjet 35', 'bizjet', 'jet', 2),
  ('LJ60', 'LR6', 'Learjet', '60', 'Learjet 60', 'bizjet', 'jet', 2),
  ('MD11', 'M11', 'McDonnell Douglas', 'MD-11', 'McDonnell Douglas MD-11', 'widebody', 'jet', 3),
  ('MD81', 'M81', 'McDonnell Douglas', 'MD-81', 'McDonnell Douglas MD-81', 'narrowbody', 'jet', 2),
  ('MD82', 'M82', 'McDonnell Douglas', 'MD-82', 'McDonnell Douglas MD-82', 'narrowbody', 'jet', 2),
  ('MD83', 'M83', 'McDonnell Douglas', 'MD-83', 'McDonnell Douglas MD-83', 'narrowbody', 'jet', 2),
  ('MD87', 'M87', 'McDonnell Douglas', 'MD-87', 'McDonnell Douglas MD-87', 'narrowbody', 'jet', 2),
  ('MD88', 'M88', 'McDonnell Douglas', 'MD-88', 'McDonnell Douglas MD-88', 'narrowbody', 'jet', 2),
  ('MD90', 'M90', 'McDonnell Douglas', 'MD-90', 'McDonnell Douglas MD-90', 'narrowbody', 'jet', 2),
  ('N262', 'ND2', 'Aerospatiale', '262', 'Aerospatiale (Nord) 262', 'turboprop', 'turboprop', 2),
  ('P68', 'PN6', 'Partenavia', 'P.68', 'Partenavia P.68', 'piston', 'piston', 2),
  ('PA31', 'PA2', 'Piper', 'PA-31 Navajo', 'Piper PA-31 Navajo', 'piston', 'piston', 2),
  ('PA46', 'PAG', 'Piper', 'PA-46', 'Piper PA-46', 'piston', 'piston', 2),
  ('PC12', 'PL2', 'Pilatus', 'PC-12', 'Pilatus PC-12', 'turboprop', 'turboprop', 2),
  ('PC6T', 'PL6', 'Pilatus', 'PC-6 Turbo Porter', 'Pilatus PC-6 Turbo Porter', 'turboprop', 'turboprop', 2),
  ('RJ1H', 'AR1', 'BAE Systems', 'RJ100', 'Avro RJ100', 'narrowbody', 'jet', 2),
  ('RJ70', 'AR7', 'BAE Systems', 'RJ70', 'Avro RJ70', 'narrowbody', 'jet', 2),
  ('RJ85', 'AR8', 'BAE Systems', 'RJ85', 'Avro RJ85', 'narrowbody', 'jet', 2),
  ('S210', 'CRV', 'Aerospatiale', 'Se.210 Caravelle', 'Aerospatiale (Sud Aviation) Se.210 Caravelle', 'narrowbody', 'jet', 2),
  ('S601', 'NDC', 'Aerospatiale', 'SN.601 Corvette', 'Aerospatiale SN.601 Corvette', 'turboprop', 'turboprop', 2),
  ('SB20', 'S20', 'Saab', '2000', 'Saab 2000', 'turboprop', 'turboprop', 2),
  ('SC7', 'SHS', 'Shorts', 'SC-7 Skyvan', 'Shorts SC-7 Skyvan', 'turboprop', 'turboprop', 2),
  ('SF34', 'SF3', 'Saab', 'SF340A/B', 'Saab SF340A/B', 'turboprop', 'turboprop', 2),
  ('SH33', 'SH3', 'Shorts', 'SD.330', 'Shorts SD.330', 'turboprop', 'turboprop', 2),
  ('SH36', 'SH6', 'Shorts', 'SD.360', 'Shorts SD.360', 'turboprop', 'turboprop', 2),
  ('SU95', 'SU9', 'Sukhoi', 'Superjet 100-95', 'Sukhoi Superjet 100-95', 'narrowbody', 'jet', 2),
  ('T134', 'TU3', 'Tupolev', 'Tu-134', 'Tupolev Tu-134', 'narrowbody', 'jet', 2),
  ('T154', 'TU5', 'Tupolev', 'Tu-154', 'Tupolev Tu-154', 'narrowbody', 'jet', 2),
  ('T204', 'T20', 'Tupolev', 'Tu-204', 'Tupolev Tu-204', 'narrowbody', 'jet', 2),
  ('TRIS', 'BNT', 'Pilatus', 'Britten-Norman BN-2A Mk III Trislander', 'Pilatus Britten-Norman BN-2A Mk III Trislander', 'turboprop', 'turboprop', 3),
  ('Y12', 'YN2', 'Harbin', 'Yunshuji Y12', 'Harbin Yunshuji Y12', 'turboprop', 'turboprop', 2),
  ('YK40', 'YK4', 'Yakovlev', 'Yak-40', 'Yakovlev Yak-40', 'turboprop', 'turboprop', 3),
  ('YK42', 'YK2', 'Yakovlev', 'Yak-42', 'Yakovlev Yak-42', 'narrowbody', 'jet', 2),
  ('YS11', 'YS1', 'NAMC', 'YS-11', 'NAMC YS-11', 'turboprop', 'turboprop', 2)
ON CONFLICT (icao) DO NOTHING;

-- ============================================================================
-- 3. Add New Columns to user_advanced_stats
-- ============================================================================

ALTER TABLE user_advanced_stats ADD COLUMN IF NOT EXISTS aircraft_type_breakdown JSONB;
ALTER TABLE user_advanced_stats ADD COLUMN IF NOT EXISTS region_breakdown JSONB;

-- ============================================================================
-- 4. Updated compute_aircraft_breakdown Function (Uses Reference Table)
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_aircraft_breakdown(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_aircraft JSONB;
  v_manufacturer JSONB;
BEGIN
  -- Aircraft type counts (top 10 by flight count)
  SELECT jsonb_object_agg(aircraft_icao, count)
  INTO v_aircraft
  FROM (
    SELECT aircraft_icao, COUNT(*) as count
    FROM flights
    WHERE user_id = p_user_id
      AND aircraft_icao IS NOT NULL
      AND (is_upcoming IS NULL OR is_upcoming = FALSE)
    GROUP BY aircraft_icao
    ORDER BY count DESC
    LIMIT 10
  ) t;

  -- Manufacturer breakdown using aircraft_reference table
  SELECT jsonb_object_agg(manufacturer, count)
  INTO v_manufacturer
  FROM (
    SELECT
      COALESCE(ar.manufacturer, 'Unknown') as manufacturer,
      COUNT(*) as count
    FROM flights f
    LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
    WHERE f.user_id = p_user_id
      AND f.aircraft_icao IS NOT NULL
      AND (f.is_upcoming IS NULL OR f.is_upcoming = FALSE)
    GROUP BY COALESCE(ar.manufacturer, 'Unknown')
    ORDER BY count DESC
  ) t;

  RETURN jsonb_build_object(
    'aircraft', COALESCE(v_aircraft, '{}'::jsonb),
    'manufacturers', COALESCE(v_manufacturer, '{}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. New compute_aircraft_type_breakdown Function
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_aircraft_type_breakdown(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_most_flown JSONB;
BEGIN
  -- Type breakdown (widebody, narrowbody, regional, etc.)
  SELECT jsonb_object_agg(type, count)
  INTO v_result
  FROM (
    SELECT
      COALESCE(ar.type, 'unknown') as type,
      COUNT(*) as count
    FROM flights f
    LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
    WHERE f.user_id = p_user_id
      AND f.aircraft_icao IS NOT NULL
      AND (f.is_upcoming IS NULL OR f.is_upcoming = FALSE)
    GROUP BY COALESCE(ar.type, 'unknown')
    ORDER BY count DESC
  ) t;

  -- Find most flown aircraft
  SELECT jsonb_build_object(
    'icao', aircraft_icao,
    'name', COALESCE(ar.name, aircraft_icao),
    'count', flight_count,
    'total_flights', total
  )
  INTO v_most_flown
  FROM (
    SELECT
      f.aircraft_icao,
      COUNT(*) as flight_count,
      SUM(COUNT(*)) OVER() as total
    FROM flights f
    WHERE f.user_id = p_user_id
      AND f.aircraft_icao IS NOT NULL
      AND (f.is_upcoming IS NULL OR f.is_upcoming = FALSE)
    GROUP BY f.aircraft_icao
    ORDER BY flight_count DESC
    LIMIT 1
  ) t
  LEFT JOIN aircraft_reference ar ON t.aircraft_icao = ar.icao;

  RETURN jsonb_build_object(
    'types', COALESCE(v_result, '{}'::jsonb),
    'most_flown', v_most_flown
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. New compute_region_breakdown Function
-- ============================================================================
-- Note: This function will use a lookup table approach
-- Regions are passed via the app layer since countries.json has this data

CREATE OR REPLACE FUNCTION compute_region_breakdown(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- For now, return continent breakdown as region breakdown
  -- Full region breakdown requires country->region mapping in the app layer
  -- This provides a placeholder that will be enhanced later
  SELECT jsonb_object_agg(continent, count)
  INTO v_result
  FROM (
    SELECT
      CASE
        WHEN country_code IN ('US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'JM', 'HT', 'DO', 'PR', 'BS', 'TT', 'BB') THEN 'americas'
        WHEN country_code IN ('BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR') THEN 'americas'
        WHEN country_code IN ('GB', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'PL', 'CZ', 'HU', 'RO', 'BG', 'GR', 'SE', 'NO', 'DK', 'FI', 'IE', 'LU', 'SK', 'SI', 'HR', 'RS', 'UA', 'BY', 'LT', 'LV', 'EE', 'MD', 'AL', 'MK', 'ME', 'BA', 'XK', 'IS', 'MT', 'CY', 'MC', 'SM', 'AD', 'LI', 'VA') THEN 'europe'
        WHEN country_code IN ('RU', 'CN', 'JP', 'KR', 'IN', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK', 'MO', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'MN', 'NP', 'BD', 'LK', 'PK', 'AF', 'IR', 'IQ', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'LB', 'SY', 'IL', 'PS', 'TR', 'GE', 'AM', 'AZ', 'MM', 'LA', 'KH', 'BN', 'TL') THEN 'asia'
        WHEN country_code IN ('AU', 'NZ', 'FJ', 'PG', 'NC', 'PF', 'WS', 'TO', 'VU', 'SB', 'GU', 'FM', 'MH', 'PW', 'KI', 'NR', 'TV', 'CK', 'NU', 'TK', 'WF', 'AS') THEN 'oceania'
        WHEN country_code IN ('ZA', 'EG', 'MA', 'DZ', 'TN', 'LY', 'NG', 'KE', 'ET', 'GH', 'TZ', 'UG', 'SD', 'SS', 'SN', 'CI', 'CM', 'ZW', 'AO', 'MZ', 'MG', 'ZM', 'BW', 'NA', 'MU', 'RE', 'RW', 'BJ', 'TG', 'ML', 'BF', 'NE', 'TD', 'SO', 'DJ', 'ER', 'MW', 'LS', 'SZ', 'GM', 'GN', 'GW', 'SL', 'LR', 'GA', 'CG', 'CD', 'CF', 'GQ', 'ST', 'CV', 'KM', 'SC', 'YT') THEN 'africa'
        ELSE 'other'
      END as continent,
      COUNT(DISTINCT country_code) as count
    FROM visits
    WHERE user_id = p_user_id AND country_code IS NOT NULL
    GROUP BY continent
  ) t;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Update refresh_advanced_stats Function
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_advanced_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
  v_aircraft_breakdown JSONB;
  v_aircraft_type_breakdown JSONB;
BEGIN
  -- Get current user_stats
  SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;

  IF v_stats IS NULL THEN
    RETURN;
  END IF;

  -- Compute breakdowns
  v_aircraft_breakdown := compute_aircraft_breakdown(p_user_id);
  v_aircraft_type_breakdown := compute_aircraft_type_breakdown(p_user_id);

  -- Upsert advanced stats with all computed values
  INSERT INTO user_advanced_stats (
    user_id,
    avia_geek_unlocked,
    country_geek_unlocked,
    duration_unlocked,
    manufacturer_breakdown,
    aircraft_breakdown,
    aircraft_type_breakdown,
    continent_breakdown,
    region_breakdown,
    duration_stats,
    updated_at
  )
  VALUES (
    p_user_id,
    v_stats.aircraft_count >= 5,
    v_stats.countries_count >= 5,
    v_stats.total_flights >= 10,
    v_aircraft_breakdown->'manufacturers',
    v_aircraft_breakdown->'aircraft',
    v_aircraft_type_breakdown,
    (SELECT compute_continent_breakdown(p_user_id)),
    (SELECT compute_region_breakdown(p_user_id)),
    (SELECT compute_duration_stats(p_user_id)),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    avia_geek_unlocked = v_stats.aircraft_count >= 5,
    country_geek_unlocked = v_stats.countries_count >= 5,
    duration_unlocked = v_stats.total_flights >= 10,
    manufacturer_breakdown = v_aircraft_breakdown->'manufacturers',
    aircraft_breakdown = v_aircraft_breakdown->'aircraft',
    aircraft_type_breakdown = v_aircraft_type_breakdown,
    continent_breakdown = (SELECT compute_continent_breakdown(p_user_id)),
    region_breakdown = (SELECT compute_region_breakdown(p_user_id)),
    duration_stats = (SELECT compute_duration_stats(p_user_id)),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Re-compute stats for all existing users
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN SELECT DISTINCT user_id FROM user_stats LOOP
    PERFORM refresh_advanced_stats(v_user_id);
  END LOOP;
END
$$;
