export const SESSION_COOKIE = 'kuuki_session'
export const CSRF_COOKIE = 'kuuki_csrf'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    if (!key) continue
    out[key] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return out
}

export interface CookieOptions {
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  path?: string
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const { maxAge, httpOnly = false, secure = true, sameSite = 'Lax', path = '/' } = opts
  let cookie = `${name}=${encodeURIComponent(value)}`
  cookie += `; Path=${path}`
  cookie += `; SameSite=${sameSite}`
  if (maxAge !== undefined) cookie += `; Max-Age=${maxAge}`
  if (httpOnly) cookie += '; HttpOnly'
  if (secure) cookie += '; Secure'
  return cookie
}

export function clearCookie(name: string, opts: CookieOptions = {}): string {
  return serializeCookie(name, '', { ...opts, maxAge: 0 })
}
