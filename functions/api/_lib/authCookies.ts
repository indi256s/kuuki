// Clears the legacy session cookie and the CSRF cookie on a response Headers object.

import { SESSION_COOKIE, CSRF_COOKIE, clearCookie } from './cookies'

export function clearSessionCookies(headers: Headers): void {
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, { httpOnly: true }))
  headers.append('Set-Cookie', clearCookie(CSRF_COOKIE, { httpOnly: false }))
}
