// Unfinished ground-journey input on this device. Keys sit under the capture prefix so the identity reset
// (clearCapturePreferences) removes them, and carry the owner id and a schema version, so another account
// never reads them and an older shape is discarded instead of half-restored.

import {
  isUuid,
  parsePlaceSnapshot,
  type GroundCommand,
  type GroundMode,
} from '@kuuki/shared/groundTravel'
import type { FormState, LegDraft, PointDraft } from './model'

export const DRAFT_VERSION = 1

/** `new-rail`, `new-road`, or `edit-<journey id>`. */
export type DraftKind = `new-${GroundMode}` | `edit-${string}`

export interface Draft {
  v: typeof DRAFT_VERSION
  /** The id a new journey is created under; kept so a retry after a reload never creates a second one. */
  journeyId: string
  /** The version the edit started from; the server's 409 decides whether it is still current. */
  baseVersion: number | null
  state: FormState
  /** A save whose result is not known yet, frozen with its operation key. */
  pending: GroundCommand | null
}

export type DraftRead = { status: 'none' } | { status: 'ok'; draft: Draft } | { status: 'invalid' }

export const draftStorageKey = (ownerId: string, kind: DraftKind): string =>
  `kuuki:capture:${ownerId}:ground:v${DRAFT_VERSION}:${kind}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value : '')

function place(value: unknown) {
  return value === null || value === undefined ? null : parsePlaceSnapshot(value)
}

function leg(value: unknown): LegDraft | null {
  if (!isRecord(value) || !isUuid(value.id)) return null
  return {
    id: value.id,
    from: place(value.from),
    to: place(value.to),
    fromStation: text(value.fromStation),
    toStation: text(value.toStation),
    trainNumber: text(value.trainNumber),
    operator: text(value.operator),
    departureDate: text(value.departureDate),
    departureTime: text(value.departureTime),
    arrivalDate: text(value.arrivalDate),
    arrivalTime: text(value.arrivalTime),
    durationManual: text(value.durationManual),
  }
}

function point(value: unknown): PointDraft | null {
  if (!isRecord(value) || !isUuid(value.id)) return null
  return {
    id: value.id,
    place: place(value.place),
    arrivalDate: text(value.arrivalDate),
    departureDate: text(value.departureDate),
    nights: text(value.nights),
    note: text(value.note),
  }
}

function rows<T>(value: unknown, parse: (row: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null
  const parsed = value.map(parse)
  return parsed.every((row) => row !== null) ? (parsed as T[]) : null
}

/** Rebuilds a draft from storage; anything unreadable, foreign or of another mode is rejected whole. */
export function parseDraft(raw: unknown, mode: GroundMode): Draft | null {
  if (!isRecord(raw) || raw.v !== DRAFT_VERSION || !isUuid(raw.journeyId)) return null
  const state = raw.state
  if (!isRecord(state) || state.mode !== mode) return null
  if (state.status !== 'planned' && state.status !== 'completed') return null
  const legs = rows(state.legs, leg)
  const points = rows(state.points, point)
  if (!legs || !points) return null
  if (mode === 'rail' ? points.length > 0 : legs.length > 0) return null
  const countries = Array.isArray(state.countries)
    ? state.countries.filter(
        (code): code is string => typeof code === 'string' && /^[A-Z]{2}$/.test(code),
      )
    : null
  if (!countries) return null
  const baseVersion =
    Number.isSafeInteger(raw.baseVersion) && (raw.baseVersion as number) >= 1
      ? (raw.baseVersion as number)
      : null
  // The pending command is the server's own shape; it is re-sent verbatim, so only its identity is checked.
  const pending =
    isRecord(raw.pending) &&
    typeof raw.pending.operationKey === 'string' &&
    isUuid(raw.pending.journeyId) &&
    typeof raw.pending.action === 'string'
      ? (raw.pending as unknown as GroundCommand)
      : null
  return {
    v: DRAFT_VERSION,
    journeyId: raw.journeyId,
    baseVersion,
    pending,
    state: {
      mode,
      status: state.status,
      title: text(state.title),
      note: text(state.note),
      startDate: text(state.startDate),
      endDate: text(state.endDate),
      legs,
      points,
      countries: [...new Set(countries)],
      noCountries: state.noCountries === true && countries.length === 0,
    },
  }
}

export function readDraft(ownerId: string, kind: DraftKind, mode: GroundMode): DraftRead {
  try {
    const stored = localStorage.getItem(draftStorageKey(ownerId, kind))
    if (stored === null) return { status: 'none' }
    const draft = parseDraft(JSON.parse(stored), mode)
    return draft ? { status: 'ok', draft } : { status: 'invalid' }
  } catch {
    return { status: 'invalid' }
  }
}

/** Returns whether the draft was stored; storage is optional, so a failure becomes a visible note, not an error. */
export function writeDraft(ownerId: string, kind: DraftKind, draft: Draft): boolean {
  try {
    localStorage.setItem(draftStorageKey(ownerId, kind), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function removeDraft(ownerId: string, kind: DraftKind): void {
  try {
    localStorage.removeItem(draftStorageKey(ownerId, kind))
  } catch {
    /* Storage is optional. */
  }
}

/** A trailing-edge debounced writer: typing does not serialize the whole route on every key. */
export function createDraftWriter(
  ownerId: string,
  kind: DraftKind,
  onResult: (stored: boolean) => void,
  delayMs = 400,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let queued: Draft | null = null
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (!queued) return
    const draft = queued
    queued = null
    onResult(writeDraft(ownerId, kind, draft))
  }
  return {
    schedule(draft: Draft) {
      queued = draft
      clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    flush,
    /** Drops anything queued, e.g. after a successful save removed the stored draft. */
    cancel() {
      clearTimeout(timer)
      timer = undefined
      queued = null
    },
  }
}
