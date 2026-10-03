import { afterEach, expect, it } from 'vitest'
import { createApiDatabase } from './harness'

let cleanup: (() => Promise<void>) | undefined
afterEach(async () => { await cleanup?.(); cleanup = undefined })

it('opens a fresh local D1 with the production baseline schema', async () => {
  const { db, dispose } = await createApiDatabase()
  cleanup = dispose
  const table = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first<{ name: string }>()
  expect(table?.name).toBe('users')
})
