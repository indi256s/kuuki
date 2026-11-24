import { parseCookies, CSRF_COOKIE } from './cookies'
import { HttpError } from './http'

export interface SessionUser {
  id: string
  email: string
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export interface RequestData extends Record<string, unknown> {
  user: SessionUser | null
}

export function requireUser(data: RequestData): SessionUser {
  if (!data.user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED')
  return data.user
}

export function requireSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return
  const origin = request.headers.get('Origin')
  if (!origin) return
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

export function requireStrictSameOrigin(request: Request): void {
  const origin = request.headers.get('Origin')
  if (!origin) throw new HttpError(403, 'Origin required', 'CSRF')
  try {
    if (new URL(origin).origin === new URL(request.url).origin) return
  } catch {}
  throw new HttpError(403, 'Cross-origin request rejected', 'CSRF')
}

export function requireCsrf(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return
  requireSameOrigin(request)
  const cookieToken = parseCookies(request.headers.get('Cookie'))[CSRF_COOKIE]
  const headerToken = request.headers.get('X-CSRF-Token')
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new HttpError(403, 'Invalid CSRF token', 'CSRF')
  }
}
