import { nowIso } from '../_lib/time'

export function tombstoneHistoryRowsStatement(
  db: D1Database,
  userId: string,
  flightIds: number[],
): D1PreparedStatement {
  const now = nowIso()
  return db
    .prepare(
      `UPDATE history_import_rows SET state = 'removed', flight_id = NULL, cells_json = NULL,
         flight_deleted_at = ?, updated_at = ?, version = version + 1
       WHERE user_id = ? AND flight_id IN (SELECT value FROM json_each(?))
         AND EXISTS (SELECT 1 FROM flights f WHERE f.id = history_import_rows.flight_id AND f.user_id = ?)`,
    )
    .bind(now, now, userId, JSON.stringify(flightIds), userId)
}

export const OPEN_ROW_STATE_LIST = ['ready', 'needs_review', 'error'] as const
export const OPEN_ROW_STATES = `(${OPEN_ROW_STATE_LIST.map((state) => `'${state}'`).join(',')})`

export function expireHistoryRunsStatements(
  db: D1Database,
  instant: string,
): D1PreparedStatement[] {
  const expired = `run_id IN (SELECT id FROM history_import_runs WHERE expires_at <= ? AND status <> 'closed')`
  return [
    db
      .prepare(
        `UPDATE history_import_rows SET state = 'ignored', ignore_reason = 'expired', cells_json = NULL,
           version = version + 1, updated_at = ?
         WHERE state IN ${OPEN_ROW_STATES} AND ${expired}`,
      )
      .bind(instant, instant),
    db
      .prepare(
        `UPDATE history_import_rows SET cells_json = NULL, updated_at = ?
         WHERE state = 'ignored' AND cells_json IS NOT NULL AND ${expired}`,
      )
      .bind(instant, instant),
    db
      .prepare(
        `UPDATE history_import_runs SET status = 'closed', generation = generation + 1, revision = revision + 1,
           updated_at = ?
         WHERE expires_at <= ? AND status <> 'closed'`,
      )
      .bind(instant, instant),
  ]
}
