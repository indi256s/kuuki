// POST /api/auth/continue — the one-form card's first step: email + password.
// A verified password issues a session (same body as sign-in); an unknown email answers
// { next: 'create' } so the client can ask for a new password; anything else is 401.

import { z } from 'zod'
import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireSameOrigin } from '../_lib/auth'
import { getUserByEmail, parsePassword } from '../_lib/users'
import { dummyVerify } from '../_lib/crypto'
import { signInWithBetterAuth } from '../_lib/betterAuth'
import { getProfileRow, toOwnProfile } from '../_lib/profiles'
import { rateLimit, clientIp } from '../_lib/ratelimit'

interface ContinueBody {
  email?: string
  password?: string
}

export const onRequestPost: PagesFunction<Env> = (context) =>
  runHandler(async () => {
    const { request, env } = context
    requireSameOrigin(request)
    await rateLimit(env.DB, `signin:${clientIp(request)}`, 20, 900)

    const body = await readJson<ContinueBody>(request)
    const email = typeof body?.email === 'string' ? body.email.trim() : null
    if (!email) throw new HttpError(400, 'Email and password are required', 'MISSING_CREDENTIALS')
    if (!z.email().safeParse(email).success) throw new HttpError(400, 'A valid email is required', 'INVALID_EMAIL')
    const password = parsePassword(body?.password, 'current')

    const user = await getUserByEmail(env.DB, email)
    if (!user) {
      // Account-existence leak, accepted (security finding #8, LOW): answering `create` here versus
      // 401 for a known account tells a caller whether an email is registered. Sign-up already
      // reveals the same thing through 409 EMAIL_TAKEN, and requiring email verification first was
      // rejected because it forces an app switch, so no new exposure is added. The leak is bounded
      // by the per-IP buckets: every call spends `signin:` (above) and every `create` answer also
      // spends `signup:` (below), which caps how fast unused emails can be probed.
      await rateLimit(env.DB, `signup:${clientIp(request)}`, 10, 3600)
      // Equalize timing so a missing account isn't distinguishable from a wrong password.
      await dummyVerify(password, env.AUTH_SECRET)
      return json({ next: 'create' })
    }

    const authResponse = await signInWithBetterAuth(env, request, user.email, password)
    // Better Auth's own 401 body differs from ours (and RESET_REQUIRED accounts have no credential row).
    if (!authResponse.ok) throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')

    const authResult = await authResponse.json() as Record<string, unknown>
    delete authResult.token
    const profileRow = await getProfileRow(env.DB, user.id)
    const res = json({
      ...authResult,
      profile: profileRow ? toOwnProfile(profileRow) : null,
    })
    for (const cookie of authResponse.headers.getSetCookie()) res.headers.append('Set-Cookie', cookie)
    res.headers.set('Cache-Control', 'no-store')
    return res
  })
