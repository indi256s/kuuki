import { expect, it } from 'vitest'
import { createApiDatabase } from './harness'

it('keeps concurrently open fixtures isolated after repeated teardown', async () => {
  const released = await createApiDatabase()
  await released.dispose()
  await released.dispose()
  const first = await createApiDatabase()
  const second = await createApiDatabase()
  try {
    await first.db.prepare("INSERT INTO _code_nouns(word) VALUES ('first')").run()
    expect(await second.db.prepare('SELECT word FROM _code_nouns').first()).toBeNull()
  } finally {
    await first.dispose()
    await second.dispose()
  }
})
