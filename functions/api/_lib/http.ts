// JSON request/response helpers for the API handlers.

/** Fixed fields an endpoint adds to every error response (e.g. CORS headers, an empty result list). */
export interface ErrorShape {
  headers?: Record<string, string>
  fields?: Record<string, unknown>
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers ?? {}) },
  })
}

export function jsonError(status: number, message: string, code?: string, shape: ErrorShape = {}): Response {
  return json({ error: message, ...(code ? { code } : {}), ...shape.fields }, { status, headers: shape.headers })
}

// Covers the largest ordinary body: a 10,000-id bulk delete is ~110 KB. Bigger callers pass maxBytes.
const DEFAULT_MAX_JSON_BYTES = 128 * 1024

/**
 * Parse a JSON request body, returning null on empty/invalid JSON instead of throwing.
 * Bytes are counted from the stream itself, since Content-Length can be absent or false;
 * a body over maxBytes throws a 413 HttpError.
 */
export async function readJson<T>(request: Request, { maxBytes = DEFAULT_MAX_JSON_BYTES }: { maxBytes?: number } = {}): Promise<T | null> {
  const tooLarge = () => new HttpError(413, 'Request too large', 'PAYLOAD_TOO_LARGE')
  if (Number(request.headers.get('Content-Length')) > maxBytes) throw tooLarge()
  if (!request.body) return null
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
  const chunks: string[] = []
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw tooLarge()
      }
      chunks.push(decoder.decode(value, { stream: true }))
    }
    chunks.push(decoder.decode())
    return JSON.parse(chunks.join('')) as T
  } catch (err) {
    if (err instanceof HttpError) throw err
    return null
  } finally {
    reader.releaseLock()
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
export async function runHandler(fn: () => Promise<Response>, shape: ErrorShape = {}): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message, err.code, shape)
    console.error(JSON.stringify({ event: 'handler_error', error: String(err) }))
    return jsonError(500, 'Internal server error', 'INTERNAL', shape)
  }
}
