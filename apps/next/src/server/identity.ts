import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createAuth, BETTER_AUTH_COOKIE } from '../../../../functions/api/_lib/betterAuth'
import { parseCookies } from '../../../../functions/api/_lib/cookies'
import type { SessionUser } from '../../../../functions/api/_lib/auth'

export type RequestIdentity = SessionUser
export type RequestEnv = Parameters<typeof createAuth>[0]

/** Get the binding for this render. Never retain it or the identity at module scope; cache() is per-request. */
export const getRequestEnv = cache(async (): Promise<RequestEnv> => {
  await connection()
  const context = await getCloudflareContext({ async: true })
  return context.env as RequestEnv
})

/** Cookie-free fresh D1 identity read from the Better Auth session. */
export const getRequestIdentity = cache(async (): Promise<RequestIdentity | null> => {
  const env = await getRequestEnv()
  if (env.MAINTENANCE_MODE === 'true') throw new Error('MAINTENANCE')
  const requestHeaders = await headers()
  const cookies = parseCookies(requestHeaders.get('cookie'))
  if (
    !Object.hasOwn(cookies, BETTER_AUTH_COOKIE) &&
    !Object.hasOwn(cookies, `__Secure-${BETTER_AUTH_COOKIE}`)
  )
    return null
  const session = await createAuth(env).api.getSession({
    headers: new Headers(requestHeaders),
    query: { disableRefresh: true },
  })
  return session?.user ? { id: session.user.id, email: session.user.email } : null
})

/** Public pages stay available during maintenance; real session-read errors still surface. */
export async function getOptionalPublicViewer(): Promise<RequestIdentity | null> {
  const env = await getRequestEnv()
  if (env.MAINTENANCE_MODE === 'true') return null
  return getRequestIdentity()
}
