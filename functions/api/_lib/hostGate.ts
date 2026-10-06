import { configuredActivationOrigin } from './activationSender'
import { jsonError } from './http'

/** Run before assets, API dispatch, rendering, or a session/database lookup. */
export function gateActivationHost(request: Request, env: Env): Response | 'activation' | null {
  if (!env.ACTIVATION_ORIGIN) return null
  let activationOrigin: string
  try {
    activationOrigin = configuredActivationOrigin(env)
  } catch {
    return new Response('Service temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  const url = new URL(request.url)
  if (url.origin !== activationOrigin) return null
  if ((request.method === 'GET' || request.method === 'HEAD') &&
      (url.pathname === '/activate' || url.pathname === '/activate.html' || url.pathname === '/activate.js')) return 'activation'
  if (request.method === 'POST' && url.pathname === '/api/auth/activation/complete') return 'activation'
  if (request.method === 'GET' || request.method === 'HEAD') {
    // The legacy sign-in return (`/?mode=signin`) resolves to the card's password-saved notice. The empty fragment
    // keeps the browser from carrying a token fragment across the redirect.
    const signIn = url.pathname === '/' && url.searchParams.get('mode') === 'signin'
    return new Response(null, { status: 302, headers: {
      Location: new URL(signIn ? '/?notice=password-saved#' : '/#', env.PAGES_ORIGIN).toString(),
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    } })
  }
  return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } })
}

/** Enforce a maintenance hold before D1 work on private reads and all API routes. */
export function maintenanceResponse(env: Env): Response | null {
  if (env.MAINTENANCE_MODE !== 'true') return null
  return jsonError(503, 'Service temporarily unavailable', 'MAINTENANCE', { headers: { 'Retry-After': '300' } })
}
