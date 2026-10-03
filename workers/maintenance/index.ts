import { refreshLeaderboards } from '../../functions/api/_services/leaderboard'
import { repairUserDerivedState } from '../../functions/api/_services/derivedState'

interface MaintenanceEnv {
  DB: D1Database
  MAINTENANCE_MODE?: string
}

const errorCode = 'MAINTENANCE_CYCLE_FAILED'

export default {
  async scheduled(_event: ScheduledEvent, env: MaintenanceEnv): Promise<void> {
    // The guard runs before any DB access, including the status probe.
    if (env.MAINTENANCE_MODE === 'true') return
    const db = env.DB
    try {
      const dirty = await db.prepare(
        `SELECT user_id FROM user_derived_state
         WHERE revision != published_revision ORDER BY updated_at ASC LIMIT 100`,
      ).all<{ user_id: string }>()
      for (const row of dirty.results) {
        await repairUserDerivedState(db, row.user_id)
      }
      await refreshLeaderboards(db)
      const now = new Date()
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
        'SELECT COUNT(*) AS n FROM user_derived_state WHERE revision != published_revision',
      ).first<{ n: number }>()
      if ((remaining?.n ?? 0) > 0) throw new Error('Dirty derived users remain')
      await db.prepare(
        'UPDATE maintenance_status SET last_success_at = ?, last_error = NULL WHERE id = 1',
      ).bind(now.toISOString()).run()
    } catch {
      const now = new Date().toISOString()
      await db.prepare(
        'UPDATE maintenance_status SET last_failure_at = ?, last_error = ? WHERE id = 1',
      ).bind(now, errorCode).run().catch(() => undefined)
      console.error(errorCode)
      throw new Error(errorCode)
    }
  },
}
