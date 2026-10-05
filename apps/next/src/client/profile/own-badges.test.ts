import { expect, it } from 'vitest'
import { readOwnBadges } from '../../../../../functions/api/_services/ownBadges'
it('does not render a failed D1 badge read as no achievements', async () => {
  const db = { prepare: () => ({ bind: () => ({ all: async () => ({ success: false, results: [] }) }) }) } as unknown as D1Database
  await expect(readOwnBadges(db, 'owner')).rejects.toThrow('Badges unavailable')
})
