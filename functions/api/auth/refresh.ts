// POST /api/auth/refresh — slide an *already-valid* session forward.
//
// Opaque sessions have no separate refresh token, so this cannot revive an expired
// session — it only extends a still-valid one. The client's "on 401, refresh once then
// retry" must therefore treat a 401 here as a hard logout (no infinite loop).

import { runHandler, json, HttpError } from '../_lib/http'
import { requireCsrf, type RequestData } from '../_lib/auth'
import { parseCookies, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../_lib/cookies'
import { resolveSession, slideSession } from '../_lib/session'
import { refreshSessionCookie } from '../_lib/authCookies'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)

    // Middleware only attaches data.user for a valid session; a missing user means the
    // session is absent or expired and refresh must fail (client logs out).
    if (!data.user) throw new HttpError(401, 'Session expired', 'SESSION_EXPIRED')

    const token = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE]
    const session = await resolveSession(env.DB, token)
    if (!session) throw new HttpError(401, 'Session expired', 'SESSION_EXPIRED')

    const newExpiry = await slideSession(env.DB, session, true)
    const res = json({ user: session.user })
    if (newExpiry && token) refreshSessionCookie(res.headers, token, SESSION_TTL_SECONDS)
    return res
  })
