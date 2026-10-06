// Local-only transport: identity is injected; real API handlers, D1 and DO execute in workerd.
import { ImportJob, type ImportEnv } from '../../workers/import/ImportJob'
import { importJobRequest } from '../api/import/jobs'
import { onRequestGet as events } from '../api/import/batches/[id]/events'
import { onRequestPost as cancel } from '../api/import/batches/[id]/cancel'
import { onRequestGet as snapshot, onRequestDelete as discard } from '../api/import/batches/[id]'
import { deleteUserCascade } from '../api/_lib/users'
import { createProcessingBatch, persistDraftRows } from '../api/_services/importDrafts'
import { rowOf } from '../api/_services/importJob'
import { normalizeFlights } from '../api/import/_extract'
import { configureProvider } from './import-fake-provider'

export class TestImportJob extends ImportJob {
  constructor(ctx: DurableObjectState, env: ImportEnv & { FAKE: Fetcher }) { super(ctx, env); configureProvider(env.FAKE) }
  override async fetch(request: Request) {
    if (new URL(request.url).pathname === '/__test/alarm') { await this.alarm(); return new Response(null, { status: 204 }) }
    if (new URL(request.url).pathname === '/__test/storage') return Response.json(Object.fromEntries(await this.ctx.storage.list()))
    return super.fetch(request)
  }
}
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    const data = { user: { id: request.headers.get('X-Test-User') ?? 'u1', email: 'fixture@example.test' } }
    if (url.pathname === '/api/import/jobs') return importJobRequest(request, env, data as never)
    if (url.pathname === '/__test/delete-account') { await deleteUserCascade(env.DB, data.user.id); return new Response(null, { status: 204 }) }
    if (url.pathname === '/__test/racing-duplicate') {
      // The original submission's batch is visible as `accepted`, then its job completes before this duplicate's handshake lands.
      const body = await request.clone().json() as { submissionOperationId: string; type: 'text' }
      const batchId = crypto.randomUUID()
      await createProcessingBatch(env.DB, { id: batchId, userId: data.user.id, sourceType: body.type, sourceLabel: null, operationId: body.submissionOperationId }, new Date())
      const namespace = env.IMPORT_JOBS!
      const racing = { ...namespace, idFromName: (name: string) => namespace.idFromName(name), get: (id: DurableObjectId) => {
        const stub = namespace.get(id)
        return { fetch: async (input: string, init?: RequestInit) => {
          await persistDraftRows(env.DB, { userId: data.user.id, batchId, generation: 1 }, [], { status: 'review', errorCode: null })
          return stub.fetch(input, init)
        } }
      } }
      return importJobRequest(request, { ...env, IMPORT_JOBS: racing as unknown as DurableObjectNamespace }, data as never)
    }
    if (url.pathname === '/__test/late-write') {
      const input = await request.json() as { batchId: string; flight: never }
      const event = await persistDraftRows(env.DB, { userId: data.user.id, batchId: input.batchId, generation: 1 },
        [rowOf(normalizeFlights({ flights: [input.flight] }).flights[0])], null, new Date(), { ordinalStart: 99 })
      return Response.json(event)
    }
    const match = url.pathname.match(/^\/api\/import\/batches\/([^/]+)(?:\/(events|cancel))?$/)
    if (!match) return new Response(null, { status: 404 })
    const context = { request, env, data, params: { id: match[1] } } as never
    if (match[2] === 'events') return events(context)
    if (match[2] === 'cancel' && (env as Env & { FAIL_ABORT?: boolean }).FAIL_ABORT) {
      const unavailable = { idFromName: (name: string) => name, get: () => ({ fetch: async () => { throw new Error('Abort transport unavailable') } }) }
      return cancel({ request, env: { ...env, IMPORT_JOBS: unavailable }, data, params: { id: match[1] } } as never)
    }
    if (match[2] === 'cancel') return cancel(context)
    return request.method === 'DELETE' ? discard(context) : snapshot(context)
  },
}
