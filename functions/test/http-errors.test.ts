import { describe, expect, it } from 'vitest'
import { HttpError, runHandler } from '../api/_lib/http'

describe('HttpError details', () => {
  it('adds extra fields but can never override error or code', async () => {
    const res = await runHandler(async () => {
      throw new HttpError(409, 'Conflict', 'STATE_CONFLICT', {
        cause: 'concurrent_update',
        error: 'forged',
        code: 'FORGED',
      })
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'Conflict',
      code: 'STATE_CONFLICT',
      cause: 'concurrent_update',
    })
  })
})
