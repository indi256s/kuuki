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
import type { Preview, PreviewDate } from './ocr/model'
import type { StoredOcrRow } from './rail-editor'

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
  /**
   * Ticket previews received and not yet added to the route. Only the editable preview fields: never the file
   * or the text the reader returned. Absent in drafts written before the reader existed.
   */
  ocr?: StoredOcrRow[]
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
    fromCity: text(value.fromCity) || undefined,
    toCity: text(value.toCity) || undefined,
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

const PENDING_ACTIONS = ['create', 'update', 'complete'] as const
const version = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 1

/**
 * The frozen command is re-sent verbatim, so its identity is checked in full: a known form action, an operation
 * key, the draft's own journey id, a version where the action needs one, and a route whose places the notice
 * reads. Anything else is dropped rather than half-trusted.
 */
function parsePending(value: unknown, mode: GroundMode, journeyId: string): GroundCommand | null {
  if (!isRecord(value)) return null
  const { action } = value
  if (!(PENDING_ACTIONS as readonly unknown[]).includes(action)) return null
  if (typeof value.operationKey !== 'string' || value.operationKey === '') return null
  if (value.journeyId !== journeyId) return null
  if (action === 'create') {
    if (value.status !== 'planned' && value.status !== 'completed') return null
  } else if (!version(value.expectedVersion)) return null
  if (value.countries !== undefined) {
    if (!Array.isArray(value.countries) || !value.countries.every((c) => typeof c === 'string'))
      return null
  } else if (action === 'complete' || (action === 'create' && value.status === 'completed')) {
    return null
  }
  const journey = value.journey
  if (!isRecord(journey) || journey.mode !== mode) return null
  if (mode === 'rail') {
    if (!Array.isArray(journey.legs)) return null
    const routed = journey.legs.every(
      (item) => isRecord(item) && parsePlaceSnapshot(item.from) && parsePlaceSnapshot(item.to),
    )
    if (!routed) return null
  } else {
    if (!Array.isArray(journey.points)) return null
    if (!journey.points.every((item) => isRecord(item) && parsePlaceSnapshot(item.place)))
      return null
  }
  return value as unknown as GroundCommand
}

function previewDate(value: unknown): PreviewDate {
  const none: PreviewDate = { value: '', partial: null, year: '' }
  if (!isRecord(value)) return none
  const partial = isRecord(value.partial) ? value.partial : null
  const month = partial?.month
  const day = partial?.day
  return {
    value: text(value.value),
    partial:
      Number.isInteger(month) && Number.isInteger(day)
        ? { month: month as number, day: day as number }
        : null,
    year: text(value.year),
  }
}

function preview(value: unknown): Preview | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '') return null
  return {
    id: value.id,
    fromStation: text(value.fromStation),
    toStation: text(value.toStation),
    fromCity: text(value.fromCity),
    toCity: text(value.toCity),
    trainNumber: text(value.trainNumber),
    operator: text(value.operator),
    departureDate: previewDate(value.departureDate),
    arrivalDate: previewDate(value.arrivalDate),
    departureTime: text(value.departureTime),
    arrivalTime: text(value.arrivalTime),
    uncertain: Array.isArray(value.uncertain)
      ? (value.uncertain.filter((field) => typeof field === 'string') as Preview['uncertain'])
      : [],
    cancelled: value.cancelled === true,
    otherPassenger: value.otherPassenger === true,
    include: value.include === true,
    added: false,
  }
}

/** Rows that hold at least one readable, unadded preview; an unreadable row is skipped, not the whole draft. */
function parseOcr(value: unknown): StoredOcrRow[] {
  if (!Array.isArray(value)) return []
  const out: StoredOcrRow[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || !Array.isArray(item.previews)) continue
    const previews = item.previews.map(preview).filter((p): p is Preview => p !== null)
    if (previews.length === 0) continue
    out.push({
      id: item.id,
      fileName: text(item.fileName),
      fileSize: typeof item.fileSize === 'number' && item.fileSize >= 0 ? item.fileSize : null,
      previews,
    })
  }
  return out
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
  const pending = parsePending(raw.pending, mode, raw.journeyId)
  return {
    v: DRAFT_VERSION,
    journeyId: raw.journeyId,
    baseVersion,
    pending,
    ocr: mode === 'rail' ? parseOcr(raw.ocr) : [],
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
  // After an identity reset the stored draft belongs to nobody: nothing queued or scheduled later may bring it back.
  let reset = false
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (!queued || reset) return
    const draft = queued
    queued = null
    onResult(writeDraft(ownerId, kind, draft))
  }
  const cancel = () => {
    clearTimeout(timer)
    timer = undefined
    queued = null
  }
  return {
    schedule(draft: Draft) {
      if (reset) return
      queued = draft
      clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    flush,
    /** Drops anything queued, e.g. after a successful save removed the stored draft. */
    cancel,
    /** Stops writing for good when the identity resets; returns the unsubscribe for unmount. */
    watchIdentityReset() {
      const onReset = () => {
        reset = true
        cancel()
      }
      window.addEventListener('kuuki:identity-reset', onReset)
      return () => window.removeEventListener('kuuki:identity-reset', onReset)
    },
  }
}
