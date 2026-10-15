import { beforeEach, expect, it, vi } from 'vitest'
import { draft, snapshot } from './fixtures'
import type { Draft, Snapshot } from './import-types'
import type { BatchApi } from './batch-run'
import type { ImportSource } from './import-api'

const local = vi.hoisted(() => vi.fn())
const patch = vi.hoisted(() => vi.fn())
const confirm = vi.hoisted(() => vi.fn())
vi.mock('./barcode-reader', () => ({ readBoardingPass: local }))
vi.mock('./import-api', async (original) => ({
  ...(await original<typeof import('./import-api')>()),
  patchDraft: patch,
  confirmItems: confirm,
}))
import { UnifiedSession } from './unified-session'

function server() {
  const batches = new Map<string, Snapshot>()
  const jobs: Array<{ source: ImportSource; operationId: string }> = []
  const api: BatchApi = {
    readBatch: vi.fn(async (id) => batches.get(id)!),
    connect: vi.fn(async () => {}),
    sleep: vi.fn(async () => {}),
    submit: vi.fn(async (source: ImportSource, operationId: string) => {
      jobs.push({ source, operationId })
      const id = `b${jobs.length}`
      const rows =
        source.type === 'boarding_pass'
          ? source.legs.map((leg, i) =>
              draft({
                id: `${id}-${i}`,
                fields: {
                  date: '',
                  origin: leg.origin,
                  destination: leg.destination,
                  airline_iata: leg.airline ?? '',
                  flight_number: leg.flightNumber,
                  date_ordinal_day: leg.dayOfYear,
                  flown_required: true,
                },
                selected: false,
                yearExplicit: false,
              }),
            )
          : [
              draft({
                id: `${id}-0`,
                fields: {
                  date: '2026-03-01',
                  origin: 'JFK',
                  destination: 'BOS',
                  airline_iata: 'AA',
                  flown_required: true,
                },
              }),
            ]
      const result = snapshot(rows, { id })
      batches.set(id, result)
      return result
    }),
  }
  patch.mockImplementation(
    async (
      id: string,
      body: {
        version: number
        fields?: object
        flownConfirmed?: boolean
        selected?: boolean
        dismissed?: boolean
      },
    ) => {
      const batch = [...batches.values()].find((batch) =>
        batch.drafts.some((draft) => draft.id === id),
      )!
      const before = batch.drafts.find((draft) => draft.id === id)!
      if (before.version !== body.version) throw new Error('wrong version')
      const after: Draft = {
        ...before,
        version: before.version + 1,
        fields: {
          ...before.fields,
          ...body.fields,
          ...(body.flownConfirmed ? { flown_confirmed: true as const } : {}),
        },
        selected: body.selected ?? before.selected,
        status: body.dismissed ? 'dismissed' : before.status,
      }
      batch.drafts = batch.drafts.map((draft) => (draft.id === id ? after : draft))
      return after
    },
  )
  confirm.mockImplementation(
    async (batchId: string, items: Array<{ draftId: string; version: number }>) => {
      const batch = batches.get(batchId)!
      for (const item of items) {
        const row = batch.drafts.find((draft) => draft.id === item.draftId)!
        if (
          !row ||
          row.version !== item.version ||
          (row.fields.date <= '2026-10-14' &&
            row.fields.flown_required &&
            !row.fields.flown_confirmed)
        )
          throw new Error('invalid confirm')
        row.status = 'converted'
        row.convertedFlightId = 100 + jobs.length
      }
      return {
        results: items.map((item) => ({
          ...item,
          key: `import:${item.draftId}:${item.version}`,
          status: 'created',
          flight: {
            id: 100 + jobs.length,
            aircraft_icao: null,
            origin: 'JFK',
            destination: 'BOS',
            date: '2026-03-01',
          },
        })),
        batch: { id: batchId, status: 'completed', sequence: 2, reviewRowCount: 0 },
      }
    },
  )
  return { api, jobs, batches }
}
const file = (name: string, type = 'image/png') => new File(['fixture'], name, { type })
const done = async (session: UnifiedSession) => {
  await vi.waitFor(() =>
    expect(
      session
        .getEntries()
        .every(
          (entry) => entry.phase === 'ready' || entry.phase === 'failed' || entry.phase === 'empty',
        ),
    ).toBe(true),
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  local.mockResolvedValue({ kind: 'none', reason: 'no-barcode' })
})

it('starts recognition automatically, respects single-job admission, and retains successful results when another file fails and retries', async () => {
  const { api, jobs } = server()
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  local.mockImplementationOnce(async () => {
    await wait
    return { kind: 'none', reason: 'no-barcode' }
  })
  const submit = api.submit
  api.submit = vi.fn(async (source: ImportSource, operationId: string, signal?: AbortSignal) => {
    if (
      source.sourceLabel === 'bad.png' &&
      !jobs.some((job) => job.source.sourceLabel === 'bad.png')
    ) {
      jobs.push({ source, operationId })
      throw new Error('offline')
    }
    return submit(source, operationId, signal)
  })
  const session = new UnifiedSession(api)
  session.add([file('held.png'), file('bad.png'), file('later.png')])
  await vi.waitFor(() => expect(local).toHaveBeenCalledTimes(1))
  expect(session.getEntries().map((entry) => entry.phase)).toEqual(['local', 'queued', 'queued'])
  release()
  await done(session)
  const failed = session.getEntries().find((entry) => entry.label === 'bad.png')!
  const operation = failed.operationId
  expect(session.drafts().filter((row) => row.status === 'review')).toHaveLength(2)
  session.retry(failed)
  await done(session)
  expect(
    jobs.filter((job) => job.source.sourceLabel === 'bad.png').map((job) => job.operationId),
  ).toEqual([operation, operation])
  expect(session.drafts()).toHaveLength(3)
})

it('complements a PDF barcode with its printed year and extra legs, retaining trusted fields and avoiding a second barcode copy', async () => {
  const { api, jobs, batches } = server()
  local.mockResolvedValue({
    kind: 'legs',
    incomplete: false,
    legs: [{ origin: 'JFK', destination: 'BOS', airline: 'AA', flightNumber: '12', dayOfYear: 60 }],
  })
  const submit = api.submit
  api.submit = vi.fn(async (source: ImportSource, operationId: string) => {
    if (source.type === 'boarding_pass') return submit(source, operationId)
    jobs.push({ source, operationId })
    const value = snapshot(
      [
        draft({
          id: 'matched',
          fields: {
            date: '2026-03-01',
            origin: 'JFK',
            destination: 'BOS',
            airline_iata: 'ZZ',
            flight_number: '',
          },
        }),
        draft({
          id: 'extra-page',
          fields: { date: '2027-01-01', origin: 'BOS', destination: 'LAX', airline_iata: 'AA' },
        }),
      ],
      { id: 'pdf-batch' },
    )
    batches.set('pdf-batch', value)
    return value
  })
  const session = new UnifiedSession(api)
  session.add([file('three-pages.pdf', 'application/pdf')])
  await done(session)
  expect(jobs).toHaveLength(2)
  expect(jobs[1].source).toMatchObject({ type: 'pdf', requireFlownConfirmation: true })
  expect(session.drafts().filter((row) => row.status === 'review')).toHaveLength(2)
  expect(session.drafts().filter((row) => row.status === 'dismissed')).toHaveLength(1)
  expect(session.drafts().find((row) => row.id === 'matched')?.fields).toMatchObject({
    date: '2026-03-01',
    airline_iata: 'AA',
    flight_number: '12',
  })
  expect(confirm).not.toHaveBeenCalled()
})

it('retains ordinal evidence when online reading fails, and keeps the file failure actionable for unread PDF pages', async () => {
  const { api } = server()
  const submit = api.submit
  api.submit = vi.fn(async (source: ImportSource, operationId: string, signal?: AbortSignal) =>
    source.type === 'boarding_pass'
      ? submit(source, operationId, signal)
      : snapshot([], { id: 'failed-online', status: 'failed', errorCode: 'PROVIDER_ERROR' }),
  )
  local.mockResolvedValue({
    kind: 'legs',
    incomplete: false,
    legs: [{ origin: 'JFK', destination: 'BOS', airline: 'AA', dayOfYear: 60 }],
  })
  const session = new UnifiedSession(api)
  session.add([file('remaining.pdf', 'application/pdf')])
  await done(session)
  expect(session.getEntries()[0]).toMatchObject({ phase: 'failed', problem: 'partial' })
  expect(session.drafts()[0]).toMatchObject({
    fields: { date: '', date_ordinal_day: 60 },
    yearExplicit: false,
  })
})

it('does not auto-select a complete model row with low overall confidence', async () => {
  const { api } = server()
  const submit = api.submit
  api.submit = vi.fn(async (source: ImportSource, operationId: string, signal?: AbortSignal) => {
    const result = await submit(source, operationId, signal)
    if ('drafts' in result)
      result.drafts = result.drafts.map((row) => ({ ...row, selected: false, confidence: 0.2 }))
    return result
  })
  const session = new UnifiedSession(api)
  session.add([file('unsure.png')])
  await done(session)
  expect(patch).not.toHaveBeenCalled()
  expect(session.drafts().map((row) => row.selected)).toEqual([false])
})

it('resumes all owning batches and uses one explicit save with pinned receipt versions after a lost response', async () => {
  const { api, batches } = server()
  batches.set(
    'past',
    snapshot(
      [
        draft({
          id: 'past-row',
          fields: {
            date: '2026-03-01',
            origin: 'JFK',
            destination: 'BOS',
            airline_iata: 'AA',
            flown_required: true,
          },
        }),
      ],
      { id: 'past' },
    ),
  )
  batches.set(
    'future',
    snapshot(
      [
        draft({
          id: 'future-row',
          fields: {
            date: '2027-03-01',
            origin: 'BOS',
            destination: 'LAX',
            airline_iata: 'AA',
            flown_required: true,
          },
        }),
      ],
      { id: 'future' },
    ),
  )
  const session = new UnifiedSession(api)
  session.resume([
    {
      id: 'session-file',
      label: 'itinerary',
      operationId: 'original',
      batchIds: ['past', 'future'],
    },
  ])
  await done(session)
  expect(confirm).not.toHaveBeenCalled()
  confirm.mockRejectedValueOnce(new Error('lost response'))
  await session.save(['past-row', 'future-row'])
  expect(confirm.mock.calls.map(([id]) => id)).toEqual(['past', 'future'])
  expect(session.getOutcomes().get('past-row')?.status).toBe('uncertain')
  expect(session.getOutcomes().get('future-row')?.status).toBe('saved')
  expect(
    patch.mock.calls.some(([id, body]) => id === 'past-row' && body.flownConfirmed === true),
  ).toBe(true)
  expect(
    patch.mock.calls.some(([id, body]) => id === 'future-row' && body.flownConfirmed === true),
  ).toBe(false)
  const before = confirm.mock.calls[0][1][0]
  await session.save(['past-row'])
  expect(confirm.mock.calls.at(-1)).toEqual(['past', [before]])
  expect(session.getOutcomes().get('past-row')?.status).toBe('saved')
  session.leave()
})

it('resumes online complement from persisted barcode and batch identities without the source file', async () => {
  const { api, batches } = server()
  const submit = api.submit
  api.sleep = async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  api.submit = vi.fn(async (source: ImportSource, operationId: string) => {
    if (source.type === 'boarding_pass') return submit(source, operationId)
    batches.set('online', snapshot([], { id: 'online', status: 'processing' }))
    return { batchId: 'online' }
  })
  local.mockResolvedValue({
    kind: 'legs',
    incomplete: false,
    legs: [{ origin: 'JFK', destination: 'BOS', airline: 'AA', flightNumber: '12', dayOfYear: 60 }],
  })
  const original = new UnifiedSession(api)
  original.add([file('pass.pdf', 'application/pdf')])
  await vi.waitFor(() => expect(original.retained()[0]?.batchIds).toHaveLength(2))
  const records = JSON.parse(JSON.stringify(original.retained()))
  expect(JSON.stringify(records)).not.toContain('Zml4dHVyZQ==')
  original.leave()
  batches.set(
    'online',
    snapshot(
      [
        draft({
          id: 'printed',
          fields: { date: '2026-03-01', origin: 'JFK', destination: 'BOS', airline_iata: 'ZZ' },
        }),
        draft({
          id: 'third-page',
          fields: { date: '2027-01-02', origin: 'BOS', destination: 'LAX', airline_iata: 'AA' },
        }),
      ],
      { id: 'online' },
    ),
  )
  const resumed = new UnifiedSession(api)
  resumed.resume(records)
  await done(resumed)
  expect(
    resumed
      .drafts()
      .filter((row) => row.status === 'review')
      .map((row) => row.id),
  ).toEqual(['printed', 'third-page'])
  expect(resumed.drafts().find((row) => row.id === 'printed')?.fields).toMatchObject({
    date: '2026-03-01',
    airline_iata: 'AA',
    flight_number: '12',
  })
  expect(api.submit).toHaveBeenCalledTimes(2)
  expect(local).toHaveBeenCalledTimes(1)
  resumed.leave()
})

it('gives a changed source with the same filename a new operation while retaining the unknown original', async () => {
  const { api } = server()
  const submit = api.submit
  const attempted: string[] = []
  api.submit = vi.fn(async (source: ImportSource, operationId: string) => {
    attempted.push(operationId)
    if (attempted.length === 1) throw new Error('lost submission')
    return submit(source, operationId)
  })
  const original = new UnifiedSession(api)
  original.add([file('same.png')])
  await done(original)
  const resumed = new UnifiedSession(api)
  resumed.resume(original.retained())
  resumed.add([new File(['changed contents'], 'same.png', { type: 'image/png' })])
  await done(resumed)
  expect(attempted).toHaveLength(2)
  expect(attempted[1]).not.toBe(attempted[0])
  expect(resumed.getEntries().map((entry) => entry.phase)).toEqual(['failed', 'ready'])
  expect(resumed.drafts()).toHaveLength(1)
})

it('retains every candidate when a printed page cannot be matched uniquely to same-route barcode legs', async () => {
  const { api, batches } = server()
  const submit = api.submit
  local.mockResolvedValue({
    kind: 'legs',
    legs: ['12', '34'].map((flightNumber) => ({
      origin: 'JFK',
      destination: 'BOS',
      airline: 'AA',
      flightNumber,
      dayOfYear: 60,
    })),
  })
  api.submit = vi.fn(async (source: ImportSource, operationId: string) => {
    if (source.type === 'boarding_pass') return submit(source, operationId)
    const value = snapshot(
      [
        draft({
          id: 'ambiguous-page',
          fields: { date: '2026-03-01', origin: 'JFK', destination: 'BOS', airline_iata: 'AA' },
        }),
      ],
      { id: 'ambiguous' },
    )
    batches.set('ambiguous', value)
    return value
  })
  const session = new UnifiedSession(api)
  session.add([file('same-route.pdf', 'application/pdf')])
  await done(session)
  expect(session.drafts().filter((row) => row.status === 'review')).toHaveLength(3)
  expect(patch.mock.calls.some(([, body]) => body.dismissed)).toBe(false)
  expect(confirm).not.toHaveBeenCalled()
})

it('retains barcode-only resume as incomplete until the original unknown online operation is recovered', async () => {
  const { api, batches } = server()
  const submit = api.submit
  const operations: string[] = []
  local.mockResolvedValue({
    kind: 'legs',
    legs: [{ origin: 'JFK', destination: 'BOS', airline: 'AA', dayOfYear: 60 }],
  })
  api.submit = vi.fn(async (source: ImportSource, operationId: string) => {
    if (source.type === 'boarding_pass') return submit(source, operationId)
    operations.push(operationId)
    if (operations.length === 1) throw new Error('Online response lost after acceptance')
    return submit(source, operationId)
  })
  const original = new UnifiedSession(api)
  original.add([file('incomplete.pdf', 'application/pdf')])
  await done(original)
  const records = original.retained()
  // Simulate a crash after barcode receipt and before the main online response, without a recorded error.
  delete records[0].problem
  const resumed = new UnifiedSession(api)
  resumed.resume(records)
  await done(resumed)
  expect(resumed.getEntries()[0]).toMatchObject({ phase: 'failed', problem: 'reselect' })
  resumed.add([file('incomplete.pdf', 'application/pdf')])
  await done(resumed)
  expect(operations).toEqual([records[0].operationId, records[0].operationId])
  expect(resumed.getEntries()[0].phase).toBe('ready')
  expect(batches.size).toBe(2)
})

it.each([
  [
    'conflicting through-flight route',
    [{ origin: 'JFK', destination: 'BOS', airline: 'AA', flightNumber: '12', dayOfYear: 60 }],
    [
      {
        date: '2026-03-01',
        origin: 'BOS',
        destination: 'LAX',
        airline_iata: 'AA',
        flight_number: '12',
      },
    ],
  ],
  [
    'two competing online copies',
    [{ origin: 'JFK', destination: 'BOS', airline: 'AA', flightNumber: '12', dayOfYear: 60 }],
    [
      {
        date: '2026-03-01',
        origin: 'JFK',
        destination: 'BOS',
        airline_iata: 'AA',
        flight_number: '12',
      },
      {
        date: '2026-03-01',
        origin: 'JFK',
        destination: 'BOS',
        airline_iata: 'AA',
        flight_number: '12',
      },
    ],
  ],
  [
    'conflicting same-route flight number',
    [{ origin: 'JFK', destination: 'BOS', airline: 'AA', flightNumber: '12', dayOfYear: 60 }],
    [
      {
        date: '2026-03-01',
        origin: 'JFK',
        destination: 'BOS',
        airline_iata: 'AA',
        flight_number: '99',
      },
    ],
  ],
] as const)(
  'preserves all conflicting or bidirectionally ambiguous candidates: %s',
  async (_, legs, fields) => {
    const { api, batches } = server()
    const submit = api.submit
    local.mockResolvedValue({ kind: 'legs', legs })
    api.submit = vi.fn(async (source: ImportSource, operationId: string) => {
      if (source.type === 'boarding_pass') return submit(source, operationId)
      const value = snapshot(
        fields.map((field, index) => draft({ id: `online-${index}`, fields: { ...field } })),
        { id: 'conflicting' },
      )
      batches.set('conflicting', value)
      return value
    })
    const session = new UnifiedSession(api)
    session.add([file('conflicts.pdf', 'application/pdf')])
    await done(session)
    expect(session.drafts().filter((row) => row.status === 'review')).toHaveLength(
      legs.length + fields.length,
    )
    expect(patch.mock.calls.some(([, body]) => body.dismissed)).toBe(false)
  },
)

it('retries an unknown main response with the original operation despite a known terminal barcode', async () => {
  const { api } = server()
  const submit = api.submit
  const operations: string[] = []
  local.mockResolvedValue({
    kind: 'legs',
    legs: [{ origin: 'JFK', destination: 'BOS', airline: 'AA', dayOfYear: 60 }],
  })
  api.submit = vi.fn(async (source: ImportSource, operationId: string) => {
    if (source.type === 'boarding_pass') return submit(source, operationId)
    operations.push(operationId)
    if (operations.length === 1) throw new Error('Unknown accepted online submission')
    return submit(source, operationId)
  })
  const session = new UnifiedSession(api)
  session.add([file('lost-online.pdf', 'application/pdf')])
  await done(session)
  session.retry(session.getEntries()[0])
  await done(session)
  expect(operations[1]).toBe(operations[0])
  expect(local).toHaveBeenCalledTimes(1)
})

it('retains barcode drafts and source recovery when online complement is cancelled before finding any draft', async () => {
  const { api } = server()
  const submit = api.submit
  local.mockResolvedValue({
    kind: 'legs',
    legs: [{ origin: 'JFK', destination: 'BOS', airline: 'AA', dayOfYear: 60 }],
  })
  api.submit = vi.fn(async (source: ImportSource, operationId: string) =>
    source.type === 'boarding_pass'
      ? submit(source, operationId)
      : snapshot([], { id: 'cancelled-online', status: 'cancelled' }),
  )
  const session = new UnifiedSession(api)
  const source = file('unread-pages.pdf', 'application/pdf')
  session.add([source])
  await done(session)
  const entry = session.getEntries()[0]
  expect(entry.online?.getState()).toMatchObject({
    phase: 'cancelled',
    cancelled: false,
    failure: null,
  })
  expect(entry).toMatchObject({ phase: 'failed', problem: 'partial', complementPending: true })
  expect(entry.file).toBe(source)
  expect(session.drafts().filter((row) => row.status === 'review')).toHaveLength(1)
  expect(session.retained()[0].complementPending).toBe(true)
  expect(confirm).not.toHaveBeenCalled()
})
