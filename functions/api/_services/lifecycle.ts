// Flight lifecycle assignment (ADR 0001 §2). Create, bulk create and edit call the pure rules below;
// the owner sync and the cron share `applyDueTransitions`. Lifecycle-aware writes always set the
// columns and the `is_upcoming` projection together, so the §1 adapter triggers never fire for them.
import {
  addDays,
  canonicalTimeZone,
  localToday,
  startOfLocalDay,
} from '../../../packages/shared/src/calendar'
import { HttpError } from '../_lib/http'
import { connectionChains } from './connections'
import { dirtyUserStatement, ensureDerivedStateRow } from './derivedState'
import {
  effectiveArrivalPolicies,
  evidenceFlightsStatement,
  type EvidenceFlight,
  type LifecycleState,
} from './countryEvidence'
import { firstOf, rowsOf } from './stats'

export type ConfirmationSource = 'save' | 'user' | 'automatic' | 'legacy'

/** Every lifecycle column a lifecycle-aware writer sets, plus the compatibility projection. */
export interface LifecycleColumns {
  lifecycle_state: LifecycleState
  is_upcoming: number
  confirmation_source: ConfirmationSource | null
  confirmed_at: string | null
  lifecycle_timezone: string | null
  awaiting_after: string | null
  auto_confirm_after: string | null
  arrival_transit: number | null
  arrival_transit_leg_id: number | null
}

export const LIFECYCLE_COLUMN_NAMES = [
  'lifecycle_state',
  'is_upcoming',
  'confirmation_source',
  'confirmed_at',
  'lifecycle_timezone',
  'awaiting_after',
  'auto_confirm_after',
  'arrival_transit',
  'arrival_transit_leg_id',
] as const satisfies ReadonlyArray<keyof LifecycleColumns>

export const lifecycleValues = (columns: LifecycleColumns) =>
  LIFECYCLE_COLUMN_NAMES.map((name) => columns[name])

/** Max flights moved per user and call (owner sync and cron alike). */
export const DUE_TRANSITION_LIMIT = 100

/**
 * The member's browser timezone travels as a top-level `timezone` request field next to the flight
 * fields (never part of `FlightInput` or its idempotency digest). Absent → null (old clients);
 * present but not a valid IANA zone → 400 INVALID_TIMEZONE.
 */
export function takeRequestTimezone(body: unknown): { body: unknown; timezone: string | null } {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('timezone' in body))
    return { body, timezone: null }
  const { timezone, ...rest } = body as Record<string, unknown>
  if (timezone === undefined || timezone === null) return { body: rest, timezone: null }
  const canonical = canonicalTimeZone(timezone)
  if (!canonical)
    throw new HttpError(400, 'timezone must be a valid IANA time zone', 'INVALID_TIMEZONE')
  return { body: rest, timezone: canonical }
}

/** Morning-after boundary and the auto-confirm boundary seven local days later (ADR §1 calendar rule). */
export function deadlinesFor(date: string, timeZone: string) {
  return {
    awaiting_after: startOfLocalDay(addDays(date, 1), timeZone),
    auto_confirm_after: startOfLocalDay(addDays(date, 8), timeZone),
  }
}

/** Create, bulk create and (T10) draft conversion: today or past logs as `save`, future is upcoming. */
export function lifecycleForCreate(
  date: string,
  timezone: string | null,
  now: Date = new Date(),
): LifecycleColumns {
  const zone = timezone ?? 'UTC'
  if (date <= localToday(zone, now)) {
    return {
      lifecycle_state: 'logged',
      is_upcoming: 0,
      confirmation_source: 'save',
      confirmed_at: now.toISOString(),
      lifecycle_timezone: zone,
      awaiting_after: null,
      auto_confirm_after: null,
      arrival_transit: null,
      arrival_transit_leg_id: null,
    }
  }
  return {
    lifecycle_state: 'upcoming',
    is_upcoming: 1,
    confirmation_source: null,
    confirmed_at: null,
    lifecycle_timezone: zone,
    ...deadlinesFor(date, zone),
    arrival_transit: null,
    arrival_transit_leg_id: null,
  }
}

/** Edit rows of the §2 table. `timezone` is the request's zone; the stored one is the fallback, then UTC. */
export function lifecycleForEdit(
  existing: Omit<LifecycleColumns, 'is_upcoming'> & {
    is_upcoming: number | null
    date: string
    origin: string
    destination: string
  },
  next: { date: string; origin: string; destination: string },
  timezone: string | null,
  now: Date = new Date(),
): LifecycleColumns {
  const current = {
    ...(Object.fromEntries(
      LIFECYCLE_COLUMN_NAMES.map((name) => [name, existing[name]]),
    ) as unknown as LifecycleColumns),
    is_upcoming: existing.lifecycle_state === 'upcoming' ? 1 : 0, // always the projection of the state
  } satisfies LifecycleColumns
  const routeChanged = next.origin !== existing.origin || next.destination !== existing.destination
  const result: LifecycleColumns = routeChanged
    ? { ...current, arrival_transit: null, arrival_transit_leg_id: null }
    : current
  if (next.date === existing.date) return result

  const zone = timezone ?? existing.lifecycle_timezone ?? 'UTC'
  if (next.date > localToday(zone, now)) {
    return {
      lifecycle_state: 'upcoming',
      is_upcoming: 1,
      confirmation_source: null,
      confirmed_at: null,
      lifecycle_timezone: zone,
      ...deadlinesFor(next.date, zone),
      arrival_transit: null,
      arrival_transit_leg_id: null,
    }
  }
  if (existing.lifecycle_state === 'logged') return result // provenance kept, no deadlines
  const deadlines = deadlinesFor(next.date, zone)
  // A corrected upcoming flight never skips the queue, and the edit never auto-confirms inline.
  const state: LifecycleState =
    existing.lifecycle_state === 'awaiting' || now.toISOString() >= deadlines.awaiting_after
      ? 'awaiting'
      : 'upcoming'
  return {
    ...result,
    lifecycle_state: state,
    is_upcoming: state === 'upcoming' ? 1 : 0,
    lifecycle_timezone: zone,
    ...deadlines,
  }
}

export interface DueTransitionResult {
  /** Flights moved upcoming → awaiting by this pass. */
  awaited: number
  /** Flights moved awaiting → logged (`automatic`) by this pass, including ones that were awaited in the same pass. */
  autoConfirmed: number
  /** Distinct flights whose state changed; a flight making both moves counts once. */
  synced: number
  /** Due work remains: a direction hit its cap, or an auto-confirm lost the revision guard and needs another pass. */
  more: boolean
}

/**
 * The two due transitions for one user (ADR 0001 §2), used by the owner sync and the cron:
 *  - upcoming → awaiting once the stored `awaiting_after` has passed;
 *  - awaiting → logged (`automatic`) once the stored `auto_confirm_after` has passed. A flight past both deadlines
 *    makes both moves in one pass, so a missed cron or a late first session never restarts the clock.
 * Deadlines are never recomputed here. Each direction is capped at `limit` flights, oldest stored deadline first, so
 * the stored deadline is the cursor and a backlog drains over successive passes without moving anyone's eligibility.
 *
 * Auto-confirm writes the effective arrival policy computed from one snapshot (`effectiveArrivalPolicies`), and is
 * guarded by the derived-state revision that snapshot was read under: a concurrent mutation makes it a no-op and the
 * next pass retries. The dirty mark is unconditional whenever due rows were read, because `changes()` would only see
 * the last UPDATE; a lost race costs one extra repair.
 */
export async function applyDueTransitions(
  db: D1Database,
  {
    userId,
    now = new Date(),
    limit = DUE_TRANSITION_LIMIT,
  }: { userId: string; now?: Date; limit?: number },
): Promise<DueTransitionResult> {
  const instant = now.toISOString()
  await ensureDerivedStateRow(db, userId).run()
  // The revision is read before the flights: any mutation committed after this point bumps it and fails the guard.
  const [dueUp, dueAw, stateRow] = await db.batch([
    db
      .prepare(
        `SELECT id, auto_confirm_after FROM flights WHERE user_id = ? AND lifecycle_state = 'upcoming' AND awaiting_after <= ?
       ORDER BY awaiting_after, id LIMIT ?`,
      )
      .bind(userId, instant, limit + 1),
    db
      .prepare(
        `SELECT id, auto_confirm_after FROM flights WHERE user_id = ? AND lifecycle_state = 'awaiting' AND auto_confirm_after <= ?
       ORDER BY auto_confirm_after, id LIMIT ?`,
      )
      .bind(userId, instant, limit + 1),
    db.prepare('SELECT revision FROM user_derived_state WHERE user_id = ?').bind(userId),
  ])
  const upRows = rowsOf<{ id: number; auto_confirm_after: string }>(dueUp)
  const awRows = rowsOf<{ id: number; auto_confirm_after: string }>(dueAw)
  const revision = firstOf<{ revision: number }>(stateRow)?.revision ?? 0
  const upIds = upRows.slice(0, limit).map((row) => row.id)
  // Auto-confirm candidates: already awaiting and due, plus flights this pass moves that are also past their 7-day deadline.
  const pastBoth = upRows.slice(0, limit).filter((row) => row.auto_confirm_after <= instant)
  const confirmable = [...awRows.slice(0, limit), ...pastBoth].sort((a, b) =>
    a.auto_confirm_after < b.auto_confirm_after
      ? -1
      : a.auto_confirm_after > b.auto_confirm_after
        ? 1
        : a.id - b.id,
  )
  const confirmIds = confirmable.slice(0, limit).map((row) => row.id)
  const capped = upRows.length > limit || awRows.length > limit || confirmable.length > limit
  if (upIds.length === 0 && confirmIds.length === 0)
    return { awaited: 0, autoConfirmed: 0, synced: 0, more: false }

  let decisions: Array<{ id: number; transit: number; leg: number | null }> = []
  if (confirmIds.length > 0) {
    const flights = rowsOf<EvidenceFlight>(await evidenceFlightsStatement(db, userId).all())
    const moved = new Set(upIds)
    const snapshot = flights.map((flight) =>
      moved.has(flight.id) ? { ...flight, lifecycle_state: 'awaiting' as const } : flight,
    )
    const policies = effectiveArrivalPolicies(snapshot, connectionChains(snapshot))
    const wanted = new Set(confirmIds)
    decisions = snapshot
      .filter((flight) => wanted.has(flight.id))
      .map((flight) => {
        const policy = policies.get(flight.id)
        return {
          id: flight.id,
          transit: policy?.transit ? 1 : 0,
          leg: policy?.transit ? policy.legId : null,
        }
      })
  }

  const statements: D1PreparedStatement[] = []
  if (upIds.length > 0) {
    statements.push(
      db
        .prepare(
          `UPDATE flights SET lifecycle_state = 'awaiting', is_upcoming = 0
       WHERE user_id = ? AND lifecycle_state = 'upcoming' AND awaiting_after <= ?
         AND id IN (SELECT value FROM json_each(?)) RETURNING id`,
        )
        .bind(userId, instant, JSON.stringify(upIds)),
    )
  }
  if (decisions.length > 0) {
    const payload = JSON.stringify(decisions)
    statements.push(
      db
        .prepare(
          `UPDATE flights SET lifecycle_state = 'logged', is_upcoming = 0, confirmation_source = 'automatic', confirmed_at = ?,
         arrival_transit = (SELECT json_extract(j.value, '$.transit') FROM json_each(?) j WHERE json_extract(j.value, '$.id') = flights.id),
         arrival_transit_leg_id = (SELECT json_extract(j.value, '$.leg') FROM json_each(?) j WHERE json_extract(j.value, '$.id') = flights.id)
       WHERE user_id = ? AND lifecycle_state = 'awaiting' AND auto_confirm_after <= ?
         AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?))
         AND EXISTS (SELECT 1 FROM user_derived_state WHERE user_id = ? AND revision = ?)
       RETURNING id`,
        )
        .bind(instant, payload, payload, userId, instant, payload, userId, revision),
    )
  }
  statements.push(dirtyUserStatement(db, userId))
  const results = await db.batch(statements)
  // Counted from RETURNING: D1 meta.changes also counts trigger writes (A1 note).
  let cursor = 0
  const awaitedIds =
    upIds.length > 0 ? rowsOf<{ id: number }>(results[cursor++]).map((row) => row.id) : []
  const confirmedIds =
    decisions.length > 0 ? rowsOf<{ id: number }>(results[cursor++]).map((row) => row.id) : []
  return {
    awaited: awaitedIds.length,
    autoConfirmed: confirmedIds.length,
    synced: new Set([...awaitedIds, ...confirmedIds]).size,
    more: capped || confirmedIds.length < decisions.length,
  }
}
