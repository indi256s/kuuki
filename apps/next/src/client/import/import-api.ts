// Thin typed calls to the import endpoints. No retries or copy here: callers classify failures (import-errors.ts).
import { api, type CallOptions } from '../../../../web/src/lib/apiClient'
import { sendWithZone, withZone } from '../capture/flight-writes'
import { importKey, type ConfirmItem } from './confirm-runner'
import type { ConfirmResponse, Draft, DraftPatchBody, Snapshot, UnfinishedImport } from './import-types'

export interface ImportSource { type: 'pdf' | 'image' | 'text'; content: string; sourceLabel?: string | null }

/** Source bytes and pasted text live only in this request body: nothing here touches browser storage. */
export async function submitSource(source: ImportSource, submissionOperationId: string, signal?: AbortSignal): Promise<{ batchId: string } | Snapshot> {
  return api.post('/api/import/jobs', { ...source, submissionOperationId }, { signal, timeoutMs: 90_000 })
}

export const readBatch = (batchId: string, signal?: AbortSignal) =>
  api.get<Snapshot>(`/api/import/batches/${encodeURIComponent(batchId)}`, undefined, { signal })

export async function patchDraft(draftId: string, body: DraftPatchBody, options?: CallOptions): Promise<Draft> {
  const { draft } = await api.patch<{ draft: Draft }>(`/api/import/drafts/${encodeURIComponent(draftId)}`, body, options)
  return draft
}

/** The member's IANA zone goes on every confirm, as the flight writes do; a rejected zone is retried once without it. */
export const confirmItems = (batchId: string, items: ConfirmItem[]): Promise<ConfirmResponse> =>
  sendWithZone(zone => api.post<ConfirmResponse>(`/api/import/batches/${encodeURIComponent(batchId)}/confirm`,
    withZone({ items: items.map(item => ({ draftId: item.draftId, version: item.version, key: importKey(item.draftId, item.version) })) }, zone)))

export const cancelBatch = (batchId: string) =>
  api.post<{ cancelled: boolean }>(`/api/import/batches/${encodeURIComponent(batchId)}/cancel`)

export const discardBatch = (batchId: string) =>
  api.delete<{ deleted: boolean }>(`/api/import/batches/${encodeURIComponent(batchId)}`)

/** Open imports (processing or with rows still in review) from the shared queue read; no import-specific list exists. */
export async function listUnfinished(signal?: AbortSignal): Promise<UnfinishedImport[]> {
  const queue = await api.get<{ drafts?: UnfinishedImport[] }>('/api/me/awaiting', undefined, { signal })
  return queue.drafts ?? []
}
