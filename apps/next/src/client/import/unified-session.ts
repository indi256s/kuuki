import { getAuthGeneration } from '@kuuki/client/apiClient'
import {
  createBatchRun,
  defaultBatchApi,
  failureOf,
  isReading,
  stoppedOf,
  type BatchApi,
  type BatchRun,
} from './batch-run'
import { readBoardingPass } from './barcode-reader'
import type { Leg } from './bcbp'
import { confirmItems, patchDraft, type ImportSource } from './import-api'
import type { ImportRuns } from './import-runs'
import type { Draft } from './import-types'
import { runConfirm, type RowOutcome } from './confirm-runner'
import { checkFile } from './source-step'
import { uploadSource } from './quick-add-source'
import {
  localToday,
  readiness,
  toValues,
  validateValues,
  isDuplicate,
  lowFields,
  LOW_CONFIDENCE,
} from './review-model'

export type EntryProblem = 'type' | 'size' | 'read' | 'recognition' | 'partial' | 'reselect'
/** A problem exists exactly when the entry failed. */
export type EntryState =
  | { phase: 'queued' | 'local' | 'online' | 'ready' | 'empty'; problem?: undefined }
  | { phase: 'failed'; problem: EntryProblem }
interface EntryFields {
  id: string
  label: string
  operationId: string
  runs: BatchRun[]
  barcode?: BatchRun
  online?: BatchRun
  suppressedIds?: string[]
  excludedIds?: string[]
  file?: File
  source?: ImportSource
  fingerprint?: string
}
export type SessionEntry = EntryFields & EntryState

/** The complementary source is still owed: everything except a settled entry. */
export const complementPending = (entry: SessionEntry): boolean =>
  entry.phase !== 'ready' && entry.phase !== 'empty'

const entryOf = (fields: EntryFields, state: EntryState): SessionEntry => ({ ...fields, ...state })
const setState = (entry: SessionEntry, state: EntryState) =>
  void Object.assign(entry, { problem: undefined }, state)
export interface RetainedEntry {
  id: string
  label: string
  operationId: string
  batchIds: string[]
  barcodeBatchId?: string
  onlineBatchId?: string
  complementPending?: boolean
  suppressedIds?: string[]
  excludedIds?: string[]
  selectionRequired?: boolean
  fingerprint?: string
  problem?: EntryProblem
}

/** Several existing single-source jobs; draft identity and confirmation always stay with their owning run. */
export class UnifiedSession {
  private entries: SessionEntry[] = []
  private listeners = new Set<() => void>()
  private releases: Array<() => void> = []
  private generation = getAuthGeneration()
  private stopped = false
  private active = 0
  private visible = true
  private confirmVersions = new Map<string, number>()
  private outcomes = new Map<string, RowOutcome>()
  private selectionRequired = false
  constructor(
    private api: BatchApi = defaultBatchApi,
    private store?: ImportRuns | null,
    private retain?: (entries: RetainedEntry[]) => void,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getEntries = () => this.entries
  getOutcomes = () => this.outcomes
  private publish() {
    if (this.stopped || this.generation !== getAuthGeneration()) return
    if (
      this.entries.every((entry) => !['queued', 'local', 'online'].includes(entry.phase)) &&
      this.drafts().filter((draft) => draft.status === 'review').length > 1
    )
      this.selectionRequired = true
    this.entries = [...this.entries]
    this.retain?.(this.retained())
    this.listeners.forEach((listener) => listener())
  }
  retained(): RetainedEntry[] {
    return this.entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      operationId: entry.operationId,
      batchIds: [...new Set(entry.runs.flatMap((run) => (run.batchId() ? [run.batchId()!] : [])))],
      ...(entry.barcode?.batchId() ? { barcodeBatchId: entry.barcode.batchId()! } : {}),
      ...(entry.online?.batchId() ? { onlineBatchId: entry.online.batchId()! } : {}),
      complementPending: complementPending(entry),
      suppressedIds: entry.suppressedIds ?? [],
      excludedIds: entry.excludedIds ?? [],
      selectionRequired: this.selectionRequired,
      ...(entry.problem ? { problem: entry.problem } : {}),
      ...(entry.fingerprint ? { fingerprint: entry.fingerprint } : {}),
    }))
  }
  requiresSelection() {
    return this.selectionRequired
  }
  isExcluded(id: string) {
    return this.entries.some((entry) => entry.excludedIds?.includes(id))
  }
  isSuppressed(id: string) {
    return this.entries.some((entry) => entry.suppressedIds?.includes(id))
  }
  noteSelection(id: string, selected: boolean) {
    const entry = this.entries.find((entry) =>
      entry.runs.some((run) => run.getState().drafts.some((draft) => draft.id === id)),
    )
    if (!entry) return
    entry.excludedIds = selected
      ? (entry.excludedIds ?? []).filter((value) => value !== id)
      : [...new Set([...(entry.excludedIds ?? []), id])]
    this.publish()
  }
  private attach(entry: SessionEntry, run: BatchRun) {
    entry.runs.push(run)
    if (this.store) {
      const release = this.store.view(run)
      if (this.visible) this.releases.push(release)
      else {
        const stop = run.subscribe(() => {
          if (run.getState().phase !== 'idle') {
            stop()
            release()
          }
        })
      }
    }
    run.subscribe(() => this.publish())
    run.onBatchId(() => this.publish())
    return run
  }
  resume(records: RetainedEntry[]) {
    this.selectionRequired ||= records.some((record) => record.selectionRequired)
    for (const record of records) {
      if (this.entries.some((entry) => entry.id === record.id)) continue
      const entry = entryOf(
        {
          id: record.id,
          label: record.label,
          operationId: record.operationId,
          runs: [],
          suppressedIds: record.suppressedIds,
          excludedIds: record.excludedIds,
          fingerprint: record.fingerprint,
        },
        record.batchIds.length ? { phase: 'online' } : { phase: 'failed', problem: 'reselect' },
      )
      this.entries.push(entry)
      for (const id of record.batchIds) {
        const run = this.attach(entry, this.store?.find(id) ?? createBatchRun(this.api, id))
        if (record.barcodeBatchId === id) entry.barcode = run
        if (record.onlineBatchId === id || (!record.onlineBatchId && id !== record.barcodeBatchId))
          entry.online = run
        run.open()
      }
      if (entry.runs.length)
        void Promise.all(entry.runs.map((run) => this.terminal(run)))
          .then(async () => {
            const online = entry.online
            if (entry.barcode && online && !failureOf(online.getState()))
              await this.reconcile(entry, entry.barcode, online)
            for (const run of entry.runs) await this.clearInvalidOptional(run)
            this.settle(
              entry,
              !online ||
                online.getState().phase !== 'ready' ||
                failureOf(online.getState()) ||
                stoppedOf(online.getState())?.why === 'cancelled' ||
                (entry.barcode && failureOf(entry.barcode.getState()))
                ? 'reselect'
                : undefined,
            )
            this.publish()
          })
          .catch(() => {
            setState(entry, { phase: 'failed', problem: 'reselect' })
            this.publish()
          })
    }
    this.publish()
  }
  add(files: File[]) {
    for (const file of files) {
      // Reselecting a lost submission reuses its operation id. A known terminal batch gets a new operation on Retry.
      const held = this.entries.find(
        (entry) => entry.problem === 'reselect' && entry.label === file.name && !entry.file,
      )
      if (held) {
        this.prepareRetry(held)
        held.file = file
        setState(held, { phase: 'queued' })
      } else
        this.entries.push(
          entryOf(
            {
              id: crypto.randomUUID(),
              label: file.name,
              file,
              operationId: crypto.randomUUID(),
              runs: [],
            },
            { phase: 'queued' },
          ),
        )
    }
    this.publish()
    this.pump()
  }
  addText(text: string, label: string) {
    const held = this.entries.find(
      (entry) =>
        entry.problem === 'reselect' && entry.label === label && !entry.file && !entry.source,
    )
    const source: ImportSource = { type: 'text', content: text }
    if (held) {
      this.prepareRetry(held)
      held.source = source
      setState(held, { phase: 'queued' })
    } else
      this.entries.push(
        entryOf(
          { id: crypto.randomUUID(), label, operationId: crypto.randomUUID(), source, runs: [] },
          { phase: 'queued' },
        ),
      )
    this.publish()
    this.pump()
  }
  remove(entry: SessionEntry) {
    if (entry.runs.length || entry.phase !== 'failed') return
    this.entries = this.entries.filter((item) => item !== entry)
    this.publish()
  }
  retry(entry: SessionEntry) {
    if (entry.phase !== 'failed') return
    if (!entry.file && !entry.source) {
      setState(entry, { phase: 'failed', problem: 'reselect' })
      this.publish()
      return
    }
    // Never replace retained partial drafts or receipts. Retry adds a new run and the server's duplicate guard applies.
    this.prepareRetry(entry)
    setState(entry, { phase: 'queued' })
    this.publish()
    this.pump()
  }
  private prepareRetry(entry: SessionEntry) {
    if (entry.online?.getState().batch && entry.online.getState().batch?.status !== 'processing') {
      entry.operationId = crypto.randomUUID()
      entry.online = undefined
    }
  }
  /** One outcome for a settled entry: failed with its problem, else empty or ready by the drafts the runs hold. */
  private settle(entry: SessionEntry, problem: EntryProblem | undefined) {
    if (problem) setState(entry, { phase: 'failed', problem })
    else
      setState(entry, {
        phase: entry.runs.every((run) => !run.getState().drafts.length) ? 'empty' : 'ready',
      })
  }
  private assertCurrent() {
    if (this.stopped || this.generation !== getAuthGeneration())
      throw new DOMException('Session changed', 'AbortError')
  }
  stop() {
    this.stopped = true
    this.entries.flatMap((entry) => entry.runs).forEach((run) => run.dispose())
  }
  private pump() {
    if (this.stopped || this.generation !== getAuthGeneration()) return
    // The existing admission contract permits one processing batch per owner.
    while (this.active < 1) {
      const entry = this.entries.find((item) => item.phase === 'queued')
      if (!entry) break
      setState(entry, { phase: 'local' })
      this.active++
      this.publish()
      void this.process(entry).finally(() => {
        this.active--
        this.publish()
        this.pump()
      })
    }
  }
  private async terminal(run: BatchRun) {
    if (!isReading(run.getState().phase)) return
    await new Promise<void>((resolve) => {
      const release = run.subscribe(() => {
        if (!isReading(run.getState().phase)) {
          release()
          resolve()
        }
      })
      if (!isReading(run.getState().phase)) {
        release()
        resolve()
      }
    })
  }
  private async submit(entry: SessionEntry, source: ImportSource, operationId: string) {
    this.assertCurrent()
    const run = this.attach(entry, createBatchRun(this.api))
    if (source.type === 'boarding_pass') entry.barcode = run
    else entry.online = run
    await run.start(source, operationId)
    await this.terminal(run)
    this.assertCurrent()
    return run
  }
  private async clearInvalidOptional(run: BatchRun) {
    for (const draft of run.getState().drafts) {
      if (draft.status !== 'review' || draft.edited) continue
      this.assertCurrent()
      const errors = validateValues(toValues(draft.fields))
      const fields: Record<string, null> = {}
      for (const key of [
        'aircraft_icao',
        'departure_time',
        'arrival_time',
        'flight_number',
      ] as const) {
        if (errors[key]) fields[key] = null
      }
      if (Object.keys(fields).length)
        run.setDraft(await patchDraft(draft.id, { version: draft.version, fields }))
    }
  }
  private async reconcile(entry: SessionEntry, barcode: BatchRun, online: BatchRun) {
    const locals = barcode.getState().drafts.filter((draft) => draft.status === 'review')
    const remote = online.getState().drafts.filter((draft) => draft.status === 'review')
    // Resolve the entire bipartite identity graph before mutating either batch.
    const matches = remote.map((draft) =>
      locals.filter((local) => compatibleIdentity(local, draft)),
    )
    const pairs = remote.flatMap((draft, index) => {
      const candidates = matches[index]
      if (candidates.length !== 1 || draft.edited || candidates[0].edited) return []
      const local = candidates[0]
      if (matches.filter((candidates) => candidates.includes(local)).length !== 1) return []
      return [{ local, draft }]
    })
    for (const { local, draft } of pairs) {
      this.assertCurrent()
      const suppressed = !draft.fields.date || !draft.yearExplicit ? draft : local
      // Persist intent before the dismissal request, so an interrupted response cannot expose a system Restore action.
      entry.suppressedIds = [...new Set([...(entry.suppressedIds ?? []), suppressed.id])]
      this.publish()
      if (suppressed === draft) {
        online.setDraft(await patchDraft(draft.id, { version: draft.version, dismissed: true }))
        continue
      }
      const fields: Record<string, string> = {
        origin: local.fields.origin,
        destination: local.fields.destination,
      }
      if (local.fields.airline_iata && !local.fields.airline_was_placeholder)
        fields.airline_iata = local.fields.airline_iata
      if (local.fields.flight_number) fields.flight_number = local.fields.flight_number
      if (
        Object.entries(fields).some(
          ([key, value]) => draft.fields[key as keyof typeof draft.fields] !== value,
        )
      )
        online.setDraft(
          await patchDraft(draft.id, { version: draft.version, fields, selected: false }),
        )
      this.assertCurrent()
      barcode.setDraft(await patchDraft(local.id, { version: local.version, dismissed: true }))
    }
  }
  private async process(entry: SessionEntry) {
    try {
      const problem = entry.file ? checkFile(entry.file) : null
      if (problem) {
        setState(entry, { phase: 'failed', problem })
        return
      }
      const bytes = entry.file
        ? new Uint8Array(await entry.file.arrayBuffer())
        : new TextEncoder().encode(entry.source?.type === 'text' ? entry.source.content : '')
      this.assertCurrent()
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
      this.assertCurrent()
      const fingerprint = `${entry.file?.type ?? 'text'}:${[...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
      if (entry.fingerprint && entry.fingerprint !== fingerprint) {
        // A replacement with the same filename is a new source; never replay it as the original request.
        this.entries.push(
          entryOf(
            {
              id: crypto.randomUUID(),
              label: entry.label,
              operationId: crypto.randomUUID(),
              runs: [],
              file: entry.file,
              source: entry.source,
              fingerprint,
            },
            { phase: 'queued' },
          ),
        )
        entry.file = undefined
        entry.source = undefined
        setState(entry, { phase: 'failed', problem: 'reselect' })
        return
      }
      entry.fingerprint = fingerprint
      this.publish()
      let legs: Leg[] = []
      if (entry.file && !entry.barcode?.getState().drafts.length) {
        const local = await readBoardingPass(entry.file)
        if (local.kind === 'legs') legs = local.legs
        if (legs.length)
          entry.barcode = await this.submit(
            entry,
            {
              type: 'boarding_pass',
              source: entry.file.type === 'application/pdf' ? 'pdf' : 'image',
              sourceLabel: entry.label,
              legs,
            },
            `${entry.operationId}:barcode`,
          )
      }
      // Persist barcode fields before sending the full source, so resume never depends on the file remaining in memory.
      setState(entry, { phase: 'online' })
      this.publish()
      const source = entry.source ?? (await uploadSource(entry.file!))
      const online = await this.submit(entry, source, entry.operationId)
      const state = online.getState()
      if (entry.barcode) await this.reconcile(entry, entry.barcode, online)
      const barcodeFailed = Boolean(entry.barcode && failureOf(entry.barcode.getState()))
      for (const run of entry.runs) await this.clearInvalidOptional(run)
      for (const run of entry.runs)
        for (const draft of run.getState().drafts) {
          this.assertCurrent()
          if (
            draft.status === 'review' &&
            !draft.selected &&
            !this.isExcluded(draft.id) &&
            !draft.fields.review_required &&
            !isDuplicate(draft) &&
            readiness({ ...draft, fields: { ...draft.fields, flown_confirmed: true } }).length ===
              0 &&
            Object.keys(validateValues(toValues(draft.fields))).length === 0 &&
            (draft.confidence === null || draft.confidence >= LOW_CONFIDENCE) &&
            !lowFields(draft).some((field) =>
              ['date', 'origin', 'destination', 'airline_iata'].includes(field),
            )
          ) {
            run.setDraft(await patchDraft(draft.id, { version: draft.version, selected: true }))
          }
        }
      this.settle(
        entry,
        state.phase !== 'ready' ||
          failureOf(state) ||
          stoppedOf(state)?.why === 'cancelled' ||
          barcodeFailed
          ? state.drafts.length || entry.barcode?.getState().drafts.length
            ? 'partial'
            : 'recognition'
          : undefined,
      )
      // Source bytes are memory-only. Keep failed inputs for retry while this page remains open.
      if (entry.phase !== 'failed') {
        entry.file = undefined
        entry.source = undefined
      }
    } catch {
      setState(entry, { phase: 'failed', problem: 'read' })
    }
  }
  draftOwner(id: string) {
    return this.entries
      .flatMap((entry) => entry.runs)
      .find((run) => run.getState().drafts.some((draft) => draft.id === id))
  }
  setDraft = (draft: Draft) => {
    this.draftOwner(draft.id)?.setDraft(draft)
  }
  drafts() {
    return [
      ...new Map(
        this.entries
          .flatMap((entry) => entry.runs.flatMap((run) => run.getState().drafts))
          .map((draft) => [draft.id, draft]),
      ).values(),
    ]
  }
  /** One explicit save authorizes past-flight confirmation, followed by the existing idempotent per-batch receipts. */
  async save(ids: string[]) {
    const acks = []
    for (const entry of this.entries)
      for (const run of entry.runs) {
        const selected = run
          .getState()
          .drafts.filter((draft) => ids.includes(draft.id) && draft.status === 'review')
        const items = []
        for (const draft of selected) {
          this.assertCurrent()
          if (
            readiness(
              { ...draft, fields: { ...draft.fields, flown_confirmed: true } },
              localToday(),
            ).length ||
            Object.keys(validateValues(toValues(draft.fields))).length
          )
            continue
          // The receipt version after this patch is pinned for every retry of an unknown confirm outcome.
          const previous = this.outcomes.get(draft.id)
          const saved =
            previous?.status === 'uncertain' ||
            previous?.status === 'unsent' ||
            draft.fields.flown_confirmed ||
            (!draft.fields.flown_required && draft.selected) ||
            (draft.fields.date > localToday() && draft.selected)
              ? draft
              : await patchDraft(draft.id, {
                  version: draft.version,
                  ...(draft.fields.flown_required && draft.fields.date <= localToday()
                    ? { flownConfirmed: true }
                    : {}),
                  selected: true,
                })
          run.setDraft(saved)
          const version =
            previous?.status === 'uncertain'
              ? (this.confirmVersions.get(saved.id) ?? saved.version)
              : saved.version
          this.confirmVersions.set(saved.id, version)
          items.push({ draftId: saved.id, version })
        }
        if (!items.length || !run.batchId()) continue
        this.assertCurrent()
        const result = await runConfirm({ batchId: run.batchId()!, items, send: confirmItems })
        for (const [id, outcome] of result.rows) this.outcomes.set(id, outcome)
        acks.push(...result.acks)
        try {
          await run.reload(run.batchId())
        } catch {
          /* Confirm receipts remain authoritative; unresolved rows stay visible. */
        }
      }
    this.publish()
    return acks
  }
  enter() {
    this.visible = true
    for (const run of this.entries.flatMap((entry) => entry.runs)) {
      if (this.store) this.releases.push(this.store.view(run))
      run.open()
    }
  }
  leave() {
    this.visible = false
    this.releases.splice(0).forEach((release) => release())
    if (!this.store) this.entries.flatMap((entry) => entry.runs).forEach((run) => run.dispose())
  }
}

function ordinal(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const time = Date.parse(`${date}T00:00:00Z`)
  return Math.floor((time - Date.UTC(Number(date.slice(0, 4)), 0, 1)) / 86400000) + 1
}

function compatibleIdentity(local: Draft, remote: Draft) {
  const a = local.fields,
    b = remote.fields
  for (const endpoint of ['origin', 'destination'] as const)
    if (a[endpoint] && b[endpoint] && a[endpoint] !== b[endpoint]) return false
  const knownAirline = (value: string | undefined) => value && value !== 'ZZ'
  if (
    knownAirline(a.airline_iata) &&
    knownAirline(b.airline_iata) &&
    a.airline_iata !== b.airline_iata
  )
    return false
  const number = (value: string) => value.replace(/^0+(?=\d)/, '')
  if (a.flight_number && b.flight_number && number(a.flight_number) !== number(b.flight_number))
    return false
  if (a.date_ordinal_day) {
    if (b.date && remote.yearExplicit && ordinal(b.date) !== a.date_ordinal_day) return false
    if (
      b.date_month_day &&
      ![2000, 2001].some((year) => ordinal(`${year}-${b.date_month_day}`) === a.date_ordinal_day)
    )
      return false
  }
  return Boolean(
    (a.origin && a.destination && a.origin === b.origin && a.destination === b.destination) ||
    (knownAirline(a.airline_iata) &&
      a.airline_iata === b.airline_iata &&
      a.flight_number &&
      b.flight_number &&
      number(a.flight_number) === number(b.flight_number)),
  )
}
