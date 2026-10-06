import { GoogleGenAI } from '@google/genai'
import { extractionContents, FLIGHT_RESPONSE_SCHEMA, normalizeFlights, logValidation, validateImportSource, MAX_IMPORT_BODY_BYTES } from '../../functions/api/import/_extract'
import { DEFAULT_MODEL, PROVIDER_TIMEOUT_MS, providerFailure } from '../../functions/api/import/_provider'
import type { ExtractedFlight, ParseRequest } from '../../functions/api/import/_shared'
import { HttpError, readJson, runHandler } from '../../functions/api/_lib/http'
import { interruptBatch, MAX_DRAFTS_PER_BATCH, ownedBatch, persistDraftRows, type BatchFence, type BatchRow } from '../../functions/api/_services/importDrafts'
import { rowOf } from '../../functions/api/_services/importJob'
import { MAX_EVENT_QUEUE, MAX_REPLAY_EVENTS, MAX_SUBSCRIBERS, type ImportEvent, type StartImportJob } from '../../functions/api/_services/importRuntime'
import { FlightScanner } from './scanner'
import { parseStructuredText } from '../../functions/api/import/_text'

export interface ImportEnv { DB: D1Database; GEMINI_API_KEY: string; GEMINI_IMPORT_MODEL?: string }
type Subscriber = { fence: BatchFence; controller: ReadableStreamDefaultController<Uint8Array>; sequence: number; unsubscribe: () => void }
const encoder = new TextEncoder()
const frame = (event: ImportEvent, snapshot = false, reupload = false) =>
  `event: ${snapshot ? 'snapshot' : 'rows'}\ndata: ${JSON.stringify({ ...event, ...(snapshot ? { snapshot: true, ...(reupload ? { reupload: true } : {}) } : {}) })}\n\n`
const packet = (event: ImportEvent, snapshot = false, reupload = false) => encoder.encode(frame(event, snapshot, reupload))

/** One server-owned request per batch. Durable storage contains only the fence, never source or provider output. */
export class ImportJob {
  private fence?: BatchFence
  private controller?: AbortController
  private replay: ImportEvent[] = []
  private subscribers = new Set<Subscriber>()
  private heartbeat?: ReturnType<typeof setInterval>

  constructor(protected ctx: DurableObjectState, protected env: ImportEnv) {
    ctx.blockConcurrencyWhile(async () => {
      this.fence = await ctx.storage.get<BatchFence>('fence')
      if (this.fence) { await interruptBatch(env.DB, this.fence); await this.finish(this.fence) }
    })
  }

  async fetch(request: Request): Promise<Response> {
    return runHandler(async () => {
      const url = new URL(request.url)
      if (url.pathname === '/start' && request.method === 'POST') {
        const input = await readJson<StartImportJob>(request, { maxBytes: MAX_IMPORT_BODY_BYTES })
        if (!input?.fence || typeof input.fence.userId !== 'string' || typeof input.fence.batchId !== 'string'
          || !Number.isSafeInteger(input.fence.generation) || input.fence.generation < 1) throw new HttpError(400, 'Invalid job fence')
        const source = validateImportSource(input.source)
        const fence: BatchFence = { userId: input.fence.userId, batchId: input.fence.batchId, generation: input.fence.generation }
        const refusal = await this.ctx.blockConcurrencyWhile(async () => {
          const batch = await ownedBatch(this.env.DB, fence.userId, fence.batchId)
          if (!batch || batch.status !== 'processing' || batch.generation !== fence.generation) return new HttpError(409, 'Job no longer active')
          if (this.fence) {
            if (this.fence.userId !== fence.userId || this.fence.batchId !== fence.batchId || this.fence.generation !== fence.generation) return new HttpError(409, 'Job fence differs')
            return // A duplicate start never makes a second provider call, including after a restart.
          }
          this.fence = fence
          await this.ctx.storage.put('fence', fence)
          await this.ctx.storage.setAlarm(Date.now() + 120_000)
          this.controller = new AbortController()
          this.ctx.waitUntil(this.recognize(source, fence, this.controller).catch(() => {
            // No exception payload is logged: database errors may contain extracted values.
            console.error(JSON.stringify({ event: 'import_job_error', code: 'INTERNAL' }))
          }))
        })
        if (refusal) throw refusal
        return new Response(null, { status: 202 })
      }
      if (url.pathname === '/abort' && request.method === 'POST') {
        this.controller?.abort()
        if (this.fence) await this.finish(this.fence)
        return new Response(null, { status: 204 })
      }
      if (url.pathname === '/events' && request.method === 'GET') return this.events(request)
      return new Response(null, { status: 404 })
    })
  }

  protected async providerStream(source: ParseRequest, signal: AbortSignal): Promise<AsyncIterable<string>> {
    const stream = await new GoogleGenAI({ apiKey: this.env.GEMINI_API_KEY }).models.generateContentStream({
      model: this.env.GEMINI_IMPORT_MODEL?.trim() || DEFAULT_MODEL,
      contents: extractionContents(source),
      config: { responseMimeType: 'application/json', responseSchema: FLIGHT_RESPONSE_SCHEMA,
        httpOptions: { timeout: PROVIDER_TIMEOUT_MS }, abortSignal: signal },
    })
    return (async function* () { for await (const chunk of stream) yield chunk.text ?? '' })()
  }

  private async recognize(source: ParseRequest, fence: BatchFence, controller: AbortController) {
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; controller.abort() }, PROVIDER_TIMEOUT_MS)
    // Race every provider await against abort, including providers that ignore the signal.
    let rejectAbort: (reason: unknown) => void = () => undefined
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject })
    void aborted.catch(() => undefined)
    const onAbort = () => rejectAbort(new DOMException('Aborted', 'AbortError'))
    controller.signal.addEventListener('abort', onAbort, { once: true })
    const scanner = new FlightScanner()
    let valid = 0; let truncated = false; let finalized = false
    const emitted = new Map<number, string>()
    const rejectedOrdinals = new Set<number>() // the final pass revisits rows already refused while streaming
    let iterator: AsyncIterator<string> | undefined
    const persist = async (value: unknown, ordinal: number) => {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (emitted.has(ordinal) || rejectedOrdinals.has(ordinal)) return true
      let flight: ExtractedFlight
      try { flight = normalizeFlights({ flights: [structuredClone(value) as ExtractedFlight] }, ordinal).flights[0] } catch { rejectedOrdinals.add(ordinal); return true }
      if (valid >= MAX_DRAFTS_PER_BATCH) { truncated = true; return true }
      const event = await persistDraftRows(this.env.DB, fence, [rowOf(flight)], null, new Date(), { ordinalStart: ordinal })
      if (!event) { finalized = true; return false }
      emitted.set(ordinal, JSON.stringify(value)); valid++
      this.notify(event)
      return true
    }
    try {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const started = await persistDraftRows(this.env.DB, fence, [], null)
      if (!started) { finalized = true; return }
      this.notify(started)
      const local = source.type === 'text' ? parseStructuredText(source.content) : null
      const stream = local
        ? (async function* () { yield JSON.stringify({ flights: local.flights }) })()
        : await Promise.race([this.providerStream(source, controller.signal), aborted])
      iterator = stream[Symbol.asyncIterator]()
      for (;;) {
        const chunk = await Promise.race([iterator.next(), aborted])
        if (chunk.done) break
        for (const row of scanner.push(chunk.value)) if (!await persist(row.value, row.ordinal)) return
      }
      const validating = await persistDraftRows(this.env.DB, fence, [], null, new Date(), { stage: 'validating' })
      if (!validating) { finalized = true; return }
      this.notify(validating)
      const final = scanner.finish()
      // Source ordinals survive rejected rows; existing drafts (including member edits) are never overwritten.
      for (const [ordinal, value] of emitted) {
        if (JSON.stringify(final[ordinal]) !== value) throw new HttpError(502, 'Extraction changed at completion', 'PROVIDER_INVALID_RESPONSE')
      }
      for (let ordinal = 0; ordinal < final.length; ordinal++) if (!await persist(final[ordinal], ordinal)) return
      const rejected = rejectedOrdinals.size + (local?.rejected?.length ?? 0)
      logValidation(valid, final.length + (local?.rejected?.length ?? 0), rejected)
      const errorCode = !valid ? 'NO_FLIGHTS_FOUND' : truncated ? 'ROWS_TRUNCATED' : rejected ? 'ROWS_REJECTED' : null
      const event = await persistDraftRows(this.env.DB, fence, [], { status: !valid ? 'failed' : errorCode ? 'partial' : 'review', errorCode })
      finalized = true
      if (event) this.notify(event, true)
    } catch (error) {
      const failure = timedOut ? new HttpError(504, 'Recognition timed out', 'PROVIDER_TIMEOUT')
        : error instanceof HttpError ? error : providerFailure(error)
      const event = await persistDraftRows(this.env.DB, fence, [], { status: valid ? 'partial' : 'failed', errorCode: failure.code ?? 'PROVIDER_ERROR' })
      finalized = true
      if (event) this.notify(event, true)
    } finally {
      clearTimeout(timeout)
      controller.signal.removeEventListener('abort', onAbort)
      controller.abort()
      void iterator?.return?.().catch(() => undefined)
      if (finalized) await this.finish(fence)
    }
  }

  private async events(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') ?? ''; const batchId = url.searchParams.get('batchId') ?? ''
    const after = Number(url.searchParams.get('after') ?? 0)
    if (!Number.isSafeInteger(after) || after < 0) throw new HttpError(400, 'Invalid event sequence', 'INVALID_SEQUENCE')
    const batch = await ownedBatch(this.env.DB, userId, batchId)
    if (!batch) throw new HttpError(404, 'Import batch not found', 'IMPORT_BATCH_NOT_FOUND')
    if (this.subscribers.size >= MAX_SUBSCRIBERS) throw new HttpError(429, 'Too many event subscribers', 'IMPORT_SUBSCRIBER_LIMIT')
    const newer = this.replay.filter(event => event.sequence > after)
    const contiguous = after === batch.sequence || (newer.length > 0 && newer[0].sequence === after + 1
      && newer.every((event, index) => event.sequence === after + index + 1) && newer.at(-1)!.sequence === batch.sequence)
    let subscriber: Subscriber
    const unsubscribe = () => {
      this.subscribers.delete(subscriber)
      request.signal.removeEventListener('abort', disconnected)
      if (!this.subscribers.size) { clearInterval(this.heartbeat); this.heartbeat = undefined }
    }
    const disconnected = () => { unsubscribe(); try { subscriber.controller.close() } catch {} }
    const stream = new ReadableStream<Uint8Array>({
      start: controller => {
        subscriber = { fence: { userId, batchId, generation: batch.generation }, controller, sequence: batch.sequence, unsubscribe }
        controller.enqueue(encoder.encode(': connected\n\n'))
        if (!contiguous) controller.enqueue(packet({ sequence: batch.sequence, rowIds: [] }, true, batch.error_code === 'JOB_INTERRUPTED'))
        // One bounded replay chunk keeps the 128-event history independent of the 16-chunk live queue.
        else if (newer.length) controller.enqueue(encoder.encode(newer.map(event => frame(event)).join('')))
        if (batch.status === 'processing' && !request.signal.aborted) {
          this.subscribers.add(subscriber)
          request.signal.addEventListener('abort', disconnected, { once: true })
          this.startHeartbeat()
        } else if (request.signal.aborted) controller.close()
        else this.closeSubscriber(subscriber, batch.sequence, batch.status, batch.error_code === 'JOB_INTERRUPTED')
      },
      cancel: unsubscribe,
    }, { highWaterMark: MAX_EVENT_QUEUE })
    // A final write may have run while the initial D1 read was pending, before registration.
    if (this.subscribers.has(subscriber!)) {
      const latest = await ownedBatch(this.env.DB, userId, batchId)
      if (!latest || latest.status !== 'processing' || latest.generation !== batch.generation) {
        await this.finish({ userId, batchId, generation: batch.generation })
      } else if (this.subscribers.has(subscriber!) && latest.sequence > subscriber!.sequence) {
        subscriber!.controller.enqueue(packet({ sequence: latest.sequence, rowIds: [] }, true))
        subscriber!.sequence = latest.sequence
      }
    }
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } })
  }

  private notify(event: ImportEvent, terminal = false) {
    this.replay.push(event)
    if (this.replay.length > MAX_REPLAY_EVENTS) this.replay.shift()
    if (terminal) return // The final snapshot and status are read from D1 by finish().
    for (const subscriber of this.subscribers) {
      try {
        if ((subscriber.controller.desiredSize ?? 0) <= 2) {
          this.closeSubscriber(subscriber, event.sequence, 'processing')
        } else {
          subscriber.controller.enqueue(packet(event, event.sequence !== subscriber.sequence + 1))
          subscriber.sequence = event.sequence
        }
      } catch { subscriber.unsubscribe() }
    }
  }

  private closeSubscriber(subscriber: Subscriber, sequence: number, status: BatchRow['status'] | 'deleted', reupload = false) {
    try {
      subscriber.controller.enqueue(packet({ sequence, rowIds: [] }, true, reupload))
      subscriber.controller.enqueue(encoder.encode(`event: end\ndata: ${JSON.stringify({ sequence, status })}\n\n`))
      subscriber.controller.close()
    } finally { subscriber.unsubscribe() }
  }

  private async finish(fence: BatchFence) {
    const batch = await ownedBatch(this.env.DB, fence.userId, fence.batchId)
    for (const subscriber of this.subscribers) {
      try { this.closeSubscriber(subscriber, batch?.sequence ?? subscriber.sequence, batch?.status ?? 'deleted', batch?.error_code === 'JOB_INTERRUPTED') }
      catch { subscriber.unsubscribe() }
    }
    clearInterval(this.heartbeat); this.heartbeat = undefined
    this.controller?.abort()
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
  }

  private startHeartbeat() {
    if (this.heartbeat !== undefined) return
    // Reconcile outside termination even while the provider is idle; comment frames flush disconnects.
    this.heartbeat = setInterval(() => {
      this.ctx.waitUntil(this.checkSubscribers().catch(() => {
        console.error(JSON.stringify({ event: 'import_job_error', code: 'INTERNAL' }))
      }))
    }, 5_000)
  }

  private async checkSubscribers() {
    const fence = this.fence ?? this.subscribers.values().next().value?.fence
    if (fence) {
      const batch = await ownedBatch(this.env.DB, fence.userId, fence.batchId)
      if (!batch || batch.status !== 'processing' || batch.generation !== fence.generation) {
        await this.finish(fence)
        return
      }
    }
    for (const subscriber of this.subscribers) {
      try {
        if ((subscriber.controller.desiredSize ?? 0) <= 2) this.closeSubscriber(subscriber, subscriber.sequence, 'processing')
        else subscriber.controller.enqueue(encoder.encode(': keepalive\n\n'))
      } catch { subscriber.unsubscribe() }
    }
  }

  async alarm() {
    if (this.fence) {
      const event = await interruptBatch(this.env.DB, this.fence)
      if (event) this.notify(event, true)
      await this.finish(this.fence)
    }
    this.controller?.abort()
  }
}
