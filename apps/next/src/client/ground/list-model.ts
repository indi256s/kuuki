import {
  compareJourneys,
  listGroup,
  railRouteRuns,
  type GroundJourneyDto,
  type GroundPlaceSnapshot,
  type GroundMode,
  type ListGroup,
} from '@kuuki/shared/groundTravel'

export type Section = { id: 'plans' | 'history' | 'cancelled'; journeys: GroundJourneyDto[] }

export function visibleJourneys(
  journeys: readonly GroundJourneyDto[],
  mode: GroundMode | null,
  today: string,
): GroundJourneyDto[] {
  return journeys.filter((journey) => !mode || journey.mode === mode).sort(compareJourneys(today))
}

export function sectionsOf(journeys: readonly GroundJourneyDto[], today: string): Section[] {
  const buckets: Record<Section['id'], GroundJourneyDto[]> = {
    plans: [],
    history: [],
    cancelled: [],
  }
  for (const journey of journeys) {
    const group = listGroup(journey, today)
    buckets[group === 'history' ? 'history' : group === 'cancelled' ? 'cancelled' : 'plans'].push(
      journey,
    )
  }
  return (['plans', 'history', 'cancelled'] as const)
    .map((id) => ({ id, journeys: buckets[id] }))
    .filter((section) => section.journeys.length > 0)
}

export const groupOf = (journey: GroundJourneyDto, today: string): ListGroup =>
  listGroup(journey, today)

export function endpoints(journey: GroundJourneyDto) {
  if (journey.mode === 'rail') {
    const first = journey.legs[0]
    const last = journey.legs[journey.legs.length - 1]
    return { from: first?.from ?? null, to: last?.to ?? null, steps: journey.legs.length }
  }
  const first = journey.points[0]
  const last = journey.points[journey.points.length - 1]
  return { from: first?.place ?? null, to: last?.place ?? null, steps: journey.points.length }
}

export type RouteStop = {
  place: GroundPlaceSnapshot
  role: 'start' | 'via' | 'end'
  afterGap: boolean
}

export function routeStops(journey: GroundJourneyDto): RouteStop[] {
  const runs =
    journey.mode === 'rail'
      ? railRouteRuns(journey.legs)
      : [journey.points.map((point) => point.place)]
  const flat = runs.flatMap((run, r) =>
    run.map((place, i) => ({ place, afterGap: r > 0 && i === 0 })),
  )
  return flat.map((stop, i) => ({
    ...stop,
    role: i === 0 ? 'start' : i === flat.length - 1 ? 'end' : 'via',
  }))
}
