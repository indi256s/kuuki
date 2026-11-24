import { decideEvent } from './import-events'
import type { ImportEvent, Snapshot } from './import-types'

export interface WatchOptions {
  load: () => Promise<Snapshot>
  connect: (after: number, onEvent: (event: ImportEvent) => void) => Promise<void>
  sleep: (ms: number) => Promise<void>
  onSnapshot: (snapshot: Snapshot, info: { reupload: boolean }) => void
  signal: AbortSignal
}

const MAX_DELAY_MS = 15_000
const FINAL_READ_ATTEMPTS = 5
const FATAL = new Set([401, 403, 404, 410])
const fatal = (error: unknown) => FATAL.has((error as { status?: number } | null)?.status ?? 0)

export async function watchBatch({
  load,
  connect,
  sleep,
  onSnapshot,
  signal,
}: WatchOptions): Promise<void> {
  let snapshot = await load()
  if (signal.aborted) return
  onSnapshot(snapshot, { reupload: false })
  let attempt = 0

  async function readFinal() {
    for (let tries = 0; !signal.aborted && snapshot.batch.status === 'processing'; tries++) {
      try {
        const next = await load()
        if (signal.aborted) return
        snapshot = next
        onSnapshot(next, { reupload: false })
        if (next.batch.status !== 'processing') return
      } catch (error) {
        if (fatal(error) || tries + 1 >= FINAL_READ_ATTEMPTS) throw error
      }
      await sleep(Math.min(1000 * 2 ** tries, MAX_DELAY_MS))
    }
  }

  while (!signal.aborted && snapshot.batch.status === 'processing') {
    let known = snapshot.batch.sequence
    let dirty = false
    let reupload = false
    let progressed = false
    let pumping: Promise<void> | null = null
    let fatalError: unknown = null
    let endStatus: string | null = null

    const pump = () => {
      if (pumping) return
      pumping = (async () => {
        while (dirty && !signal.aborted) {
          dirty = false
          const wasReupload = reupload
          reupload = false
          let next: Snapshot
          try {
            next = await load()
          } catch (error) {
            if (fatal(error)) fatalError = error
            return
          }
          if (signal.aborted) return
          if (
            next.batch.sequence !== snapshot.batch.sequence ||
            next.batch.status !== snapshot.batch.status
          )
            progressed = true
          snapshot = next
          known = Math.max(known, next.batch.sequence)
          onSnapshot(next, { reupload: wasReupload })
        }
      })().finally(() => {
        pumping = null
      })
    }
    const onEvent = (event: ImportEvent) => {
      const decision = decideEvent(known, event)
      if (decision === 'ignore') return
      if (decision === 'end') endStatus = event.status ?? 'processing'
      known = Math.max(known, event.sequence)
      dirty = true
      if (event.reupload) reupload = true
      pump()
    }

    try {
      await connect(known, onEvent)
    } catch (error) {
      if (signal.aborted) return
      if (fatal(error)) throw error
    }
    if (signal.aborted) return
    for (;;) {
      const active: Promise<void> | null = pumping
      if (!active) break
      await active
    }
    if (fatalError) throw fatalError
    if (signal.aborted) return
    if (endStatus !== null && endStatus !== 'processing') await readFinal()
    if (signal.aborted || snapshot.batch.status !== 'processing') return

    attempt = progressed ? 0 : attempt + 1
    await sleep(Math.min(1000 * 2 ** (attempt === 0 ? 0 : attempt - 1), MAX_DELAY_MS))
    if (signal.aborted) return
    try {
      const next = await load()
      if (signal.aborted) return
      snapshot = next
      onSnapshot(next, { reupload: false })
    } catch (error) {
      if (fatal(error)) throw error
    }
  }
}
