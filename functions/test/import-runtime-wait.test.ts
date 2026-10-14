// The two tests that wait on real runtime clocks (the 30 s subscriber-less window, the heartbeat); split out so
// they run beside the rest of import-runtime instead of after it.
import { expect, it } from 'vitest'
import { closedEvents, dispatch, feed, mf, readRow, runtime } from './import-runtime-fixture'
import { providerFlight } from './import-fixture'

it('persists before notify, keeps provider I/O alive beyond 30 s without subscribers, then resumes', async () => {
  const { db, send, start, batch, rows, calls } = await runtime()
  const id = await start() // The accepting HTTP request has finished.
  const disconnectedClient = new AbortController()
  const firstEvents = await globalThis.fetch(
    new URL(
      `/api/import/batches/${id}/events?after=0`,
      await mf!.unsafeGetDirectURL('import-test'),
    ),
    { signal: disconnectedClient.signal },
  )
  const reader = firstEvents.body!.getReader()
  send('{"flights":[' + JSON.stringify(providerFlight()))
  const first = await readRow(reader)
  expect((await rows(id)).results.map((row) => row.id)).toEqual(first.rowIds)
  expect((await batch(id))?.sequence).toBe(first.sequence)
  disconnectedClient.abort()
  await reader.cancel().catch(() => undefined) // Real HTTP disconnect; comment frames flush cancellation within 5 s.
  await new Promise((resolve) => setTimeout(resolve, 36_100))
  send(',' + JSON.stringify(providerFlight({ origin: 'TBS', destination: 'IST' })))
  await expect.poll(async () => (await rows(id)).results.length).toBe(2)
  const resumedClient = new AbortController()
  const resumed = await globalThis.fetch(
    new URL(
      `/api/import/batches/${id}/events?after=${first.sequence}`,
      await mf!.unsafeGetDirectURL('import-test'),
    ),
    { signal: resumedClient.signal },
  )
  const newReader = resumed.body!.getReader()
  const second = await readRow(newReader)
  expect(second.sequence).toBe(first.sequence + 1)
  expect((await rows(id)).results[1].id).toBe(second.rowIds[0])
  resumedClient.abort()
  await newReader.cancel().catch(() => undefined)
  const replay = await dispatch('/api/import/jobs', 'POST', {
    type: 'text',
    content: 'different replay input',
    submissionOperationId: 'runtime-op-0001',
  })
  expect(await replay.json()).toEqual({ batchId: id })
  expect(calls()).toBe(1)
  send(']}')
  feed.close()
  await expect.poll(async () => (await batch(id))?.status).toBe('review')
  const snapshot = (await (await dispatch(`/api/import/batches/${id}`)).json()) as {
    drafts: unknown[]
  }
  expect(snapshot.drafts).toHaveLength(2)
  expect((await db.prepare('SELECT COUNT(*) AS n FROM flights').first())?.n).toBe(0)
}, 60_000)

it('detects outside cancellation on the heartbeat while the provider is idle', async () => {
  const { start } = await runtime(true)
  const id = await start()
  const response = await dispatch(`/api/import/batches/${id}/events`)
  expect((await dispatch(`/api/import/batches/${id}/cancel`, 'POST')).status).toBe(200)
  const text = await closedEvents(response, 7_000)
  expect(text).toContain('event: snapshot')
  expect(text).toContain('event: end')
  expect(text).toContain('"status":"cancelled"')
}, 10_000)
