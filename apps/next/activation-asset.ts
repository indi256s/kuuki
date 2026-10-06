import { configuredRecoveryOrigin } from '../../functions/api/_lib/passwordRecovery'

export async function activationAsset(request: Request, env: Env & { ASSETS: Fetcher }): Promise<Response> {
  const url = new URL(request.url)
  const script = url.pathname === '/activate.js'
  const assetUrl = new URL(script ? '/activate.js' : '/activate', url)
  const response = await env.ASSETS.fetch(new Request(assetUrl, request))
  if (response.status !== 304 && !response.ok) return new Response('Activation page unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  const headers = new Headers(response.headers)
  headers.set('Content-Type', script ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  if (!script) headers.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  const asset = new Response(response.body, { status: response.status, headers })
  if (script || response.status === 304) return asset
  let primaryOrigin: string
  try { primaryOrigin = configuredRecoveryOrigin(env) }
  catch { return new Response('Activation page unavailable', { status: 503, headers }) }
  // The restricted activation host cannot serve sign-in or resend. Only these explicit static links leave it.
  return new HTMLRewriter().on('a[data-primary-path]', {
    element(element) {
      const path = element.getAttribute('data-primary-path')
      if (path === '/' || path === '/signin' || path === '/activation-request') {
        element.setAttribute('href', new URL(path, primaryOrigin).href)
      }
    },
  }).transform(asset)
}
