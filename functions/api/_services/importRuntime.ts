import type { BatchFence } from './importDrafts'
import type { ParseRequest } from '../import/_shared'

export interface StartImportJob {
  fence: BatchFence
  source: ParseRequest
  requireFlownConfirmation?: boolean
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
  await jobStub(env.IMPORT_JOBS, { userId, batchId })
    .fetch('https://import.internal/abort', { method: 'POST' })
    .catch(() => undefined)
}
