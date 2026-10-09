// Duplicate matching over the member's whole flight history (ADR 0001 §6). One json_each tuple query, independent
// of any list paging: a candidate (date, origin, destination) matches the lowest-id owned flight with the same
// tuple, optionally excluding one flight (the one being edited, or the flight a draft already became).
import { assertRows } from '../_lib/d1'

export interface DuplicateCandidate {
  date: string
  origin: string
  destination: string
  excludeId?: number
}
export interface DuplicateMatch {
  candidateIndex: number
  flightId: number
}

export async function findDuplicateMatches(
  db: D1Database,
  userId: string,
  candidates: DuplicateCandidate[],
): Promise<DuplicateMatch[]> {
  if (!candidates.length) return []
  const result = await db
    .prepare(
      `SELECT CAST(c.key AS INTEGER) AS candidateIndex, MIN(f.id) AS flightId
     FROM json_each(?) c JOIN flights f
       ON f.user_id = ? AND f.date = json_extract(c.value, '$.date')
       AND f.origin = json_extract(c.value, '$.origin')
       AND f.destination = json_extract(c.value, '$.destination')
       AND (json_extract(c.value, '$.excludeId') IS NULL OR f.id != json_extract(c.value, '$.excludeId'))
     GROUP BY c.key ORDER BY CAST(c.key AS INTEGER)`,
    )
    .bind(JSON.stringify(candidates), userId)
    .all<DuplicateMatch>()
  assertRows(result, 'Duplicate candidate read failed')
  return result.results
}
