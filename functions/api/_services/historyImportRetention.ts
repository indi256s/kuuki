// Retention and deletion statements for Flighty history rows (ADR 0008 "Private source data and deletion").
// Each one is meant for the caller's own D1 batch, so the private cells disappear in the same transaction as the
// flight, the run or the account they belong to.
import { nowIso } from '../_lib/time'

/**
 * Before `DELETE FROM flights` in the same batch: rows linked to these owned flights lose their cells and link and
 * become `removed`. Digest, Flighty ID and match key remain as the tombstone that stops a silent re-creation.
 */
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

/** States a row can still leave by an owner decision: the one list the SQL, the page filter and patches read. */
export const OPEN_ROW_STATE_LIST = ['ready', 'needs_review', 'error'] as const
export const OPEN_ROW_STATES = `(${OPEN_ROW_STATE_LIST.map((state) => `'${state}'`).join(',')})`

/**
 * Maintenance: 30 days after a run opened, its unconfirmed rows become `ignored`/`expired`, ignored rows lose their
 * cells and the run closes. Committed rows keep their cells; no row disappears, so totals still add up.
 */
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
