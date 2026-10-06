import { describe, expect, it, vi } from 'vitest'
import { connectEvents, decideEvent, parseFrames, toImportEvent } from './import-events'
import { watchBatch } from './batch-watcher'
import type { ImportEvent, Snapshot } from './import-types'

const ev = (over: Partial<ImportEvent>): ImportEvent => ({ name: 'rows', sequence: 1, rowIds: [], snapshot: false, reupload: false, ...over })

describe('SSE frames', () => {
  it('splits frames across chunk boundaries and ignores comments', () => {
    const first = parseFrames(': connected\n\nid: 2\nevent: rows\ndata: {"sequence":2,"rowI')
    expect(first.frames).toEqual([])
    const second = parseFrames(first.rest + 'ds":["a"]}\n\n: keepalive\n\nevent: snapshot\ndata: {"sequence":5,"rowIds":[],"snapshot":true,"reupload":true}\n\n')
    expect(second.frames.map(frame => toImportEvent(frame))).toEqual([
      { name: 'rows', sequence: 2, rowIds: ['a'], snapshot: false, reupload: false },
      { name: 'snapshot', sequence: 5, rowIds: [], snapshot: true, reupload: true },
    ])
    expect(second.rest).toBe('')
  })
  it('tolerates an unknown event name, malformed data and the terminal end event', () => {
    expect(toImportEvent({ event: 'future', data: '{"sequence":9}' })).toMatchObject({ name: 'future', sequence: 9, snapshot: false })
    expect(toImportEvent({ event: 'rows', data: '{nope' })).toBeNull()
    expect(toImportEvent({ event: 'end', data: '{"sequence":7,"status":"review"}' })).toMatchObject({ name: 'end', sequence: 7, status: 'review' })
    expect(toImportEvent({ event: 'rows', data: '{"sequence":"x"}' })).toBeNull()
  })
  it('handles CRLF framing', () => {
    expect(parseFrames('event: rows\r\ndata: {"sequence":1}\r\n\r\n').frames).toHaveLength(1)
  })
})

describe('event decisions against the known sequence', () => {
  it('ignores a repeated or older notification', () => {
    expect(decideEvent(5, ev({ sequence: 5 }))).toBe('ignore')
    expect(decideEvent(5, ev({ sequence: 3 }))).toBe('ignore')
  })
  it('reloads for the next sequence, a gap and any snapshot instruction', () => {
    expect(decideEvent(5, ev({ sequence: 6 }))).toBe('reload')
    expect(decideEvent(5, ev({ sequence: 9 }))).toBe('reload')
    expect(decideEvent(5, ev({ sequence: 2, snapshot: true }))).toBe('reload')
  })
  it('stops on the terminal event and ignores unknown names without a sequence', () => {
    expect(decideEvent(5, ev({ name: 'end', sequence: 7 }))).toBe('end')
    expect(decideEvent(5, ev({ name: 'future', sequence: 0 }))).toBe('ignore')
  })
})

const snap = (sequence: number, status: Snapshot['batch']['status'] = 'processing'): Snapshot => ({
  batch: { id: 'b', sourceType: 'text', sourceLabel: null, status, stage: 'recognizing', sequence, errorCode: null, retryAfter: null, createdAt: '', updatedAt: '', expiresAt: '', expired: false },
  drafts: [],
})

function harness(snapshots: Snapshot[]) {
  const seen: Snapshot[] = []
  const reload = vi.fn(async () => { const next = snapshots.shift() ?? snap(99, 'review'); seen.push(next); return next })
  const sleeps: number[] = []
  const sleep = vi.fn(async (ms: number) => { sleeps.push(ms) })
  return { seen, reload, sleep, sleeps }
}

describe('watchBatch', () => {
  it('loads the snapshot, subscribes after its sequence and reloads once per new notification', async () => {
    const h = harness([snap(1), snap(3), snap(4, 'review')])
    const afters: number[] = []
    const connect = vi.fn(async (after: number, onEvent: (event: ImportEvent) => void) => {
      afters.push(after)
      onEvent(ev({ sequence: 2 })); onEvent(ev({ sequence: 3 })); onEvent(ev({ sequence: 3 }))
      onEvent(ev({ name: 'end', sequence: 4, status: 'review' }))
    })
    await watchBatch({ load: h.reload, connect, sleep: h.sleep, onSnapshot: () => {}, signal: new AbortController().signal })
    expect(afters).toEqual([1])
    expect(h.seen.map(s => s.batch.sequence)).toEqual([1, 3, 4])
    expect(h.sleeps).toEqual([])
  })

  it('does not subscribe when the batch is no longer processing (resume of a finished batch)', async () => {
    const h = harness([snap(8, 'review')])
    const connect = vi.fn()
    await watchBatch({ load: h.reload, connect, sleep: h.sleep, onSnapshot: () => {}, signal: new AbortController().signal })
    expect(connect).not.toHaveBeenCalled()
  })

  it('reconnects with a bounded backoff after a server close without end, re-reading the snapshot each time', async () => {
    const h = harness([snap(1), snap(1), snap(1), snap(1), snap(1), snap(1), snap(1), snap(1), snap(1), snap(1, 'review')])
    let calls = 0
    const connect = vi.fn(async () => { calls++; if (calls % 2 === 0) throw Object.assign(new Error('boom'), { status: 502 }) })
    await watchBatch({ load: h.reload, connect, sleep: h.sleep, onSnapshot: () => {}, signal: new AbortController().signal })
    expect(h.sleeps.length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...h.sleeps)).toBeLessThanOrEqual(15_000)
    expect(h.sleeps.slice(0, 3)).toEqual([1000, 2000, 4000])
    expect(calls).toBeGreaterThan(3)
  })

  it('resets the backoff when events arrive', async () => {
    const h = harness([snap(1), snap(2), snap(2), snap(3, 'review')])
    let calls = 0
    const connect = vi.fn(async (_after: number, onEvent: (e: ImportEvent) => void) => { calls++; if (calls === 1) onEvent(ev({ sequence: 2 })) })
    await watchBatch({ load: h.reload, connect, sleep: h.sleep, onSnapshot: () => {}, signal: new AbortController().signal })
    expect(h.sleeps[0]).toBe(1000)
  })

  it('stops when aborted and never calls back afterwards', async () => {
    const controller = new AbortController()
    const h = harness([snap(1)])
    const onSnapshot = vi.fn()
    const connect = vi.fn(async () => { controller.abort() })
    await watchBatch({ load: h.reload, connect, sleep: h.sleep, onSnapshot, signal: controller.signal })
    expect(onSnapshot).toHaveBeenCalledTimes(1)
    expect(h.reload).toHaveBeenCalledTimes(1)
  })

  it('a reupload instruction is reported with the reloaded snapshot', async () => {
    const h = harness([snap(1), snap(2, 'partial')])
    const flags: boolean[] = []
    const connect = vi.fn(async (_a: number, onEvent: (e: ImportEvent) => void) => onEvent(ev({ sequence: 2, snapshot: true, reupload: true })))
    await watchBatch({ load: h.reload, connect, sleep: h.sleep, onSnapshot: (_s, info) => flags.push(info.reupload), signal: new AbortController().signal })
    expect(flags).toEqual([false, true])
  })
})

describe('terminal end and the final snapshot (ADR 0001 section 9)', () => {
  it.each(['review', 'partial', 'failed', 'cancelled', 'completed'])('end with status %s followed by a failed final read opens exactly one connection', async status => {
    let loads = 0
    const load = vi.fn(async () => { loads++; if (loads === 1) return snap(1); if (loads === 2) throw Object.assign(new Error('offline'), { status: 502 }); return snap(4, status as Snapshot['batch']['status']) })
    const connect = vi.fn(async (_after: number, onEvent: (event: ImportEvent) => void) => { onEvent(ev({ name: 'end', sequence: 4, status })) })
    const seen: string[] = []
    await watchBatch({ load, connect, sleep: async () => {}, onSnapshot: next => seen.push(next.batch.status), signal: new AbortController().signal })
    expect(connect).toHaveBeenCalledTimes(1)
    expect(loads).toBe(3) // initial, the failed final read, then the independent retry
    expect(seen.at(-1)).toBe(status)
  })

  it('gives up with the read error when the final snapshot never arrives, still without a second connection', async () => {
    let loads = 0
    const load = vi.fn(async () => { loads++; if (loads === 1) return snap(1); throw Object.assign(new Error('offline'), { status: 502 }) })
    const connect = vi.fn(async (_after: number, onEvent: (event: ImportEvent) => void) => { onEvent(ev({ name: 'end', sequence: 4, status: 'review' })) })
    await expect(watchBatch({ load, connect, sleep: async () => {}, onSnapshot: () => {}, signal: new AbortController().signal })).rejects.toMatchObject({ status: 502 })
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('end with status processing reads the snapshot and reconnects from its sequence', async () => {
    const h = harness([snap(1), snap(7), snap(7), snap(9, 'review')])
    const afters: number[] = []
    let calls = 0
    const connect = vi.fn(async (after: number, onEvent: (event: ImportEvent) => void) => {
      afters.push(after)
      calls++
      if (calls === 1) onEvent(ev({ name: 'end', sequence: 7, status: 'processing' }))
      else onEvent(ev({ name: 'end', sequence: 9, status: 'review' }))
    })
    await watchBatch({ load: h.reload, connect, sleep: h.sleep, onSnapshot: () => {}, signal: new AbortController().signal })
    expect(afters).toEqual([1, 7])
  })

  it('a deleted batch ends the watch with the fatal read error and never reconnects', async () => {
    let loads = 0
    const load = vi.fn(async () => { loads++; if (loads === 1) return snap(1); throw Object.assign(new Error('gone'), { status: 404 }) })
    const connect = vi.fn(async (_after: number, onEvent: (event: ImportEvent) => void) => { onEvent(ev({ name: 'end', sequence: 2, status: 'deleted' })) })
    await expect(watchBatch({ load, connect, sleep: async () => {}, onSnapshot: () => {}, signal: new AbortController().signal })).rejects.toMatchObject({ status: 404 })
    expect(connect).toHaveBeenCalledTimes(1)
  })
})

describe('connectEvents', () => {
  const stream = (chunks: string[], closes: boolean) => {
    const encoder = new TextEncoder()
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); if (closes) controller.close() },
      cancel() { cancelled = true },
    })
    return { body, wasCancelled: () => cancelled }
  }
  it('treats end as the end of the connection even when the server keeps the stream open', async () => {
    const open = stream([': connected\n\nevent: end\ndata: {"sequence":3,"status":"review"}\n\n'], false)
    const events: ImportEvent[] = []
    const fetchImpl = (async () => new Response(open.body, { status: 200 })) as typeof fetch
    await connectEvents('b1', 0, event => events.push(event), new AbortController().signal, fetchImpl)
    expect(events.map(event => event.name)).toEqual(['end'])
    expect(open.wasCancelled()).toBe(true)
  })
})
