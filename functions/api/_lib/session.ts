// D1-backed opaque sessions. The raw 256-bit token lives only in the httpOnly cookie;
// the DB stores its SHA-256 so a DB leak can't reconstruct live sessions. Sessions are
// in D1 (not KV) so logout / account deletion revoke instantly (KV is eventually consistent).

import { generateToken, sha256Hex, newId } from './crypto'
import { nowIso, isoPlusSeconds, msSince } from './time'
import { SESSION_TTL_SECONDS } from './cookies'

export interface SessionUser {
  id: string
  email: string
}

export interface ResolvedSession {
  user: SessionUser
  sessionId: string
  expiresAt: string
  lastSeenAt: string | null
}

const SLIDE_AFTER_MS = 24 * 60 * 60 * 1000 // extend a session at most once per day

/** Create a session row and return the raw token to set as the cookie. */
export async function createSession(
  db: D1Database,
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: string }> {
  const token = generateToken()
  const tokenHash = await sha256Hex(token)
  const now = nowIso()
  const expiresAt = isoPlusSeconds(SESSION_TTL_SECONDS, now)
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), userId, tokenHash, now, expiresAt, now, meta.userAgent ?? null, meta.ip ?? null)
    .run()
  return { token, expiresAt }
}

/** Resolve a raw cookie token to its user, or null if missing/expired. Expired rows are pruned. */
export async function resolveSession(db: D1Database, token: string | undefined): Promise<ResolvedSession | null> {
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.id AS user_id, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ session_id: string; expires_at: string; last_seen_at: string | null; user_id: string; email: string }>()
  if (!row) return null
  if (row.expires_at <= nowIso()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(row.session_id).run()
    return null
  }
  return {
    user: { id: row.user_id, email: row.email },
    sessionId: row.session_id,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
  }
}

/**
 * Slide a valid session's expiry forward, at most once per day. Returns the new expiry
 * (to re-set the cookie Max-Age) or null if no extension happened. Pass `force` (used by
 * the explicit `/api/auth/refresh` endpoint) to bypass the once-per-day guard.
 */
export async function slideSession(
  db: D1Database,
  session: ResolvedSession,
  force = false,
): Promise<string | null> {
  if (!force && session.lastSeenAt && msSince(session.lastSeenAt) < SLIDE_AFTER_MS) return null
  const now = nowIso()
  const expiresAt = isoPlusSeconds(SESSION_TTL_SECONDS, now)
  await db
    .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
    .bind(now, expiresAt, session.sessionId)
    .run()
  return expiresAt
}

/** Revoke a single session by its raw cookie token (logout). */
export async function revokeSession(db: D1Database, token: string | undefined): Promise<void> {
  if (!token) return
  const tokenHash = await sha256Hex(token)
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
}

/** Revoke every session for a user (account deletion / password change). */
export async function revokeAllSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
}
