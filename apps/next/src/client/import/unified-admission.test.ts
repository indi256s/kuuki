import { expect, it } from 'vitest'
import { UnifiedSession } from './unified-session'
import { importAccount, postJob } from '../../../../../functions/test/import-fixture'
import type { BatchApi } from './batch-run'
import type { Snapshot } from './import-types'

// This cross-boundary check boots Miniflare D1; use the API suite's fixture budget.
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
