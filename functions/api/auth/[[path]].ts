// Better Auth client endpoints; account provisioning keeps Kuuki's atomic D1 batch.
import { onRequestPost as signIn } from './signin'
import { onRequestPost as signUp } from './signup'
import { onRequestPost as signOut } from './signout'
import { createAuth, appendCsrfCookie, hasBetterAuthCookie } from '../_lib/betterAuth'
import { runHandler, jsonError } from '../_lib/http'
import { parseCookies, CSRF_COOKIE, SESSION_COOKIE, clearCookie } from '../_lib/cookies'
import { revokeSession } from '../_lib/session'
import { rateLimit, clientIp } from '../_lib/ratelimit'

export const onRequest: PagesFunction<Env> = (context) => runHandler(async () => {
  const path = new URL(context.request.url).pathname
  if (context.request.method === 'POST') {
    if (path === '/api/auth/sign-in/email') return signIn(context)
    if (path === '/api/auth/sign-up/email') return signUp(context)
    if (path === '/api/auth/sign-out') return signOut(context)
  }
  if (context.request.method === 'GET' && path === '/api/auth/get-session') {
    await rateLimit(context.env.DB, `auth-session:${clientIp(context.request)}`, 120, 60)
    const response = await createAuth(context.env).handler(context.request)
    if (!response.ok) return response
    const session = await response.json() as { session: Record<string, unknown>; user: Record<string, unknown> } | null
    if (session) delete session.session.token
    const result = new Response(JSON.stringify(session), response)
    if (session) {
      appendCsrfCookie(result.headers, context.request, parseCookies(context.request.headers.get('Cookie'))[CSRF_COOKIE])
    } else if (hasBetterAuthCookie(context.request)) {
      await revokeSession(context.env.DB, parseCookies(context.request.headers.get('Cookie'))[SESSION_COOKIE])
      result.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, { httpOnly: true }))
    }
    return result
  }
  return jsonError(404, 'Not found', 'NOT_FOUND')
})
