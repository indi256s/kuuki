import type { BadgeTrackId } from './badge-tracks'

type FlavorState = 'empty' | 'active' | 'high'

// 3 variants per state per track, selected by value % 3
const FLAVOR_TEXT: Record<BadgeTrackId, Record<FlavorState, string[]>> = {
  flights: {
    empty: [
      'No experiments conducted. Yet.',
      'The launch pad remains cold.',
      'Flight log: blank. How novel.',
    ],
    active: [
      'The subject shows signs of mobility.',
      'Logging missions for science.',
      'Atmospheric re-entries: survivable so far.',
    ],
    high: [
      'The flight log requires additional storage.',
      'Air traffic control sends their regards.',
      'You could staff a small airline.',
    ],
  },
  distance: {
    empty: [
      'Displacement: zero. Fascinating.',
      'Current range: your parking lot.',
      'The odometer appears... decorative.',
    ],
    active: [
      'Measurable displacement detected.',
      'The curvature of the Earth becomes relevant.',
      'Distance: non-trivial.',
    ],
    high: [
      'Distance traveled exceeds reasonable parameters.',
      'Fuel consumption data has been forwarded to accounting.',
      'You have exceeded the warranty on most spacecraft.',
    ],
  },
  airlines: {
    empty: [
      'Corporate loyalty data: insufficient.',
      'No airline alliances formed.',
      'Brand allegiance: undetermined.',
    ],
    active: [
      'Portfolio diversification: adequate.',
      'The loyalty programs are getting suspicious.',
      'Multiple cabin crew have your order memorized.',
    ],
    high: [
      'You collect airlines like frequent flyer miles.',
      'The airline industry thanks you personally.',
      'Brand loyalty: distributed across the industry.',
    ],
  },
  aircraft: {
    empty: [
      'Fleet familiarity: nonexistent.',
      'Aircraft recognition skills: untested.',
      'The hangar remains empty.',
    ],
    active: [
      'Developing a discerning fuselage palate.',
      'You can distinguish a narrowbody at 500 meters.',
      'The spotting log grows.',
    ],
    high: [
      'You could write the aircraft recognition manual.',
      'Boeing and Airbus both claim you as a reference customer.',
      'Fleet expertise: encyclopedic.',
    ],
  },
  cities: {
    empty: [
      'No urban areas infiltrated.',
      'City count: your home address.',
      'Metropolitan exposure: pending.',
    ],
    active: [
      'Urban data collection: in progress.',
      'Multiple city grids successfully navigated.',
      'The concrete jungle expands.',
    ],
    high: [
      'You have a favorite coffee shop on every continent.',
      'City navigation: muscle memory at this point.',
      'Urban sprawl: your natural habitat.',
    ],
  },
  time_in_air: {
    empty: [
      'Time suspended above ground: negligible.',
      'Atmospheric residency: zero.',
      'Gravity remains your primary employer.',
    ],
    active: [
      'Atmospheric exposure within acceptable limits.',
      'Significant time at cruising altitude logged.',
      'The tray table has become a second desk.',
    ],
    high: [
      'Extended atmospheric residency noted.',
      'You qualify for in-flight citizenship.',
      'The cabin crew considers you permanent staff.',
    ],
  },
  continents: {
    empty: [
      'Continental coverage: minimal.',
      'Tectonic plate exploration: local only.',
      'The other continents remain theoretical.',
    ],
    active: [
      'Multiple tectonic plates confirmed.',
      'Continental drift: you are faster.',
      'Pangaea reassembly: in progress.',
    ],
    high: [
      'Planetary coverage: comprehensive.',
      'You have opinions about every hemisphere.',
      'Continental collection: nearly complete.',
    ],
  },
  airports: {
    empty: [
      'Tower communications: silent.',
      'Airport familiarity: departures only.',
      'Terminal count: insufficient.',
    ],
    active: [
      'ATC frequency: active.',
      'You know which terminals have the good lounges.',
      'Runway preferences are forming.',
    ],
    high: [
      'You could draw the taxiway layouts from memory.',
      'Airport codes: your second language.',
      'Ground control considers you a regular.',
    ],
  },
  countries: {
    empty: [
      'Territorial range: your current coordinates.',
      'Border crossings: pending authorization.',
      'Sovereignty exposure: domestic only.',
    ],
    active: [
      'Passport stamps accumulating nicely.',
      'Multiple jurisdictions acknowledge your existence.',
      'The stamp collection grows.',
    ],
    high: [
      'Immigration officers recognize you by name.',
      'Your passport requires supplementary pages.',
      'Diplomatic immunity: pending application.',
    ],
  },
}

function getFlavorState(tierIndex: number): FlavorState {
  if (tierIndex < 0) return 'empty'
  if (tierIndex <= 1) return 'active'
  return 'high'
}

export function getFlavorText(trackId: BadgeTrackId, tierIndex: number, value: number): string {
  const state = getFlavorState(tierIndex)
  const variants = FLAVOR_TEXT[trackId][state]
  return variants[Math.abs(value) % variants.length]
}

export function getTimeRelatable(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes < 60) return 'A quick hop through the atmosphere'
  if (minutes < 1440) {
    const movies = Math.round(minutes / 120)
    return movies === 1 ? 'About one in-flight movie' : `That's about ${movies} movies`
  }
  const days = Math.round(minutes / 1440)
  if (days <= 7) return 'A vacation spent in the sky'
  if (days <= 30) return 'Two weeks above the clouds'
  return 'A full month at cruising altitude'
}
