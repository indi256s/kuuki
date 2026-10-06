// Drop-in mock for src/lib/apiClient used by unit tests. Replaces the old Supabase mock.
//
// Usage in a test file:
//   vi.mock('@kuuki/client/apiClient', async () => await import('@/test/mocks/apiClient'))
//   import { api, resetApiMock } from '@/test/mocks/apiClient'
//   beforeEach(resetApiMock)
//   vi.mocked(api.get).mockResolvedValue({ entries: [], total: 0 })

import { vi } from 'vitest'

export class ApiError extends Error {
  status: number
  code?: string
  body?: unknown
  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export const api = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

export const setUnauthorizedHandler = vi.fn()

/** Reset all mocked api methods between tests. */
export function resetApiMock(): void {
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
  api.put.mockReset()
  api.delete.mockReset()
  setUnauthorizedHandler.mockReset()
}
