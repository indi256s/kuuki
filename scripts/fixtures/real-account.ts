// me@example.test: a full copy of one real account, loaded from the private snapshot that
// `pnpm fixture:snapshot` writes outside the repo. Without a snapshot the preview runs fully synthetic.
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const REAL_SNAPSHOT_PATH =
  process.env.KUUKI_REAL_SNAPSHOT ?? join(homedir(), '.kuuki', 'fixtures', 'real-account.json')
export const REAL_ACCOUNT_EMAIL = 'me@example.test'

type Row = Record<string, unknown>
export type RealSnapshot = {
  sourceEmail: string
  sourceUserId: string
  takenAt: string
  profile: Row
  reference: Record<string, Row[]>
  user: Record<string, Row[]>
}

export function readRealSnapshot(): RealSnapshot | undefined {
  if (!existsSync(REAL_SNAPSHOT_PATH)) return undefined
  return JSON.parse(readFileSync(REAL_SNAPSHOT_PATH, 'utf8')) as RealSnapshot
}

function insert(db: D1Database, table: string, row: Row, verb = 'INSERT') {
  const columns = Object.keys(row)
  return db
    .prepare(
      `${verb} INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`,
    )
    .bind(...columns.map((column) => row[column] ?? null))
}

/** Copies the snapshot onto `userId`, an account the fixture already signed up. */
export async function seedRealAccount(db: D1Database, userId: string, snapshot: RealSnapshot) {
  const { id: _id, ...profile } = snapshot.profile
  const columns = Object.keys(profile)
  await db.batch([
    // Snapshot tables arrive in name order, so foreign keys are checked at commit.
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    ...Object.entries(snapshot.reference).flatMap(([table, rows]) =>
      rows.map((row) => insert(db, table, row, 'INSERT OR IGNORE')),
    ),
    db
      .prepare(
        `UPDATE profiles SET ${columns.map((column) => `${column} = ?`).join(',')} WHERE id = ?`,
      )
      .bind(...columns.map((column) => profile[column] ?? null), userId),
    ...Object.entries(snapshot.user).flatMap(([table, rows]) =>
      // The fresh account may already own singleton rows (stats, derived state); the snapshot wins.
      rows.map((row) => insert(db, table, { ...row, user_id: userId }, 'INSERT OR REPLACE')),
    ),
  ])
}
