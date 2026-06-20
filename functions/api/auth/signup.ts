// POST /api/auth/signup — open registration (email + password, optional displayName).

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireSameOrigin } from '../_lib/auth'
import { getUserByEmail, createUserWithProfile } from '../_lib/users'
import { createSession } from '../_lib/session'
import { setSessionCookies } from '../_lib/authCookies'
import { getProfileRow, toOwnProfile } from '../_lib/profiles'
import { rateLimit, clientIp } from '../_lib/ratelimit'

interface SignupBody {
  email?: string
  password?: string
  displayName?: string
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const onRequestPost: PagesFunction<Env> = (context) =>
  runHandler(async () => {
    const { request, env } = context
    requireSameOrigin(request)
    await rateLimit(env.IMPORT_JOBS, `signup:${clientIp(request)}`, 10, 3600)

    const body = await readJson<SignupBody>(request)
    const email = body?.email?.trim()
    const password = body?.password
    if (!email || !EMAIL_RE.test(email)) throw new HttpError(400, 'A valid email is required', 'INVALID_EMAIL')
    if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters', 'WEAK_PASSWORD')

    if (await getUserByEmail(env.DB, email)) {
      throw new HttpError(409, 'An account with this email already exists', 'EMAIL_TAKEN')
    }

    const user = await createUserWithProfile(
      env.DB,
      { email, password, displayName: body?.displayName?.trim() || null },
      env.AUTH_SECRET,
    )

    const { token } = await createSession(env.DB, user.id, {
      userAgent: request.headers.get('User-Agent'),
      ip: clientIp(request),
    })

    const profileRow = await getProfileRow(env.DB, user.id)
    const res = json(
      { user: { id: user.id, email: user.email }, profile: profileRow ? toOwnProfile(profileRow) : null },
      { status: 201 },
    )
    setSessionCookies(res.headers, token)
    return res
  })
