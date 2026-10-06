// POST /api/auth/signin — email + password.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireSameOrigin } from '../_lib/auth'
import { getUserByEmail, parsePassword } from '../_lib/users'
import { dummyVerify } from '../_lib/crypto'
import { signInWithBetterAuth } from '../_lib/betterAuth'
import { getProfileRow, toOwnProfile } from '../_lib/profiles'
import { rateLimit, clientIp } from '../_lib/ratelimit'

interface SigninBody {
  email?: string
  password?: string
}

export const onRequestPost: PagesFunction<Env> = (context) =>
  runHandler(async () => {
    const { request, env } = context
    requireSameOrigin(request)
    await rateLimit(env.DB, `signin:${clientIp(request)}`, 20, 900)

    const body = await readJson<SigninBody>(request)
    const email = typeof body?.email === 'string' ? body.email.trim() : null
    if (!email) throw new HttpError(400, 'Email and password are required', 'MISSING_CREDENTIALS')
    const password = parsePassword(body?.password, 'current')

    const user = await getUserByEmail(env.DB, email)
    if (!user) {
      // Equalize timing so a missing account isn't distinguishable from a wrong password.
      await dummyVerify(password, env.AUTH_SECRET)
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
    }
    const authResponse = await signInWithBetterAuth(env, request, user.email, password)
    // Better Auth's own 401 body differs from the unknown-email one above, which would reveal that the account exists.
    if (!authResponse.ok) return authResponse

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
