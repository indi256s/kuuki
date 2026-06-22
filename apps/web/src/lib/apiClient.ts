// Typed fetch client for the same-origin Pages Functions API (`/api/*`).
//
// Replaces the browser→Supabase data path. The SPA and the API share an origin, so
// requests are same-origin with `credentials: 'include'` to carry the httpOnly session
// cookie. State-changing requests echo the readable `kuuki_csrf` cookie in an
// `X-CSRF-Token` header (double-submit; see functions/api/_lib/auth.ts).
//
// On a 401 the client transparently tries ONE session refresh, then retries the original
// request once. If refresh fails it invokes the registered unauthorized handler (the auth
// store clears the user) and surfaces the error — no infinite loop. Auth endpoints are
// exempt: a 401 from /api/auth/* (bad password, expired refresh) must propagate as-is.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_COOKIE = 'kuuki_csrf'

/** Thrown for any non-2xx response. Carries the HTTP status + server error code so the
 *  existing error classifier (lib/errors/classify.ts reads `.status`/`.message`) works. */
export class ApiError extends Error {
  status: number
  code?: string
  body?: unknown
  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface RequestOptions {
  params?: QueryParams
  signal?: AbortSignal
}

// Registered by the auth store; called when a refresh attempt fails (hard logout).
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}

function buildUrl(path: string, params?: QueryParams): string {
  if (!params) return path
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const v of value) if (v !== undefined && v !== null) usp.append(key, String(v))
    } else {
      usp.append(key, String(value))
    }
  }
  const qs = usp.toString()
  return qs ? `${path}?${qs}` : path
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// De-dupe concurrent refreshes: many parallel requests can 401 at once; they should share
// a single /api/auth/refresh round-trip rather than stampede it.
let refreshInFlight: Promise<boolean> | null = null

async function attemptRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: csrfHeaders(),
        })
        return res.ok
      } catch {
        return false
      } finally {
        // Clear after the microtask settles so concurrent callers reuse this result first.
        queueMicrotask(() => {
          refreshInFlight = null
        })
      }
    })()
  }
  return refreshInFlight
}

function csrfHeaders(): Record<string, string> {
  const token = readCookie(CSRF_COOKIE)
  return token ? { 'X-CSRF-Token': token } : {}
}

async function doFetch(method: HttpMethod, url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = {}
  let payload: BodyInit | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  if (!SAFE_METHODS.has(method)) Object.assign(headers, csrfHeaders())
  return fetch(url, { method, headers, body: payload, credentials: 'include', signal })
}

async function request<T>(method: HttpMethod, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.params)
  let res = await doFetch(method, url, body, opts.signal)

  // Transparent 401 recovery — never for auth endpoints (their 401s are meaningful).
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await attemptRefresh()
    if (refreshed) {
      res = await doFetch(method, url, body, opts.signal)
    } else {
      onUnauthorized?.()
    }
  }

  const parsed = await parseBody(res)
  if (!res.ok) {
    const errObj = (parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}) as {
      error?: string
      code?: string
    }
    throw new ApiError(res.status, errObj.error || `Request failed (${res.status})`, errObj.code, parsed)
  }
  return parsed as T
}

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) => request<T>('GET', path, undefined, { params, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}
