import nextWorker from './.open-next/worker.js'
import pagesWorker from '../../.wrangler/functions-build/index.js'
import { gateRequest } from '../../functions/api/_lib/workerBoundary'
import { activationAsset } from './activation-asset'
import { jsonError } from '../../functions/api/_lib/http'
import { apiRoutes } from './api-routes.generated'
import { captureHandler } from './api-capture'

type RuntimeEnv = Env & { ASSETS: Fetcher }

const authRoute = '/api/auth/activation/complete'
const cachedMapAssets = new Set([
  '/maps/countries-110m-2.0.2.geojson',
  '/maps/country-centers-110m-2.0.2.json',
  '/maps/world-outline-110m-2.0.2.svg',
  '/maps/maplibre-6.12.0/maplibre-gl.css',
  '/maps/maplibre-6.12.0/maplibre-gl-shared.mjs',
  '/maps/maplibre-6.12.0/maplibre-gl-worker.mjs',
])
const exactRoutes = new Map(apiRoutes.map(({ route, methods }): [string, readonly string[]] => [route, methods]))
const dynamicRoutes = apiRoutes.filter(({ route }) => route.includes(':')).map(({ route, methods }) => ({
  pattern: new RegExp('^' + route.split('/').map(segment => segment.startsWith(':') ? '[^/]+' : segment).join('/') + '$'),
  methods,
}))

function apiMethods(pathname: string): readonly string[] | null {
  return exactRoutes.get(pathname) ?? dynamicRoutes.find(({ pattern }) => pattern.test(pathname))?.methods ?? null
}

async function api(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
  const pathname = new URL(request.url).pathname
  const methods = apiMethods(pathname)
  if (!methods) return jsonError(404, 'Not found', 'NOT_FOUND')
  if (!methods.includes(request.method)) return jsonError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED', { headers: { Allow: methods.join(', ') } })
  const capture = captureHandler(request, env, ctx)
  if (capture) return capture()
  // Pages' generated handler may call ASSETS on a miss. It must never return HTML
  // for an API URL, even if its internal route table changes.
  const apiEnv = {
    ...env,
    ASSETS: { fetch: async () => jsonError(404, 'Not found', 'NOT_FOUND') },
  }
  return pagesWorker.fetch(request, apiEnv, ctx)
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
    if (url.pathname === '/sw.js' || url.pathname === '/registerSW.js') {
      const response = await env.ASSETS.fetch(request)
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
    const contentType = headers.get('Content-Type')
    if ((request.method === 'GET' || request.method === 'HEAD') && cachedMapAssets.has(url.pathname) &&
      (response.status === 200 || response.status === 304) && !headers.has('Set-Cookie') &&
      (response.status === 304 || (contentType && !contentType.includes('text/html')))) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    } else if (!url.pathname.startsWith('/_next/static/') || response.status >= 400) {
      headers.set('Cache-Control', 'no-store')
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
} satisfies ExportedHandler<RuntimeEnv>
