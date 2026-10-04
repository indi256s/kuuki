import nextWorker from './.open-next/worker.js'
import pagesWorker from '../../.wrangler/functions-build/index.js'
import { gateRequest } from '../../functions/api/_lib/workerBoundary'
import { apiRoutes } from './api-routes.generated'
import { requestPasswordReset } from '../../functions/api/auth/password-reset/request'
import { completePasswordReset } from '../../functions/api/auth/password-reset/complete'
import { captureHandler } from './api-capture'

type RuntimeEnv = Env & { ASSETS: Fetcher }

const authRoute = '/api/auth/activation/complete'
const legacyDocuments = new Set([
  '/legacy/', '/legacy/flights', '/legacy/import', '/legacy/passport',
  '/legacy/settings', '/legacy/journey', '/legacy/dashboard',
  '/legacy/onboarding', '/legacy/leaderboard', '/legacy/landing',
])
const legacyMime: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

function jsonError(status: number, code: string, allow?: string): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  if (allow) headers.set('Allow', allow)
  return new Response(JSON.stringify({ error: status === 405 ? 'Method not allowed' : 'Not found', code }), { status, headers })
}

function apiMethods(pathname: string): string[] | null {
  const exact = apiRoutes.find(({ route }) => route === pathname)
  if (exact) return [...exact.methods]
  for (const { route, methods } of apiRoutes) {
    if (!route.includes(':')) continue
    const pattern = new RegExp('^' + route.split('/').map(segment => segment.startsWith(':') ? '[^/]+' : segment).join('/') + '$')
    if (pattern.test(pathname)) return [...methods]
  }
  return null
}

async function api(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
  const pathname = new URL(request.url).pathname
  const methods = apiMethods(pathname)
  if (!methods) return jsonError(404, 'NOT_FOUND')
  if (!methods.includes(request.method)) return jsonError(405, 'METHOD_NOT_ALLOWED', methods.join(', '))
  const capture = captureHandler(request, env)
  if (capture) return capture()
  // These pre-auth routes own their cookies and use real Request/Response adapters.
  if (pathname === '/api/auth/password-reset/request' || pathname === '/api/auth/password-reset/complete') {
    const started = Date.now()
    const response = pathname.endsWith('/request')
      ? await requestPasswordReset(request, env, task => ctx.waitUntil(task))
      : await completePasswordReset(request, env)
    const headers = new Headers(response.headers)
    const requestId = crypto.randomUUID()
    headers.set('X-Request-Id', requestId)
    headers.set('Server-Timing', `api;dur=${Date.now() - started}`)
    console.log(JSON.stringify({ event: 'api_request', requestId, method: request.method, status: response.status, durationMs: Date.now() - started }))
    return new Response(response.body, { status: response.status, headers })
  }
  // Pages' generated handler may call ASSETS on a miss. It must never return HTML
  // for an API URL, even if its internal route table changes.
  const apiEnv = {
    ...env,
    ASSETS: { fetch: async () => jsonError(404, 'NOT_FOUND') },
  }
  return pagesWorker.fetch(request, apiEnv, ctx)
}

async function asset(request: Request, env: RuntimeEnv): Promise<Response> {
  const response = await env.ASSETS.fetch(request)
  return response
}

async function activationAsset(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url)
  const script = url.pathname === '/activate.js'
  const assetUrl = new URL(script ? '/activate.js' : '/activate', url)
  const response = await asset(new Request(assetUrl, request), env)
  if (response.status !== 304 && !response.ok) return new Response('Activation page unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  const headers = new Headers(response.headers)
  headers.set('Content-Type', script ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  if (!script) headers.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  return new Response(response.body, { status: response.status, headers })
}

async function legacy(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname
  if (pathname === '/legacy') return Response.redirect(new URL('/legacy/', url), 308)
  if (legacyDocuments.has(pathname) || /^\/legacy\/fly\/[a-zA-Z0-9_-]+$/.test(pathname)) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
    const entry = new URL('/legacy/', url)
    const response = await asset(new Request(entry, request), env)
    if (response.status !== 304 && !response.ok) return new Response('Legacy entry unavailable', { status: 503 })
    const headers = new Headers(response.headers)
    headers.set('Content-Type', 'text/html; charset=utf-8')
    headers.set('Cache-Control', 'no-store')
    return new Response(response.body, { status: response.status, headers })
  }
  const ext = /\.[^/.]+$/.exec(pathname)?.[0]
  const mime = ext && legacyMime[ext]
  if (!mime || (request.method !== 'GET' && request.method !== 'HEAD')) return new Response('Not found', { status: 404 })
  const response = await asset(request, env)
  if ((response.status !== 304 && !response.ok) || response.headers.get('Content-Type')?.startsWith('text/html')) return new Response('Not found', { status: 404 })
  const headers = new Headers(response.headers)
  headers.set('Content-Type', mime)
  return new Response(response.body, { status: response.status, headers })
}

export default {
  async fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
    const gate = gateRequest(request, env)
    if (gate) return gate
    const url = new URL(request.url)
    if (env.ACTIVATION_ORIGIN && url.origin === new URL(env.ACTIVATION_ORIGIN).origin) {
      if (url.pathname === authRoute) return api(request, env, ctx)
      return activationAsset(request, env)
    }
    if ((request.method === 'GET' || request.method === 'HEAD') &&
      (url.pathname === '/activate' || url.pathname === '/activate.html' || url.pathname === '/activate.js')) return activationAsset(request, env)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return api(request, env, ctx)
    if (url.pathname === '/legacy' || url.pathname.startsWith('/legacy/')) return legacy(request, env)
    if (url.pathname === '/sw.js' || url.pathname === '/registerSW.js') {
      const response = await asset(request, env)
      if (response.status !== 304 && !response.ok) return new Response('Not found', { status: 404 })
      const headers = new Headers(response.headers)
      headers.set('Content-Type', 'text/javascript; charset=utf-8')
      headers.set('Cache-Control', 'no-store')
      return new Response(response.body, { status: response.status, headers })
    }
    if (env.MAINTENANCE_MODE === 'true' && ['/overview', '/journal', '/passport', '/settings', '/onboarding', '/me', '/add', '/import'].some(path => url.pathname === path || url.pathname.startsWith(path + '/'))) {
      return new Response('Service temporarily unavailable', { status: 503, headers: {
        'Retry-After': '300', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8',
      } })
    }
    const response = await nextWorker.fetch(request, env, ctx)
    const headers = new Headers(response.headers)
    headers.set('X-Frame-Options', 'DENY')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', url.pathname === '/reset-password' ? 'no-referrer' : 'strict-origin-when-cross-origin')
    if (!url.pathname.startsWith('/_next/static/')) headers.set('Cache-Control', 'no-store')
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
} satisfies ExportedHandler<RuntimeEnv>
