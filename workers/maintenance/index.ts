import { refreshLeaderboards } from '../../functions/api/_services/leaderboard'
import { dirtyUserStatement, repairUserDerivedState } from '../../functions/api/_services/derivedState'

interface MaintenanceEnv {
  DB: D1Database
  MAINTENANCE_MODE?: string
}

const errorCode = 'MAINTENANCE_CYCLE_FAILED'
const ROLLOVER_LIMIT = 100

export default {
  async scheduled(_event: ScheduledEvent, env: MaintenanceEnv): Promise<void> {
    // The guard runs before any DB access, including the status probe.
    if (env.MAINTENANCE_MODE === 'true') return
    const db = env.DB
    const started = Date.now()
    try {
      const now = new Date()
      const today = now.toISOString().slice(0, 10)
      // Bound each cron invocation. The next invocation picks up the remaining rows.
      const overdue = await db.prepare(
        `SELECT id, user_id FROM flights
         WHERE is_upcoming = 1 AND date <= ? ORDER BY date, id LIMIT ?`,
      ).bind(today, ROLLOVER_LIMIT).all<{ id: number; user_id: string }>()
      const byUser = new Map<string, number[]>()
      for (const flight of overdue.results) {
        const ids = byUser.get(flight.user_id) ?? []
        ids.push(flight.id)
        byUser.set(flight.user_id, ids)
      }
      let rolledOver = 0
      for (const [userId, ids] of byUser) {
        // The conditional dirty mark shares the canonical transaction and fires only
        // when this batch actually changed rows (a concurrent sync may have won).
        const [updated] = await db.batch([
          db.prepare(
            `UPDATE flights SET is_upcoming = 0 WHERE user_id = ? AND is_upcoming = 1
             AND date <= ? AND id IN (SELECT value FROM json_each(?))`,
          ).bind(userId, today, JSON.stringify(ids)),
          dirtyUserStatement(db, userId, true),
        ])
        if ((updated.meta.changes ?? 0) > 0) {
          rolledOver += updated.meta.changes ?? 0
          await repairUserDerivedState(db, userId)
        }
      }
      const dirty = await db.prepare(
        `SELECT user_id FROM user_derived_state
         WHERE revision != published_revision ORDER BY updated_at ASC LIMIT 100`,
      ).all<{ user_id: string }>()
      for (const row of dirty.results) {
        await repairUserDerivedState(db, row.user_id)
      }
      await refreshLeaderboards(db)
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      await db.batch([
        db.prepare('DELETE FROM account_activation_tokens WHERE expires_at <= ?').bind(now.toISOString()),
        db.prepare('DELETE FROM auth_rate_limits WHERE expires_at <= ?').bind(Math.floor(now.getTime() / 1000)),
        db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now.toISOString()),
        db.prepare('DELETE FROM auth_sessions WHERE expiresAt <= ?').bind(now.toISOString()),
        db.prepare('DELETE FROM auth_verifications WHERE expiresAt <= ?').bind(now.toISOString()),
        db.prepare('DELETE FROM flight_idempotency WHERE created_at < ?').bind(cutoff),
      ])
      const remaining = await db.prepare(
        `SELECT COUNT(*) AS n, MIN(updated_at) AS oldest
         FROM user_derived_state WHERE revision != published_revision`,
      ).first<{ n: number; oldest: string | null }>()
      const overdueRemaining = await db.prepare(
        'SELECT COUNT(*) AS n FROM flights WHERE is_upcoming = 1 AND date <= ?',
      ).bind(today).first<{ n: number }>()
      if ((remaining?.n ?? 0) > 0) throw new Error('Dirty derived users remain')
      await db.prepare(
        'UPDATE maintenance_status SET last_success_at = ?, last_error = NULL WHERE id = 1',
      ).bind(now.toISOString()).run()
      console.log(JSON.stringify({ event: 'maintenance_success', duration_ms: Date.now() - started,
        rolled_over: rolledOver, overdue_remaining: overdueRemaining?.n ?? 0,
        dirty_count: remaining?.n ?? 0, dirty_oldest_age_seconds: remaining?.oldest
          ? Math.max(0, Math.floor((Date.now() - Date.parse(remaining.oldest)) / 1000)) : 0 }))
    } catch {
      const now = new Date().toISOString()
      await db.prepare(
        'UPDATE maintenance_status SET last_failure_at = ?, last_error = ? WHERE id = 1',
      ).bind(now, errorCode).run().catch(() => undefined)
      console.error(JSON.stringify({ event: 'maintenance_failure', code: errorCode, duration_ms: Date.now() - started }))
      throw new Error(errorCode)
    }
  },
}
