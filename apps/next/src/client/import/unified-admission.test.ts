import { expect, it } from 'vitest'
import { UnifiedSession } from './unified-session'
import { importAccount, postJob } from '../../../../../functions/test/import-fixture'
import type { BatchApi } from './batch-run'
import type { Snapshot } from './import-types'

it(
  'admits the unified pasted-text request through the real jobs handler',
  { timeout: 30_000 },
  async () => {
    const { db, dispose } = await importAccount()
    try {
      const statuses: number[] = []
      const api: BatchApi = {
        submit: async (source, operationId) => {
          const response = await postJob(db, { ...source, submissionOperationId: operationId })
          statuses.push(response.status)
          if (response.status !== 201) throw new Error('Text admission failed')
          return response.body as Snapshot
        },
        readBatch: async () => {
          throw new Error('Unexpected batch read')
        },
        connect: async () => {},
        sleep: async () => {},
      }
      const session = new UnifiedSession(api)
      session.addText('2026-03-10 | JFK → LHR | BA178 | 19:00 → 07:00', 'Pasted text')
      await expect.poll(() => session.getEntries()[0]?.phase).toBe('ready')
      expect(statuses).toEqual([201])
      expect(session.drafts()).toHaveLength(1)
      session.leave()
    } finally {
      await dispose()
    }
  },
)

it('admits Nomads files without a provider, preserves hints and requires explicit selection', async () => {
  const { db, dispose } = await importAccount()
  const sources: unknown[] = []
  try {
    const session = new UnifiedSession({
      submit: async (source, operationId) => {
        sources.push(source)
        const response = await postJob(db, { ...source, submissionOperationId: operationId })
        expect(response.status).toBe(201)
        return response.body as Snapshot
      },
      readBatch: async () => {
        throw new Error('Unexpected read')
      },
      connect: async () => {},
      sleep: async () => {},
    })
    session.add([
      new File(
        [
          JSON.stringify({
            username: 'private-user',
            trips: [
              {
                place: 'New York',
                country_code: 'US',
                date_start: '2026-03-01',
                date_end: '2026-03-10',
              },
              {
                place: 'Boston',
                country_code: 'US',
                date_start: '2026-03-12',
                date_end: '2026-03-15',
              },
              {
                place: 'Chicago',
                country_code: 'US',
                date_start: '2026-03-14',
                date_end: '2026-03-16',
              },
            ],
          }),
        ],
        'nomads.json',
        { type: 'application/json' },
      ),
    ])
    await expect.poll(() => session.getEntries()[0]?.phase).toBe('ready')
    expect(session.drafts()).toHaveLength(2)
    expect(session.drafts()[0]).toMatchObject({
      selected: false,
      fields: {
        origin_hint: 'New York, US',
        destination_hint: 'Boston, US',
        review_required: true,
      },
    })
    expect(session.requiresSelection()).toBe(true)
    expect(session.drafts()[1]).toMatchObject({
      selected: false,
      fields: { date: '', origin_hint: 'Boston, US', destination_hint: 'Chicago, US' },
    })
    expect(JSON.stringify(sources)).not.toContain('private-user')
    session.leave()
  } finally {
    await dispose()
  }
})
