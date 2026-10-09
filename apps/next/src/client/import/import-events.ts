// The only module that knows the wire format of `GET /api/import/batches/:id/events`. The server contract is
// still moving (explicit `end` event, `reupload` only on snapshot instructions), so parsing is tolerant: unknown
// event names are returned and ignored by `decideEvent`, malformed frames are dropped, and D1 (the snapshot) stays
// the only source of row data.
import type { ImportEvent } from './import-types'

export interface RawFrame {
  event: string
  data: string
}

/** Split an SSE text buffer into complete frames; `rest` is the incomplete tail to prepend to the next chunk. */
export function parseFrames(buffer: string): { frames: RawFrame[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() ?? ''
  const frames: RawFrame[] = []
  for (const part of parts) {
    let event = 'message'
    const data: string[] = []
    for (const line of part.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
    }
    if (data.length) frames.push({ event, data: data.join('\n') })
  }
  return { frames, rest }
}

export function toImportEvent(frame: RawFrame): ImportEvent | null {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(frame.data) as Record<string, unknown>
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  const sequence = payload.sequence
  if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 0) return null
  return {
    name: frame.event,
    sequence,
    rowIds: Array.isArray(payload.rowIds)
      ? payload.rowIds.filter((id): id is string => typeof id === 'string')
      : [],
    snapshot: payload.snapshot === true || frame.event === 'snapshot',
    reupload: payload.reupload === true,
    ...(typeof payload.status === 'string' ? { status: payload.status } : {}),
  }
}

/**
 * What a notification means for a client that already holds the snapshot at `known`:
 * `end` closes this connection (re-read the snapshot; reconnect only when its status is `processing`), `reload` re-fetches the snapshot (a new sequence, a
 * gap, or an explicit snapshot instruction), `ignore` is a repeat or an unknown event.
 */
export function decideEvent(known: number, event: ImportEvent): 'ignore' | 'reload' | 'end' {
  if (event.name === 'end') return 'end'
  if (event.snapshot) return 'reload'
  if (event.name !== 'rows' && event.name !== 'message') return 'ignore'
  return event.sequence > known ? 'reload' : 'ignore'
}

/**
 * One SSE connection: resolves when the server closes the stream or sends `end` (the client closes its side on `end`,
 * it does not wait for the server's EOF), rejects on a non-2xx answer or a network error.
 */
export async function connectEvents(
  batchId: string,
  after: number,
  onEvent: (event: ImportEvent) => void,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(
    `/api/import/batches/${encodeURIComponent(batchId)}/events?after=${after}`,
    {
      credentials: 'include',
      signal,
      headers: { Accept: 'text/event-stream' },
    },
  )
  if (!response.ok || !response.body)
    throw Object.assign(new Error(`Events ${response.status}`), { status: response.status })
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parsed = parseFrames(buffer)
      buffer = parsed.rest
      for (const frame of parsed.frames) {
        const event = toImportEvent(frame)
        if (!event) continue
        onEvent(event)
        if (event.name === 'end') {
          await reader.cancel().catch(() => {})
          return
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
