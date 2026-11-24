import { refreshLeaderboards } from '../../functions/api/_services/leaderboard'
import {
  STALE_DERIVED_PREDICATE,
  repairUserDerivedState,
} from '../../functions/api/_services/derivedState'
import { interruptBatchSql } from '../../functions/api/_services/importBatchInterrupt'
import { expireHistoryRunsStatements } from '../../functions/api/_services/historyImportRetention'
import { applyDueTransitions } from '../../functions/api/_services/lifecycle'

interface MaintenanceEnv {
  DB: D1Database
  MAINTENANCE_MODE?: string
}

const errorCode = 'MAINTENANCE_CYCLE_FAILED'
const DUE_USERS_PER_DIRECTION = 50
const REPAIR_USERS = 200
const DAY_MS = 24 * 60 * 60 * 1000

export default {
  async scheduled(_event: ScheduledEvent, env: MaintenanceEnv): Promise<void> {
    if (env.MAINTENANCE_MODE === 'true') return
    const db = env.DB
    const started = Date.now()
    try {
      const now = new Date()
      const instant = now.toISOString()

      const upcomingUsers = await db
        .prepare(
          `SELECT user_id FROM flights WHERE lifecycle_state = 'upcoming' AND awaiting_after <= ?
         GROUP BY user_id ORDER BY MIN(awaiting_after), user_id LIMIT ?`,
        )
        .bind(instant, DUE_USERS_PER_DIRECTION)
        .all<{ user_id: string }>()
      const awaitingUsers = await db
        .prepare(
          `SELECT user_id FROM flights WHERE lifecycle_state = 'awaiting' AND auto_confirm_after <= ?
         GROUP BY user_id ORDER BY MIN(auto_confirm_after), user_id LIMIT ?`,
        )
        .bind(instant, DUE_USERS_PER_DIRECTION)
        .all<{ user_id: string }>()
      const dueUsers = [
        ...new Set([...upcomingUsers.results, ...awaitingUsers.results].map((row) => row.user_id)),
      ]
      let awaited = 0
      let autoConfirmed = 0
      let failedUsers = 0
      for (const userId of dueUsers) {
        try {
          const result = await applyDueTransitions(db, { userId, now })
          awaited += result.awaited
          autoConfirmed += result.autoConfirmed
        } catch {
          failedUsers += 1
        }
      }

      const dirty = await db
        .prepare(
          `SELECT user_id FROM user_derived_state
         WHERE ${STALE_DERIVED_PREDICATE} ORDER BY updated_at ASC LIMIT ?`,
        )
        .bind(REPAIR_USERS)
        .all<{ user_id: string }>()
      for (const row of dirty.results) {
        await repairUserDerivedState(db, row.user_id)
      }

      let leaderboardFailed = false
      try {
        await refreshLeaderboards(db)
      } catch {
        leaderboardFailed = true
      }

      const idempotencyCutoff = new Date(now.getTime() - 7 * DAY_MS).toISOString()
      const lifecycleReceiptCutoff = new Date(now.getTime() - 14 * DAY_MS).toISOString()
      const conversionReceiptCutoff = new Date(now.getTime() - 37 * DAY_MS).toISOString()
      const batchDeleteCutoff = new Date(now.getTime() - 7 * DAY_MS).toISOString()
      await db.batch([
        db.prepare('DELETE FROM account_activation_tokens WHERE expires_at <= ?').bind(instant),
        db
          .prepare('DELETE FROM auth_rate_limits WHERE expires_at <= ?')
          .bind(Math.floor(now.getTime() / 1000)),
        db.prepare('DELETE FROM auth_sessions WHERE expiresAt <= ?').bind(instant),
        db.prepare('DELETE FROM auth_verifications WHERE expiresAt <= ?').bind(instant),
        db.prepare('DELETE FROM flight_idempotency WHERE created_at < ?').bind(idempotencyCutoff),
        db
          .prepare('DELETE FROM lifecycle_operation_receipts WHERE created_at < ?')
          .bind(lifecycleReceiptCutoff),
        db
          .prepare(
            'DELETE FROM import_drafts WHERE batch_id IN (SELECT id FROM import_batches WHERE expires_at <= ?)',
          )
          .bind(instant),
        db.prepare('DELETE FROM import_batches WHERE expires_at <= ?').bind(batchDeleteCutoff),
        db
          .prepare('DELETE FROM import_conversion_receipts WHERE created_at < ?')
          .bind(conversionReceiptCutoff),
        ...expireHistoryRunsStatements(db, instant),
        db.prepare('DELETE FROM ground_operation_receipts WHERE expires_at <= ?').bind(instant),
        db.prepare(interruptBatchSql('overdue')).bind(instant, instant),
      ])

      const remaining = await db
        .prepare(
          `SELECT COUNT(*) AS n, MIN(updated_at) AS oldest
         FROM user_derived_state WHERE ${STALE_DERIVED_PREDICATE}`,
        )
        .first<{ n: number; oldest: string | null }>()
      const dueRemaining = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM flights
         WHERE (lifecycle_state = 'upcoming' AND awaiting_after <= ?) OR (lifecycle_state = 'awaiting' AND auto_confirm_after <= ?)`,
        )
        .bind(instant, instant)
        .first<{ n: number }>()
      if ((remaining?.n ?? 0) > 0) throw new Error('Dirty derived users remain')
      if (failedUsers > 0) throw new Error('A due transition failed')
      if ((dueRemaining?.n ?? 0) > 0) throw new Error('Due transitions remain')
      if (leaderboardFailed) throw new Error('Leaderboard refresh failed')
      await db
        .prepare(
          'UPDATE maintenance_status SET last_success_at = ?, last_error = NULL WHERE id = 1',
        )
        .bind(instant)
        .run()
      console.log(
        JSON.stringify({
          event: 'maintenance_success',
          duration_ms: Date.now() - started,
          rolled_over: awaited,
          auto_confirmed: autoConfirmed,
          overdue_remaining: dueRemaining?.n ?? 0,
          dirty_count: remaining?.n ?? 0,
          dirty_oldest_age_seconds: remaining?.oldest
            ? Math.max(0, Math.floor((Date.now() - Date.parse(remaining.oldest)) / 1000))
            : 0,
        }),
      )
    } catch {
      const now = new Date().toISOString()
      await db
        .prepare('UPDATE maintenance_status SET last_failure_at = ?, last_error = ? WHERE id = 1')
        .bind(now, errorCode)
        .run()
        .catch(() => undefined)
      console.error(
        JSON.stringify({
          event: 'maintenance_failure',
          code: errorCode,
          duration_ms: Date.now() - started,
        }),
      )
      throw new Error(errorCode)
    }
  },
}
