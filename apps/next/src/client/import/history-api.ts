// Thin typed calls to `/api/import/history` (ADR 0008). No retries or copy here: the controller classifies failures.
import { api } from '@kuuki/client/apiClient'
import type {
  HistoryChunkBody,
  HistoryConfirmItem,
  HistoryConfirmResult,
  HistoryCreateBody,
  HistoryPage,
  HistoryRowAnswers,
  HistoryRowView,
  HistoryRunSummary,
} from '@kuuki/shared/flightyHistory'
import { sendWithZone, withZone } from '../capture/flight-writes'
import { awaitPublication } from '../publication'

/** The regular import's passport read and bounded derived-publication wait, so stamps follow the same rule. */
export { awaitPublication }
export { fetchPressedCountries } from './import-api'

const base = (runId: string) => `/api/import/history/${encodeURIComponent(runId)}`

export const createHistoryRun = (body: HistoryCreateBody) =>
  api.post<{ run: HistoryRunSummary }>('/api/import/history', body)

/** The chunk body is the exact payload its digest was computed over; the server re-hashes it. */
export const putHistoryChunk = (runId: string, index: number, body: HistoryChunkBody) =>
  api.put<{ run: HistoryRunSummary; inserted: number }>(`${base(runId)}/chunks/${index}`, body, {
    timeoutMs: 60_000,
  })

export const readHistoryPage = (
  runId: string,
  query: { state?: string; group?: string; cursor?: number; limit?: number } = {},
  signal?: AbortSignal,
) => api.get<HistoryPage>(base(runId), query, { signal })

export const patchHistoryRow = (
  runId: string,
  rowId: string,
  body: { version: number; answers?: HistoryRowAnswers; ignore?: boolean },
) => api.patch<HistoryRowView>(`${base(runId)}/rows/${encodeURIComponent(rowId)}`, body)

export const answerHistoryGroup = (
  runId: string,
  body: { group: string; answer: string | boolean | null; revision: number },
) => api.post<{ updated: number }>(`${base(runId)}/groups`, body)

export interface HistoryConfirmResponse {
  results: HistoryConfirmResult[]
  run: HistoryRunSummary
  derived_state?: 'ready' | 'pending'
  revision?: number
}

/** The member's zone goes on every confirm, as the other flight writes do; a rejected zone is retried without it. */
export const confirmHistoryRows = (runId: string, items: HistoryConfirmItem[]) =>
  sendWithZone((zone) =>
    api.post<HistoryConfirmResponse>(`${base(runId)}/confirm`, withZone({ items }, zone), {
      timeoutMs: 60_000,
    }),
  )

export const discardHistoryRun = (runId: string) =>
  api.delete<{ deleted?: boolean; closed?: boolean }>(base(runId))

export const eraseHistorySource = (runId: string) =>
  api.delete<{ erased: true }>(`${base(runId)}/source`)

/** The owner's archive as a same-origin download; the browser keeps it, this page never stores it. */
export const historyArchiveHref = (runId: string) => `${base(runId)}?representation=archive`
