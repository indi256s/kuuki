// Version-checked persistence of review edits. Unsent text never leaves memory (no browser storage): a failed PATCH
// keeps the change here, the form keeps showing it, and the member can retry, re-apply after a conflict or discard.
// Edits to one draft are serialised so each request carries the version the previous one returned.
import { classifyRequestFailure, type Failure } from './import-errors'
import type { Draft, DraftPatchBody } from './import-types'

export interface DraftChange {
  fields?: Record<string, string | null>
  selected?: boolean
  yearConfirmed?: boolean
  flownConfirmed?: boolean
  duplicateAcknowledged?: boolean
  dismissed?: boolean
}
export interface SaveState {
  status: 'saving' | 'error' | 'conflict'
  unsent: DraftChange
  failure: Failure | null
  /** The server refused the value itself (4xx other than a version conflict): retrying the same text cannot help. */
  rejected: boolean
}

interface Entry {
  unsent: DraftChange | null
  status: SaveState['status'] | 'idle'
  failure: Failure | null
  rejected: boolean
  running: Promise<void> | null
  flight: DraftChange | null
}

interface Deps {
  patch: (id: string, body: DraftPatchBody) => Promise<Draft>
  onDraft: (draft: Draft) => void
  onState: (id: string, state: SaveState | null) => void
}

const merge = (a: DraftChange | null, b: DraftChange | null): DraftChange | null => {
  if (!a || !b) return a ?? b
  const fields = a.fields || b.fields ? { ...a.fields, ...b.fields } : undefined
  return { ...a, ...b, ...(fields ? { fields } : {}) }
}

export class DraftSaver {
  private entries = new Map<string, Entry>()
  private versions = new Map<string, number>()
  private disposed = false
  constructor(private deps: Deps) {}

  private entry(id: string): Entry {
    let entry = this.entries.get(id)
    if (!entry) {
      entry = {
        unsent: null,
        status: 'idle',
        failure: null,
        rejected: false,
        running: null,
        flight: null,
      }
      this.entries.set(id, entry)
    }
    return entry
  }

  private publish(id: string, entry: Entry) {
    if (this.disposed) return
    const change = merge(entry.flight, entry.unsent)
    if (entry.status === 'idle' || !change) {
      this.deps.onState(id, null)
      return
    }
    this.deps.onState(id, {
      status: entry.status,
      unsent: change,
      failure: entry.failure,
      rejected: entry.rejected,
    })
  }

  /** Queue a change. Resolves when this draft has nothing in flight (saved, or parked in an error/conflict state). */
  save(current: Draft, change: DraftChange): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const entry = this.entry(current.id)
    this.versions.set(current.id, Math.max(this.versions.get(current.id) ?? 0, current.version))
    entry.unsent = merge(entry.unsent, change)
    if (entry.status === 'error' || entry.status === 'conflict') {
      entry.status = 'idle'
      entry.failure = null
      entry.rejected = false
    }
    return entry.running ?? this.run(current.id, entry)
  }

  retry(id: string): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const entry = this.entries.get(id)
    if (!entry) return Promise.resolve()
    if (entry.running) return entry.running
    entry.status = 'idle'
    entry.failure = null
    entry.rejected = false
    return this.run(id, entry)
  }

  discard(id: string) {
    const entry = this.entries.get(id)
    if (!entry || entry.running) return
    entry.unsent = null
    entry.status = 'idle'
    entry.failure = null
    entry.rejected = false
    this.publish(id, entry)
  }

  /**
   * The batch this saver belonged to is gone (discarded, cancelled, replaced). Parked and queued edits are dropped and
   * a request still in flight can no longer report a draft or a state, so nothing leaks into the next import.
   */
  dispose() {
    this.disposed = true
    this.entries.clear()
    this.versions.clear()
  }

  hasUnsaved() {
    return this.unsentIds().length > 0
  }
  unsentIds() {
    return [...this.entries]
      .filter(([, e]) => e.status !== 'idle' || e.unsent || e.flight)
      .map(([id]) => id)
  }

  private run(id: string, entry: Entry): Promise<void> {
    entry.running = (async () => {
      while (entry.unsent && entry.status === 'idle' && !this.disposed) {
        entry.flight = entry.unsent
        entry.unsent = null
        entry.status = 'saving'
        this.publish(id, entry)
        const body: DraftPatchBody = { version: this.versions.get(id) ?? 1, ...entry.flight }
        try {
          const saved = await this.deps.patch(id, body)
          if (this.disposed) return
          this.versions.set(id, saved.version)
          entry.flight = null
          entry.status = 'idle'
          this.deps.onDraft(saved)
        } catch (error) {
          if (this.disposed) return
          const shaped = error as { status?: number; code?: string; body?: { draft?: Draft } }
          entry.unsent = merge(entry.flight, entry.unsent)
          entry.flight = null
          if (
            shaped.status === 409 &&
            shaped.code === 'DRAFT_VERSION_CONFLICT' &&
            shaped.body?.draft
          ) {
            this.versions.set(id, shaped.body.draft.version)
            this.deps.onDraft(shaped.body.draft)
            entry.status = 'conflict'
          } else entry.status = 'error'
          entry.failure = classifyRequestFailure(error)
          entry.rejected =
            typeof shaped.status === 'number' &&
            shaped.status >= 400 &&
            shaped.status < 500 &&
            shaped.status !== 409 &&
            shaped.status !== 429 &&
            entry.status === 'error'
        }
      }
      this.publish(id, entry)
    })().finally(() => {
      entry.running = null
    })
    return entry.running
  }
}
