import 'server-only'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createAuth, BETTER_AUTH_COOKIE } from '../../../../functions/api/_lib/betterAuth'
import { parseCookies, SESSION_COOKIE } from '../../../../functions/api/_lib/cookies'
import { resolveSession, type SessionUser } from '../../../../functions/api/_lib/session'

export type RequestIdentity = SessionUser
export type RequestEnv = Parameters<typeof createAuth>[0]

/** Get the binding for this render. Never retain it or the identity at module scope. */
export async function getRequestEnv(): Promise<RequestEnv> {
  await connection()
  const context = await getCloudflareContext({ async: true })
  return context.env as RequestEnv
}

/** Cookie-free fresh D1 identity read; a Better Auth cookie suppresses legacy fallback. */
export async function getRequestIdentity(): Promise<RequestIdentity | null> {
  const env = await getRequestEnv()
  if (env.MAINTENANCE_MODE === 'true') throw new Error('MAINTENANCE')
  const requestHeaders = await headers()
  const cookies = parseCookies(requestHeaders.get('cookie'))
  if (Object.hasOwn(cookies, BETTER_AUTH_COOKIE) || Object.hasOwn(cookies, `__Secure-${BETTER_AUTH_COOKIE}`)) {
    const session = await createAuth(env).api.getSession({
      headers: new Headers(requestHeaders), query: { disableRefresh: true },
    })
    return session?.user ? { id: session.user.id, email: session.user.email } : null
  }
  const session = await resolveSession(env.DB, cookies[SESSION_COOKIE], { pruneExpired: false })
  return session?.user ?? null
}

/** Public pages stay available during maintenance; real session-read errors still surface. */
export async function getOptionalPublicViewer(): Promise<RequestIdentity | null> {
  const env = await getRequestEnv()
  if (env.MAINTENANCE_MODE === 'true') return null
  return getRequestIdentity()
}
