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
  identityToken?: IdentityOperationToken
  timeoutMs?: number
  headers?: Record<string, string>
  csrfToken?: string | null
}

export type IdentityOperationToken = symbol
let identityOperation: IdentityOperationToken | null = null
const inFlightRequests = new Set<Promise<unknown>>()
const IDENTITY_WAIT_MS = 35_000
const REQUEST_TIMEOUT_MS = 30_000
const LOCK_NAME = 'kuuki-session-identity'

function timeoutError(): Error {
  return new Error('The account action timed out waiting for other requests. Please try again.')
}

async function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(timeoutError()), milliseconds) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function holdExclusiveLock(released: Promise<void>, signal: AbortSignal): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.locks) return
  let acquired!: () => void
  const acquiredPromise = new Promise<void>(resolve => { acquired = resolve })
  const lockTask = navigator.locks.request(LOCK_NAME, { mode: 'exclusive', signal }, async () => {
    acquired()
    await released
  })
  // The lock task can reject after acquisition when the page is torn down.
  void lockTask.catch(() => {})
  await Promise.race([acquiredPromise, lockTask.then(() => { throw new Error('Could not acquire the account lock') })])
}

/** Reserve the cookie identity before waiting for older responses and their Set-Cookie headers. */
export function beginIdentityOperation() {
  if (identityOperation) throw new Error('An account action is already in progress')
  const token = Symbol('identity operation')
  identityOperation = token
  let unlock!: () => void
  const released = new Promise<void>(resolve => { unlock = resolve })
  const controller = new AbortController()
  const ready = (async () => {
    try {
      await withDeadline(Promise.allSettled([...inFlightRequests]), IDENTITY_WAIT_MS)
      await withDeadline(holdExclusiveLock(released, controller.signal), IDENTITY_WAIT_MS)
      advanceAuthGeneration()
    } catch (error) {
      controller.abort()
      unlock()
      if (identityOperation === token) identityOperation = null
      throw error
    }
  })()
  return {
    token,
    ready,
    release: () => {
      unlock()
      if (identityOperation === token) identityOperation = null
    },
  }
}

// Registered by the auth store; called when a refresh attempt fails (hard logout).
let onUnauthorized: (() => void) | null = null
let authGeneration = 0
export function getAuthGeneration(): number { return authGeneration }
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}
export function advanceAuthGeneration(): void {
  authGeneration += 1
  refreshInFlight?.controller.abort()
  refreshInFlight = null
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
type RefreshResult = 'refreshed' | 'unauthorized' | 'failed'
let refreshInFlight: { generation: number; promise: Promise<RefreshResult>; controller: AbortController } | null = null

async function attemptRefresh(): Promise<RefreshResult> {
  if (!refreshInFlight || refreshInFlight.generation !== authGeneration) {
    const generation = authGeneration
    const controller = new AbortController()
    const promise = (async () => {
      const timeout = setTimeout(() => controller.abort(new DOMException('Refresh timed out', 'TimeoutError')), REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: csrfHeaders(),
          signal: controller.signal,
        })
        if (res.ok) return 'refreshed'
        return res.status === 401 || res.status === 403 ? 'unauthorized' : 'failed'
      } catch {
        return 'failed'
      } finally {
        clearTimeout(timeout)
      }
    })()
    refreshInFlight = { generation, promise, controller }
    // The previous identity's refresh must not clear a newer identity's request.
    void promise.then(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null
    })
  }
  return refreshInFlight.promise
}

function assertCurrentIdentity(generation: number): void {
  if (generation !== authGeneration) throw new DOMException('Session changed', 'AbortError')
}

function csrfHeaders(token = readCookie(CSRF_COOKIE)): Record<string, string> {
  return token ? { 'X-CSRF-Token': token } : {}
}

async function doFetch(method: HttpMethod, url: string, body: unknown, signal?: AbortSignal, customHeaders?: Record<string, string>, csrfToken?: string | null): Promise<Response> {
  const headers: Record<string, string> = { ...customHeaders }
  let payload: BodyInit | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  if (!SAFE_METHODS.has(method)) Object.assign(headers, csrfHeaders(csrfToken))
  return fetch(url, { method, headers, body: payload, credentials: 'include', signal })
}

async function performRequest<T>(method: HttpMethod, path: string, body: unknown, opts: RequestOptions): Promise<T> {
  const requestGeneration = authGeneration
  const url = buildUrl(path, opts.params)
  let res = await doFetch(method, url, body, opts.signal, opts.headers, opts.csrfToken)
  assertCurrentIdentity(requestGeneration)

  // Transparent 401 recovery — never for auth endpoints (their 401s are meaningful).
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await attemptRefresh()
    assertCurrentIdentity(requestGeneration)
    if (refreshed === 'refreshed') {
      res = await doFetch(method, url, body, opts.signal, opts.headers, opts.csrfToken)
      assertCurrentIdentity(requestGeneration)
      if (res.status === 401 && requestGeneration === authGeneration) onUnauthorized?.()
    } else if (refreshed === 'unauthorized') {
      if (requestGeneration === authGeneration) onUnauthorized?.()
    }
  }

  const parsed = await parseBody(res)
  assertCurrentIdentity(requestGeneration)
  if (!res.ok) {
    const errObj = (parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}) as {
      error?: string
      message?: string
      code?: string
    }
    throw new ApiError(res.status, errObj.error || errObj.message || `Request failed (${res.status})`, errObj.code, parsed)
  }
  return parsed as T
}

function request<T>(method: HttpMethod, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  if (identityOperation && opts.identityToken !== identityOperation) {
    return Promise.reject(new DOMException('Account action in progress', 'AbortError'))
  }
  const requestGeneration = authGeneration
  const csrfToken = readCookie(CSRF_COOKIE)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), opts.timeoutMs ?? REQUEST_TIMEOUT_MS)
  const abort = () => controller.abort(opts.signal?.reason)
  if (opts.signal?.aborted) abort()
  else opts.signal?.addEventListener('abort', abort, { once: true })
  const run = () => {
    // A peer may release its lock before this tab receives the identity broadcast.
    assertCurrentIdentity(requestGeneration)
    if (readCookie(CSRF_COOKIE) !== csrfToken) throw new DOMException('Session changed', 'AbortError')
    return performRequest<T>(method, path, body, { ...opts, csrfToken, signal: controller.signal })
  }
  const pending = (async () => {
    try {
      if ((opts.identityToken && opts.identityToken === identityOperation) || typeof navigator === 'undefined' || !navigator.locks) return await run()
      return await navigator.locks.request(LOCK_NAME, { mode: 'shared', signal: controller.signal }, run)
    } finally {
      clearTimeout(timeout)
      opts.signal?.removeEventListener('abort', abort)
    }
  })()
  inFlightRequests.add(pending)
  void pending.then(
    () => inFlightRequests.delete(pending),
    () => inFlightRequests.delete(pending),
  )
  return pending
}

export type CallOptions = Pick<RequestOptions, 'signal' | 'identityToken' | 'timeoutMs' | 'headers'>

export const api = {
  get: <T>(path: string, params?: QueryParams, options?: CallOptions) => request<T>('GET', path, undefined, { ...options, params }),
  post: <T>(path: string, body?: unknown, options?: CallOptions) => request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: CallOptions) => request<T>('PATCH', path, body, options),
  put: <T>(path: string, body?: unknown, options?: CallOptions) => request<T>('PUT', path, body, options),
  delete: <T>(path: string, body?: unknown, options?: CallOptions) => request<T>('DELETE', path, body, options),
}
