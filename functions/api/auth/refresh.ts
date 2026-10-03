// POST /api/auth/refresh — slide an *already-valid* session forward.
//
// Opaque sessions have no separate refresh token, so this cannot revive an expired
// session — it only extends a still-valid one. The client's "on 401, refresh once then
// retry" must therefore treat a 401 here as a hard logout (no infinite loop).

import { runHandler, json, HttpError } from '../_lib/http'
import { requireCsrf, type RequestData } from '../_lib/auth'
import { parseCookies, SESSION_COOKIE, CSRF_COOKIE, SESSION_TTL_SECONDS } from '../_lib/cookies'
import { resolveSession, slideSession } from '../_lib/session'
import { refreshSessionCookie } from '../_lib/authCookies'
import { createAuth, hasBetterAuthCookie, appendCsrfCookie } from '../_lib/betterAuth'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)

    // Middleware only attaches data.user for a valid session; a missing user means the
    // session is absent or expired and refresh must fail (client logs out).
    if (!data.user) throw new HttpError(401, 'Session expired', 'SESSION_EXPIRED')

    if (hasBetterAuthCookie(request)) {
      const response = await createAuth(env).api.getSession({ headers: request.headers, asResponse: true })
      if (!response.ok) return response
      const session = await response.json() as { user: { id: string; email: string } } | null
      if (!session) throw new HttpError(401, 'Session expired', 'SESSION_EXPIRED')
      const res = json({ user: { id: session.user.id, email: session.user.email } })
      for (const cookie of response.headers.getSetCookie()) res.headers.append('Set-Cookie', cookie)
      appendCsrfCookie(res.headers, request, parseCookies(request.headers.get('Cookie'))[CSRF_COOKIE])
      return res
    }
    const cookies = parseCookies(request.headers.get('Cookie'))
    const token = cookies[SESSION_COOKIE]
    const session = await resolveSession(env.DB, token)
    if (!session) throw new HttpError(401, 'Session expired', 'SESSION_EXPIRED')

    const newExpiry = await slideSession(env.DB, session, true)
    const res = json({ user: session.user })
    if (newExpiry && token && cookies[CSRF_COOKIE]) refreshSessionCookie(res.headers, token, cookies[CSRF_COOKIE], SESSION_TTL_SECONDS)
    return res
  })
