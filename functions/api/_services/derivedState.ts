import { nowIso } from '../_lib/time'
import {
  combineReads,
  computeStatsForVisits,
  computedBadgeStatements,
  computedStatsStatement,
  firstOf,
  rowsOf,
  type BatchedRead,
  type DerivedVisit,
} from './stats'
import { computedAdvancedStatsStatement } from './advancedStats'
import { countryEvidenceRead, countryEvidenceStatements, flightCountriesOf } from './countryEvidence'

export interface DerivedRepairResult {
  derived_state: 'ready' | 'pending'
  revision: number
}

export interface DerivedStateRow {
  revision: number
  published_revision: number
  evidence_revision: number
  last_error: string | null
}

/** Readiness needs the evidence stamp too: an older build can publish a revision without the projection (ADR 0001 §4). */
export const isDerivedReady = (state: Pick<DerivedStateRow, 'revision' | 'published_revision' | 'evidence_revision'>) =>
  state.revision === state.published_revision && state.evidence_revision === state.published_revision

/** SQL form of "not ready", for maintenance selection and its remaining-work check. */
export const STALE_DERIVED_PREDICATE = '(revision != published_revision OR evidence_revision != published_revision)'

interface VisitSource {
  airport_iata: string
  country_code: string | null
  city: string | null
  date: string
}

interface LegacyVisitSource {
  airport_iata: string | null
  country_code: string | null
  city: string | null
  reference_country_code: string | null
  reference_city: string | null
  first_visit: string
  last_visit: string
  visit_count: number
}

/**
 * Include this statement in the same D1 batch as every canonical user mutation.
 * The original published revision remains visible until a complete repair publishes.
 */
export function dirtyUserStatement(
  db: D1Database,
  userId: string,
  onlyIfPreviousChanged = false,
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO user_derived_state
       (user_id, revision, published_revision, last_error, updated_at)
     SELECT ?, 1, 0, NULL, ? WHERE ${onlyIfPreviousChanged ? 'changes() > 0' : '1 = 1'}
     ON CONFLICT(user_id) DO UPDATE SET
       revision = user_derived_state.revision + 1,
       last_error = NULL,
       updated_at = excluded.updated_at`,
  ).bind(userId, nowIso())
}

/** Upsert-then-guard: an account with no derived-state row must still reach every revision-guarded write. */
export function ensureDerivedStateRow(db: D1Database, userId: string): D1PreparedStatement {
  return db.prepare(
    'INSERT INTO user_derived_state (user_id, revision, published_revision) VALUES (?, 0, 0) ON CONFLICT (user_id) DO NOTHING',
  ).bind(userId)
}

function proposedVisits(db: D1Database, userId: string): BatchedRead<DerivedVisit[]> {
  const flightSources = db.prepare(
    `SELECT ar.iata AS airport_iata, ar.country_code, ar.city, f.date
     FROM flights f JOIN airports_reference ar ON ar.iata = f.origin
     WHERE f.user_id = ? AND f.lifecycle_state IN ('awaiting', 'logged')
     UNION ALL
     SELECT ar.iata AS airport_iata, ar.country_code, ar.city, f.date
     FROM flights f JOIN airports_reference ar ON ar.iata = f.destination
     WHERE f.user_id = ? AND f.lifecycle_state IN ('awaiting', 'logged')`,
  ).bind(userId, userId)

  return {
    statements: [flightSources, legacyEvidenceStatement(db, userId)],
    derive: ([flightResult, evidenceResult]) =>
      mergeVisits(rowsOf<VisitSource>(flightResult), rowsOf<LegacyVisitSource>(evidenceResult)),
  }
}

function legacyEvidenceStatement(db: D1Database, userId: string): D1PreparedStatement {
  return db.prepare(
    `SELECT e.airport_iata, e.country_code, e.city, e.first_visit, e.last_visit,
            e.visit_count, ar.country_code AS reference_country_code,
            ar.city AS reference_city
     FROM legacy_visit_evidence e
     LEFT JOIN airports_reference ar ON ar.iata = e.airport_iata
     WHERE e.user_id = ? AND e.contributes = 1`,
  ).bind(userId)
}

function mergeVisits(flightSources: VisitSource[], evidence: LegacyVisitSource[]): DerivedVisit[] {
  const merged = new Map<string, DerivedVisit>()
  for (const source of flightSources) {
    const prior = merged.get(source.airport_iata)
    if (prior) {
      prior.first_visit = prior.first_visit < source.date ? prior.first_visit : source.date
      prior.last_visit = prior.last_visit > source.date ? prior.last_visit : source.date
      prior.visit_count += 1
    } else {
      merged.set(source.airport_iata, {
        airport_iata: source.airport_iata,
        country_code: source.country_code ?? '',
        city: source.city,
        first_visit: source.date,
        last_visit: source.date,
        visit_count: 1,
      })
    }
  }
  for (const source of evidence) {
    if (!source.airport_iata) throw new Error('Contributing legacy evidence lacks airport')
    const prior = merged.get(source.airport_iata)
    if (prior) {
      // Archived counters may overlap flight history. Keep the larger observed count,
      // never add both or infer a number of extra trips from their difference.
      prior.visit_count = Math.max(prior.visit_count, source.visit_count)
      prior.first_visit = prior.first_visit < source.first_visit ? prior.first_visit : source.first_visit
      prior.last_visit = prior.last_visit > source.last_visit ? prior.last_visit : source.last_visit
    } else {
      const country = source.country_code ?? source.reference_country_code
      if (!country) throw new Error('Contributing legacy evidence lacks country')
      merged.set(source.airport_iata, {
        airport_iata: source.airport_iata,
        country_code: country,
        city: source.city ?? source.reference_city,
        first_visit: source.first_visit,
        last_visit: source.last_visit,
        visit_count: source.visit_count,
      })
    }
  }
  return [...merged.values()].sort((a, b) => a.airport_iata.localeCompare(b.airport_iata))
}

function stateStatement(db: D1Database, userId: string): D1PreparedStatement {
  return db.prepare(
    'SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?',
  ).bind(userId)
}

export async function stateOf(db: D1Database, userId: string): Promise<DerivedStateRow | null> {
  return stateStatement(db, userId).first<DerivedStateRow>()
}

/** Write proposed visits without touching unchanged rows: drop stale airports, upsert the rest. */
function visitStatements(db: D1Database, userId: string, visits: DerivedVisit[]): D1PreparedStatement[] {
  const proposed = JSON.stringify(visits)
  return [
    db.prepare(
      `DELETE FROM visits WHERE user_id = ? AND (airport_iata IS NULL OR airport_iata NOT IN
         (SELECT json_extract(value, '$.airport_iata') FROM json_each(?)))`,
    ).bind(userId, proposed),
    db.prepare(
      `INSERT INTO visits
         (user_id, country_code, city, airport_iata, first_visit, last_visit, visit_count)
       SELECT ?, json_extract(value, '$.country_code'), json_extract(value, '$.city'),
              json_extract(value, '$.airport_iata'), json_extract(value, '$.first_visit'),
              json_extract(value, '$.last_visit'), json_extract(value, '$.visit_count')
       FROM json_each(?) WHERE true
       ON CONFLICT(user_id, airport_iata) DO UPDATE SET
         country_code = excluded.country_code, city = excluded.city,
         first_visit = excluded.first_visit, last_visit = excluded.last_visit,
         visit_count = excluded.visit_count
       WHERE visits.country_code IS NOT excluded.country_code OR visits.city IS NOT excluded.city
         OR visits.first_visit IS NOT excluded.first_visit OR visits.last_visit IS NOT excluded.last_visit
         OR visits.visit_count IS NOT excluded.visit_count`,
    ).bind(userId, proposed),
  ]
}

/**
 * Calculate only from canonical rows, then publish every derived table in one D1 batch.
 * A newer canonical mutation makes the first guard violate CHECK, rolling back the batch.
 */
export async function repairUserDerivedState(db: D1Database, userId: string): Promise<DerivedRepairResult> {
  // A new account with no mutation can be asked to repair; seed it dirty once.
  let state: DerivedStateRow | null
  try {
    const [, current] = await db.batch([
      db.prepare(
        'INSERT INTO user_derived_state (user_id, revision, published_revision) VALUES (?, 1, 0) ON CONFLICT(user_id) DO NOTHING',
      ).bind(userId),
      stateStatement(db, userId),
    ])
    state = firstOf<DerivedStateRow>(current)
  } catch {
    return { derived_state: 'pending', revision: 0 }
  }
  if (!state) return { derived_state: 'pending', revision: 0 }
  if (isDerivedReady(state)) {
    return { derived_state: 'ready', revision: state.revision }
  }
  const revision = state.revision
  try {
    // Every canonical read shares one round trip; the guard below rejects a stale snapshot.
    const read = combineReads(
      proposedVisits(db, userId),
      computeStatsForVisits(db, userId),
      computedAdvancedStatsStatement(db, userId),
      computedBadgeStatements(db, userId),
      countryEvidenceRead(db, userId, legacyEvidenceStatement(db, userId), mergeVisits),
    )
    const [visits, statsFor, advancedFor, badgesFor, evidence] = read.derive(await db.batch(read.statements))
    // One country calculation: stats, advanced breakdowns and the published projection all read it.
    const countries = flightCountriesOf(evidence.rows)
    const stats = statsFor(visits, countries)
    const now = nowIso()
    const statements: D1PreparedStatement[] = [
      // The -1 branch violates CHECK; no later result can publish after a newer revision.
      db.prepare(
        `UPDATE user_derived_state
         SET published_revision = CASE WHEN revision = ? THEN ? ELSE -1 END,
             evidence_revision = ?,
             last_error = NULL, published_at = ?
         WHERE user_id = ?`,
      ).bind(revision, revision, revision, now, userId),
      // UPDATE matching zero rows must not let the remaining derived writes through.
      db.prepare(
        `INSERT INTO user_derived_state (user_id, revision, published_revision)
         SELECT ?, 0, -1 WHERE NOT EXISTS
           (SELECT 1 FROM user_derived_state WHERE user_id = ?)`,
      ).bind(userId, userId),
      ...visitStatements(db, userId, visits),
      computedStatsStatement(db, userId, stats),
      advancedFor(stats, countries),
      ...badgesFor(stats),
      ...countryEvidenceStatements(db, userId, evidence),
    ]
    await db.batch(statements)
    return { derived_state: 'ready', revision }
  } catch {
    // A newer mutation owns the marker; never attach this attempt's error to it.
    await db.prepare(
      `UPDATE user_derived_state SET last_error = 'DERIVED_REPAIR_FAILED'
       WHERE user_id = ? AND revision = ? AND published_revision < revision`,
    ).bind(userId, revision).run().catch(() => undefined)
    const current = await stateOf(db, userId).catch(() => null)
    return { derived_state: 'pending', revision: current?.revision ?? revision }
  }
}
