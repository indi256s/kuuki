// Shared CORS for the handlers that were previously public with `Access-Control-Allow-Origin: *`
// (import / enrich / search). `*` is illegal once credentials are sent, so reflect the configured
// Pages origin and allow credentials. On a same-origin Pages deployment (SPA + Functions on one
// host) CORS is mostly moot, but tightening from `*` is defense-in-depth + a prerequisite for
// sending the session cookie. Headers must include X-CSRF-Token for the double-submit check.

const ALLOW_HEADERS = 'Content-Type, X-CSRF-Token'
const DEFAULT_METHODS = 'GET, POST, OPTIONS'

/**
 * CORS response headers reflecting env.PAGES_ORIGIN. The request Origin is echoed only when it
 * matches the configured origin; otherwise the configured origin is advertised so a mismatch is
 * visible rather than silently `*` (which credentials forbid).
 */
export function corsHeaders(
  request: Request,
  env: Env,
  methods: string = DEFAULT_METHODS,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': methods,
    Vary: 'Origin',
  }
  const allowed = env.PAGES_ORIGIN?.trim()
  if (allowed) {
    const origin = request.headers.get('Origin')
    headers['Access-Control-Allow-Origin'] = origin === allowed ? origin : allowed
  }
  return headers
}

/** Preflight (OPTIONS) response for credentialed cross-origin requests. */
export function corsPreflight(
  request: Request,
  env: Env,
  methods: string = DEFAULT_METHODS,
): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env, methods) })
}
