// Minimal fixed-window rate limiter backed by the IMPORT_JOBS KV namespace.
// Open registration + password sign-in need brute-force / abuse throttling.

import { HttpError } from './http'

/**
 * Increment a counter for `key` within a `windowSeconds` window. Throws 429 once `limit`
 * is exceeded. Best-effort (KV is eventually consistent) — adequate for abuse throttling,
 * not for hard quotas.
 */
export async function rateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const k = `rl:${key}`
  const current = Number((await kv.get(k)) ?? '0')
  if (current >= limit) {
    throw new HttpError(429, 'Too many requests — please try again later', 'RATE_LIMITED')
  }
  // expirationTtl keeps the window fixed; first writer in the window sets the TTL.
  await kv.put(k, String(current + 1), { expirationTtl: windowSeconds })
}

/** Derive a client key from the request (Cloudflare-provided client IP). */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'
}
