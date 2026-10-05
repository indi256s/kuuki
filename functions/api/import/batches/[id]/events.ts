import { requireUser, type RequestData } from '../../../_lib/auth'
import { HttpError, runHandler } from '../../../_lib/http'
import { batchExpired, batchNotFound, isBatchExpired, ownedBatch } from '../../../_services/importDrafts'
import { jobStub } from '../../../_services/importRuntime'

export const onRequestGet: PagesFunction<Env, string, RequestData> = context => runHandler(async () => {
  const user = requireUser(context.data); const batchId = String(context.params.id)
  const batch = await ownedBatch(context.env.DB, user.id, batchId)
  if (!batch) throw batchNotFound()
  if (isBatchExpired(batch, new Date())) throw batchExpired()
  const raw = new URL(context.request.url).searchParams.get('after') ?? '0'
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new HttpError(400, 'Invalid event sequence', 'INVALID_SEQUENCE')
  if (context.env.IMPORT_JOBS) {
    const query = new URLSearchParams({ userId: user.id, batchId, after: raw })
    return jobStub(context.env.IMPORT_JOBS, { userId: user.id, batchId }).fetch(`https://import.internal/events?${query}`, { signal: context.request.signal })
  }
  return new Response(`event: snapshot\ndata: ${JSON.stringify({ sequence: batch.sequence, rowIds: [], snapshot: true, ...(batch.error_code === 'JOB_INTERRUPTED' ? { reupload: true } : {}) })}\n\nevent: end\ndata: ${JSON.stringify({ sequence: batch.sequence, status: batch.status })}\n\n`, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
  })
})
