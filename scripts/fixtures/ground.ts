// Ground journeys seeded through the API for a@example.test; `request` is the harness fetch against the Worker.
type GroundRequest = (
  path: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; text(): Promise<string> }>

// [id, name, ISO country, lon, lat]: GeoNames-shaped snapshots the journeys API accepts as given.
const GROUND_PLACES = {
  paris: ['2988507', 'Paris', 'FR', 2.3522, 48.8566],
  frankfurt: ['2925533', 'Frankfurt', 'DE', 8.6821, 50.1109],
  berlin: ['2950159', 'Berlin', 'DE', 13.405, 52.52],
  vienna: ['2761369', 'Vienna', 'AT', 16.3738, 48.2082],
  budapest: ['3054643', 'Budapest', 'HU', 19.0402, 47.4979],
  munich: ['2867714', 'Munich', 'DE', 11.582, 48.1351],
  salzburg: ['2766824', 'Salzburg', 'AT', 13.055, 47.8095],
  innsbruck: ['2775220', 'Innsbruck', 'AT', 11.4041, 47.2692],
  prague: ['3067696', 'Prague', 'CZ', 14.4378, 50.0755],
} as const
const groundPlace = (key: keyof typeof GROUND_PLACES) => {
  const [id, name, countryCode, lon, lat] = GROUND_PLACES[key]
  return {
    source: 'geonames',
    id,
    name,
    nameRu: null,
    nameEn: name,
    countryCode,
    region: null,
    lat,
    lon,
    timezone: null,
    catalogVersion: 'fixture',
  }
}
type GroundPlaceKey = keyof typeof GROUND_PLACES
const GROUND_JOURNEYS: Array<{
  mode: 'rail' | 'road'
  status: 'completed' | 'planned'
  title: string
  startDate: string
  endDate: string
  places: GroundPlaceKey[]
  countries: string[]
}> = [
  {
    mode: 'rail',
    status: 'completed',
    title: 'Paris to Berlin',
    startDate: '2025-06-10',
    endDate: '2025-06-12',
    places: ['paris', 'frankfurt', 'berlin'],
    countries: ['DE', 'FR'],
  },
  {
    mode: 'rail',
    status: 'completed',
    title: 'Vienna to Budapest',
    startDate: '2024-09-14',
    endDate: '2024-09-14',
    places: ['vienna', 'budapest'],
    countries: ['AT', 'HU'],
  },
  {
    mode: 'road',
    status: 'completed',
    title: 'Alpine drive',
    startDate: '2026-04-18',
    endDate: '2026-04-20',
    places: ['munich', 'salzburg', 'innsbruck'],
    countries: ['AT', 'DE'],
  },
  {
    mode: 'rail',
    status: 'planned',
    title: 'Berlin to Prague',
    startDate: '2026-11-21',
    endDate: '2026-11-22',
    places: ['berlin', 'prague'],
    countries: [],
  },
]

export async function seedGroundJourneys(
  request: GroundRequest,
  origin: string,
  cookie: string,
  csrf: string,
) {
  for (const [index, spec] of GROUND_JOURNEYS.entries()) {
    const places = spec.places.map(groundPlace)
    const fields = {
      title: spec.title,
      note: null,
      startDate: spec.startDate,
      endDate: spec.endDate,
    }
    const journey =
      spec.mode === 'rail'
        ? {
            mode: 'rail',
            ...fields,
            legs: places.slice(1).map((to, leg) => ({
              id: crypto.randomUUID(),
              from: places[leg],
              to,
              fromStation: null,
              toStation: null,
              trainNumber: null,
              operator: null,
              departureDate: null,
              departureTime: null,
              arrivalDate: null,
              arrivalTime: null,
              durationMinutes: null,
            })),
          }
        : {
            mode: 'road',
            ...fields,
            points: places.map((place) => ({
              id: crypto.randomUUID(),
              place,
              arrivalDate: null,
              departureDate: null,
              nights: null,
              note: null,
            })),
          }
    const response = await request('/api/ground-journeys', {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: cookie,
        'X-CSRF-Token': csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        operationKey: `next-fixture-ground-${String(index + 1).padStart(3, '0')}`,
        journeyId: crypto.randomUUID(),
        status: spec.status,
        journey,
        ...(spec.status === 'completed' ? { countries: spec.countries } : {}),
      }),
    })
    if (response.status !== 201)
      throw new Error(
        `Synthetic ground journey create failed: ${response.status} ${await response.text()}`,
      )
  }
}
