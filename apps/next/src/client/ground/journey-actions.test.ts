import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import type { GroundMutationResult } from '@kuuki/shared/groundTravel'
import { resolveCommand, runCommand, startCommand } from './journey-actions'
import * as api from './api'
import { rail } from './test-fixtures'

vi.mock('./api', () => ({ sendCommand: vi.fn(), readOperation: vi.fn() }))

const journey = rail({ id: 1, status: 'planned', version: 4 })
const saved: GroundMutationResult = {
  outcome: 'saved',
  journeyId: journey.id,
  action: 'cancel',
  savedVersion: 5,
  accountRevision: 9,
  derivedState: 'ready',
  replayed: false,
  current: { ...journey, status: 'cancelled', version: 5 },
}

beforeEach(() => vi.clearAllMocks())

describe('startCommand', () => {
  it('uses a fresh key per attempt and the loaded version', () => {
    const a = startCommand('cancel', journey)
    const b = startCommand('cancel', journey)
    expect(a.operationKey).not.toBe(b.operationKey)
    expect(a).toMatchObject({ action: 'cancel', journeyId: journey.id, expectedVersion: 4 })
  })
})

describe('runCommand', () => {
  const pending = startCommand('cancel', journey)

  it('sends the command with its key and version', async () => {
    vi.mocked(api.sendCommand).mockResolvedValue(saved)
    expect(await runCommand(pending)).toEqual({ kind: 'saved', result: saved })
    expect(api.sendCommand).toHaveBeenCalledWith(
      {
        action: 'cancel',
        operationKey: pending.operationKey,
        journeyId: journey.id,
        expectedVersion: 4,
      },
      { signal: undefined },
    )
  })

  it.each([
    [409, 'conflict'],
    [404, 'gone'],
    [410, 'gone'],
    [502, 'unknown'],
    [500, 'unknown'],
  ])('classifies HTTP %i as %s', async (status, kind) => {
    vi.mocked(api.sendCommand).mockRejectedValue(new ApiError(status, 'x'))
    expect((await runCommand(pending)).kind).toBe(kind)
  })

  it('treats a lost response (no HTTP status) as unknown, never as a failure', async () => {
    vi.mocked(api.sendCommand).mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await runCommand(pending)).toEqual({ kind: 'unknown' })
  })

  it('reports other refusals with their message', async () => {
    vi.mocked(api.sendCommand).mockRejectedValue(new ApiError(400, 'bad request'))
    expect(await runCommand(pending)).toEqual({ kind: 'rejected', message: 'bad request' })
  })
})

describe('resolveCommand', () => {
  const pending = startCommand('delete', journey)

  it('asks about the original key', async () => {
    vi.mocked(api.readOperation).mockResolvedValue({
      status: 'unknown',
      operationKey: pending.operationKey,
    })
    expect(await resolveCommand(pending)).toEqual({ kind: 'not-recorded' })
    expect(api.readOperation).toHaveBeenCalledWith(pending.operationKey, { signal: undefined })
  })

  it('returns the saved status', async () => {
    const status = {
      status: 'saved' as const,
      journeyId: journey.id,
      action: 'cancel' as const,
      savedVersion: 5,
      accountRevision: 9,
      derivedState: 'pending' as const,
      current: saved.current,
    }
    vi.mocked(api.readOperation).mockResolvedValue(status)
    expect(await resolveCommand(pending)).toEqual({ kind: 'applied', status })
  })

  it('says failed when the lookup itself fails', async () => {
    vi.mocked(api.readOperation).mockRejectedValue(new Error('offline'))
    expect(await resolveCommand(pending)).toEqual({ kind: 'failed' })
  })
})
