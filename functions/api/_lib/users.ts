// User + profile creation, porting Supabase's handle_new_user + award_founding_badge_on_signup.
//
// handle_new_user (live): on auth.users INSERT → insert profiles(id, display_name, avatar_url).
//   No username, no user_stats row (user_stats is created lazily by recomputeUserStats upsert).
// award_founding_badge_on_signup (live): on profiles INSERT → award badge where code='founding-user'.

import { newId, hashPassword } from './crypto'
import { nowIso } from './time'

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

/**
 * Create the auth user, its profile, and the founding-user badge in one batch.
 * Mirrors the live signup trigger chain. Returns the new user id.
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
      .prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, email, passwordHash, now),
    db
      .prepare(
        `INSERT INTO profiles (id, display_name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, input.displayName ?? null, input.avatarUrl ?? null, now, now),
    // Founding-user badge (no-op if that badge definition isn't seeded yet).
    db
      .prepare(
        `INSERT INTO user_badges (user_id, badge_id, earned_at)
         SELECT ?, bd.id, ? FROM badge_definitions bd WHERE bd.code = 'founding-user'
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
      )
      .bind(id, now),
  ])

  return { id, email }
}
