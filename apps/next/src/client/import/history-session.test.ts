import { expect, it, vi } from 'vitest'
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
import { routeCountries } from './flight-input'
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
    pressedCountries: async () => new Set<string>(),
    awaitPublication: async () => 'ready',
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

/** The server acknowledges a confirm as already published; stamps wait only on a pending acknowledgement. */
function pendingConfirms(transport: HistoryTransport) {
  const confirm = transport.confirm
  transport.confirm = async (runId, items) => ({
    ...(await confirm(runId, items)),
    derived_state: 'pending',
    revision: 7,
  })
}

it(
  'widens the years of the sent chunks as each chunk lands, and clears them when the upload ends',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const seen: Array<{ sent: number; years: { from: number; to: number } | null }> = []
      const session = new HistorySession(
        () => {},
        () => null,
        transportFor(db),
      )
      session.subscribe(() => {
        const upload = session.getState().upload
        if (upload) seen.push({ sent: upload.sent, years: upload.years })
      })
      // 150 records span two chunks, all in 2020.
      await session.choose(fileOf(cleanCsv(150, Date.UTC(2020, 6, 1))))
      expect(seen[0]).toEqual({ sent: 0, years: null })
      expect(seen.at(-1)).toEqual({ sent: 2, years: { from: 2020, to: 2020 } })
      expect(seen.some((entry) => entry.sent === 1 && entry.years?.from === 2020)).toBe(true)
      expect(session.getState().upload).toBeNull()

      const wide = new HistorySession(
        () => {},
        () => null,
        transportFor(db),
      )
      const spans: Array<{ from: number; to: number } | null> = []
      wide.subscribe(() => spans.push(wide.getState().upload?.years ?? null))
      await wide.choose(fileOf(cleanCsv(150, Date.UTC(2019, 11, 1))))
      const last = spans.filter(Boolean).at(-1)
      expect(last).toEqual({ from: 2019, to: 2020 })
    } finally {
      await dispose()
    }
  },
)

it('settles a group answer only when it succeeds', { timeout: 60_000 }, async () => {
  const { db, dispose } = await historyAccount()
  try {
    const transport = transportFor(db)
    const answer = transport.answerGroup
    let refuse = true
    transport.answerGroup = async (runId, body) => {
      if (refuse) throw new TypeError('Failed to fetch')
      return answer(runId, body)
    }
    const session = new HistorySession(
      () => {},
      () => null,
      transport,
    )
    await session.choose(fileOf(fixtureCsv()))
    const group = session.getState().run!.groups.find((item) => item.group === 'airline:THA')!
    await session.answerGroup(group, 'TG')
    expect(session.getState().settled).toEqual([])
    refuse = false
    await session.answerGroup(group, 'TG')
    expect(session.getState().settled).toEqual([
      { group: 'airline:THA', token: group.token, answer: 'TG', rows: group.rows },
    ])
    session.forget()
    expect(session.getState().settled).toEqual([])
  } finally {
    await dispose()
  }
})

it(
  'presses new stamps after the publication: pending, then the countries this save created',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const transport = transportFor(db)
      pendingConfirms(transport)
      const reads: number[] = []
      // The passport already holds GB; after the save it also holds the route countries and one the save never touched.
      let routeCodes: string[] = []
      transport.pressedCountries = async () => {
        reads.push(reads.length)
        return new Set(reads.length === 1 ? ['GB'] : ['GB', 'XX', ...routeCodes])
      }
      let release: () => void = () => {}
      transport.awaitPublication = () =>
        new Promise((resolve) => {
          release = () => resolve('ready')
        })
      const session = new HistorySession(
        () => {},
        () => null,
        transport,
      )
      await session.choose(fileOf(cleanCsv(2)))
      const rows = (await getPage(db, session.getState().run!.id, { state: 'ready' })).body.rows
      const touched = new Set(
        rows.flatMap((row) =>
          routeCountries(row.projection.origin ?? '', row.projection.destination ?? ''),
        ),
      )
      routeCodes = [...touched]
      expect(touched.has('US')).toBe(true)
      await session.save()
      // Derived state of the confirm was not ready: the stamps wait for the publication, then read once more.
      expect(session.getState().stamps).toEqual({ status: 'pending', codes: [] })
      expect(reads).toEqual([0])
      release()
      await vi.waitFor(() => expect(session.getState().stamps?.status).toBe('ready'))
      expect(session.getState().stamps?.codes).toEqual(
        [...touched].filter((code) => code !== 'GB').sort(),
      )
      expect(reads).toEqual([0, 1])
    } finally {
      await dispose()
    }
  },
)

it(
  'keeps the stamps of a save that failed half-way: the retry compares with the passport before the first confirm',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const transport = transportFor(db)
      const confirm = transport.confirm
      let confirms = 0
      transport.confirm = async (runId, items) => {
        confirms += 1
        if (confirms === 2) throw new TypeError('Failed to fetch')
        return confirm(runId, items)
      }
      // The passport holds GB before the run; every later read also holds what the saves created.
      let reads = 0
      let routeCodes: string[] = []
      transport.pressedCountries = async () =>
        (reads += 1) === 1 ? new Set(['GB']) : new Set(['GB', ...routeCodes])
      const session = new HistorySession(
        () => {},
        () => null,
        transport,
      )
      await session.choose(fileOf(cleanCsv(120)))
      const [row] = (await getPage(db, session.getState().run!.id, { state: 'ready', limit: 1 }))
        .body.rows
      routeCodes = routeCountries(row.projection.origin ?? '', row.projection.destination ?? '')
      await session.save()
      expect(session.getState().failure).toEqual({ kind: 'offline' })
      await session.save()
      expect(session.getState().run!.status).toBe('completed')
      await vi.waitFor(() => expect(session.getState().stamps?.status).toBe('ready'))
      expect(session.getState().stamps?.codes).toEqual(
        routeCodes.filter((code) => code !== 'GB').sort(),
      )
    } finally {
      await dispose()
    }
  },
)

it(
  'says delayed when the publication does not arrive, and forgetting clears the stamps',
  { timeout: 60_000 },
  async () => {
    const { db, dispose } = await historyAccount()
    try {
      const transport = transportFor(db)
      pendingConfirms(transport)
      transport.awaitPublication = async () => 'delayed'
      const session = new HistorySession(
        () => {},
        () => null,
        transport,
      )
      await session.choose(fileOf(cleanCsv(2)))
      await session.save()
      await vi.waitFor(() =>
        expect(session.getState().stamps).toEqual({ status: 'delayed', codes: [] }),
      )
      session.forget()
      expect(session.getState().stamps).toBeNull()
    } finally {
      await dispose()
    }
  },
)
