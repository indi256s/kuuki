import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import type {
  GroundCommand,
  GroundJourneyDto,
  GroundJourneyList,
  GroundMode,
  GroundMutationResult,
  GroundOperationStatus,
  GroundPlaceOption,
  GroundPlaceSnapshot,
  ManualPlaceInput,
} from '@kuuki/shared/groundTravel'
import type { RailOcrResult } from '@kuuki/shared/railTicketOcr'

type Signal = { signal?: AbortSignal }

type ListKey = 'active' | 'cancelled'
type ListMemo = {
  ownerId: string
  generation: number
  today: string
  lists: Partial<Record<ListKey, GroundJourneyList>>
}

let listMemo: ListMemo | null = null

export function rememberedLists(ownerId: string): Pick<ListMemo, 'today' | 'lists'> | null {
  return listMemo?.ownerId === ownerId && listMemo.generation === getAuthGeneration()
    ? listMemo
    : null
}

export function rememberList(
  ownerId: string,
  today: string,
  key: ListKey,
  list: GroundJourneyList,
) {
  const generation = getAuthGeneration()
  const same =
    listMemo?.ownerId === ownerId && listMemo.generation === generation && listMemo.today === today
  listMemo = {
    ownerId,
    generation,
    today,
    lists: { ...(same ? listMemo?.lists : {}), [key]: list },
  }
}

export function listJourneys(
  query: { mode?: GroundMode; cancelled?: boolean; today: string },
  options: Signal = {},
): Promise<GroundJourneyList> {
  return api.get<GroundJourneyList>(
    '/api/ground-journeys',
    { mode: query.mode, status: query.cancelled ? 'cancelled' : undefined, today: query.today },
    options,
  )
}

export function readJourney(id: string, options: Signal = {}): Promise<GroundJourneyDto> {
  return api.get<GroundJourneyDto>(
    `/api/ground-journeys/${encodeURIComponent(id)}`,
    undefined,
    options,
  )
}

export function sendCommand(
  command: GroundCommand,
  options: Signal = {},
): Promise<GroundMutationResult> {
  listMemo = null
  const path =
    command.action === 'create'
      ? '/api/ground-journeys'
      : `/api/ground-journeys/${encodeURIComponent(command.journeyId)}`
  const sent =
    command.action === 'create'
      ? api.post<GroundMutationResult>(path, command, options)
      : command.action === 'delete'
        ? api.delete<GroundMutationResult>(path, command, options)
        : api.patch<GroundMutationResult>(path, command, options)
  return sent.finally(() => {
    listMemo = null
  })
}

export function readOperation(key: string, options: Signal = {}): Promise<GroundOperationStatus> {
  return api.get<GroundOperationStatus>(
    `/api/ground-journeys/operations/${encodeURIComponent(key)}`,
    undefined,
    options,
  )
}

export function searchPlaces(
  q: string,
  locale: 'ru' | 'en',
  options: Signal = {},
): Promise<GroundPlaceOption[]> {
  return api.get<GroundPlaceOption[]>('/api/ground-places/search', { q, locale }, options)
}

export function listManualPlaces(options: Signal = {}): Promise<GroundPlaceSnapshot[]> {
  return api.get<GroundPlaceSnapshot[]>('/api/ground-places/manual', undefined, options)
}

export function createManualPlace(
  place: ManualPlaceInput,
  options: Signal = {},
): Promise<GroundPlaceSnapshot> {
  return api.post<GroundPlaceSnapshot>('/api/ground-places/manual', place, options)
}

export function readRailTicket(base64: string, options: Signal = {}): Promise<RailOcrResult> {
  return api.post<RailOcrResult>(
    '/api/ground-journeys/ocr',
    { content: base64 },
    { ...options, timeoutMs: 120_000 },
  )
}

export const exportJourneysUrl = '/api/ground-journeys/export'
