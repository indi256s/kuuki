// Atomic D1 fixed-window counters for the small auth surface.

import { HttpError } from './http'

/**
 * Increment a counter for `key` within a fixed window. The UPSERT is one SQLite
 * statement, so parallel requests cannot lose increments.
 */
export async function rateLimit(
  store: D1Database | KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  // Import/enrichment callers still use the pre-existing KV limiter. Auth routes
  // pass D1 and use the atomic branch below; W4 can move its own callers later.
  if (!('prepare' in store)) {
    const k = `rl:${key}`
    const current = Number((await store.get(k)) ?? '0')
    if (current >= limit) throw new HttpError(429, 'Too many requests — please try again later', 'RATE_LIMITED')
    await store.put(k, String(current + 1), { expirationTtl: windowSeconds })
    return
  }
  const now = Math.floor(Date.now() / 1000)
  const row = await store.prepare(
    `INSERT INTO auth_rate_limits (key, count, expires_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN auth_rate_limits.expires_at <= ? THEN 1 ELSE auth_rate_limits.count + 1 END,
       expires_at = CASE WHEN auth_rate_limits.expires_at <= ? THEN excluded.expires_at ELSE auth_rate_limits.expires_at END
     RETURNING count`,
  ).bind(key, now + windowSeconds, now, now).first<{ count: number }>()
  if (!row || row.count > limit) {
    throw new HttpError(429, 'Too many requests — please try again later', 'RATE_LIMITED')
  }
}

/** Derive a client key from the request (Cloudflare-provided client IP). */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'
}
