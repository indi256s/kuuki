// Flight lifecycle assignment (ADR 0001 §2). Create, bulk create and edit call the pure rules below;
// the owner sync and the cron share `applyDueTransitions`. Lifecycle-aware writes always set the
// columns and the `is_upcoming` projection together, so the §1 adapter triggers never fire for them.
import { addDays, canonicalTimeZone, localToday, startOfLocalDay } from '../../../packages/shared/src/calendar'
import { HttpError } from '../_lib/http'
import { dirtyUserStatement } from './derivedState'
import type { LifecycleState } from './countryEvidence'

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
  'lifecycle_state', 'is_upcoming', 'confirmation_source', 'confirmed_at', 'lifecycle_timezone',
  'awaiting_after', 'auto_confirm_after', 'arrival_transit', 'arrival_transit_leg_id',
] as const satisfies ReadonlyArray<keyof LifecycleColumns>

export const lifecycleValues = (columns: LifecycleColumns) => LIFECYCLE_COLUMN_NAMES.map(name => columns[name])

/** Max flights moved per user and call (owner sync and cron alike). */
export const DUE_TRANSITION_LIMIT = 100

/**
 * The member's browser timezone travels as a top-level `timezone` request field next to the flight
 * fields (never part of `FlightInput` or its idempotency digest). Absent → null (old clients);
 * present but not a valid IANA zone → 400 INVALID_TIMEZONE.
 */
export function takeRequestTimezone(body: unknown): { body: unknown; timezone: string | null } {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('timezone' in body)) return { body, timezone: null }
  const { timezone, ...rest } = body as Record<string, unknown>
  if (timezone === undefined || timezone === null) return { body: rest, timezone: null }
  const canonical = canonicalTimeZone(timezone)
  if (!canonical) throw new HttpError(400, 'timezone must be a valid IANA time zone', 'INVALID_TIMEZONE')
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
export function lifecycleForCreate(date: string, timezone: string | null, now: Date = new Date()): LifecycleColumns {
  const zone = timezone ?? 'UTC'
  if (date <= localToday(zone, now)) {
    return { lifecycle_state: 'logged', is_upcoming: 0, confirmation_source: 'save', confirmed_at: now.toISOString(),
      lifecycle_timezone: zone, awaiting_after: null, auto_confirm_after: null, arrival_transit: null, arrival_transit_leg_id: null }
  }
  return { lifecycle_state: 'upcoming', is_upcoming: 1, confirmation_source: null, confirmed_at: null,
    lifecycle_timezone: zone, ...deadlinesFor(date, zone), arrival_transit: null, arrival_transit_leg_id: null }
}

/** Edit rows of the §2 table. `timezone` is the request's zone; the stored one is the fallback, then UTC. */
export function lifecycleForEdit(
  existing: Omit<LifecycleColumns, 'is_upcoming'> & { is_upcoming: number | null; date: string; origin: string; destination: string },
  next: { date: string; origin: string; destination: string },
  timezone: string | null,
  now: Date = new Date(),
): LifecycleColumns {
  const current = {
    ...(Object.fromEntries(LIFECYCLE_COLUMN_NAMES.map(name => [name, existing[name]])) as unknown as LifecycleColumns),
    is_upcoming: existing.lifecycle_state === 'upcoming' ? 1 : 0, // always the projection of the state
  } satisfies LifecycleColumns
  const routeChanged = next.origin !== existing.origin || next.destination !== existing.destination
  const result: LifecycleColumns = routeChanged ? { ...current, arrival_transit: null, arrival_transit_leg_id: null } : current
  if (next.date === existing.date) return result

  const zone = timezone ?? existing.lifecycle_timezone ?? 'UTC'
  if (next.date > localToday(zone, now)) {
    return { lifecycle_state: 'upcoming', is_upcoming: 1, confirmation_source: null, confirmed_at: null,
      lifecycle_timezone: zone, ...deadlinesFor(next.date, zone), arrival_transit: null, arrival_transit_leg_id: null }
  }
  if (existing.lifecycle_state === 'logged') return result // provenance kept, no deadlines
  const deadlines = deadlinesFor(next.date, zone)
  // A corrected upcoming flight never skips the queue, and the edit never auto-confirms inline.
  const state: LifecycleState = existing.lifecycle_state === 'awaiting' || now.toISOString() >= deadlines.awaiting_after
    ? 'awaiting' : 'upcoming'
  return { ...result, lifecycle_state: state, is_upcoming: state === 'upcoming' ? 1 : 0, lifecycle_timezone: zone, ...deadlines }
}

/**
 * Upcoming → awaiting for one user (ADR §2): flights whose stored `awaiting_after` has passed. Deadlines
 * are never recomputed here, so a late sync does not restart the clock. The dirty mark is unconditional
 * when due rows were read, because `changes()` would only see the last UPDATE.
 */
export async function applyDueTransitions(
  db: D1Database,
  { userId, now = new Date(), limit = DUE_TRANSITION_LIMIT }: { userId: string; now?: Date; limit?: number },
): Promise<{ awaited: number; more: boolean }> {
  const instant = now.toISOString()
  // Upsert-then-guard: an account with no derived-state row must still reach the guarded repair.
  await db.prepare(
    'INSERT INTO user_derived_state (user_id, revision, published_revision) VALUES (?, 0, 0) ON CONFLICT (user_id) DO NOTHING',
  ).bind(userId).run()
  const due = await db.prepare(
    `SELECT id FROM flights WHERE user_id = ? AND lifecycle_state = 'upcoming' AND awaiting_after <= ?
     ORDER BY awaiting_after, id LIMIT ?`,
  ).bind(userId, instant, limit + 1).all<{ id: number }>()
  const ids = due.results.slice(0, limit).map(row => row.id)
  if (ids.length === 0) return { awaited: 0, more: false }
  const [moved] = await db.batch([
    db.prepare(
      `UPDATE flights SET lifecycle_state = 'awaiting', is_upcoming = 0
       WHERE user_id = ? AND lifecycle_state = 'upcoming' AND awaiting_after <= ?
         AND id IN (SELECT value FROM json_each(?)) RETURNING id`,
    ).bind(userId, instant, JSON.stringify(ids)),
    dirtyUserStatement(db, userId),
  ])
  // Counted from RETURNING: D1 meta.changes also counts trigger writes (A1 note). A concurrent
  // sync that won the race leaves nothing to return and costs one extra repair.
  return { awaited: moved.results.length, more: due.results.length > limit }
}
