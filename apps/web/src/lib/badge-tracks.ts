export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export type BadgeTrackId =
  | 'flights' | 'distance' | 'airlines' | 'aircraft'
  | 'cities' | 'time_in_air' | 'continents' | 'airports' | 'countries'

export interface BadgeThreshold {
  tier: BadgeTier
  value: number
  badgeCode: string
  name: string  // display name from badge_definitions
}

export interface BadgeTrack {
  id: BadgeTrackId
  statKey: string
  thresholds: BadgeThreshold[]
  icon: string  // lucide icon name
  format: 'number' | 'distance' | 'duration'
}

export const BADGE_TRACKS: Record<BadgeTrackId, BadgeTrack> = {
  flights: {
    id: 'flights',
    statKey: 'totalFlights',
    icon: 'plane',
    format: 'number',
    thresholds: [
      { tier: 'bronze', value: 1, badgeCode: 'flights-1', name: 'Launch Pad' },
      { tier: 'silver', value: 25, badgeCode: 'flights-2', name: 'Low Orbit' },
      { tier: 'gold', value: 50, badgeCode: 'flights-3', name: 'High Orbit' },
      { tier: 'platinum', value: 100, badgeCode: 'flights-4', name: 'Moon Mission' },
      { tier: 'diamond', value: 500, badgeCode: 'flights-5', name: 'Mars Mission' },
    ],
  },
  distance: {
    id: 'distance',
    statKey: 'totalDistance',
    icon: 'route',
    format: 'distance',
    thresholds: [
      { tier: 'bronze', value: 10000, badgeCode: 'distance-1', name: 'Sputnik' },
      { tier: 'silver', value: 50000, badgeCode: 'distance-2', name: 'Vostok' },
      { tier: 'gold', value: 100000, badgeCode: 'distance-3', name: 'Apollo' },
      { tier: 'platinum', value: 500000, badgeCode: 'distance-4', name: 'Voyager' },
      { tier: 'diamond', value: 1000000, badgeCode: 'distance-5', name: 'New Horizons' },
    ],
  },
  airlines: {
    id: 'airlines',
    statKey: 'uniqueAirlines',
    icon: 'building-2',
    format: 'number',
    thresholds: [
      { tier: 'bronze', value: 5, badgeCode: 'airlines-1', name: 'Loyal' },
      { tier: 'silver', value: 15, badgeCode: 'airlines-2', name: 'Diverse' },
      { tier: 'gold', value: 30, badgeCode: 'airlines-3', name: 'Collector' },
    ],
  },
  aircraft: {
    id: 'aircraft',
    statKey: 'uniqueAircraft',
    icon: 'plane',
    format: 'number',
    thresholds: [
      { tier: 'bronze', value: 5, badgeCode: 'aircraft-1', name: 'Spotter' },
      { tier: 'silver', value: 20, badgeCode: 'aircraft-2', name: 'Enthusiast' },
      { tier: 'gold', value: 50, badgeCode: 'aircraft-3', name: 'Fleet Master' },
    ],
  },
  cities: {
    id: 'cities',
    statKey: 'uniqueCities',
    icon: 'building',
    format: 'number',
    thresholds: [
      { tier: 'bronze', value: 5, badgeCode: 'cities-1', name: 'Outpost Alpha' },
      { tier: 'silver', value: 20, badgeCode: 'cities-2', name: 'Orbital Station' },
      { tier: 'gold', value: 50, badgeCode: 'cities-3', name: 'Skylab' },
      { tier: 'platinum', value: 100, badgeCode: 'cities-4', name: 'Mir' },
      { tier: 'diamond', value: 200, badgeCode: 'cities-5', name: 'ISS Commander' },
    ],
  },
  time_in_air: {
    id: 'time_in_air',
    statKey: 'totalDuration',
    icon: 'clock',
    format: 'duration',
    thresholds: [
      { tier: 'bronze', value: 1440, badgeCode: 'airtime-1', name: 'Time Slip' },
      { tier: 'silver', value: 7200, badgeCode: 'airtime-2', name: 'Temporal Drift' },
      { tier: 'gold', value: 21600, badgeCode: 'airtime-3', name: 'Chrono Shift' },
      { tier: 'platinum', value: 43200, badgeCode: 'airtime-4', name: 'Time Dilation' },
      { tier: 'diamond', value: 129600, badgeCode: 'airtime-5', name: 'Event Horizon' },
    ],
  },
  continents: {
    id: 'continents',
    statKey: 'continentsCount',
    icon: 'globe',
    format: 'number',
    thresholds: [
      { tier: 'bronze', value: 2, badgeCode: 'continents-1', name: 'Hemispheric' },
      { tier: 'silver', value: 3, badgeCode: 'continents-2', name: 'Meridian Crosser' },
      { tier: 'gold', value: 4, badgeCode: 'continents-3', name: 'Pangaea Seeker' },
      { tier: 'platinum', value: 5, badgeCode: 'continents-4', name: 'Circumnavigator' },
      { tier: 'diamond', value: 6, badgeCode: 'continents-5', name: 'Full Orbital' },
    ],
  },
  airports: {
    id: 'airports',
    statKey: 'uniqueAirports',
    icon: 'tower-control',
    format: 'number',
    thresholds: [
      { tier: 'bronze', value: 5, badgeCode: 'airports-1', name: 'Tower Contact' },
      { tier: 'silver', value: 20, badgeCode: 'airports-2', name: 'Approach Control' },
      { tier: 'gold', value: 50, badgeCode: 'airports-3', name: 'ATC Veteran' },
      { tier: 'platinum', value: 100, badgeCode: 'airports-4', name: 'TRACON Master' },
      { tier: 'diamond', value: 200, badgeCode: 'airports-5', name: 'Global ATC' },
    ],
  },
  countries: {
    id: 'countries',
    statKey: 'uniqueCountries',
    icon: 'flag',
    format: 'number',
    thresholds: [
      { tier: 'bronze', value: 5, badgeCode: 'countries-1', name: 'Border Crosser' },
      { tier: 'silver', value: 15, badgeCode: 'countries-2', name: 'Territory Scout' },
      { tier: 'gold', value: 30, badgeCode: 'countries-3', name: 'Sovereignty Collector' },
      { tier: 'platinum', value: 50, badgeCode: 'countries-4', name: 'Diplomatic Clearance' },
      { tier: 'diamond', value: 100, badgeCode: 'countries-5', name: 'Planetary Survey' },
    ],
  },
}

// Helper to get all track IDs
export const BADGE_TRACK_IDS = Object.keys(BADGE_TRACKS) as BadgeTrackId[]
