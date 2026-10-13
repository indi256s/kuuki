import { betterAuth } from 'better-auth/minimal'
import { kyselyAdapter } from '@better-auth/kysely-adapter'
import { Kysely } from 'kysely'
import { D1Dialect } from 'kysely-d1'
import { hashPassword, verifyPassword, generateToken } from './crypto'
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  serializeCookie,
  clearCookie,
  parseCookies,
} from './cookies'
import { revokeSession } from './session'
import { nowIso } from './time'
import { requireCsrf, requireSameOrigin } from './auth'
import { HttpError, jsonError } from './http'

export const BETTER_AUTH_COOKIE = 'kuuki_auth_session'

/** Request-scoped configuration uses this environment's D1 binding and canonical origin. */
export function createAuth(env: Env) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')
  if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET is not configured')
  const origin = new URL(env.PAGES_ORIGIN).origin
  return betterAuth({
    appName: 'Kuuki',
    database: kyselyAdapter(new Kysely({ dialect: new D1Dialect({ database: env.DB }) }), {
      type: 'sqlite',
      transaction: false,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: origin,
    trustedOrigins: [origin],
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: 'select_account',
              mapProfileToUser: async (profile) => {
                // Google only owns Gmail and Workspace email addresses, not third-party mailboxes.
                const emailVerified =
                  profile.email_verified === true &&
                  (/@(?:gmail|googlemail)\.com$/i.test(profile.email) ||
                    (typeof profile.hd === 'string' && profile.hd.length > 0))
                if (emailVerified) {
                  // Google proves ownership of an unclaimed migrated journal. Keep the local
                  // verification gate for accounts with an existing password or provider identity.
                  await env.DB.prepare(
                    `UPDATE users SET email_verified = 1, updated_at = ?
                     WHERE email = ? AND email_verified = 0 AND password_hash = 'RESET_REQUIRED'
                       AND NOT EXISTS (SELECT 1 FROM auth_accounts WHERE userId = users.id)`,
                  )
                    .bind(nowIso(), profile.email.toLowerCase())
                    .run()
                }
                return { emailVerified }
              },
            },
          }
        : {},
    onAPIError: { errorURL: `${origin}/signin` },
    emailAndPassword: {
      enabled: true,
      // Kuuki provisions the user, profile and credential together in one D1 batch.
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 1024,
      password: {
        hash: (password) => hashPassword(password, env.AUTH_SECRET),
        verify: ({ password, hash }) => verifyPassword(password, hash, env.AUTH_SECRET),
      },
    },
    user: {
      modelName: 'users',
      fields: { createdAt: 'created_at', updatedAt: 'updated_at', emailVerified: 'email_verified' },
      additionalFields: {
        password_hash: {
          type: 'string',
          input: false,
          returned: false,
          required: false,
          defaultValue: 'RESET_REQUIRED',
        },
      },
    },
    account: { modelName: 'auth_accounts', updateAccountOnSignIn: false },
    databaseHooks: {
      account: {
        create: {
          // Sign-in needs the stable provider identity, not reusable Google API credentials.
          before: async (account) => ({
            data: { ...account, accessToken: null, refreshToken: null, idToken: null },
          }),
        },
      },
      session: {
        create: {
          before: async (session) => {
            await env.DB.prepare('INSERT INTO profiles (id) VALUES (?) ON CONFLICT(id) DO NOTHING')
              .bind(session.userId)
              .run()
          },
        },
      },
    },
    session: {
      modelName: 'auth_sessions',
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    verification: { modelName: 'auth_verifications' },
    // The mounted routes use Kuuki's atomic, D1-backed per-IP counters.
    rateLimit: { enabled: false },
    advanced: {
      useSecureCookies: origin.startsWith('https:'),
      cookies: { session_token: { name: BETTER_AUTH_COOKIE } },
      database: { generateId: () => crypto.randomUUID() },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
  })
}

export function hasBetterAuthCookie(request: Request): boolean {
  const cookies = parseCookies(request.headers.get('Cookie'))
  return (
    Object.hasOwn(cookies, BETTER_AUTH_COOKIE) ||
    Object.hasOwn(cookies, `__Secure-${BETTER_AUTH_COOKIE}`)
  )
}

export function appendCsrfCookie(
  headers: Headers,
  request: Request,
  token = generateToken(),
): void {
  headers.append(
    'Set-Cookie',
    serializeCookie(CSRF_COOKIE, token, {
      maxAge: SESSION_TTL_SECONDS,
      secure: new URL(request.url).protocol === 'https:',
    }),
  )
}

export function clearBetterAuthCookie(headers: Headers, request: Request): void {
  const secure = new URL(request.url).protocol === 'https:'
  headers.append(
    'Set-Cookie',
    clearCookie(secure ? `__Secure-${BETTER_AUTH_COOKIE}` : BETTER_AUTH_COOKIE, {
      httpOnly: true,
      secure,
    }),
  )
}

/** Preserve Better Auth's signed cookie headers and pair them with Kuuki's CSRF token. */
export async function signInWithBetterAuth(
  env: Env,
  request: Request,
  email: string,
  password: string,
): Promise<Response> {
  requireSameOrigin(request)
  const response = await createAuth(env).api.signInEmail({
    body: { email, password },
    headers: request.headers,
    asResponse: true,
  })
  if (!response.ok) {
    const failure = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null
    if (failure?.code === 'INVALID_EMAIL_OR_PASSWORD')
      return jsonError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
    if (failure?.code === 'FAILED_TO_CREATE_SESSION' || response.status >= 500) {
      throw new HttpError(503, 'Sign-in is temporarily unavailable', 'AUTH_UNAVAILABLE')
    }
    return response
  }
  const result = new Response(response.body, response)
  await revokeSession(env.DB, parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE])
  result.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, { httpOnly: true }))
  appendCsrfCookie(result.headers, request)
  result.headers.set('Cache-Control', 'no-store')
  return result
}

export async function signOutWithBetterAuth(env: Env, request: Request): Promise<Response> {
  requireCsrf(request)
  // Revoke the legacy cookie first so an old identity cannot reappear after signout.
  await revokeSession(env.DB, parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE])
  return createAuth(env).api.signOut({ headers: request.headers, asResponse: true })
}
