import { FLIGHT_BULK_CREATE_MAX } from '@kuuki/shared'
import { classifyRequestFailure, classifyRowFailure, type RowFailureKind } from './import-errors'
import type { ConfirmResponse } from './import-types'

export interface ConfirmItem {
  draftId: string
  version: number
}

export type RowOutcome =
  | { status: 'saved'; flightId: number; replayed: boolean; aircraftIcao: string | null }
  | {
      status: 'failed'
      code: string | null
      httpStatus: number | null
      failure: RowFailureKind
      retryable: boolean
    }
  | { status: 'uncertain' }
  | { status: 'unsent' }

export interface ConfirmOutcome {
  rows: Map<string, RowOutcome>
  batch: ConfirmResponse['batch'] | null
  acks: Array<Pick<ConfirmResponse, 'derived_state' | 'revision'>>
  uncertain: boolean
}

export const importKey = (draftId: string, version: number) => `import:${draftId}:${version}`

export function retryableIds(outcome: ConfirmOutcome): string[] {
  return [...outcome.rows]
    .filter(
      ([, row]) =>
        row.status === 'uncertain' ||
        row.status === 'unsent' ||
        (row.status === 'failed' && row.retryable),
    )
    .map(([id]) => id)
}

function failedRow(code: string | null, httpStatus: number | null): RowOutcome {
  const { kind, retryable } = classifyRowFailure({
    code: code ?? undefined,
    http_status: httpStatus ?? undefined,
  })
  return { status: 'failed', code, httpStatus, failure: kind, retryable }
}

interface Run {
  batchId: string
  items: ConfirmItem[]
  send: (batchId: string, items: ConfirmItem[]) => Promise<ConfirmResponse>
  signal?: AbortSignal
}

export async function runConfirm({ batchId, items, send, signal }: Run): Promise<ConfirmOutcome> {
  const outcome: ConfirmOutcome = { rows: new Map(), batch: null, acks: [], uncertain: false }
  for (const item of items) outcome.rows.set(item.draftId, { status: 'unsent' })
  for (let start = 0; start < items.length; start += FLIGHT_BULK_CREATE_MAX) {
    if (signal?.aborted) break
    const chunk = items.slice(start, start + FLIGHT_BULK_CREATE_MAX)
    let response: ConfirmResponse
    try {
      response = await send(batchId, chunk)
    } catch (error) {
      const failure = classifyRequestFailure(error)
      const maybeCommitted = failure.status === null || failure.status >= 500
      for (const item of chunk) {
        outcome.rows.set(
          item.draftId,
          maybeCommitted ? { status: 'uncertain' } : failedRow(failure.code, failure.status),
        )
      }
      if (maybeCommitted) outcome.uncertain = true
      break
    }
    outcome.batch = response.batch
    outcome.acks.push({ derived_state: response.derived_state, revision: response.revision })
    const answered = new Set<string>()
    for (const result of response.results) {
      answered.add(result.draftId)
      if (result.status === 'error') {
        outcome.rows.set(result.draftId, failedRow(result.code, result.http_status))
      } else {
        outcome.rows.set(result.draftId, {
          status: 'saved',
          flightId: result.flight.id,
          replayed: result.status === 'replayed',
          aircraftIcao: result.flight.aircraft_icao,
        })
      }
    }
    for (const item of chunk)
      if (!answered.has(item.draftId)) {
        outcome.rows.set(item.draftId, { status: 'uncertain' })
        outcome.uncertain = true
      }
  }
  return outcome
}
