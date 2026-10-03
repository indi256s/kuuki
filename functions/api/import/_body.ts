/** A request body error that can be returned without exposing request contents. */
export class BodyError extends Error {
  constructor(readonly status: 400 | 413, message: string) {
    super(message)
  }
}

/**
 * Count bytes from the actual stream. Content-Length can be absent or false, so
 * parsing with request.json() before this check would already buffer an oversized body.
 */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.body) throw new BodyError(400, 'Invalid JSON request')
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
        throw new BodyError(413, 'Request too large')
      }
      chunks.push(decoder.decode(value, { stream: true }))
    }
    chunks.push(decoder.decode())
    return JSON.parse(chunks.join('')) as unknown
  } catch (error) {
    if (error instanceof BodyError) throw error
    throw new BodyError(400, 'Invalid JSON request')
  } finally {
    reader.releaseLock()
  }
}

/** Validate the entire base64 payload and its actual decoded byte count. */
export function decodedBase64Size(base64: string): number {
  // Keep this regex flat: repeating quartet groups can exhaust the stack on a
  // valid 10 MiB file. Padding is allowed only in the final quartet.
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new BodyError(400, 'Invalid file encoding')
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const bytes = (base64.length / 4) * 3 - padding
  const finalValue = base64.charCodeAt(base64.length - padding - 1)
  const sextet = finalValue >= 97 ? finalValue - 71 : finalValue >= 65 ? finalValue - 65 : finalValue >= 48 ? finalValue + 4 : finalValue === 43 ? 62 : 63
  if ((padding === 2 && (sextet & 15) !== 0) || (padding === 1 && (sextet & 3) !== 0)) {
    throw new BodyError(400, 'Invalid file encoding')
  }
  return bytes
}
