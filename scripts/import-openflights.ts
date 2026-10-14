/**
 * Import script for OpenFlights data
 * Downloads and processes airports.dat and airlines.dat
 * Filters by target regions and outputs enriched JSON
 */

import * as fs from 'fs'
import * as path from 'path'

// Target country codes for filtering
const TARGET_COUNTRIES = new Set([
  // Russia
  'RU',
  // CIS
  'UA',
  'BY',
  'GE',
  'AZ',
  'AM',
  'KZ',
  'UZ',
  'KG',
  'TJ',
  'TM',
  'MD',
  // East Asia
  'CN',
  'JP',
  'KR',
  'TW',
  'HK',
  'MO',
  // Southeast Asia
  'SG',
  'MY',
  'TH',
  'VN',
  'ID',
  'PH',
  'MM',
  'KH',
  'LA',
  'BN',
  'MV',
  // South Asia
  'IN',
  'BD',
  'LK',
  'PK',
  'NP',
  // Middle East
  'AE',
  'QA',
  'SA',
  'BH',
  'OM',
  'KW',
  'IL',
  'JO',
  'LB',
  'TR',
  'IQ',
  // Europe (Western)
  'DE',
  'FR',
  'IT',
  'ES',
  'PT',
  'NL',
  'BE',
  'CH',
  'AT',
  'GB',
  'IE',
  // Europe (Nordic)
  'SE',
  'NO',
  'DK',
  'FI',
  'IS',
  // Europe (Central/Eastern)
  'PL',
  'CZ',
  'HU',
  'RO',
  'BG',
  'GR',
  'HR',
  'RS',
  'SI',
  'SK',
  'BA',
  'ME',
  'MK',
  'AL',
  'XK',
  // Europe (Baltic)
  'EE',
  'LV',
  'LT',
  // Europe (Mediterranean islands)
  'CY',
  'MT',
  'LU',
  // North America (keep existing coverage)
  'US',
  'CA',
  'MX',
  // Caribbean & Central America
  'PA',
  'CR',
  'CU',
  'DO',
  'JM',
  'BB',
  'TT',
  'GT',
  'NI',
  'HN',
  'SV',
  'BZ',
  // South America (keep existing coverage)
  'BR',
  'AR',
  'CL',
  'CO',
  'PE',
  'EC',
  'VE',
  'UY',
  'PY',
  'BO',
  'GY',
  'SR',
  // Oceania
  'AU',
  'NZ',
  // Africa (major)
  'ZA',
  'EG',
  'KE',
  'MA',
  'NG',
  'ET',
  'TN',
  'DZ',
  'TZ',
  'GH',
  'UG',
  'RW',
  'MU',
  'SC',
  'SN',
  'CI',
])

// Curated list of major airports to include from each region
// This ensures we have quality over quantity
const PRIORITY_AIRPORTS = new Set([
  // Russia - Major hubs and regional capitals
  'SVO',
  'DME',
  'VKO',
  'LED', // Moscow + St. Petersburg
  'KZN',
  'SVX',
  'OVB',
  'KJA',
  'IKT',
  'VVO',
  'KHV', // Regional hubs
  'UFA',
  'ROV',
  'AER',
  'KRR',
  'GOJ',
  'KGD',
  'MMK', // Major regional
  'PEE',
  'CEK',
  'TOF',
  'VOZ',
  'OMS',
  'TJM',
  'NJC', // Industrial cities
  'YKS',
  'BTK',
  'PKC',
  'PES',
  'MQF',
  'ARH',
  'ASF', // Others

  // Ukraine
  'KBP',
  'IEV',
  'ODS',
  'LWO',
  'HRK',
  'DNK',
  'SIP',

  // Belarus
  'MSQ',
  'GNA',
  'GME',

  // Georgia
  'TBS',
  'KUT',
  'BUS',

  // Azerbaijan
  'GYD',
  'NAJ',

  // Armenia
  'EVN',
  'LWN',

  // Kazakhstan
  'ALA',
  'NQZ',
  'CIT',
  'SCO',
  'KZO',
  'PLX',
  'PWQ',
  'GUW',

  // Uzbekistan
  'TAS',
  'SKD',
  'BHK',
  'NVI',

  // Kyrgyzstan
  'FRU',
  'OSS',

  // China - Major hubs
  'PEK',
  'PKX',
  'PVG',
  'SHA',
  'CAN',
  'SZX',
  'CTU',
  'TFU',
  'XIY',
  'KMG',
  'WUH',
  'CKG',
  'HGH',
  'NKG',
  'TAO',
  'DLC',
  'SHE',
  'TSN',
  'XMN',
  'CSX',
  'CGO',
  'URC',
  'HRB',
  'SYX',
  'NNG',
  'KWE',
  'LHW',
  'JJN',
  'FOC',
  'TNA',
  'WNZ',
  'LXA',

  // Hong Kong & Macau
  'HKG',
  'MFM',

  // Taiwan
  'TPE',
  'KHH',
  'RMQ',
  'TNN',

  // Japan - Major airports
  'NRT',
  'HND',
  'KIX',
  'ITM',
  'NGO',
  'FUK',
  'CTS',
  'OKA',
  'KOJ',
  'HIJ',
  'SDJ',
  'NGS',
  'KMJ',
  'TAK',
  'MYJ',
  'OIT',

  // South Korea
  'ICN',
  'GMP',
  'PUS',
  'CJU',
  'TAE',
  'KWJ',
  'RSU',

  // Southeast Asia
  'SIN',
  'KUL',
  'PEN',
  'LGK',
  'BKI',
  'KCH',
  'BKK',
  'DMK',
  'CNX',
  'HKT',
  'USM',
  'SGN',
  'HAN',
  'DAD',
  'CXR',
  'PQC',
  'CGK',
  'DPS',
  'SUB',
  'UPG',
  'JOG',
  'MES',
  'PDG',
  'MNL',
  'CEB',
  'DVO',
  'ILO',
  'CRK',
  'RGN',
  'MDL',
  'PNH',
  'REP',
  'VTE',
  'BWN',
  'MLE',

  // India - Major airports
  'DEL',
  'BOM',
  'BLR',
  'MAA',
  'CCU',
  'HYD',
  'COK',
  'GOI',
  'AMD',
  'PNQ',
  'JAI',
  'LKO',
  'GAU',
  'TRV',
  'IXC',
  'SXR',
  'PAT',
  'VNS',
  'VGA',
  'IXB',
  'IXR',
  'RPR',
  'BHO',
  'NAG',

  // Middle East
  'DXB',
  'AUH',
  'SHJ',
  'DOH',
  'RUH',
  'JED',
  'DMM',
  'MED',
  'KWI',
  'BAH',
  'MCT',
  'TLV',
  'AMM',
  'BEY',
  'BGW',

  // Turkey
  'IST',
  'ISL', // Atatürk: retain historical flight endpoints
  'SAW',
  'ESB',
  'AYT',
  'ADB',
  'DLM',
  'BJV',
  'GZT',
  'TZX',
  'ERZ',
  'VAN',
  'ASR',
  'SZF',

  // Germany
  'FRA',
  'MUC',
  'BER',
  'DUS',
  'HAM',
  'STR',
  'CGN',
  'HAJ',
  'NUE',
  'LEJ',
  'DTM',
  'FMO',
  'HHN',
  'PAD',

  // France
  'CDG',
  'ORY',
  'NCE',
  'LYS',
  'MRS',
  'TLS',
  'BOD',
  'NTE',
  'SXB',
  'BIQ',
  'LIL',
  'MPL',
  'BIA',
  'AJA',
  'FSC',

  // Italy
  'FCO',
  'MXP',
  'LIN',
  'VCE',
  'NAP',
  'BGY',
  'BLQ',
  'FLR',
  'PSA',
  'CTA',
  'PMO',
  'BRI',
  'CAG',
  'TRN',
  'VRN',
  'GOA',

  // Spain
  'MAD',
  'BCN',
  'GRO',
  'PMI',
  'AGP',
  'ALC',
  'VLC',
  'BIO',
  'SVQ',
  'TFS',
  'LPA',
  'ACE',
  'FUE',
  'IBZ',
  'XRY',
  'SCQ',
  'GRX',

  // UK
  'LHR',
  'LGW',
  'STN',
  'LTN',
  'MAN',
  'EDI',
  'BHX',
  'GLA',
  'BRS',
  'NCL',
  'LPL',
  'EMA',
  'LBA',
  'BFS',
  'ABZ',
  'CWL',

  // Netherlands, Belgium, Switzerland, Austria
  'AMS',
  'EIN',
  'RTM',
  'BRU',
  'CRL',
  'ANR',
  'ZRH',
  'GVA',
  'BSL',
  'VIE',
  'SZG',
  'INN',
  'GRZ',

  // Nordic
  'ARN',
  'GOT',
  'MMX',
  'OSL',
  'BGO',
  'TRD',
  'SVG',
  'BOO',
  'CPH',
  'AAL',
  'BLL',
  'HEL',
  'OUL',
  'TMP',
  'TKU',
  'KEF',
  'AEY',

  // Ireland & Portugal
  'DUB',
  'ORK',
  'SNN',
  'KNO',
  'LIS',
  'OPO',
  'FAO',
  'FNC',
  'PDL',

  // Greece
  'ATH',
  'SKG',
  'HER',
  'RHO',
  'CFU',
  'ZTH',
  'JMK',
  'JTR',

  // Poland, Czech, Hungary
  'WAW',
  'KRK',
  'GDN',
  'WRO',
  'POZ',
  'KTW',
  'RZE',
  'PRG',
  'BRQ',
  'OSR',
  'BUD',
  'DEB',

  // Romania, Bulgaria
  'OTP',
  'CLJ',
  'TSR',
  'IAS',
  'SBZ',
  'SOF',
  'VAR',
  'BOJ',

  // Baltics
  'RIX',
  'TLL',
  'VNO',
  'KUN',

  // Balkans
  'BEG',
  'ZAG',
  'SPU',
  'DBV',
  'PUY',
  'LJU',
  'MBX',
  'TIV',
  'PRN',
  'SKP',
  'TIA',
  'SJJ',
  'BNX',

  // Cyprus, Malta, Luxembourg
  'LCA',
  'PFO',
  'MLA',
  'LUX',

  // US - Top 50 airports
  'JFK',
  'LAX',
  'ORD',
  'DFW',
  'DEN',
  'ATL',
  'SFO',
  'SEA',
  'MIA',
  'BOS',
  'EWR',
  'LGA',
  'IAD',
  'DCA',
  'PHX',
  'IAH',
  'LAS',
  'MCO',
  'CLT',
  'MSP',
  'DTW',
  'PHL',
  'SAN',
  'TPA',
  'PDX',
  'SLC',
  'FLL',
  'BWI',
  'AUS',
  'STL',
  'RDU',
  'MCI',
  'OAK',
  'SJC',
  'SMF',
  'HNL',
  'ANC',
  'SNA',
  'DAL',
  'HOU',
  'MDW',
  'BNA',
  'IND',
  'CMH',
  'CLE',
  'PIT',
  'SAT',
  'MKE',

  // Canada
  'YYZ',
  'YVR',
  'YUL',
  'YYC',
  'YEG',
  'YOW',
  'YWG',
  'YHZ',
  'YQB',
  'YXE',
  'YQR',
  'YLW',
  'YYJ',
  'YZF',
  'YQT',

  // Mexico
  'MEX',
  'CUN',
  'GDL',
  'MTY',
  'TIJ',
  'SJD',
  'PVR',
  'MID',

  // Caribbean & Central America
  'PTY',
  'SJO',
  'HAV',
  'SDQ',
  'PUJ',
  'MBJ',
  'BGI',
  'POS',
  'GUA',
  'MGA',
  'SAP',
  'SAL',
  'BZE',

  // Brazil
  'GRU',
  'GIG',
  'CGH',
  'SDU',
  'BSB',
  'CNF',
  'REC',
  'SSA',
  'POA',
  'FOR',
  'CWB',
  'FLN',
  'VCP',
  'MAO',
  'BEL',
  'NAT',

  // Argentina
  'EZE',
  'AEP',
  'COR',
  'MDZ',
  'BRC',
  'IGR',
  'SLA',
  'FTE',

  // Chile
  'SCL',
  'IQQ',
  'ANF',
  'CCP',
  'ZCO',
  'PMC',
  'PUQ',

  // Colombia, Peru
  'BOG',
  'MDE',
  'CLO',
  'CTG',
  'BAQ',
  'SMR',
  'LIM',
  'CUZ',
  'AQP',
  'TRU',

  // Ecuador
  'UIO',
  'GYE',

  // Venezuela
  'CCS',

  // Uruguay
  'MVD',

  // Paraguay
  'ASU',

  // Bolivia
  'VVI',
  'LPB',

  // Guyana, Suriname
  'GEO',
  'PBM',

  // Australia
  'SYD',
  'MEL',
  'BNE',
  'PER',
  'ADL',
  'CBR',
  'OOL',
  'CNS',
  'HBA',
  'DRW',
  'ASP',
  'TSV',
  'NTL',
  'AVV',

  // New Zealand
  'AKL',
  'WLG',
  'CHC',
  'ZQN',
  'DUD',
  'NPE',
  'ROT',

  // Africa
  'JNB',
  'CPT',
  'DUR',
  'PLZ',
  'CAI',
  'ALY',
  'HRG',
  'SSH',
  'NBO',
  'MBA',
  'CMN',
  'RAK',
  'AGA',
  'FEZ',
  'LOS',
  'ABV',
  'PHC',
  'ADD',
  'DIR',
  'TUN',
  'MIR',
  'SFA',
  'ALG',
  'DAR',
  'ZNZ',
  'ACC',
  'EBB',
  'KGL',
  'MRU',
  'SEZ',
  'DSS',
  'ABJ',
])

// Curated list of major airlines to include
// Focus on: major carriers, popular LCCs, regional carriers in target markets
const PRIORITY_AIRLINES = new Set([
  // US majors
  'AA',
  'UA',
  'DL',
  'WN',
  'AS',
  'B6',
  'F9',
  'NK',
  'HA',
  'G4',
  // European majors
  'BA',
  'VS',
  'U2',
  'FR',
  'EI',
  'AF',
  'LH',
  'LX',
  'OS',
  'KL',
  'IB',
  'VY',
  'AZ',
  'SK',
  'AY',
  'DY',
  'TP',
  'A3',
  'TK',
  'PC',
  'W6',
  'LO',
  'OK',
  'FB',
  'RO',
  'JU',
  'OU',
  'BT',
  'EW',
  'D8',
  'LS',
  'HV',
  'V7',
  'TO',
  'SN',
  'EN',
  'EW',
  // UK
  'BE',
  'ZT',
  // Middle East
  'EK',
  'EY',
  'QR',
  'SV',
  'GF',
  'WY',
  'KU',
  'RJ',
  'ME',
  'LY',
  // Russia/CIS
  'SU',
  'S7',
  'U6',
  'DP',
  'N4',
  'UT',
  'FV',
  'R3',
  'A9',
  'Y7',
  'B2',
  'KC',
  'HY',
  'J2',
  'PS',
  '5N',
  'WZ',
  'H5',
  'I8',
  // China
  'CA',
  'CZ',
  'MU',
  'HU',
  '3U',
  'ZH',
  'FM',
  'MF',
  'SC',
  'GS',
  'HO',
  '9C',
  'G5',
  // Hong Kong/Taiwan
  'CX',
  'HX',
  'BR',
  'CI',
  'UO',
  'HK',
  // Japan
  'JL',
  'NH',
  'MM',
  'BC',
  'JW',
  'GK',
  'DJ',
  'HD',
  '7G',
  // Korea
  'KE',
  'OZ',
  '7C',
  'LJ',
  'TW',
  'ZE',
  'BX',
  // Southeast Asia
  'SQ',
  'TR',
  'MH',
  'AK',
  'D7',
  'TG',
  'FD',
  'DD',
  'WE',
  'PG',
  'VN',
  'VJ',
  'QH',
  'GA',
  'QG',
  'JT',
  'ID',
  'PR',
  '5J',
  'Z2',
  // South Asia
  'AI',
  '6E',
  'UK',
  'SG',
  'G8',
  'UL',
  'PK',
  'RA',
  // Oceania
  'QF',
  'JQ',
  'VA',
  'NZ',
  'FJ',
  // Americas
  'AC',
  'WS',
  'AM',
  'Y4',
  '4O',
  'LA',
  'G3',
  'AD',
  'AR',
  'AV',
  'CM',
  // Africa
  'SA',
  'ET',
  'MS',
  'KQ',
  'AT',
  'RW',
  'WB',
])

// Alliance membership data
const ALLIANCE_DATA: Record<string, 'star_alliance' | 'oneworld' | 'skyteam'> = {
  // Star Alliance
  LH: 'star_alliance', // Lufthansa
  UA: 'star_alliance', // United
  AC: 'star_alliance', // Air Canada
  NH: 'star_alliance', // ANA
  SQ: 'star_alliance', // Singapore Airlines
  TK: 'star_alliance', // Turkish Airlines
  LO: 'star_alliance', // LOT Polish
  OS: 'star_alliance', // Austrian
  SK: 'star_alliance', // SAS
  TP: 'star_alliance', // TAP Portugal
  A3: 'star_alliance', // Aegean
  CA: 'star_alliance', // Air China
  OZ: 'star_alliance', // Asiana
  TG: 'star_alliance', // Thai Airways
  BR: 'star_alliance', // EVA Air
  NZ: 'star_alliance', // Air New Zealand
  ET: 'star_alliance', // Ethiopian
  MS: 'star_alliance', // EgyptAir
  SA: 'star_alliance', // South African Airways
  AI: 'star_alliance', // Air India
  LX: 'star_alliance', // Swiss
  SN: 'star_alliance', // Brussels Airlines
  OU: 'star_alliance', // Croatia Airlines
  AV: 'star_alliance', // Avianca
  CM: 'star_alliance', // Copa

  // OneWorld
  AA: 'oneworld', // American
  BA: 'oneworld', // British Airways
  QF: 'oneworld', // Qantas
  CX: 'oneworld', // Cathay Pacific
  JL: 'oneworld', // Japan Airlines
  IB: 'oneworld', // Iberia
  AY: 'oneworld', // Finnair
  QR: 'oneworld', // Qatar Airways
  S7: 'oneworld', // S7 Airlines
  AS: 'oneworld', // Alaska Airlines
  MH: 'oneworld', // Malaysia Airlines
  RJ: 'oneworld', // Royal Jordanian
  LA: 'oneworld', // LATAM
  UL: 'oneworld', // SriLankan
  FJ: 'oneworld', // Fiji Airways

  // SkyTeam
  AF: 'skyteam', // Air France
  KL: 'skyteam', // KLM
  DL: 'skyteam', // Delta
  KE: 'skyteam', // Korean Air
  MU: 'skyteam', // China Eastern
  CZ: 'skyteam', // China Southern
  SU: 'skyteam', // Aeroflot
  AZ: 'skyteam', // ITA Airways
  AR: 'skyteam', // Aerolineas Argentinas
  VN: 'skyteam', // Vietnam Airlines
  CI: 'skyteam', // China Airlines
  GA: 'skyteam', // Garuda Indonesia
  AM: 'skyteam', // Aeromexico
  OK: 'skyteam', // Czech Airlines
  RO: 'skyteam', // TAROM
  ME: 'skyteam', // Middle East Airlines
  SV: 'skyteam', // Saudia
  KQ: 'skyteam', // Kenya Airways
  XL: 'skyteam', // LATAM Ecuador
}

// Existing airline colors to preserve
const EXISTING_COLORS: Record<string, string> = {
  AA: '#0078D2',
  UA: '#002244',
  DL: '#003366',
  WN: '#304CB2',
  AS: '#00205B',
  B6: '#003876',
  F9: '#00AA00',
  NK: '#FFE600',
  HA: '#8B2346',
  BA: '#2E5C99',
  VS: '#DC143C',
  U2: '#FF6600',
  FR: '#073590',
  EI: '#006853',
  AF: '#002157',
  LH: '#05164D',
  LX: '#DC0019',
  OS: '#E20A16',
  KL: '#00A1E4',
  IB: '#D81E05',
  VY: '#FFCE00',
  AZ: '#008C45',
  SK: '#000080',
  AY: '#0B1560',
  DY: '#D81939',
  TP: '#009639',
  A3: '#083C6E',
  TK: '#C8102E',
  PC: '#FFD700',
  EK: '#D71A21',
  EY: '#BD8B13',
  QR: '#5C0632',
  SV: '#006633',
  GF: '#B30838',
  SU: '#FF6600',
  S7: '#8CC43C',
  JL: '#C8102E',
  NH: '#003087',
  CA: '#C70037',
  CZ: '#008AC5',
  MU: '#003876',
  HU: '#C8102E',
  CX: '#005F3E',
  HX: '#C8102E',
  BR: '#00A84F',
  CI: '#D31145',
  KE: '#0063AF',
  OZ: '#003D7C',
  SQ: '#F8A81D',
  TR: '#FFFF00',
  MH: '#C90632',
  AK: '#FF0000',
  TG: '#582C83',
  VN: '#08528F',
  VJ: '#E50019',
  GA: '#009A44',
  PR: '#00205B',
  AI: '#FF8C00',
  '6E': '#3F51B5',
  QF: '#E20A16',
  JQ: '#FF6600',
  VA: '#E4002B',
  NZ: '#221F1F',
  AC: '#F01428',
  WS: '#00A6A6',
  AM: '#00205B',
  Y4: '#780D4A',
  LA: '#10004F',
  G3: '#FF7300',
  AD: '#003087',
  AR: '#0072CE',
  AV: '#E4002B',
  CM: '#003F87',
  SA: '#FF7F00',
  ET: '#078930',
  MS: '#003A70',
  KQ: '#C8102E',
  AT: '#C4122E',
  LY: '#003DA5',
  W6: '#C6007E',
  LO: '#003A70',
  OK: '#003A70',
  FB: '#00A3E0',
  RO: '#003087',
  JU: '#E4002B',
  OU: '#003087',
  PS: '#0057B8',
  BT: '#00A651',
  EN: '#1E3264',
  '4U': '#7B0051',
  EW: '#A4005E',
  A9: '#DA291C',
  R3: '#005E8B',
}

// Additional airline colors for new airlines
const NEW_AIRLINE_COLORS: Record<string, string> = {
  // Russian/CIS
  U6: '#FF6B00', // Ural Airlines - orange
  DP: '#FF0000', // Pobeda - red
  N4: '#1E3A8A', // Nordwind - navy blue
  UT: '#003399', // UTair - blue
  FV: '#E4002B', // Rossiya - red
  B2: '#00A651', // Belavia - green
  KC: '#0066B3', // Air Astana - blue
  HY: '#00529B', // Uzbekistan Airways - blue
  J2: '#0066CC', // Azerbaijan Airlines - blue

  // East Asian
  '3U': '#E31837', // Sichuan Airlines - red
  ZH: '#00529B', // Shenzhen Airlines - blue
  FM: '#E31837', // Shanghai Airlines - red
  MF: '#003399', // Xiamen Airlines - blue
  SC: '#00529B', // Shandong Airlines - blue
  GS: '#E31837', // Tianjin Airlines - red
  HO: '#E31837', // Juneyao Airlines - red
  '9C': '#00A651', // Spring Airlines - green
  MM: '#FF69B4', // Peach Aviation - pink
  BC: '#FFD700', // Skymark Airlines - yellow
  '7C': '#FF6600', // Jeju Air - orange
  LJ: '#00529B', // Jin Air - blue
  TW: '#E31837', // T'way Air - red
  ZE: '#FFD700', // Eastar Jet - yellow

  // European LCCs
  D8: '#D81939', // Norwegian Air Sweden - red
  LS: '#ED1C24', // Jet2 - red
  HV: '#00A651', // Transavia - green
  V7: '#8BC34A', // Volotea - lime green
  TO: '#00A651', // Transavia France - green
}

interface Airport {
  iata: string
  icao: string | null
  name: string
  city: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
  timezone: string
}

interface Airline {
  iata: string
  icao: string | null
  name: string
  country: string
  logoUrl: string | null
  primaryColor: string | null
  alliance: 'star_alliance' | 'oneworld' | 'skyteam' | null
  callsign: string | null
}

// Country name to ISO code mapping (partial, for OpenFlights data)
const COUNTRY_TO_CODE: Record<string, string> = {
  Russia: 'RU',
  'United States': 'US',
  'United Kingdom': 'GB',
  Germany: 'DE',
  France: 'FR',
  Italy: 'IT',
  Spain: 'ES',
  Portugal: 'PT',
  Netherlands: 'NL',
  Belgium: 'BE',
  Switzerland: 'CH',
  Austria: 'AT',
  Ireland: 'IE',
  Sweden: 'SE',
  Norway: 'NO',
  Denmark: 'DK',
  Finland: 'FI',
  Iceland: 'IS',
  Poland: 'PL',
  'Czech Republic': 'CZ',
  Czechia: 'CZ',
  Hungary: 'HU',
  Romania: 'RO',
  Bulgaria: 'BG',
  Greece: 'GR',
  Croatia: 'HR',
  Serbia: 'RS',
  Slovenia: 'SI',
  Slovakia: 'SK',
  'Bosnia and Herzegovina': 'BA',
  Montenegro: 'ME',
  'North Macedonia': 'MK',
  Macedonia: 'MK',
  Albania: 'AL',
  Kosovo: 'XK',
  Estonia: 'EE',
  Latvia: 'LV',
  Lithuania: 'LT',
  Cyprus: 'CY',
  Malta: 'MT',
  Luxembourg: 'LU',
  Ukraine: 'UA',
  Belarus: 'BY',
  Moldova: 'MD',
  Georgia: 'GE',
  Azerbaijan: 'AZ',
  Armenia: 'AM',
  Kazakhstan: 'KZ',
  Uzbekistan: 'UZ',
  Kyrgyzstan: 'KG',
  Tajikistan: 'TJ',
  Turkmenistan: 'TM',
  China: 'CN',
  Japan: 'JP',
  'South Korea': 'KR',
  Korea: 'KR',
  Taiwan: 'TW',
  'Hong Kong': 'HK',
  Macau: 'MO',
  Singapore: 'SG',
  Malaysia: 'MY',
  Thailand: 'TH',
  Vietnam: 'VN',
  Indonesia: 'ID',
  Philippines: 'PH',
  Myanmar: 'MM',
  Burma: 'MM',
  Cambodia: 'KH',
  Laos: 'LA',
  Brunei: 'BN',
  Maldives: 'MV',
  India: 'IN',
  Bangladesh: 'BD',
  'Sri Lanka': 'LK',
  Pakistan: 'PK',
  Nepal: 'NP',
  'United Arab Emirates': 'AE',
  Qatar: 'QA',
  'Saudi Arabia': 'SA',
  Bahrain: 'BH',
  Oman: 'OM',
  Kuwait: 'KW',
  Israel: 'IL',
  Jordan: 'JO',
  Lebanon: 'LB',
  Turkey: 'TR',
  Iran: 'IR',
  Iraq: 'IQ',
  Canada: 'CA',
  Mexico: 'MX',
  Panama: 'PA',
  'Costa Rica': 'CR',
  Cuba: 'CU',
  'Dominican Republic': 'DO',
  Jamaica: 'JM',
  Barbados: 'BB',
  'Trinidad and Tobago': 'TT',
  'Puerto Rico': 'PR',
  Guatemala: 'GT',
  Nicaragua: 'NI',
  Honduras: 'HN',
  'El Salvador': 'SV',
  Belize: 'BZ',
  Brazil: 'BR',
  Argentina: 'AR',
  Chile: 'CL',
  Colombia: 'CO',
  Peru: 'PE',
  Venezuela: 'VE',
  Ecuador: 'EC',
  Uruguay: 'UY',
  Paraguay: 'PY',
  Bolivia: 'BO',
  Guyana: 'GY',
  Suriname: 'SR',
  Australia: 'AU',
  'New Zealand': 'NZ',
  'South Africa': 'ZA',
  Egypt: 'EG',
  Kenya: 'KE',
  Morocco: 'MA',
  Nigeria: 'NG',
  Ethiopia: 'ET',
  Tunisia: 'TN',
  Algeria: 'DZ',
  Tanzania: 'TZ',
  Ghana: 'GH',
  Uganda: 'UG',
  Rwanda: 'RW',
  Mauritius: 'MU',
  Seychelles: 'SC',
  Senegal: 'SN',
  'Ivory Coast': 'CI',
  "Côte d'Ivoire": 'CI',
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseAirports(filePath: string): Airport[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter((l) => l.trim())
  const airports: Airport[] = []

  for (const line of lines) {
    const fields = parseCSVLine(line)
    // OpenFlights airport format:
    // 0: ID, 1: Name, 2: City, 3: Country, 4: IATA, 5: ICAO,
    // 6: Latitude, 7: Longitude, 8: Altitude, 9: Timezone offset,
    // 10: DST, 11: Timezone name, 12: Type, 13: Source

    const iata = fields[4]
    const icao = fields[5]
    const name = fields[1]
    const city = fields[2]
    const country = fields[3]
    const lat = parseFloat(fields[6])
    const lng = parseFloat(fields[7])
    const timezone = fields[11]

    // Skip if no IATA code or invalid coordinates
    if (!iata || iata === '\\N' || iata.length !== 3) continue
    if (isNaN(lat) || isNaN(lng)) continue
    if (!timezone || timezone === '\\N') continue

    // Get country code
    const countryCode = COUNTRY_TO_CODE[country]
    if (!countryCode) continue

    // Filter by target countries
    if (!TARGET_COUNTRIES.has(countryCode)) continue

    // Only include airports in the priority list
    if (!PRIORITY_AIRPORTS.has(iata.toUpperCase())) continue

    airports.push({
      iata: iata.toUpperCase(),
      icao: icao && icao !== '\\N' ? icao.toUpperCase() : null,
      name,
      city,
      country,
      countryCode,
      latitude: lat,
      longitude: lng,
      timezone,
    })
  }

  // Remove duplicates (keep first occurrence)
  const seen = new Set<string>()
  return airports.filter((a) => {
    if (seen.has(a.iata)) return false
    seen.add(a.iata)
    return true
  })
}

function parseAirlines(filePath: string): Airline[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter((l) => l.trim())
  const airlines: Airline[] = []

  for (const line of lines) {
    const fields = parseCSVLine(line)
    // OpenFlights airline format:
    // 0: ID, 1: Name, 2: Alias, 3: IATA, 4: ICAO, 5: Callsign, 6: Country, 7: Active

    const name = fields[1]
    const iata = fields[3]
    const icao = fields[4]
    const callsign = fields[5]
    const country = fields[6]
    const active = fields[7]

    // Skip if no IATA code or inactive
    if (!iata || iata === '\\N' || iata === '-' || iata.length !== 2) continue
    if (active !== 'Y') continue
    if (!country || country === '\\N') continue

    // Only include IATA codes that are valid (A-Z and 0-9 only)
    if (!/^[A-Z0-9]{2}$/.test(iata.toUpperCase())) continue

    // Only include airlines in the priority list
    if (!PRIORITY_AIRLINES.has(iata.toUpperCase())) continue

    airlines.push({
      iata: iata.toUpperCase(),
      icao: icao && icao !== '\\N' ? icao.toUpperCase() : null,
      name,
      country,
      logoUrl: null,
      primaryColor:
        EXISTING_COLORS[iata.toUpperCase()] || NEW_AIRLINE_COLORS[iata.toUpperCase()] || null,
      alliance: ALLIANCE_DATA[iata.toUpperCase()] || null,
      callsign: callsign && callsign !== '\\N' ? callsign : null,
    })
  }

  // Remove duplicates (keep first occurrence)
  const seen = new Set<string>()
  return airlines.filter((a) => {
    if (seen.has(a.iata)) return false
    seen.add(a.iata)
    return true
  })
}

// Read existing data to preserve any manual additions
// Only keep airports that are in the priority list
function loadExistingAirports(filePath: string): Map<string, Airport> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data: Airport[] = JSON.parse(content)
    // Only keep airports that are in the priority list
    return new Map(data.filter((a) => PRIORITY_AIRPORTS.has(a.iata)).map((a) => [a.iata, a]))
  } catch {
    return new Map()
  }
}

function loadExistingAirlines(filePath: string): Map<string, Airline> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data: any[] = JSON.parse(content)
    // Add new fields if missing, and filter to priority airlines only
    return new Map(
      data
        .filter((a) => PRIORITY_AIRLINES.has(a.iata))
        .map((a) => [
          a.iata,
          {
            ...a,
            alliance: a.alliance || ALLIANCE_DATA[a.iata] || null,
            callsign: a.callsign || null,
          },
        ]),
    )
  } catch {
    return new Map()
  }
}

function main() {
  const scriptsDir = path.dirname(__filename)
  const dataDir = path.join(scriptsDir, '..', 'packages', 'data', 'src')

  console.log('Parsing OpenFlights data...')

  // Parse raw data
  const rawAirports = parseAirports(path.join(scriptsDir, 'airports-raw.dat'))
  const rawAirlines = parseAirlines(path.join(scriptsDir, 'airlines-raw.dat'))

  console.log(`Parsed ${rawAirports.length} airports from OpenFlights`)
  console.log(`Parsed ${rawAirlines.length} airlines from OpenFlights`)

  // Load existing data
  const existingAirports = loadExistingAirports(path.join(dataDir, 'airports.json'))
  const existingAirlines = loadExistingAirlines(path.join(dataDir, 'airlines.json'))

  console.log(`Found ${existingAirports.size} existing airports`)
  console.log(`Found ${existingAirlines.size} existing airlines`)

  // Merge: prefer existing data, add new from OpenFlights
  const mergedAirports = new Map(existingAirports)
  for (const airport of rawAirports) {
    if (!mergedAirports.has(airport.iata)) {
      mergedAirports.set(airport.iata, airport)
    }
  }

  const mergedAirlines = new Map(existingAirlines)
  for (const airline of rawAirlines) {
    if (!mergedAirlines.has(airline.iata)) {
      mergedAirlines.set(airline.iata, airline)
    } else {
      // Update existing with new fields
      const existing = mergedAirlines.get(airline.iata)!
      mergedAirlines.set(airline.iata, {
        ...existing,
        alliance: existing.alliance || airline.alliance,
        callsign: existing.callsign || airline.callsign,
      })
    }
  }

  // Convert to arrays and sort
  const finalAirports = Array.from(mergedAirports.values()).sort((a, b) =>
    a.iata.localeCompare(b.iata),
  )

  const finalAirlines = Array.from(mergedAirlines.values()).sort((a, b) =>
    a.iata.localeCompare(b.iata),
  )

  console.log(`\nFinal counts:`)
  console.log(`  Airports: ${finalAirports.length}`)
  console.log(`  Airlines: ${finalAirlines.length}`)

  // Write output
  fs.writeFileSync(
    path.join(dataDir, 'airports.json'),
    JSON.stringify(finalAirports, null, 2) + '\n',
  )

  fs.writeFileSync(
    path.join(dataDir, 'airlines.json'),
    JSON.stringify(finalAirlines, null, 2) + '\n',
  )

  // Print statistics
  const airportsByCountry = new Map<string, number>()
  for (const airport of finalAirports) {
    airportsByCountry.set(
      airport.countryCode,
      (airportsByCountry.get(airport.countryCode) || 0) + 1,
    )
  }

  console.log('\nAirports by country (top 20):')
  const sorted = Array.from(airportsByCountry.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
  for (const [code, count] of sorted) {
    console.log(`  ${code}: ${count}`)
  }

  const allianceCounts = { star_alliance: 0, oneworld: 0, skyteam: 0 }
  for (const airline of finalAirlines) {
    if (airline.alliance) {
      allianceCounts[airline.alliance]++
    }
  }
  console.log('\nAirlines by alliance:')
  console.log(`  Star Alliance: ${allianceCounts.star_alliance}`)
  console.log(`  OneWorld: ${allianceCounts.oneworld}`)
  console.log(`  SkyTeam: ${allianceCounts.skyteam}`)

  console.log('\nDone!')
}

main()
