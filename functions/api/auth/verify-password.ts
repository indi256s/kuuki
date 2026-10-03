// POST /api/auth/verify-password — re-authentication gate (e.g. before account deletion).
//
// Confirms the logged-in user's password without minting or rotating any session: it is a
// proof-of-presence check, not a sign-in. Rate-limited per user to blunt online guessing.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { getPasswordHashById } from '../_lib/users'
import { verifyPassword } from '../_lib/crypto'
import { rateLimit, clientIp } from '../_lib/ratelimit'

interface VerifyBody {
  password?: string
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)
    await rateLimit(env.DB, `verifypw:${clientIp(request)}`, 10, 900)

    const body = await readJson<VerifyBody>(request)
    const password = body?.password
    if (typeof password !== 'string' || !password || password.length > 1024) throw new HttpError(400, 'Password is required', 'MISSING_PASSWORD')

    const hash = await getPasswordHashById(env.DB, user.id)
    if (!hash || !(await verifyPassword(password, hash, env.AUTH_SECRET))) {
      throw new HttpError(401, 'Incorrect password', 'INVALID_CREDENTIALS')
    }

    return json({ ok: true })
  })
