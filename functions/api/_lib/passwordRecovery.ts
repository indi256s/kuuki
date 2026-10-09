import { generateToken, hashPassword, newId, sha256Hex } from './crypto'
import type { MailSender } from './activationSender'
import { getUserByEmail } from './users'
import { nowIso, isoPlusSeconds } from './time'
import { HttpError } from './http'

const PREFIX = 'password-reset:'
const TTL_SECONDS = 30 * 60

/** The main app origin is the sole destination; activation has its own isolated host. */
export function configuredRecoveryOrigin(env: Env): string {
  try {
    const parsed = new URL(env.PAGES_ORIGIN)
    const localHttp =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    if ((parsed.protocol === 'https:' || localHttp) && parsed.origin === env.PAGES_ORIGIN)
      return parsed.origin
  } catch {
    /* invalid configuration */
  }
  throw new HttpError(503, 'Password recovery is temporarily unavailable', 'RECOVERY_UNAVAILABLE')
}

export async function requestPasswordRecovery(
  db: D1Database,
  email: string,
  origin: string,
  sender: MailSender,
): Promise<void> {
  const user = await getUserByEmail(db, email)
  if (!user || user.password_hash === 'RESET_REQUIRED') return
  const credential = await db
    .prepare(
      `SELECT id FROM auth_accounts WHERE userId = ? AND providerId = 'credential' AND password IS NOT NULL`,
    )
    .bind(user.id)
    .first<{ id: string }>()
  if (!credential) return
  const token = generateToken()
  const hash = await sha256Hex(token)
  const now = nowIso()
  const inserted = await db
    .prepare(`INSERT INTO auth_verifications (id, identifier, value, expiresAt, createdAt, updatedAt)
    SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (
      SELECT 1 FROM users u JOIN auth_accounts a ON a.userId = u.id AND a.providerId = 'credential'
      WHERE u.id = ? AND u.password_hash <> 'RESET_REQUIRED' AND a.password IS NOT NULL
    )`)
    .bind(
      `${PREFIX}${hash}`,
      `${PREFIX}${user.id}`,
      hash,
      isoPlusSeconds(TTL_SECONDS, now),
      now,
      now,
      user.id,
    )
    .run()
  if (inserted.meta.changes !== 1) return
  const link = new URL('/reset-password', origin)
  link.hash = `token=${token}`
  try {
    await sender.send(user.email, link.toString())
  } catch {
    try {
      await db
        .prepare('DELETE FROM auth_verifications WHERE id = ? AND value = ?')
        .bind(`${PREFIX}${hash}`, hash)
        .run()
    } catch {
      console.error(JSON.stringify({ event: 'recovery_token_cleanup_failed' }))
    }
    console.error(JSON.stringify({ event: 'recovery_sender_failed' }))
  }
}

/** D1 batch is atomic; every mutation is additionally guarded against a lost claim. */
export async function completePasswordRecovery(
  db: D1Database,
  token: string,
  password: string,
  secret: string,
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false
  const hash = await sha256Hex(token)
  const passwordHash = await hashPassword(password, secret)
  const claim = newId()
  const now = nowIso()
  const id = `${PREFIX}${hash}`
  const owner = `(SELECT substr(identifier, ${PREFIX.length + 1}) FROM auth_verifications WHERE id = ? AND value = ?)`
  const results = await db.batch([
    db
      .prepare(`UPDATE auth_verifications SET value = ?, updatedAt = ? WHERE id = ? AND value = ? AND expiresAt > ?
      AND EXISTS (SELECT 1 FROM users u JOIN auth_accounts a ON a.userId = u.id AND a.providerId = 'credential'
        WHERE u.id = substr(auth_verifications.identifier, ${PREFIX.length + 1}) AND u.password_hash <> 'RESET_REQUIRED' AND a.password IS NOT NULL)`)
      .bind(claim, now, id, hash, now),
    db
      .prepare(
        `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ${owner} AND password_hash <> 'RESET_REQUIRED'`,
      )
      .bind(passwordHash, now, id, claim),
    db
      .prepare(`UPDATE auth_accounts SET password = ?, updatedAt = ? WHERE providerId = 'credential' AND userId = ${owner}
      AND EXISTS (SELECT 1 FROM users WHERE users.id = auth_accounts.userId AND users.password_hash = ?)`)
      .bind(passwordHash, now, id, claim, passwordHash),
    db
      .prepare(`DELETE FROM sessions WHERE user_id = ${owner} AND EXISTS
      (SELECT 1 FROM users WHERE users.id = sessions.user_id AND users.password_hash = ?)`)
      .bind(id, claim, passwordHash),
    db
      .prepare(`DELETE FROM auth_sessions WHERE userId = ${owner} AND EXISTS
      (SELECT 1 FROM users WHERE users.id = auth_sessions.userId AND users.password_hash = ?)`)
      .bind(id, claim, passwordHash),
    db
      .prepare(`DELETE FROM auth_verifications WHERE identifier = (SELECT identifier FROM auth_verifications WHERE id = ? AND value = ?)
      AND id LIKE 'password-reset:%' AND EXISTS (SELECT 1 FROM users WHERE users.id = substr(auth_verifications.identifier, ${PREFIX.length + 1}) AND users.password_hash = ?)`)
      .bind(id, claim, passwordHash),
  ])
  const claimed = results[0]?.meta.changes === 1
  if (claimed && (results[1]?.meta.changes !== 1 || results[2]?.meta.changes !== 1)) {
    throw new Error('Password recovery credential update diverged')
  }
  return claimed
}
