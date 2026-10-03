// POST /api/auth/signin — email + password.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireSameOrigin } from '../_lib/auth'
import { getUserByEmail, parsePassword } from '../_lib/users'
import { verifyPassword, dummyVerify } from '../_lib/crypto'
import { createSession } from '../_lib/session'
import { setSessionCookies } from '../_lib/authCookies'
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
    if (!(await verifyPassword(password, user.password_hash, env.AUTH_SECRET))) {
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
    }

    const { token } = await createSession(env.DB, user.id, {
      userAgent: request.headers.get('User-Agent'),
      ip: clientIp(request),
    })

    const profileRow = await getProfileRow(env.DB, user.id)
    const res = json({
      user: { id: user.id, email: user.email },
      profile: profileRow ? toOwnProfile(profileRow) : null,
    })
    setSessionCookies(res.headers, token)
    return res
  })
