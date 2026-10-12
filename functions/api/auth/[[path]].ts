// Better Auth client endpoints; account provisioning keeps Kuuki's atomic D1 batch.
import { onRequestPost as signIn } from './signin'
import { onRequestPost as signUp } from './signup'
import { onRequestPost as signOut } from './signout'
import {
  createAuth,
  appendCsrfCookie,
  hasBetterAuthCookie,
  BETTER_AUTH_COOKIE,
} from '../_lib/betterAuth'
import { runHandler, jsonError, readJson } from '../_lib/http'
import { requireStrictSameOrigin } from '../_lib/auth'
import { parseCookies, CSRF_COOKIE, SESSION_COOKIE, clearCookie } from '../_lib/cookies'
import { revokeSession } from '../_lib/session'
import { rateLimit, clientIp } from '../_lib/ratelimit'

export const onRequest: PagesFunction<Env> = (context) =>
  runHandler(async () => {
    const path = new URL(context.request.url).pathname
    if (context.request.method === 'POST') {
      if (path === '/api/auth/sign-in/email') return signIn(context)
      if (path === '/api/auth/sign-up/email') return signUp(context)
      if (path === '/api/auth/sign-out') return signOut(context)
      if (path === '/api/auth/sign-in/social') {
        requireStrictSameOrigin(context.request)
        await rateLimit(context.env.DB, `signin:${clientIp(context.request)}`, 20, 900)
        const body = await readJson<{ provider?: unknown; idToken?: unknown }>(context.request)
        if (body?.provider !== 'google' || body.idToken !== undefined)
          return jsonError(400, 'Google redirect sign-in is required', 'INVALID_PROVIDER')
        if (!context.env.GOOGLE_CLIENT_ID || !context.env.GOOGLE_CLIENT_SECRET)
          return jsonError(503, 'Google sign-in is unavailable', 'AUTH_UNAVAILABLE')
        const origin = new URL(context.env.PAGES_ORIGIN).origin
        return createAuth(context.env).api.signInSocial({
          body: {
            provider: 'google',
            callbackURL: `${origin}/overview`,
            newUserCallbackURL: `${origin}/welcome/name`,
            errorCallbackURL: `${origin}/signin`,
            disableRedirect: true,
          },
          headers: context.request.headers,
          asResponse: true,
        })
      }
    }
    if (context.request.method === 'GET' && path === '/api/auth/callback/google') {
      await rateLimit(context.env.DB, `oauth-callback:${clientIp(context.request)}`, 60, 900)
      const response = await createAuth(context.env).handler(context.request)
      const result = new Response(response.body, response)
      if (
        response.headers
          .getSetCookie()
          .some(
            (cookie) =>
              cookie.startsWith(`${BETTER_AUTH_COOKIE}=`) ||
              cookie.startsWith(`__Secure-${BETTER_AUTH_COOKIE}=`),
          )
      ) {
        // A late response renewing the replaced cookie must not restore its old identity.
        if (hasBetterAuthCookie(context.request)) {
          const previous = await createAuth(context.env).api.getSession({
            headers: context.request.headers,
            query: { disableRefresh: true },
          })
          if (previous)
            await context.env.DB.prepare('DELETE FROM auth_sessions WHERE id = ?')
              .bind(previous.session.id)
              .run()
        }
        await revokeSession(
          context.env.DB,
          parseCookies(context.request.headers.get('Cookie'))[SESSION_COOKIE],
        )
        result.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, { httpOnly: true }))
        appendCsrfCookie(result.headers, context.request)
      }
      result.headers.set('Cache-Control', 'no-store')
      return result
    }
    if (context.request.method === 'GET' && path === '/api/auth/get-session') {
      await rateLimit(context.env.DB, `auth-session:${clientIp(context.request)}`, 120, 60)
      const response = await createAuth(context.env).handler(context.request)
      if (!response.ok) return response
      const session = (await response.json()) as {
        session: Record<string, unknown>
        user: Record<string, unknown>
      } | null
      if (session) delete session.session.token
      const result = new Response(JSON.stringify(session), response)
      if (session) {
        appendCsrfCookie(
          result.headers,
          context.request,
          parseCookies(context.request.headers.get('Cookie'))[CSRF_COOKIE],
        )
      } else if (hasBetterAuthCookie(context.request)) {
        await revokeSession(
          context.env.DB,
          parseCookies(context.request.headers.get('Cookie'))[SESSION_COOKIE],
        )
        result.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, { httpOnly: true }))
      }
      return result
    }
    return jsonError(404, 'Not found', 'NOT_FOUND')
  })
