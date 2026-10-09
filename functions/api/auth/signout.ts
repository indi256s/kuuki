// POST /api/auth/signout — revoke the current session and clear cookies.

import { runHandler, json } from '../_lib/http'
import { requireCsrf } from '../_lib/auth'
import { parseCookies, SESSION_COOKIE } from '../_lib/cookies'
import { revokeSession } from '../_lib/session'
import {
  hasBetterAuthCookie,
  signOutWithBetterAuth,
  clearBetterAuthCookie,
} from '../_lib/betterAuth'
import { clearSessionCookies } from '../_lib/authCookies'

export const onRequestPost: PagesFunction<Env> = (context) =>
  runHandler(async () => {
    const { request, env } = context
    requireCsrf(request)
    if (hasBetterAuthCookie(request)) {
      const authResponse = await signOutWithBetterAuth(env, request)
      if (!authResponse.ok) return authResponse
      const res = json({ ok: true })
      for (const cookie of authResponse.headers.getSetCookie())
        res.headers.append('Set-Cookie', cookie)
      clearSessionCookies(res.headers)
      return res
    }
    const token = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE]
    await revokeSession(env.DB, token)
    const res = json({ ok: true })
    clearSessionCookies(res.headers)
    clearBetterAuthCookie(res.headers, request)
    return res
  })
