// One Flighty CSV import in the browser (ADR 0008). The file is parsed here, sent in digest-checked chunks, and from
// then on the server run is the only authority: a refresh restores from it. Browser storage holds the run id, the
// operation id and the manifest digest, never cells or the file. Confirmation walks the ready rows in pages of 50 with
// keys derived from row id and version, so a retry after a lost answer replays instead of writing twice.
import { ApiError } from '@kuuki/client/apiClient'
import type { DerivedAck } from '@kuuki/client/derivedState'
import type {
  HistoryCreateBody,
  HistoryGroup,
  HistoryPage,
  HistoryRowAnswers,
  HistoryRowView,
  HistoryRunSummary,
} from '@kuuki/shared/flightyHistory'
import {
  answerHistoryGroup,
  confirmHistoryRows,
  createHistoryRun,
  discardHistoryRun,
  eraseHistorySource,
  patchHistoryRow,
  putHistoryChunk,
  readHistoryPage,
} from './history-api'

export type HistoryFailure =
  /** The file is not a readable Flighty export; `code` is the parser's structural reason. */
  | { kind: 'file'; code: string; line?: number; header?: string }
  /** The re-chosen file is not the one this import started from. */
  | { kind: 'different_file' }
  | { kind: 'too_large' }
  | { kind: 'run_limit' }
  | { kind: 'closed' }
  /** Someone (another tab) decided first; the summary was re-read. */
  | { kind: 'stale' }
  | { kind: 'offline' }
  | { kind: 'server' }

export interface HistoryState {
  /** Local reading of a chosen file. */
  reading: boolean
  fileName: string | null
  run: HistoryRunSummary | null
  /** Chunks sent in this tab / chunks the run expects. */
  upload: { sent: number; total: number } | null
  /** Rows that need an answer or cannot be read, in file order, as far as they were paged in. */
  exceptions: HistoryRowView[]
  nextCursor: number | null
  /** Records ready to save, paged in only when the owner asks to look through them. */
  ready: { rows: HistoryRowView[]; nextCursor: number | null } | null
  /** Ready rows confirmed in this save / ready rows when it started. */
  saving: { done: number; total: number } | null
  /** Row and group ids with a write in flight. */
  busy: ReadonlySet<string>
  failure: HistoryFailure | null
  /** Last derived-state acknowledgement of a confirm, for the totals publication follow-up. */
  ack: DerivedAck | null
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
}

type Chunk = { index: number; body: { records: Array<[number, number, string[]]> } }

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

/** A CSV goes to the history import; the content (the parser) decides whether it is a Flighty export. */
export const isHistoryCsv = (file: { name: string; type: string }) =>
  file.type === 'text/csv' || /\.csv$/i.test(file.name)

/** Deterministic per row version: a lost answer is retried with the same key and the server replays it. */
export const historyConfirmKey = (row: { id: string; version: number }) =>
  `h-${row.id}-v${row.version}`

export class HistorySession {
  private state: HistoryState = INITIAL
  private listeners = new Set<() => void>()
  /** The parsed file of this tab, for sending (or re-sending) chunks. Never stored. */
  private chunks: Chunk[] | null = null
  /** A run creation whose answer may have been lost: retried with the same operation id. */
  private creating: HistoryCreateBody | null = null
  private generation = 0

  /** The tab's controller for one owner: sessionStorage keeps only the run id, operation id and manifest digest. */
  static forOwner(ownerId: string, transport?: HistoryTransport) {
    const key = `kuuki-history-import:${ownerId}`
    return new HistorySession(
      (record) => {
        try {
          if (record) sessionStorage.setItem(key, JSON.stringify(record))
          else sessionStorage.removeItem(key)
        } catch {
          /* The server run remains the authority. */
        }
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

  private set(patch: Partial<HistoryState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private fail(error: unknown) {
    this.set({ failure: classifyHistoryError(error), reading: false, saving: null })
  }

  private setBusy(id: string, on: boolean) {
    const busy = new Set(this.state.busy)
    if (on) busy.add(id)
    else busy.delete(id)
    this.set({ busy })
  }

  /** Read a chosen file here, then create (or resume) its run and send what the server still lacks. */
  async choose(file: File) {
    const generation = ++this.generation
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
      this.chunks = groups.map((records, index) => ({
        index,
        body: { records: records.map((record) => [record.ordinal, record.line, record.cells]) },
      }))
      const prior = this.retained()
      const current = this.state.run
      // Re-choosing the file of a run that still lacks chunks continues it; any other file starts its own run.
      if (current && current.status === 'receiving') {
        if (prior && prior.digest !== digest) {
          this.set({ reading: false, failure: { kind: 'different_file' } })
          return
        }
        this.set({ reading: false })
        await this.send(current)
        return
      }
      const operationId =
        prior && prior.digest === digest && !prior.runId ? prior.operationId : crypto.randomUUID()
      this.retain({ runId: null, operationId, digest })
      this.creating = {
        operationId,
        profile: flighty.FLIGHTY_PROFILE,
        headers: parsed.headers,
        totalRecords: parsed.records.length,
        blankLines: parsed.blankLines,
        chunks: manifest,
      }
      await this.create(generation, digest)
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    }
  }

  private async create(generation: number, digest: string) {
    const body = this.creating!
    const { run } = await this.transport.createRun(body)
    if (generation !== this.generation) return
    this.creating = null
    this.retain({ runId: run.id, operationId: body.operationId, digest })
    this.set({ reading: false, run })
    await this.send(run)
  }

  /** Send the chunks the server lacks, one at a time; an admitted chunk resent after a lost answer inserts nothing. */
  private async send(run: HistoryRunSummary) {
    const chunks = this.chunks
    if (!chunks) return
    const missing = new Set(run.chunks.missing)
    // Every chunk arrived but the run never sealed (the last answer was lost mid-seal): a replay seals it.
    const pending = missing.size
      ? chunks.filter((chunk) => missing.has(chunk.index))
      : run.status === 'receiving'
        ? chunks.slice(-1)
        : []
    this.set({
      upload: { sent: chunks.length - pending.length, total: chunks.length },
      failure: null,
    })
    for (const chunk of pending) {
      const { run: next } = await this.transport.putChunk(run.id, chunk.index, chunk.body)
      this.set({
        run: next,
        upload: {
          sent: Math.min(chunks.length, (this.state.upload?.sent ?? 0) + 1),
          total: chunks.length,
        },
      })
    }
    this.chunks = null
    this.set({ upload: null })
    await this.refresh()
  }

  private applyPage(page: HistoryPage) {
    this.set({ run: page.run, exceptions: page.rows, nextCursor: page.nextCursor })
  }

  /** Show the failure, then the server's current state: a refused write never leaves a stale screen. */
  private async recover(error: unknown) {
    this.fail(error)
    await this.refresh().catch(() => undefined)
  }

  /** Restore an import from the server alone (after a refresh or from the URL). */
  async resume(runId: string) {
    const generation = ++this.generation
    this.set({ ...INITIAL, reading: true })
    try {
      const page = await this.transport.readPage(runId, { state: 'review' })
      if (generation !== this.generation) return
      this.set({ reading: false })
      this.applyPage(page)
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    }
  }

  /** After a failure: repeat a creation whose answer was lost, or re-read the run and send what this tab holds. */
  async retry() {
    const run = this.state.run
    const generation = this.generation
    this.set({ failure: null })
    try {
      if (!run) {
        const prior = this.retained()
        if (this.creating && prior) await this.create(generation, prior.digest)
        return
      }
      const page = await this.transport.readPage(run.id, { state: 'review' })
      this.applyPage(page)
      if (page.run.status === 'receiving' && this.chunks) await this.send(page.run)
    } catch (error) {
      this.fail(error)
    }
  }

  /** Whether this tab still holds the parsed file (a refresh drops it; the owner then chooses it again). */
  holdsFile = () => this.chunks !== null

  /** Re-read the summary and the first page of exceptions; rows the owner already answered drop out. */
  async refresh() {
    const run = this.state.run
    if (!run) return
    this.applyPage(await this.transport.readPage(run.id, { state: 'review' }))
    if (this.state.ready) await this.showReady()
  }

  async more() {
    const { run, nextCursor } = this.state
    if (!run || nextCursor === null) return
    try {
      const page = await this.transport.readPage(run.id, { state: 'review', cursor: nextCursor })
      const seen = new Set(this.state.exceptions.map((row) => row.id))
      this.set({
        run: page.run,
        exceptions: [...this.state.exceptions, ...page.rows.filter((row) => !seen.has(row.id))],
        nextCursor: page.nextCursor,
      })
    } catch (error) {
      this.fail(error)
    }
  }

  /** Page in the records ready to save, so one can be skipped before Save; `more` continues from the cursor. */
  async showReady(more = false) {
    const run = this.state.run
    if (!run) return
    const cursor = more ? this.state.ready?.nextCursor : undefined
    if (more && (cursor === null || cursor === undefined)) return
    try {
      const page = await this.transport.readPage(run.id, {
        state: 'ready',
        cursor: cursor ?? undefined,
      })
      const rows = more ? [...(this.state.ready?.rows ?? []), ...page.rows] : page.rows
      this.set({ ready: { rows, nextCursor: page.nextCursor } })
    } catch (error) {
      this.fail(error)
    }
  }

  hideReady() {
    this.set({ ready: null })
  }

  /** One answer for every open row of a group, at the revision the owner saw. */
  async answerGroup(group: HistoryGroup, answer: string | boolean | null) {
    const run = this.state.run
    if (!run || this.state.busy.has(group.group)) return
    this.setBusy(group.group, true)
    this.set({ failure: null })
    try {
      await this.transport.answerGroup(run.id, {
        group: group.group,
        answer,
        revision: run.revision,
      })
      await this.refresh()
    } catch (error) {
      await this.recover(error)
    } finally {
      this.setBusy(group.group, false)
    }
  }

  /** Answer or skip one record. Other rows and their answers are untouched. */
  async patchRow(row: HistoryRowView, change: { answers?: HistoryRowAnswers; ignore?: boolean }) {
    const run = this.state.run
    if (!run || this.state.busy.has(row.id)) return
    this.setBusy(row.id, true)
    this.set({ failure: null })
    try {
      await this.transport.patchRow(run.id, row.id, { version: row.version, ...change })
      await this.refresh()
    } catch (error) {
      await this.recover(error)
    } finally {
      this.setBusy(row.id, false)
    }
  }

  /**
   * Confirm every ready row in server pages of 50. The owner presses once; the number of requests grows with the
   * file, the number of decisions does not. Stops when a page brings no progress (every item refused).
   */
  async save() {
    const run = this.state.run
    // A pending answer or Skip must land first: confirming ahead of it could save the record being excluded.
    if (!run || this.state.saving || this.state.busy.size) return
    const total = run.totals.states.ready
    this.set({ saving: { done: 0, total }, failure: null, ready: null })
    let done = 0
    try {
      for (;;) {
        const page = await this.transport.readPage(run.id, { state: 'ready', limit: 50 })
        if (!page.rows.length) break
        const response = await this.transport.confirm(
          run.id,
          page.rows.map((row) => ({
            rowId: row.id,
            version: row.version,
            key: historyConfirmKey(row),
          })),
        )
        const progressed = response.results.filter((result) => result.status !== 'error').length
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
      await this.refresh()
    } catch (error) {
      this.set({ saving: null })
      await this.recover(error)
    }
  }

  async discard() {
    const run = this.state.run
    if (!run) return
    try {
      await this.transport.discard(run.id)
      this.forget()
    } catch (error) {
      this.fail(error)
    }
  }

  async eraseSource() {
    const run = this.state.run
    if (!run) return
    try {
      await this.transport.erase(run.id)
      await this.refresh()
    } catch (error) {
      this.fail(error)
    }
  }

  /** Leave the import: the run stays on the server until it completes or expires. */
  forget() {
    this.generation += 1
    this.chunks = null
    this.creating = null
    this.retain(null)
    this.set(INITIAL)
  }
}
