import { z } from 'zod'
import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireSameOrigin } from '../_lib/auth'
import { getUserByEmail, parsePassword } from '../_lib/users'
import { dummyVerify } from '../_lib/crypto'
import { signInWithBetterAuth } from '../_lib/betterAuth'
import { getProfileRow, toOwnProfile } from '../_lib/profiles'
import { rateLimit, rateLimitExhausted, clientIp } from '../_lib/ratelimit'

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
    if (!z.email().safeParse(email).success)
      throw new HttpError(400, 'A valid email is required', 'INVALID_EMAIL')
    const password = parsePassword(body?.password, 'current')

    const user = await getUserByEmail(env.DB, email)
    const authResponse = user
      ? await signInWithBetterAuth(env, request, user.email, password)
      : await dummyVerify(password, env.AUTH_SECRET).then(() => null)

    if (!user || !authResponse?.ok) {
      if (await rateLimitExhausted(env.DB, `signup:${clientIp(request)}`, 10)) {
        throw new HttpError(429, 'Too many requests — please try again later', 'RATE_LIMITED')
      }
      if (!user) {
        await rateLimit(env.DB, `signup:${clientIp(request)}`, 10, 3600)
        return json({ next: 'create' })
      }
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
    }

    const authResult = (await authResponse.json()) as Record<string, unknown>
    delete authResult.token
    const profileRow = await getProfileRow(env.DB, user.id)
    const res = json({
      ...authResult,
      profile: profileRow ? toOwnProfile(profileRow) : null,
    })
    for (const cookie of authResponse.headers.getSetCookie())
      res.headers.append('Set-Cookie', cookie)
    res.headers.set('Cache-Control', 'no-store')
    return res
  })
