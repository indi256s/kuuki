// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '@kuuki/client/apiClient'
import { reportVisibleActivity } from './user-activity'

vi.mock('@kuuki/client/apiClient', () => ({ api: { post: vi.fn() }, getAuthGeneration: () => 0 }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('ignores background tabs, retries failed reports, and reports again on the next UTC day', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T23:59:00Z'))
  let visible = false
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() =>
    visible ? 'visible' : 'hidden',
  )
  const signal = new AbortController().signal
  await reportVisibleActivity('owner', signal)
  expect(api.post).not.toHaveBeenCalled()
  visible = true
  vi.mocked(api.post)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue({ day: '2026-10-28' })
  await reportVisibleActivity('owner', signal)
  await reportVisibleActivity('owner', signal)
  await reportVisibleActivity('owner', signal)
  expect(api.post).toHaveBeenCalledTimes(2)
  vi.setSystemTime(new Date('2026-10-29T00:00:00Z'))
  await reportVisibleActivity('owner', signal)
  expect(api.post).toHaveBeenCalledTimes(3)
})
