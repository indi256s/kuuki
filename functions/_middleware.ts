// Resolves the session cookie for /api/* requests and attaches the user to context.data,
// so handlers read context.data.user. Also slides the session expiry (≤ once/day) and
// re-sets the cookie. Non-/api requests (the SPA + static assets) pass straight through.
//
// Replaces the former Supabase SSR cookie-refresh middleware.

import { resolveSession, slideSession } from './api/_lib/session'
import { parseCookies, SESSION_COOKIE, CSRF_COOKIE } from './api/_lib/cookies'
import { refreshSessionCookie } from './api/_lib/authCookies'
import { generateToken } from './api/_lib/crypto'
import { configuredActivationOrigin } from './api/_lib/activationSender'
import type { RequestData } from './api/_lib/auth'

export const onRequest: PagesFunction<Env, string, RequestData> = async (context) => {
  const { request, env, next, data } = context
  data.user = null

  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/') && env.MAINTENANCE_MODE === 'true') {
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable', code: 'MAINTENANCE' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': '300',
        'Cache-Control': 'no-store',
      },
    })
  }
  // The activation alias serves only the isolated token page and its completion API.
  // Gate here before any session lookup, including old SPA/service-worker URLs.
  if (env.ACTIVATION_ORIGIN) {
    let activationOrigin: string
    try {
      activationOrigin = configuredActivationOrigin(env)
    } catch {
      return new Response('Service temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    if (url.origin === activationOrigin) {
      if ((request.method === 'GET' || request.method === 'HEAD') &&
          (url.pathname === '/activate' || url.pathname === '/activate.html' || url.pathname === '/activate.js')) return next()
      if (request.method === 'POST' && url.pathname === '/api/auth/activation/complete') return next()
      if (request.method === 'GET' || request.method === 'HEAD') {
        const signIn = url.pathname === '/' && url.searchParams.get('mode') === 'signin'
        return new Response(null, {
          status: 302,
          headers: {
            // An explicit empty fragment prevents browsers inheriting a bearer token.
            Location: new URL(signIn ? '/?mode=signin#' : '/#', env.PAGES_ORIGIN).toString(),
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
          },
        })
      }
      return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }
  }
  if (!url.pathname.startsWith('/api/') || !env.DB) {
    return next()
  }

  const cookies = parseCookies(request.headers.get('Cookie'))
  const token = cookies[SESSION_COOKIE]
  const session = await resolveSession(env.DB, token)
  if (!session) {
    return next()
  }

  data.user = session.user
  const csrfToken = cookies[CSRF_COOKIE] || (request.method === 'GET' || request.method === 'HEAD' ? generateToken() : null)
  const newExpiry = csrfToken ? await slideSession(env.DB, session, !cookies[CSRF_COOKIE]) : null
  const response = await next()
  // A sign-in/sign-out/account handler owns its Set-Cookie response. Appending an old
  // session after it would leave browsers with an ambiguous A/B cookie pair.
  const handlerOwnsSession = response.headers.get('Set-Cookie')?.includes(`${SESSION_COOKIE}=`) ?? false
  if (newExpiry && token && csrfToken && !handlerOwnsSession) {
    const res = new Response(response.body, response)
    refreshSessionCookie(res.headers, token, csrfToken)
    return res
  }
  return response
}
