// Pure list shaping for the ground-travel page: filter, order and group by the shared contract.

import {
  compareJourneys,
  listGroup,
  type GroundJourneyDto,
  type GroundMode,
  type ListGroup,
} from '@kuuki/shared/groundTravel'

export type Section = { id: 'plans' | 'history' | 'cancelled'; journeys: GroundJourneyDto[] }

/** Journeys of the chosen mode (all when null), in contract order for `today`. */
export function visibleJourneys(
  journeys: readonly GroundJourneyDto[],
  mode: GroundMode | null,
  today: string,
): GroundJourneyDto[] {
  return journeys.filter((journey) => !mode || journey.mode === mode).sort(compareJourneys(today))
}

/** Plans first, then history; the cancelled view is one section. Empty sections are omitted. */
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

/** First and last city of a journey, in route order. */
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
