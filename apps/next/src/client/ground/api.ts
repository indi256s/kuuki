// Same-origin calls for ground journeys and places. Shared by the list, the forms and the OCR panel; each
// write carries its own operation key so a retry replays instead of writing twice.

import { api } from '@kuuki/client/apiClient'
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
import type { RailOcrResult } from '../../../../../functions/api/_services/railTicketOcr'

type Signal = { signal?: AbortSignal }

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

/** Sends one command; the route and method follow its action. */
export function sendCommand(
  command: GroundCommand,
  options: Signal = {},
): Promise<GroundMutationResult> {
  if (command.action === 'create')
    return api.post<GroundMutationResult>('/api/ground-journeys', command, options)
  const path = `/api/ground-journeys/${encodeURIComponent(command.journeyId)}`
  return command.action === 'delete'
    ? api.delete<GroundMutationResult>(path, command, options)
    : api.patch<GroundMutationResult>(path, command, options)
}

/** Resolves an unconfirmed write: saved, deleted, or unknown (never written or expired). */
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

/**
 * One file per call; the server detects the type from its bytes and stores nothing. The provider may take up to
 * 90 s, so the client waits longer than its 30 s default, as flight import does.
 */
export function readRailTicket(base64: string, options: Signal = {}): Promise<RailOcrResult> {
  return api.post<RailOcrResult>(
    '/api/ground-journeys/ocr',
    { content: base64 },
    { ...options, timeoutMs: 120_000 },
  )
}

export const exportJourneysUrl = '/api/ground-journeys/export'
