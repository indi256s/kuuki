import { generateToken, hashPassword, newId, sha256Hex } from './crypto'
import { normalizeEmail, getUserByEmail } from './users'
import { nowIso, isoPlusSeconds } from './time'
import type { MailSender } from './activationSender'

const TOKEN_TTL_SECONDS = 30 * 60

/** HMAC key avoids storing the normalized email in the rate-limit table. */
export async function activationEmailKey(email: string, secret: string): Promise<string> {
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalizeEmail(email)))
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

/** Only RESET_REQUIRED accounts receive a link; callers always return the same public result. */
export async function requestActivation(db: D1Database, email: string, origin: string, sender: MailSender): Promise<void> {
  const user = await getUserByEmail(db, email)
  if (!user || user.password_hash !== 'RESET_REQUIRED') return
  const token = generateToken()
  const tokenHash = await sha256Hex(token)
  const createdAt = nowIso()
  const inserted = await db.prepare(
    `INSERT INTO account_activation_tokens (token_hash, user_id, created_at, expires_at)
     SELECT ?, id, ?, ? FROM users WHERE id = ? AND password_hash = 'RESET_REQUIRED'`,
  ).bind(tokenHash, createdAt, isoPlusSeconds(TOKEN_TTL_SECONDS, createdAt), user.id).run()
  if (inserted.meta.changes !== 1) return
  // Pages redirects .html assets to their extensionless URL.
  const link = new URL('/activate', origin)
  link.hash = `token=${token}`
  try {
    await sender.send(user.email, link.toString())
  } catch {
    try {
      await db.prepare('DELETE FROM account_activation_tokens WHERE token_hash = ?').bind(tokenHash).run()
    } catch {
      console.error(JSON.stringify({ event: 'activation_token_cleanup_failed' }))
    }
    console.error(JSON.stringify({ event: 'activation_sender_failed' }))
    // Preserve a generic public response for unknown, active, and delivery-failed accounts.
  }
}

/** The claim + credential update + revocation sequence is one D1 transaction. */
export async function completeActivation(db: D1Database, token: string, password: string, secret: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false
  const tokenHash = await sha256Hex(token)
  const passwordHash = await hashPassword(password, secret)
  const claimId = newId()
  const now = nowIso()
  const results = await db.batch([
    db.prepare(
      `UPDATE account_activation_tokens SET claim_id = ?
       WHERE token_hash = ? AND claim_id IS NULL AND expires_at > ?
         AND EXISTS (SELECT 1 FROM users WHERE id = account_activation_tokens.user_id AND password_hash = 'RESET_REQUIRED')`,
    ).bind(claimId, tokenHash, now),
    db.prepare(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE password_hash = 'RESET_REQUIRED'
       AND id = (SELECT user_id FROM account_activation_tokens WHERE token_hash = ? AND claim_id = ?)`,
    ).bind(passwordHash, now, tokenHash, claimId),
    db.prepare(`INSERT INTO auth_accounts (id, accountId, providerId, userId, password, createdAt, updatedAt)
      SELECT 'credential:' || u.id, u.id, 'credential', u.id, u.password_hash, u.created_at, ?
      FROM users u JOIN account_activation_tokens t ON t.user_id = u.id
      WHERE t.token_hash = ? AND t.claim_id = ? AND u.password_hash = ?
      ON CONFLICT(providerId, accountId) DO UPDATE SET password = excluded.password, updatedAt = excluded.updatedAt`)
      .bind(now, tokenHash, claimId, passwordHash),
    db.prepare(`DELETE FROM auth_sessions WHERE userId = (
      SELECT t.user_id FROM account_activation_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.claim_id = ? AND u.password_hash = ?
    )`).bind(tokenHash, claimId, passwordHash),
    db.prepare(
      `DELETE FROM sessions WHERE user_id = (
         SELECT t.user_id FROM account_activation_tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.claim_id = ? AND u.password_hash = ?
       )`,
    ).bind(tokenHash, claimId, passwordHash),
    db.prepare(
      `DELETE FROM account_activation_tokens WHERE user_id = (
         SELECT t.user_id FROM account_activation_tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.claim_id = ? AND u.password_hash = ?
       ) AND token_hash <> ?`,
    ).bind(tokenHash, claimId, passwordHash, tokenHash),
    db.prepare('DELETE FROM account_activation_tokens WHERE token_hash = ? AND claim_id = ?').bind(tokenHash, claimId),
  ])
  const claimed = results[0]?.meta.changes === 1
  const changedUser = results[1]?.meta.changes === 1
  if (claimed !== changedUser) throw new Error('Activation claim and credential update diverged')
  return claimed && changedUser
}
