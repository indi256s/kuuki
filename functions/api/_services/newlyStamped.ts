import {
  countryContributions,
  evidenceFlightsStatement,
  type EvidenceFlight,
} from './countryEvidence'
import {
  ensureDerivedStateRow,
  isDerivedReady,
  type DerivedRepairResult,
  type DerivedStateRow,
} from './derivedState'
import { STATE_SELECT } from './receipts'
import { firstOf, rowsOf } from './stats'

export const pressedCountriesStatement = (db: D1Database, userId: string) =>
  db
    .prepare(
      "SELECT country_code FROM country_visit_evidence WHERE user_id = ? AND status = 'pressed' ORDER BY country_code",
    )
    .bind(userId)

export async function readPressedBefore(db: D1Database, userId: string): Promise<string[] | null> {
  const [, state, pressed] = await db.batch([
    ensureDerivedStateRow(db, userId),
    db.prepare(STATE_SELECT).bind(userId),
    pressedCountriesStatement(db, userId),
  ])
  const row = firstOf<DerivedStateRow>(state)
  return row && isDerivedReady(row)
    ? rowsOf<{ country_code: string }>(pressed).map((entry) => entry.country_code)
    : null
}

export type PublishedStamps =
  | { ready: false; revision: number }
  | {
      ready: true
      revision: number
      pendingCountryCount: number
      newlyStamped(flightIds: Iterable<number>): string[] | null
    }

export async function readPublishedStamps(
  db: D1Database,
  userId: string,
  before: string[] | null,
): Promise<PublishedStamps> {
  const [stateNow, flightsRead, evidenceRead] = await db.batch([
    db.prepare(STATE_SELECT).bind(userId),
    evidenceFlightsStatement(db, userId),
    db
      .prepare('SELECT country_code, status FROM country_visit_evidence WHERE user_id = ?')
      .bind(userId),
  ])
  const current = firstOf<DerivedStateRow>(stateNow)
  if (!current || !isDerivedReady(current))
    return { ready: false, revision: current?.revision ?? 0 }
  const evidence = rowsOf<{ country_code: string; status: 'pressed' | 'pending' }>(evidenceRead)
  const pressedNow = new Set(
    evidence.filter((row) => row.status === 'pressed').map((row) => row.country_code),
  )
  const logged = countryContributions(rowsOf<EvidenceFlight>(flightsRead)).contributions.filter(
    (entry) => entry.state === 'logged',
  )
  const beforeSet = before ? new Set(before) : null
  return {
    ready: true,
    revision: current.revision,
    pendingCountryCount: evidence.filter((row) => row.status === 'pending').length,
    newlyStamped(flightIds) {
      if (!beforeSet) return null
      const own = new Set(flightIds)
      const contributed = new Set(
        logged.filter((entry) => own.has(entry.flight_id)).map((entry) => entry.country_code),
      )
      return [...contributed].filter((code) => pressedNow.has(code) && !beforeSet.has(code)).sort()
    },
  }
}

export async function stampsForCreated(
  db: D1Database,
  userId: string,
  before: string[] | null,
  derived: DerivedRepairResult | null,
  created: Array<{ id: number; lifecycle_state: string }>,
): Promise<(flightId: number) => string[] | null> {
  if (before === null || derived?.derived_state !== 'ready') return () => null
  if (!created.some((flight) => flight.lifecycle_state === 'logged')) return () => []
  const published = await readPublishedStamps(db, userId, before)
  return published.ready ? (flightId) => published.newlyStamped([flightId]) : () => null
}
