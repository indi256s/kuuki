import { api, type CallOptions } from '@kuuki/client/apiClient'
import { sendWithZone, withZone } from '../capture/flight-writes'
import type { Leg } from './bcbp'
import { importKey, type ConfirmItem } from './confirm-runner'
import type { AircraftAccept, EnrichResult } from './aircraft-review'
import type {
  ConfirmResponse,
  Draft,
  DraftPatchBody,
  Snapshot,
  UnfinishedImport,
} from './import-types'

export interface DocumentSource {
  type: 'pdf' | 'image' | 'text'
  content: string
  sourceLabel?: string | null
  requireFlownConfirmation?: true
}

export interface BoardingPassSource {
  type: 'boarding_pass'
  source: 'image' | 'pdf'
  sourceLabel?: string | null
  legs: Leg[]
  incomplete?: boolean
}

export type ImportSource = DocumentSource | BoardingPassSource

export async function submitSource(
  source: ImportSource,
  submissionOperationId: string,
  signal?: AbortSignal,
): Promise<{ batchId: string } | Snapshot> {
  return api.post(
    '/api/import/jobs',
    { ...source, submissionOperationId },
    { signal, timeoutMs: 120_000 },
  )
}

export const readBatch = (batchId: string, signal?: AbortSignal) =>
  api.get<Snapshot>(`/api/import/batches/${encodeURIComponent(batchId)}`, undefined, { signal })

export async function patchDraft(
  draftId: string,
  body: DraftPatchBody,
  options?: CallOptions,
): Promise<Draft> {
  const { draft } = await api.patch<{ draft: Draft }>(
    `/api/import/drafts/${encodeURIComponent(draftId)}`,
    body,
    options,
  )
  return draft
}

export const confirmItems = (batchId: string, items: ConfirmItem[]): Promise<ConfirmResponse> =>
  sendWithZone((zone) =>
    api.post<ConfirmResponse>(
      `/api/import/batches/${encodeURIComponent(batchId)}/confirm`,
      withZone(
        {
          items: items.map((item) => ({
            draftId: item.draftId,
            version: item.version,
            key: importKey(item.draftId, item.version),
          })),
        },
        zone,
      ),
    ),
  )

export const cancelBatch = (batchId: string) =>
  api.post<{ cancelled: boolean }>(`/api/import/batches/${encodeURIComponent(batchId)}/cancel`)

export const discardBatch = (batchId: string) =>
  api.delete<{ deleted: boolean }>(`/api/import/batches/${encodeURIComponent(batchId)}`)

export async function listUnfinished(signal?: AbortSignal): Promise<UnfinishedImport[]> {
  const queue = await api.get<{ drafts?: UnfinishedImport[] }>('/api/me/awaiting', undefined, {
    signal,
  })
  return queue.drafts ?? []
}

export interface EnrichFlight {
  id: string
  flight_number: string | null
  airline_iata: string | null
  airline_name?: string | null
  date: string
  origin: string
  destination: string
}
export const enrichAircraft = (flights: EnrichFlight[], signal?: AbortSignal) =>
  api.post<{ results: EnrichResult[]; search_suggestions_html?: string }>(
    '/api/enrich/aircraft',
    { flights },
    { signal, timeoutMs: 40_000 },
  )

export const acceptAircraftBatch = (items: Array<{ id: number; aircraft_icao: string }>) =>
  api.post<AircraftAccept>('/api/flights/aircraft-batch', { items, replaceAll: true })

export async function fetchPressedCountries(signal?: AbortSignal): Promise<Set<string> | null> {
  try {
    const passport = await api.get<{ countries: Array<{ country_code: string; status: string }> }>(
      '/api/passport/countries',
      undefined,
      { signal },
    )
    return new Set(
      passport.countries.filter((row) => row.status === 'pressed').map((row) => row.country_code),
    )
  } catch {
    return null
  }
}
