import { ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import type { DerivedAck } from '@kuuki/client/derivedState'
import type {
  HistoryCreateBody,
  HistoryGroup,
  HistoryPage,
  HistoryRowAnswers,
  HistoryRowView,
  HistoryRunSummary,
} from '@kuuki/shared/flightyHistory'
import { isCalendarDate } from '../../../../../packages/shared/src/flightValidation'
import { routeCountries, newlyPressed } from './flight-input'
import {
  answerHistoryGroup,
  awaitPublication,
  confirmHistoryRows,
  createHistoryRun,
  discardHistoryRun,
  eraseHistorySource,
  fetchPressedCountries,
  patchHistoryRow,
  putHistoryChunk,
  readHistoryPage,
} from './history-api'

export type HistoryFailure =
  | { kind: 'file'; code: string; line?: number; header?: string }
  | { kind: 'different_file' }
  | { kind: 'too_large' }
  | { kind: 'run_limit' }
  | { kind: 'closed' }
  | { kind: 'stale' }
  | { kind: 'offline' }
  | { kind: 'server' }

export interface HistoryState {
  reading: boolean
  fileName: string | null
  run: HistoryRunSummary | null
  upload: { sent: number; total: number; years: { from: number; to: number } | null } | null
  exceptions: HistoryRowView[]
  nextCursor: number | null
  ready: { rows: HistoryRowView[]; nextCursor: number | null } | null
  saving: { done: number; total: number } | null
  busy: ReadonlySet<string>
  failure: HistoryFailure | null
  ack: DerivedAck | null
  settled: Array<{ group: string; token: string; answer: string | boolean | null; rows: number }>
  stamps: { status: 'pending' | 'ready' | 'delayed'; codes: string[] } | null
}

export interface HistoryRetained {
  runId: string | null
  operationId: string
  digest: string
}

export interface HistoryTransport {
  createRun: typeof createHistoryRun
  putChunk: typeof putHistoryChunk
  readPage: typeof readHistoryPage
  patchRow: typeof patchHistoryRow
  answerGroup: typeof answerHistoryGroup
  confirm: typeof confirmHistoryRows
  discard: typeof discardHistoryRun
  erase: typeof eraseHistorySource
  pressedCountries: typeof fetchPressedCountries
  awaitPublication: typeof awaitPublication
}

const httpTransport: HistoryTransport = {
  createRun: createHistoryRun,
  putChunk: putHistoryChunk,
  readPage: readHistoryPage,
  patchRow: patchHistoryRow,
  answerGroup: answerHistoryGroup,
  confirm: confirmHistoryRows,
  discard: discardHistoryRun,
  erase: eraseHistorySource,
  pressedCountries: fetchPressedCountries,
  awaitPublication,
}

type Chunk = {
  index: number
  body: { records: Array<[number, number, string[]]> }
  years: { from: number; to: number } | null
}

function yearsOf(dates: Array<string | undefined>) {
  let years: { from: number; to: number } | null = null
  for (const cell of dates) {
    const date = cell?.trim() ?? ''
    if (!isCalendarDate(date)) continue
    const year = Number(date.slice(0, 4))
    years = years
      ? { from: Math.min(years.from, year), to: Math.max(years.to, year) }
      : { from: year, to: year }
  }
  return years
}

const widen = (a: { from: number; to: number } | null, b: { from: number; to: number } | null) =>
  a && b ? { from: Math.min(a.from, b.from), to: Math.max(a.to, b.to) } : (a ?? b)

const INITIAL: HistoryState = {
  reading: false,
  fileName: null,
  run: null,
  upload: null,
  exceptions: [],
  nextCursor: null,
  ready: null,
  saving: null,
  busy: new Set(),
  failure: null,
  ack: null,
  settled: [],
  stamps: null,
}

export function classifyHistoryError(error: unknown): HistoryFailure {
  if (!(error instanceof ApiError)) return { kind: 'offline' }
  if (error.status === 0 || error.status === 408) return { kind: 'offline' }
  if (error.code === 'CHUNK_DIGEST_MISMATCH' || error.code === 'IDEMPOTENCY_CONFLICT')
    return { kind: 'different_file' }
  if (error.status === 413 || error.code === 'TOO_MANY_RECORDS') return { kind: 'too_large' }
  if (error.code === 'HISTORY_RUN_LIMIT') return { kind: 'run_limit' }
  if (error.code === 'HISTORY_RUN_CLOSED' || error.status === 404) return { kind: 'closed' }
  if (error.status === 409) return { kind: 'stale' }
  return { kind: 'server' }
}

export const isHistoryCsv = (file: { name: string; type: string }) =>
  file.type === 'text/csv' || /\.csv$/i.test(file.name)

export const historyConfirmKey = (row: { id: string; version: number }) =>
  `h-${row.id}-v${row.version}`

export class HistorySession {
  private state: HistoryState = INITIAL
  private listeners = new Set<() => void>()
  private chunks: Chunk[] | null = null
  private creating: { body: HistoryCreateBody; digest: string } | null = null
  private generation = 0
  private stampsWait: AbortController | null = null
  private stampLedger: {
    runId: string
    baseline: Promise<Set<string> | null>
    touched: Set<string>
    created: number
  } | null = null

  static forOwner(ownerId: string, transport?: HistoryTransport) {
    const key = `kuuki-history-import:${ownerId}`
    return new HistorySession(
      (record) => {
        try {
          if (record) sessionStorage.setItem(key, JSON.stringify(record))
          else sessionStorage.removeItem(key)
        } catch {}
      },
      () => {
        try {
          return JSON.parse(sessionStorage.getItem(key) ?? 'null') as HistoryRetained | null
        } catch {
          return null
        }
      },
      transport,
    )
  }

  constructor(
    private readonly retain: (record: HistoryRetained | null) => void,
    private readonly retained: () => HistoryRetained | null,
    private readonly transport: HistoryTransport = httpTransport,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getState = () => this.state

  private cancelStamps() {
    this.stampsWait?.abort()
    this.stampsWait = null
  }

  stopStamps() {
    this.cancelStamps()
    if (this.state.stamps?.status === 'pending') this.set({ stamps: null })
  }

  private set(patch: Partial<HistoryState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private fail(error: unknown) {
    this.set({ failure: classifyHistoryError(error), reading: false, saving: null })
  }

  private failIfCurrent(error: unknown, generation: number) {
    if (generation === this.generation) this.fail(error)
  }

  private setBusy(id: string, on: boolean) {
    const busy = new Set(this.state.busy)
    if (on) busy.add(id)
    else busy.delete(id)
    this.set({ busy })
  }

  async choose(file: File) {
    const generation = ++this.generation
    this.cancelStamps()
    this.set({ ...INITIAL, run: this.state.run, reading: true, fileName: file.name })
    try {
      const flighty = await import('@kuuki/shared/flighty')
      if (file.size > flighty.FLIGHTY_MAX_FILE_BYTES) throw new ApiError(413, 'too large')
      let parsed: ReturnType<typeof flighty.parseFlightyCsv>
      try {
        parsed = flighty.parseFlightyCsv(await file.text())
      } catch (error) {
        if (!(error instanceof flighty.FlightyParseError)) throw error
        if (generation === this.generation)
          this.set({
            reading: false,
            failure: {
              kind: 'file',
              code: error.code,
              line: error.line ?? undefined,
              header: error.header ?? undefined,
            },
          })
        return
      }
      const groups = flighty.chunkFlightyRecords(parsed.records)
      const manifest = await Promise.all(
        groups.map(async (records) => ({
          count: records.length,
          digest: await flighty.flightyChunkDigest(records),
        })),
      )
      const digest = await flighty.flightyManifestDigest(parsed.headers, manifest)
      if (generation !== this.generation) return
      const dateColumn = parsed.headers.indexOf('Date')
      const chunks: Chunk[] = groups.map((records, index) => ({
        index,
        body: { records: records.map((record) => [record.ordinal, record.line, record.cells]) },
        years: yearsOf(records.map((record) => record.cells[dateColumn])),
      }))
      const prior = this.retained()
      const current = this.state.run
      if (current && current.status === 'receiving' && prior && prior.digest !== digest) {
        this.chunks = null
        this.set({ reading: false, failure: { kind: 'different_file' } })
        return
      }
      this.chunks = chunks
      if (current && current.status === 'receiving') {
        this.set({ reading: false })
        await this.send(generation, current)
        return
      }
      const operationId =
        prior && prior.digest === digest && !prior.runId ? prior.operationId : crypto.randomUUID()
      this.retain({ runId: null, operationId, digest })
      this.creating = {
        body: {
          operationId,
          profile: flighty.FLIGHTY_PROFILE,
          headers: parsed.headers,
          totalRecords: parsed.records.length,
          blankLines: parsed.blankLines,
          chunks: manifest,
        },
        digest,
      }
      await this.create(generation)
    } catch (error) {
      this.failIfCurrent(error, generation)
    }
  }

  private async create(generation: number) {
    const { body, digest } = this.creating!
    const { run } = await this.transport.createRun(body)
    if (generation !== this.generation) return
    this.creating = null
    this.retain({ runId: run.id, operationId: body.operationId, digest })
    this.set({ reading: false, run })
    await this.send(generation, run)
  }

  private async send(generation: number, run: HistoryRunSummary) {
    const chunks = this.chunks
    if (!chunks) return
    const missing = new Set(run.chunks.missing)
    const pending = missing.size
      ? chunks.filter((chunk) => missing.has(chunk.index))
      : run.status === 'receiving'
        ? chunks.slice(-1)
        : []
    this.set({
      upload: { sent: chunks.length - pending.length, total: chunks.length, years: null },
      failure: null,
    })
    for (const chunk of pending) {
      const { run: next } = await this.transport.putChunk(run.id, chunk.index, chunk.body)
      if (generation !== this.generation) return
      this.set({
        run: next,
        upload: {
          sent: Math.min(chunks.length, (this.state.upload?.sent ?? 0) + 1),
          total: chunks.length,
          years: widen(this.state.upload?.years ?? null, chunk.years),
        },
      })
    }
    this.chunks = null
    this.set({ upload: null })
    await this.refresh(generation)
  }

  private applyPage(page: HistoryPage) {
    this.set({ run: page.run, exceptions: page.rows, nextCursor: page.nextCursor })
  }

  private async recover(error: unknown, generation: number) {
    if (generation !== this.generation) return
    this.fail(error)
    await this.refresh(generation).catch(() => undefined)
  }

  async resume(runId: string) {
    const generation = ++this.generation
    this.cancelStamps()
    this.set({ ...INITIAL, reading: true })
    try {
      const page = await this.transport.readPage(runId, { state: 'review' })
      if (generation !== this.generation) return
      this.set({ reading: false })
      this.applyPage(page)
    } catch (error) {
      this.failIfCurrent(error, generation)
    }
  }

  async retry() {
    const run = this.state.run
    if (!run && !this.creating) return
    const generation = this.generation
    this.set({ failure: null })
    try {
      if (!run) {
        await this.create(generation)
        return
      }
      const page = await this.transport.readPage(run.id, { state: 'review' })
      if (generation !== this.generation) return
      this.applyPage(page)
      if (page.run.status === 'receiving' && this.chunks) await this.send(generation, page.run)
    } catch (error) {
      this.failIfCurrent(error, generation)
    }
  }

  holdsFile = () => this.chunks !== null

  async refresh(generation = this.generation) {
    const run = this.state.run
    if (!run) return
    const page = await this.transport.readPage(run.id, { state: 'review' })
    if (generation !== this.generation) return
    this.applyPage(page)
    if (this.state.ready) await this.showReady()
  }

  async more() {
    const { run, nextCursor } = this.state
    if (!run || nextCursor === null) return
    const generation = this.generation
    try {
      const page = await this.transport.readPage(run.id, { state: 'review', cursor: nextCursor })
      if (generation !== this.generation) return
      const seen = new Set(this.state.exceptions.map((row) => row.id))
      this.set({
        run: page.run,
        exceptions: [...this.state.exceptions, ...page.rows.filter((row) => !seen.has(row.id))],
        nextCursor: page.nextCursor,
      })
    } catch (error) {
      this.failIfCurrent(error, generation)
    }
  }

  async showReady(more = false) {
    const run = this.state.run
    if (!run) return
    const cursor = more ? this.state.ready?.nextCursor : undefined
    if (more && (cursor === null || cursor === undefined)) return
    const generation = this.generation
    try {
      const page = await this.transport.readPage(run.id, {
        state: 'ready',
        cursor: cursor ?? undefined,
      })
      if (generation !== this.generation) return
      const rows = more ? [...(this.state.ready?.rows ?? []), ...page.rows] : page.rows
      this.set({ ready: { rows, nextCursor: page.nextCursor } })
    } catch (error) {
      this.failIfCurrent(error, generation)
    }
  }

  hideReady() {
    this.set({ ready: null })
  }

  async answerGroup(group: HistoryGroup, answer: string | boolean | null) {
    const run = this.state.run
    if (!run || this.state.busy.has(group.group)) return
    const generation = this.generation
    this.setBusy(group.group, true)
    this.set({ failure: null })
    try {
      await this.transport.answerGroup(run.id, {
        group: group.group,
        answer,
        revision: run.revision,
      })
      if (generation !== this.generation) return
      this.set({
        settled: [
          ...this.state.settled,
          { group: group.group, token: group.token, answer, rows: group.rows },
        ],
      })
      await this.refresh(generation)
    } catch (error) {
      await this.recover(error, generation)
    } finally {
      if (generation === this.generation) this.setBusy(group.group, false)
    }
  }

  async patchRow(row: HistoryRowView, change: { answers?: HistoryRowAnswers; ignore?: boolean }) {
    const run = this.state.run
    if (!run || this.state.busy.has(row.id)) return
    const generation = this.generation
    this.setBusy(row.id, true)
    this.set({ failure: null })
    try {
      await this.transport.patchRow(run.id, row.id, { version: row.version, ...change })
      if (generation !== this.generation) return
      await this.refresh(generation)
    } catch (error) {
      await this.recover(error, generation)
    } finally {
      if (generation === this.generation) this.setBusy(row.id, false)
    }
  }

  async save() {
    const run = this.state.run
    if (!run || this.state.saving || this.state.busy.size) return
    const total = run.totals.states.ready
    const generation = this.generation
    this.cancelStamps()
    this.set({ saving: { done: 0, total }, failure: null, ready: null, stamps: null })
    let done = 0
    if (this.stampLedger?.runId !== run.id)
      this.stampLedger = {
        runId: run.id,
        baseline: this.transport.pressedCountries().catch(() => null),
        touched: new Set(),
        created: 0,
      }
    const ledger = this.stampLedger
    try {
      for (;;) {
        const page = await this.transport.readPage(run.id, { state: 'ready', limit: 50 })
        if (generation !== this.generation) return
        if (!page.rows.length) break
        await ledger.baseline
        if (generation !== this.generation) return
        const response = await this.transport.confirm(
          run.id,
          page.rows.map((row) => ({
            rowId: row.id,
            version: row.version,
            key: historyConfirmKey(row),
          })),
        )
        if (generation !== this.generation) return
        const progressed = response.results.filter((result) => result.status !== 'error').length
        const byId = new Map(page.rows.map((row) => [row.id, row]))
        for (const result of response.results) {
          if (result.status !== 'created') continue
          ledger.created += 1
          const projection = byId.get(result.rowId)?.projection
          if (projection?.origin && projection.destination)
            for (const code of routeCountries(projection.origin, projection.destination))
              ledger.touched.add(code)
        }
        done += progressed
        this.set({
          run: { ...response.run, groups: this.state.run?.groups ?? [] },
          saving: { done, total },
          ...(response.derived_state
            ? { ack: { derived_state: response.derived_state, revision: response.revision ?? 0 } }
            : {}),
        })
        if (!progressed) break
      }
      this.set({ saving: null })
      await this.refresh(generation)
      const before = await ledger.baseline
      if (ledger.created > 0 && before && generation === this.generation)
        void this.followStamps(generation, before, ledger.touched)
    } catch (error) {
      if (generation !== this.generation) return
      this.set({ saving: null })
      await this.recover(error, generation)
    }
  }

  private async followStamps(generation: number, before: Set<string>, touched: Set<string>) {
    const ack = this.state.ack
    const controller = new AbortController()
    this.stampsWait = controller
    const authGeneration = getAuthGeneration()
    const current = () =>
      !controller.signal.aborted &&
      generation === this.generation &&
      authGeneration === getAuthGeneration()
    this.set({ stamps: { status: 'pending', codes: [] } })
    let published: 'ready' | 'delayed' | 'stale' = 'delayed'
    if (ack?.derived_state === 'ready') published = 'ready'
    else if (ack?.derived_state === 'pending' && typeof ack.revision === 'number')
      published = await this.transport.awaitPublication(ack.revision, controller.signal, current)
    if (!current() || published === 'stale') return
    if (published === 'delayed') return this.set({ stamps: { status: 'delayed', codes: [] } })
    const after = await this.transport.pressedCountries(controller.signal).catch(() => null)
    if (!current()) return
    this.stampsWait = null
    this.set({
      stamps: { status: 'ready', codes: after ? newlyPressed(before, after, touched) : [] },
    })
  }

  async discard() {
    const run = this.state.run
    if (!run) return
    const generation = this.generation
    try {
      await this.transport.discard(run.id)
      if (generation === this.generation) this.forget()
    } catch (error) {
      this.failIfCurrent(error, generation)
    }
  }

  async eraseSource() {
    const run = this.state.run
    if (!run) return
    const generation = this.generation
    try {
      await this.transport.erase(run.id)
      await this.refresh(generation)
    } catch (error) {
      this.failIfCurrent(error, generation)
    }
  }

  forget() {
    this.generation += 1
    this.cancelStamps()
    this.stampLedger = null
    this.chunks = null
    this.creating = null
    this.retain(null)
    this.set(INITIAL)
  }
}
