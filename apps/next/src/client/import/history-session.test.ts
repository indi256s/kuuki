import { expect, it } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import {
  bawRecord,
  createRun,
  csvOf,
  discardRun,
  eraseSource,
  fixtureCsv,
  getPage,
  historyAccount,
  patchRow,
  postConfirm,
  postGroup,
  putChunk,
  type Reply,
} from '../../../../../functions/test/history-fixture'
import { HistorySession, type HistoryRetained, type HistoryTransport } from './history-session'

// The controller against the real history route handlers on Miniflare D1: transport, recovery and paging are
// checked where they meet the server, not against a mock of it.

const unwrap = <T>(reply: Reply): T => {
  if (reply.status >= 400)
    throw new ApiError(reply.status, String(reply.body.error ?? ''), reply.body.code, reply.body)
  return reply.body as T
}

function transportFor(db: D1Database, calls: string[] = []): HistoryTransport {
  return {
    createRun: async (body) => (calls.push('create'), unwrap(await createRun(db, body))),
    putChunk: async (runId, index, body) => (
      calls.push(`chunk:${index}`),
      unwrap(await putChunk(db, runId, index, body))
    ),
    readPage: async (runId, query = {}) =>
      unwrap(
        await getPage(
          db,
          runId,
          Object.fromEntries(
            Object.entries(query).filter(([, value]) => value !== undefined),
          ) as Record<string, string | number>,
        ),
      ),
    patchRow: async (runId, rowId, body) => unwrap(await patchRow(db, runId, rowId, body)),
    answerGroup: async (runId, body) => unwrap(await postGroup(db, runId, body)),
    confirm: async (runId, items) => (
      calls.push(`confirm:${items.length}`),
      unwrap(await postConfirm(db, runId, items))
    ),
    discard: async (runId) => unwrap(await discardRun(db, runId)),
    erase: async (runId) => unwrap(await eraseSource(db, runId)),
  } as HistoryTransport
}

/** sessionStorage stand-in shared by the sessions of one test, as a tab keeps it across a reload. */
function storage() {
  let value: HistoryRetained | null = null
  const writes: string[] = []
  return {
    retain: (record: HistoryRetained | null) => {
      value = record
      writes.push(JSON.stringify(record))
    },
    read: () => value,
    writes,
  }
}

/** `n` clean, distinct BAW records (one per day), so nothing needs an answer. */
const cleanCsv = (n: number, from = Date.UTC(2024, 0, 1)) =>
  csvOf(
    Array.from({ length: n }, (_, index) => {
      const day = new Date(from + index * 86_400_000).toISOString().slice(0, 10)
      const next = new Date(from + (index + 1) * 86_400_000).toISOString().slice(0, 10)
      return bawRecord({
        Date: day,
        'Gate Departure (Actual)': `${day}T19:00`,
        'Gate Arrival (Actual)': `${next}T07:00`,
        'Flight Flighty ID': `f0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      })
    }),
  )

const fileOf = (text: string, name = 'flighty.csv') => new File([text], name, { type: 'text/csv' })

it(
  'imports the observed fixture: group answers keep an individual answer, one save confirms the rest',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const kept = storage()
      const session = new HistorySession(kept.retain, kept.read, transportFor(db))
      await session.choose(fileOf(fixtureCsv()))
      let state = session.getState()
      expect(state.failure).toBeNull()
      expect(state.run?.status).toBe('review')
      expect(state.run?.totals.received).toBe(11)
      // Browser storage only ever holds ids and the manifest digest.
      for (const write of kept.writes) expect(write).not.toMatch(/PNR|SYN|Notes|BAW|JFK/)

      // The DST fold is a question about this record only: answer it first.
      const fold = state.exceptions.find((row) =>
        row.issues.some((issue) => issue.code === 'AMBIGUOUS_TIME'),
      )!
      const issue = fold.issues.find((item) => item.code === 'AMBIGUOUS_TIME')!
      await session.patchRow(fold, {
        answers: { times: { offsets: { [issue.header!]: issue.offsets![0] } } },
      })
      const empty = session.getState().exceptions.find((row) => row.state === 'error')!
      await session.patchRow(empty, { ignore: true })

      const answers: Record<string, string | boolean | null> = {
        'airline:THA': 'TG',
        'airline:XQZ': null,
        'airport:ZZZ': 'SVO',
        'canceled:': false,
      }
      for (const [group, answer] of Object.entries(answers)) {
        const target = session.getState().run!.groups.find((item) => item.group === group)
        expect(target, group).toBeDefined()
        await session.answerGroup(target!, answer)
        expect(session.getState().failure).toBeNull()
      }
      state = session.getState()
      expect(state.run!.groups).toEqual([])
      expect(state.run!.totals.states.needs_review + state.run!.totals.states.error).toBe(0)
      // The group answers did not reset the individual time answer.
      const settled = await getPage(db, state.run!.id, { state: 'ready', limit: 50 })
      expect(settled.body.rows.find((row) => row.id === fold.id)?.answers.times).toEqual({
        offsets: { [issue.header!]: issue.offsets![0] },
      })

      await session.save()
      state = session.getState()
      expect(state.failure).toBeNull()
      expect(state.run!.status).toBe('completed')
      const states = state.run!.totals.states
      expect(states.ready).toBe(0)
      expect(states.preserved_only).toBe(1)
      expect(states.ignored).toBe(1)
      expect(states.created).toBe(9)
      expect(Object.values(states).reduce((sum, n) => sum + n, 0)).toBe(11)
    } finally {
      await dispose()
    }
  },
)

it(
  'restores an interrupted upload after a reload, refuses a different file and sends only the missing chunk',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const kept = storage()
      const text = cleanCsv(150)
      const failing = transportFor(db)
      const put = failing.putChunk
      failing.putChunk = async (runId, index, body) => {
        if (index === 1) throw new TypeError('Failed to fetch')
        return put(runId, index, body)
      }
      const first = new HistorySession(kept.retain, kept.read, failing)
      await first.choose(fileOf(text))
      expect(first.getState().failure).toEqual({ kind: 'offline' })
      const runId = first.getState().run!.id
      expect(first.getState().run!.status).toBe('receiving')

      // Reload: a new controller with only the retained ids.
      const calls: string[] = []
      const second = new HistorySession(kept.retain, kept.read, transportFor(db, calls))
      await second.resume(runId)
      expect(second.getState().run).toMatchObject({
        status: 'receiving',
        chunks: { total: 2, missing: [1] },
      })
      expect(second.holdsFile()).toBe(false)

      await second.choose(fileOf(cleanCsv(150, Date.UTC(2022, 0, 1))))
      expect(second.getState().failure).toEqual({ kind: 'different_file' })
      expect(calls).toEqual([])

      await second.choose(fileOf(text))
      expect(calls).toEqual(['chunk:1'])
      expect(second.getState().run).toMatchObject({ id: runId, status: 'review' })
      expect(second.getState().run!.totals).toMatchObject({ records: 150, received: 150 })
    } finally {
      await dispose()
    }
  },
)

it(
  'saves unambiguous records with one action in server pages; a confirm whose answer was lost is not written twice',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const kept = storage()
      const calls: string[] = []
      const transport = transportFor(db, calls)
      const confirm = transport.confirm
      let lost = false
      transport.confirm = async (runId, items) => {
        const response = await confirm(runId, items)
        if (!lost) {
          lost = true
          throw new TypeError('Failed to fetch')
        }
        return response
      }
      const session = new HistorySession(kept.retain, kept.read, transport)
      await session.choose(fileOf(cleanCsv(120)))
      expect(session.getState().run!.totals.states.ready).toBe(120)
      expect(session.getState().run!.groups).toEqual([])

      await session.save()
      expect(session.getState().failure).toEqual({ kind: 'offline' })
      await session.save()
      const state = session.getState()
      expect(state.failure).toBeNull()
      expect(state.run).toMatchObject({ status: 'completed' })
      expect(state.run!.totals.states.created).toBe(120)
      // The lost page was committed; the retry reads the ready rows again and never re-sends it.
      expect(calls.filter((call) => call.startsWith('confirm'))).toEqual([
        'confirm:50',
        'confirm:50',
        'confirm:20',
      ])
      const flights = await db
        .prepare(
          'SELECT COUNT(*) AS n FROM flights WHERE user_id = (SELECT user_id FROM history_import_runs LIMIT 1)',
        )
        .first<{ n: number }>()
      expect(flights?.n).toBe(120)
    } finally {
      await dispose()
    }
  },
)

it(
  'retries a run creation whose answer was lost with the same operation, leaving one run',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const kept = storage()
      const transport = transportFor(db)
      const create = transport.createRun
      let lost = false
      transport.createRun = async (body) => {
        const response = await create(body)
        if (!lost) {
          lost = true
          throw new TypeError('Failed to fetch')
        }
        return response
      }
      const session = new HistorySession(kept.retain, kept.read, transport)
      await session.choose(fileOf(cleanCsv(3)))
      expect(session.getState()).toMatchObject({ run: null, failure: { kind: 'offline' } })
      await session.retry()
      expect(session.getState().failure).toBeNull()
      expect(session.getState().run).toMatchObject({ status: 'review', totals: { received: 3 } })
      const runs = await db
        .prepare('SELECT COUNT(*) AS n FROM history_import_runs')
        .first<{ n: number }>()
      expect(runs?.n).toBe(1)
    } finally {
      await dispose()
    }
  },
)

it(
  'skips one clean record before Save without touching the others',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const kept = storage()
      const session = new HistorySession(kept.retain, kept.read, transportFor(db))
      await session.choose(fileOf(cleanCsv(3)))
      await session.showReady()
      const [first] = session.getState().ready!.rows
      await session.patchRow(first, { ignore: true })
      expect(session.getState().ready!.rows.map((row) => row.id)).not.toContain(first.id)
      await session.save()
      expect(session.getState().run!.totals.states).toMatchObject({
        created: 2,
        ignored: 1,
        ready: 0,
      })
    } finally {
      await dispose()
    }
  },
)

it('does not start a save while a Skip is still on its way', async () => {
  const pending: Array<() => void> = []
  const calls: string[] = []
  const row = { id: 'r1', version: 1 } as never
  const transport = {
    patchRow: () => new Promise((resolve) => pending.push(() => resolve(row))),
    readPage: async () => (
      calls.push('read'),
      {
        run: { id: 'run', totals: { states: { ready: 1 } }, groups: [] },
        rows: [],
        nextCursor: null,
      }
    ),
    confirm: async () => (calls.push('confirm'), { results: [], run: {} }),
  } as unknown as HistoryTransport
  const session = new HistorySession(
    () => {},
    () => null,
    transport,
  )
  ;(session as unknown as { state: object }).state = {
    ...session.getState(),
    run: { id: 'run', revision: 1, totals: { states: { ready: 1 } }, groups: [] },
  }
  const skip = session.patchRow(row, { ignore: true })
  await session.save()
  expect(calls).not.toContain('confirm')
  pending.forEach((resolve) => resolve())
  await skip
})
