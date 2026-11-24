import { newId, hashPassword } from './crypto'
import { nowIso } from './time'
import { HttpError } from './http'

export interface NewUserInput {
  email: string
  password: string
  displayName?: string | null
  avatarUrl?: string | null
}

export interface AuthUser {
  id: string
  email: string
}

export const RESET_REQUIRED = 'RESET_REQUIRED'
export type AccountPhase = 'unclaimed' | 'active'
export const accountPhase = (hash: string | null | undefined): AccountPhase =>
  hash === RESET_REQUIRED ? 'unclaimed' : 'active'
export const unclaimedSql = (column = 'password_hash') => `${column} = '${RESET_REQUIRED}'`
export const activeSql = (column = 'password_hash') => `${column} <> '${RESET_REQUIRED}'`

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function parsePassword(value: unknown, kind: 'new' | 'current'): string {
  if (kind === 'new') {
    if (typeof value !== 'string' || value.length < 8 || value.length > 1024)
      throw new HttpError(400, 'Password must be 8–1024 characters', 'WEAK_PASSWORD')
  } else if (typeof value !== 'string' || !value || value.length > 1024) {
    throw new HttpError(400, 'Password is required', 'MISSING_PASSWORD')
  }
  return value
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<{ id: string; email: string; password_hash: string } | null> {
  return db
    .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .bind(normalizeEmail(email))
    .first<{ id: string; email: string; password_hash: string }>()
}

export async function getPasswordHashById(db: D1Database, userId: string): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT COALESCE((SELECT password FROM auth_accounts WHERE userId = users.id AND providerId = 'credential'), password_hash) AS password_hash FROM users WHERE id = ?`,
    )
    .bind(userId)
    .first<{ password_hash: string }>()
  return row?.password_hash ?? null
}

export async function deleteUserCascade(db: D1Database, userId: string): Promise<string[]> {
  const childTables = [
    'history_import_rows',
    'history_import_runs',
    'import_conversion_receipts',
    'import_drafts',
    'import_batches',
    'lifecycle_operation_receipts',
    'transit_cleanup_markers',
    'country_evidence_suppressions',
    'country_visit_evidence',
    'flights',
    'visits',
    'country_claims',
    'ground_visits',
    'user_activity_days',
    'ground_operation_receipts',
    'ground_journey_countries',
    'ground_rail_legs',
    'ground_road_points',
    'ground_journeys',
    'ground_manual_places',
    'user_stats',
    'user_advanced_stats',
    'user_badges',
    'user_aircraft',
    'leaderboard_cache',
    'sessions',
    'account_activation_tokens',
    'user_derived_state',
    'legacy_visit_evidence',
    'flight_idempotency',
  ]
  const [jobs] = await db.batch([
    db
      .prepare("SELECT id FROM import_batches WHERE user_id = ? AND status = 'processing'")
      .bind(userId),
    ...childTables.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId)),
    db.prepare('DELETE FROM auth_sessions WHERE userId = ?').bind(userId),
    db
      .prepare("DELETE FROM auth_verifications WHERE identifier = ? AND id LIKE 'password-reset:%'")
      .bind(`password-reset:${userId}`),
    db.prepare('DELETE FROM auth_accounts WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM profiles WHERE id = ?').bind(userId),
    db.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ])
  return (jobs.results as Array<{ id: string }>).map((job) => job.id)
}

export async function createUserWithProfile(
  db: D1Database,
  input: NewUserInput,
  authSecret: string,
): Promise<AuthUser> {
  const id = newId()
  const email = normalizeEmail(input.email)
  const passwordHash = await hashPassword(input.password, authSecret)
  const now = nowIso()

  await db.batch([
    db
      .prepare(
        'INSERT INTO users (id, email, password_hash, created_at, updated_at, name, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, email, passwordHash, now, now, input.displayName ?? '', input.avatarUrl ?? null),
    db
      .prepare(
        `INSERT INTO auth_accounts (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, 'credential', ?, ?, ?, ?)`,
      )
      .bind(`credential:${id}`, id, id, passwordHash, now, now),
    db
      .prepare(
        `INSERT INTO profiles (id, display_name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, input.displayName ?? null, input.avatarUrl ?? null, now, now),
  ])

  return { id, email }
}
