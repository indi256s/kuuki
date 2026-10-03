// User + profile creation, porting Supabase's handle_new_user.
//
// handle_new_user (live): on auth.users INSERT → insert profiles(id, display_name, avatar_url).
//   No username, no user_stats row (user_stats is created lazily by the derived-state repair).

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

/** Shape-only email check shared by signup and activation requests. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Password shape check. A new password needs 8+ characters; a current one only needs to be
 * present. Both cap at 1024 to bound hashing cost.
 */
export function parsePassword(value: unknown, kind: 'new' | 'current'): string {
  if (kind === 'new') {
    if (typeof value !== 'string' || value.length < 8 || value.length > 1024) throw new HttpError(400, 'Password must be 8–1024 characters', 'WEAK_PASSWORD')
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

/** Fetch a user's stored password hash by id (re-auth gate for verify-password). */
export async function getPasswordHashById(
  db: D1Database,
  userId: string,
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT COALESCE((SELECT password FROM auth_accounts WHERE userId = users.id AND providerId = 'credential'), password_hash) AS password_hash FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ password_hash: string }>()
  return row?.password_hash ?? null
}

/**
 * Delete every row a user owns, then the profile and user rows, in one batch.
 *
 * D1's FK ON DELETE CASCADE is not guaranteed on every path (see schema header), so we
 * delete children explicitly in child→parent order. Tables enumerated from §4 of the
 * migration plan + the schema. The whole thing runs as a single db.batch() so a failure
 * rolls back rather than leaving a half-deleted account.
 */
export async function deleteUserCascade(db: D1Database, userId: string): Promise<void> {
  const childTables = [
    'flights',
    'visits',
    'country_claims',
    'ground_visits',
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
  await db.batch([
    ...childTables.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId)),
    db.prepare('DELETE FROM auth_sessions WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM auth_accounts WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM profiles WHERE id = ?').bind(userId),
    db.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ])
}

/**
 * Create the auth user and profile in one batch. Founding badges already earned by
 * historical users remain untouched; new signups do not receive one.
 */
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
      .prepare('INSERT INTO users (id, email, password_hash, created_at, updated_at, name, image) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, email, passwordHash, now, now, input.displayName ?? '', input.avatarUrl ?? null),
    db.prepare(`INSERT INTO auth_accounts (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, 'credential', ?, ?, ?, ?)`)
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
