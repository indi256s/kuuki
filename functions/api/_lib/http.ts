// JSON request/response helpers for the API handlers.

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers ?? {}) },
  })
}

export function jsonError(status: number, message: string, code?: string): Response {
  return json({ error: message, ...(code ? { code } : {}) }, { status })
}

/** Parse a JSON request body, returning null on empty/invalid JSON instead of throwing. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

/** A thrown HttpError short-circuits a handler to a JSON error response (see runHandler). */
export class HttpError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Wrap a handler so thrown HttpErrors become JSON responses and unexpected throws become 500s. */
export async function runHandler(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message, err.code)
    console.error(JSON.stringify({ event: 'handler_error', error: String(err) }))
    return jsonError(500, 'Internal server error', 'INTERNAL')
  }
}
