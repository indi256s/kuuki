// Request-side auth helpers: CSRF defence + ownership guards used by every handler.
//
// Auth moved from bearer tokens (CSRF-immune) to an httpOnly cookie, which reintroduces
// CSRF risk. Defence is layered: (1) reject cross-site Origin on mutations, and
// (2) double-submit token — a non-httpOnly `kuuki_csrf` cookie that JS echoes in the
// `X-CSRF-Token` header; an attacker page can't read the cookie to forge the header.

import { parseCookies, CSRF_COOKIE } from './cookies'
import { HttpError } from './http'
import type { SessionUser } from './session'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Data attached to context by _middleware after resolving the session cookie. */
export interface RequestData extends Record<string, unknown> {
  user: SessionUser | null
}

/** Throws 401 unless a session was resolved. Returns the authenticated user. */
export function requireUser(data: RequestData): SessionUser {
  if (!data.user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED')
  return data.user
}

/**
 * Same-origin check for mutations. Used by pre-auth endpoints (signup/signin) which can't
 * yet present a double-submit token because no CSRF cookie exists before login.
 */
export function requireSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return
  const origin = request.headers.get('Origin')
  if (!origin) return // non-browser client (e.g. curl); no ambient-cookie risk
  let requestOrigin: string
  try {
    requestOrigin = new URL(origin).origin
  } catch {
    throw new HttpError(403, 'Bad origin', 'CSRF')
  }
  if (requestOrigin !== new URL(request.url).origin) {
    throw new HttpError(403, 'Cross-origin request rejected', 'CSRF')
  }
}

/** Activation requires an explicit browser Origin and an exact scheme/host/port match. */
export function requireStrictSameOrigin(request: Request): void {
  const origin = request.headers.get('Origin')
  if (!origin) throw new HttpError(403, 'Origin required', 'CSRF')
  try {
    if (new URL(origin).origin === new URL(request.url).origin) return
  } catch {
    // Reject malformed Origin through the common error below.
  }
  throw new HttpError(403, 'Cross-origin request rejected', 'CSRF')
}

/**
 * Full CSRF check for authenticated mutations: same-origin AND a matching double-submit
 * token (kuuki_csrf cookie === X-CSRF-Token header). Safe methods pass freely.
 */
export function requireCsrf(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return
  requireSameOrigin(request)
  const cookieToken = parseCookies(request.headers.get('Cookie'))[CSRF_COOKIE]
  const headerToken = request.headers.get('X-CSRF-Token')
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new HttpError(403, 'Invalid CSRF token', 'CSRF')
  }
}
