import type { BatchFence } from './importDrafts'
import type { ParseRequest } from '../import/_shared'

/** Only the authenticated API can address this binding. Source content travels in memory. */
export interface StartImportJob {
  fence: BatchFence
  source: ParseRequest
}
export interface ImportEvent {
  sequence: number
  rowIds: string[]
}
export const MAX_REPLAY_EVENTS = 128
export const MAX_SUBSCRIBERS = 8
export const MAX_EVENT_QUEUE = 16
export const MAX_OUTPUT_BYTES = 1024 * 1024

export function jobStub(
  namespace: DurableObjectNamespace,
  fence: Pick<BatchFence, 'userId' | 'batchId'>,
) {
  return namespace.get(namespace.idFromName(`${fence.userId}:${fence.batchId}`))
}

export async function abortImportJob(env: Env, userId: string, batchId: string) {
  if (!env.IMPORT_JOBS) return
  // The D1 fence has already committed. A service outage cannot undo cancellation or discard.
  await jobStub(env.IMPORT_JOBS, { userId, batchId })
    .fetch('https://import.internal/abort', { method: 'POST' })
    .catch(() => undefined)
}
