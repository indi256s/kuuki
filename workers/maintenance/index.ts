import { refreshLeaderboards } from '../../functions/api/_services/leaderboard'
import { repairUserDerivedState } from '../../functions/api/_services/derivedState'
import { applyDueTransitions } from '../../functions/api/_services/lifecycle'

interface MaintenanceEnv {
  DB: D1Database
  MAINTENANCE_MODE?: string
}

const errorCode = 'MAINTENANCE_CYCLE_FAILED'
const ROLLOVER_USERS = 50

export default {
  async scheduled(_event: ScheduledEvent, env: MaintenanceEnv): Promise<void> {
    // The guard runs before any DB access, including the status probe.
    if (env.MAINTENANCE_MODE === 'true') return
    const db = env.DB
    const started = Date.now()
    try {
      const now = new Date()
      // ADR 0001 §2/§8: due upcoming flights move to awaiting on their stored boundary, oldest first.
      // Each user's batch is capped inside applyDueTransitions; the next invocation continues.
      const due = await db.prepare(
        `SELECT user_id FROM flights WHERE lifecycle_state = 'upcoming' AND awaiting_after <= ?
         GROUP BY user_id ORDER BY MIN(awaiting_after), user_id LIMIT ?`,
      ).bind(now.toISOString(), ROLLOVER_USERS).all<{ user_id: string }>()
      let rolledOver = 0
      for (const { user_id: userId } of due.results) {
        const { awaited } = await applyDueTransitions(db, { userId, now })
        if (awaited > 0) {
          rolledOver += awaited
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
        "SELECT COUNT(*) AS n FROM flights WHERE lifecycle_state = 'upcoming' AND awaiting_after <= ?",
      ).bind(now.toISOString()).first<{ n: number }>()
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
