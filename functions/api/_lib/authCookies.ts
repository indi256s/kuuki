// Helpers that attach/clear the session + CSRF cookies on a response Headers object.

import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  SESSION_TTL_SECONDS,
  serializeCookie,
  clearCookie,
} from './cookies'
import { generateToken } from './crypto'

/**
 * Append Set-Cookie headers for a freshly issued session:
 *  - kuuki_session: the opaque token, HttpOnly (JS can't read it)
 *  - kuuki_csrf:    a separate random token, readable by JS, echoed in X-CSRF-Token
 * Returns the CSRF token (handlers may also return it in the JSON body for convenience).
 */
export function setSessionCookies(
  headers: Headers,
  sessionToken: string,
  maxAge = SESSION_TTL_SECONDS,
): string {
  const csrf = generateToken()
  headers.append(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, sessionToken, {
      maxAge,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }),
  )
  headers.append(
    'Set-Cookie',
    serializeCookie(CSRF_COOKIE, csrf, { maxAge, httpOnly: false, secure: true, sameSite: 'Lax' }),
  )
  return csrf
}

/** Renew both cookie expiries while keeping the existing CSRF token stable. */
export function refreshSessionCookie(
  headers: Headers,
  sessionToken: string,
  csrfToken: string,
  maxAge = SESSION_TTL_SECONDS,
): void {
  headers.append(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, sessionToken, {
      maxAge,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }),
  )
  headers.append(
    'Set-Cookie',
    serializeCookie(CSRF_COOKIE, csrfToken, {
      maxAge,
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    }),
  )
}

export function clearSessionCookies(headers: Headers): void {
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, { httpOnly: true }))
  headers.append('Set-Cookie', clearCookie(CSRF_COOKIE, { httpOnly: false }))
}
