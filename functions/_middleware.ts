// Resolves the session cookie for /api/* requests and attaches the user to context.data,
// so handlers read context.data.user. Also slides the session expiry (≤ once/day) and
// re-sets the cookie. Non-/api requests (the SPA + static assets) pass straight through.
//
// Replaces the former Supabase SSR cookie-refresh middleware.

import { resolveSession, slideSession } from './api/_lib/session'
import { parseCookies, SESSION_COOKIE } from './api/_lib/cookies'
import { refreshSessionCookie } from './api/_lib/authCookies'
import type { RequestData } from './api/_lib/auth'

export const onRequest: PagesFunction<Env, string, RequestData> = async (context) => {
  const { request, env, next, data } = context
  data.user = null

  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/') || !env.DB) {
    return next()
  }

  const token = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE]
  const session = await resolveSession(env.DB, token)
  if (!session) {
    return next()
  }

  data.user = session.user
  const newExpiry = await slideSession(env.DB, session)
  const response = await next()
  if (newExpiry && token) {
    const res = new Response(response.body, response)
    refreshSessionCookie(res.headers, token)
    return res
  }
  return response
}
