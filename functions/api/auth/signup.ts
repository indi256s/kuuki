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
    await rateLimit(env.DB, `signup:${clientIp(request)}`, 10, 3600)

    const body = await readJson<SignupBody>(request)
    const email = typeof body?.email === 'string' ? body.email.trim() : null
    const password = body?.password
    if (!email || !EMAIL_RE.test(email)) throw new HttpError(400, 'A valid email is required', 'INVALID_EMAIL')
    if (typeof password !== 'string' || password.length < 8 || password.length > 1024) throw new HttpError(400, 'Password must be 8–1024 characters', 'WEAK_PASSWORD')

    // Account-enumeration tradeoff (security finding #8, LOW): a distinct 409 here reveals that
    // an email is registered. The privacy-preserving fix (accept-then-verify by email) needs
    // transactional email infrastructure this app does not have, so the leak is accepted: it is
    // per-IP rate-limited (above), low-value for this app, and sign-in is separately hardened
    // against enumeration (dummyVerify + generic INVALID_CREDENTIALS).
    if (await getUserByEmail(env.DB, email)) {
      throw new HttpError(409, 'An account with this email already exists', 'EMAIL_TAKEN')
    }

    const user = await createUserWithProfile(
      env.DB,
      { email, password, displayName: typeof body?.displayName === 'string' ? body.displayName.trim() || null : null },
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
