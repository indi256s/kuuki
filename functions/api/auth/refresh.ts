// POST /api/auth/refresh — slide an *already-valid* session forward.
//
// This cannot revive an expired session — it only extends a still-valid one. The client's
// "on 401, refresh once then retry" must therefore treat a 401 here as a hard logout (no infinite loop).

import { runHandler, json, HttpError } from '../_lib/http'
import { requireCsrf, type RequestData } from '../_lib/auth'
import { parseCookies, CSRF_COOKIE } from '../_lib/cookies'
import { createAuth, hasBetterAuthCookie, appendCsrfCookie } from '../_lib/betterAuth'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)

    // Middleware only attaches data.user for a valid session; a missing user means the
    // session is absent or expired and refresh must fail (client logs out).
    if (!data.user || !hasBetterAuthCookie(request))
      throw new HttpError(401, 'Session expired', 'SESSION_EXPIRED')

    const response = await createAuth(env).api.getSession({
      headers: request.headers,
      asResponse: true,
    })
    if (!response.ok) return response
    const session = (await response.json()) as { user: { id: string; email: string } } | null
    if (!session) throw new HttpError(401, 'Session expired', 'SESSION_EXPIRED')
    const res = json({ user: { id: session.user.id, email: session.user.email } })
    for (const cookie of response.headers.getSetCookie()) res.headers.append('Set-Cookie', cookie)
    appendCsrfCookie(res.headers, request, parseCookies(request.headers.get('Cookie'))[CSRF_COOKIE])
    return res
  })
