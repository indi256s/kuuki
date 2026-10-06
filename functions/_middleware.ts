// Resolves the session cookie for /api/* requests and attaches the user to context.data,
// so handlers read context.data.user. Also slides the session expiry (≤ once/day) and
// re-sets the cookie. Non-/api requests (the SPA + static assets) pass straight through.
//
// Replaces the former Supabase SSR cookie-refresh middleware.

import { resolveSession, slideSession, revokeSession } from './api/_lib/session'
import { parseCookies, SESSION_COOKIE, CSRF_COOKIE, clearCookie } from './api/_lib/cookies'
import { refreshSessionCookie } from './api/_lib/authCookies'
import { generateToken } from './api/_lib/crypto'
import { gateRequest } from './api/_lib/workerBoundary'
import type { RequestData } from './api/_lib/auth'
import { createAuth, hasBetterAuthCookie, appendCsrfCookie, BETTER_AUTH_COOKIE } from './api/_lib/betterAuth'
import { runHandler } from './api/_lib/http'

async function handleRequest(request: Request, env: Env, data: RequestData, next: () => Promise<Response>): Promise<Response> {
  data.user = null

  const url = new URL(request.url)
  const boundary = gateRequest(request, env)
  if (boundary) return boundary
  if (!url.pathname.startsWith('/api/') || !env.DB) {
    return next()
  }
  // Recovery is a pre-auth token operation; it must never refresh an old session.
  if (url.pathname === '/api/auth/password-reset/request' || url.pathname === '/api/auth/password-reset/complete' || url.pathname === '/api/auth/link/request') return next()

  if (hasBetterAuthCookie(request)) {
    return runHandler(async () => {
      // Session replacement routes own cookie writes and must not renew an old identity.
      if (['/api/auth/signin', '/api/auth/continue', '/api/auth/signup', '/api/auth/signout', '/api/auth/sign-in/email', '/api/auth/sign-up/email', '/api/auth/sign-out', '/api/auth/get-session'].includes(url.pathname)) return next()
      const authResponse = await createAuth(env).api.getSession({ headers: request.headers, asResponse: true })
      if (!authResponse.ok) return authResponse
      const session = await authResponse.json() as { user: { id: string; email: string } } | null
      data.user = session ? { id: session.user.id, email: session.user.email } : null
      if (!session) await revokeSession(env.DB, parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE])
      const response = await next()
      if (response.headers.get('Set-Cookie')?.includes(`${BETTER_AUTH_COOKIE}=`)) return response
      const result = new Response(response.body, response)
      if (!session) result.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, { httpOnly: true }))
      for (const cookie of authResponse.headers.getSetCookie()) result.headers.append('Set-Cookie', cookie)
      if (session && (request.method === 'GET' || request.method === 'HEAD')) {
        appendCsrfCookie(result.headers, request, parseCookies(request.headers.get('Cookie'))[CSRF_COOKIE])
      }
      result.headers.set('Cache-Control', 'no-store')
      return result
    })
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
  const handlerOwnsSession = response.headers.get('Set-Cookie')?.includes(`${SESSION_COOKIE}=`) || response.headers.get('Set-Cookie')?.includes(`${BETTER_AUTH_COOKIE}=`)
  if (newExpiry && token && csrfToken && !handlerOwnsSession) {
    const res = new Response(response.body, response)
    refreshSessionCookie(res.headers, token, csrfToken)
    return res
  }
  return response
}

export const onRequest: PagesFunction<Env, string, RequestData> = context =>
  runApiRequest(context.request, context.env, context.data, () => context.next())

/** Shared transport boundary; Next and Pages call it with real request arguments. */
export async function runApiRequest(request: Request, env: Env, data: RequestData, next: () => Promise<Response>): Promise<Response> {
  if (!new URL(request.url).pathname.startsWith('/api/')) return handleRequest(request, env, data, next)
  const started = Date.now()
  const requestId = crypto.randomUUID()
  const response = await runHandler(() => handleRequest(request, env, data, next))
  const result = new Response(response.body, response)
  const durationMs = Date.now() - started
  result.headers.set('X-Request-Id', requestId)
  result.headers.set('Server-Timing', `api;dur=${durationMs}`)
  result.headers.set('Cache-Control', 'no-store')
  console.log(JSON.stringify({ event: 'api_request', requestId, method: request.method, status: result.status, durationMs }))
  return result
}
