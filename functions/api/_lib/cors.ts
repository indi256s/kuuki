const ALLOW_HEADERS = 'Content-Type, X-CSRF-Token'
const DEFAULT_METHODS = 'GET, POST, OPTIONS'

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

export function corsPreflight(
  request: Request,
  env: Env,
  methods: string = DEFAULT_METHODS,
): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env, methods) })
}
