// Owner reads of ground journeys: DTO assembly (few batched queries), list order and totals, publication
// readiness and operation receipts (.scratch/ground-travel/storage-contract.md).
import {
  compareJourneys,
  journeyMetrics,
  modeTotals,
  segmentKm,
  type DerivedPublication,
  type GroundAction,
  type GroundJourneyDto,
  type GroundJourneyList,
  type GroundMode,
  type GroundOperationStatus,
  type GroundPlaceSnapshot,
  type GroundStatus,
  type RailLegDto,
  type RoadPointDto,
} from '../../../packages/shared/src/groundTravel'
import { firstOf, rowsOf } from './stats'
import { stateOf, type DerivedStateRow } from './derivedState'

interface JourneyRow {
  id: string
  mode: GroundMode
  status: GroundStatus
  version: number
  start_date: string | null
  end_date: string | null
  title: string | null
  note: string | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
}

interface LegRow {
  journey_id: string
  id: string
  from_place: string
  to_place: string
  from_station: string | null
  to_station: string | null
  train_number: string | null
  operator: string | null
  departure_date: string | null
  departure_time: string | null
  arrival_date: string | null
  arrival_time: string | null
  duration_minutes: number | null
  duration_source: 'manual' | 'schedule' | null
}

interface PointRow {
  journey_id: string
  id: string
  place: string
  arrival_date: string | null
  departure_date: string | null
  nights: number | null
  note: string | null
}

interface CountryRow {
  journey_id: string
  country_code: string
}

export interface ReceiptRow {
  kind: string
  request_digest: string
  journey_id: string
  outcome: 'saved' | 'deleted'
  result_version: number
  account_revision: number
}

const RECEIPT_COLUMNS =
  'kind, request_digest, journey_id, outcome, result_version, account_revision'

/** Completed receipts of this owner and key that have not expired; an expired receipt reads as absent. */
export const receiptStatement = (db: D1Database, userId: string, key: string, instant: string) =>
  db
    .prepare(
      `SELECT ${RECEIPT_COLUMNS} FROM ground_operation_receipts
       WHERE user_id = ? AND operation_key = ? AND complete = 1 AND expires_at > ?`,
    )
    .bind(userId, key, instant)

const round1 = (km: number | null) => (km === null ? null : Math.round(km * 10) / 10)

/** Owner-wide child reads; exported so tests can EXPLAIN the exact SQL that runs. */
export const childReadSql = {
  legs: (childScope: string) =>
    `SELECT journey_id, id, from_place, to_place, from_station, to_station, train_number, operator,
            departure_date, departure_time, arrival_date, arrival_time, duration_minutes, duration_source
     FROM ground_rail_legs WHERE user_id = ?${childScope} ORDER BY journey_id, ordinal`,
  points: (childScope: string) =>
    `SELECT journey_id, id, place, arrival_date, departure_date, nights, note
     FROM ground_road_points WHERE user_id = ?${childScope} ORDER BY journey_id, ordinal`,
  countries: (childScope: string) =>
    `SELECT journey_id, country_code FROM ground_journey_countries
     WHERE user_id = ?${childScope} ORDER BY journey_id, country_code`,
}

/** Live journeys of one owner (optionally a single id) with children, countries and metrics; unsorted. */
export async function readOwnerJourneys(
  db: D1Database,
  userId: string,
  journeyId?: string,
): Promise<GroundJourneyDto[]> {
  const scope = journeyId ? ' AND id = ?' : ''
  const childScope = journeyId ? ' AND journey_id = ?' : ''
  const args = journeyId ? [userId, journeyId] : [userId]
  const [journeys, legs, points, countries] = await db.batch([
    db
      .prepare(
        `SELECT id, mode, status, version, start_date, end_date, title, note, created_at, updated_at, confirmed_at
         FROM ground_journeys WHERE user_id = ? AND deleted_at IS NULL${scope}`,
      )
      .bind(...args),
    db.prepare(childReadSql.legs(childScope)).bind(...args),
    db.prepare(childReadSql.points(childScope)).bind(...args),
    db.prepare(childReadSql.countries(childScope)).bind(...args),
  ])

  const group = <T extends { journey_id: string }>(rows: T[]) => {
    const byJourney = new Map<string, T[]>()
    for (const row of rows)
      byJourney.set(row.journey_id, [...(byJourney.get(row.journey_id) ?? []), row])
    return byJourney
  }
  const legsOf = group(rowsOf<LegRow>(legs))
  const pointsOf = group(rowsOf<PointRow>(points))
  const countriesOf = group(rowsOf<CountryRow>(countries))

  return rowsOf<JourneyRow>(journeys).map((row): GroundJourneyDto => {
    const base = {
      id: row.id,
      status: row.status,
      version: row.version,
      title: row.title,
      note: row.note,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmedAt: row.confirmed_at,
      countries: (countriesOf.get(row.id) ?? []).map((entry) => entry.country_code),
    }
    if (row.mode === 'rail') {
      const railLegs = (legsOf.get(row.id) ?? []).map((leg): RailLegDto => {
        const from = JSON.parse(leg.from_place) as GroundPlaceSnapshot
        const to = JSON.parse(leg.to_place) as GroundPlaceSnapshot
        return {
          id: leg.id,
          from,
          to,
          fromStation: leg.from_station,
          toStation: leg.to_station,
          trainNumber: leg.train_number,
          operator: leg.operator,
          departureDate: leg.departure_date,
          departureTime: leg.departure_time,
          arrivalDate: leg.arrival_date,
          arrivalTime: leg.arrival_time,
          durationMinutes: leg.duration_minutes,
          durationSource: leg.duration_source,
          distanceKm: round1(segmentKm(from, to)),
        }
      })
      return {
        ...base,
        mode: 'rail',
        legs: railLegs,
        metrics: journeyMetrics({
          mode: 'rail',
          title: base.title,
          note: base.note,
          startDate: base.startDate,
          endDate: base.endDate,
          legs: railLegs,
        }),
      }
    }
    const roadPoints = (pointsOf.get(row.id) ?? []).map((point): RoadPointDto => ({
      id: point.id,
      place: JSON.parse(point.place) as GroundPlaceSnapshot,
      arrivalDate: point.arrival_date,
      departureDate: point.departure_date,
      nights: point.nights,
      note: point.note,
    }))
    return {
      ...base,
      mode: 'road',
      points: roadPoints,
      metrics: journeyMetrics({
        mode: 'road',
        title: base.title,
        note: base.note,
        startDate: base.startDate,
        endDate: base.endDate,
        points: roadPoints,
      }),
    }
  })
}

export async function readOwnerJourney(
  db: D1Database,
  userId: string,
  journeyId: string,
): Promise<GroundJourneyDto | null> {
  return (await readOwnerJourneys(db, userId, journeyId))[0] ?? null
}

/** Publication is sufficient once the published and evidence revisions reach the one a commit recorded. */
export const publicationOf = (
  state: DerivedStateRow | null,
  accountRevision: number,
): DerivedPublication =>
  state && state.published_revision >= accountRevision && state.evidence_revision >= accountRevision
    ? 'ready'
    : 'pending'

export interface ListFilter {
  mode?: GroundMode
  /** `cancelled` lists only cancelled journeys; absent hides them. */
  cancelledOnly: boolean
  today: string
}

export async function readJourneyList(
  db: D1Database,
  userId: string,
  filter: ListFilter,
): Promise<GroundJourneyList> {
  const [all, state] = await Promise.all([readOwnerJourneys(db, userId), stateOf(db, userId)])
  const journeys = all
    .filter((journey) =>
      filter.cancelledOnly ? journey.status === 'cancelled' : journey.status !== 'cancelled',
    )
    .filter((journey) => !filter.mode || journey.mode === filter.mode)
    .sort(compareJourneys(filter.today))
  return {
    journeys,
    // Completed-only totals of every mode, whatever the list filter (the client hides them for cancelled-only).
    totals: { rail: modeTotals(all, 'rail'), road: modeTotals(all, 'road') },
    // No row means nothing was ever written (revision 0): nothing to publish, so the account is ready.
    derivedState:
      !state ||
      (state.revision === state.published_revision &&
        state.evidence_revision === state.published_revision)
        ? 'ready'
        : 'pending',
    revision: state?.revision ?? 0,
    publishedRevision: state?.published_revision ?? 0,
  }
}

export async function readOperationStatus(
  db: D1Database,
  userId: string,
  key: string,
  instant: string,
): Promise<GroundOperationStatus> {
  const receipt = firstOf<ReceiptRow>(
    (await db.batch([receiptStatement(db, userId, key, instant)]))[0],
  )
  if (!receipt) return { status: 'unknown', operationKey: key }
  return {
    status: receipt.outcome,
    journeyId: receipt.journey_id,
    action: receipt.kind as GroundAction,
    savedVersion: receipt.result_version,
    accountRevision: receipt.account_revision,
    derivedState: publicationOf(await stateOf(db, userId), receipt.account_revision),
    current: await readOwnerJourney(db, userId, receipt.journey_id),
  }
}
