import { ApiError } from '@kuuki/client/apiClient'
import { describe, expect, it, vi } from 'vitest'
import type {
  GroundCommand,
  GroundJourneyDto,
  GroundMutationResult,
} from '@kuuki/shared/groundTravel'
import {
  attemptSave,
  checkSave,
  commandFor,
  saveReducer,
  type SaveDeps,
  type SaveState,
} from './save'
import { blankState, buildCommandBody, emptyLeg } from './model'

const place = {
  source: 'geonames' as const,
  id: '1',
  name: 'A',
  nameRu: null,
  nameEn: null,
  countryCode: 'GE',
  region: null,
  lat: 1,
  lon: 2,
  timezone: null,
  catalogVersion: 'v1',
}
const journeyId = '00000000-0000-4000-8000-0000000000cc'
function body() {
  const state = blankState('rail', 'planned')
  state.legs = [{ ...emptyLeg(place), to: { ...place, id: '2' } }]
  const result = buildCommandBody(state, { journeyId })
  if (!result) throw new Error('invalid fixture')
  return result
}
const saved = (derivedState: 'ready' | 'pending'): GroundMutationResult => ({
  outcome: 'saved',
  journeyId,
  action: 'create',
  savedVersion: 1,
  accountRevision: 7,
  derivedState,
  replayed: false,
  current: null,
})
const signal = new AbortController().signal
const lost = () => new TypeError('Failed to fetch')

function depsWith(overrides: Partial<SaveDeps>): SaveDeps {
  return {
    send: vi.fn(async () => saved('ready')),
    read: vi.fn(async () => ({ id: journeyId, version: 5 }) as GroundJourneyDto),
    operation: vi.fn(async () => ({ status: 'unknown' as const, operationKey: 'k' })),
    ...overrides,
  }
}

describe('operation keys', () => {
  it('keep one key for the same payload and issue a new one for a changed payload', () => {
    const payload = body() as Extract<ReturnType<typeof body>, { action: 'create' }>
    const first = commandFor(payload, null, () => 'key-1')
    const again = commandFor(payload, first.attempt, () => 'key-2')
    expect(again.command.operationKey).toBe('key-1')
    const edited = { ...payload, journey: { ...payload.journey, title: 'x' } }
    expect(commandFor(edited, first.attempt, () => 'key-2').command.operationKey).toBe('key-2')
  })
})

describe('save flow', () => {
  it('keeps the frozen command and its key after a lost response; check and retry use that key', async () => {
    const { command } = commandFor(body(), null, () => 'key-lost-1')
    const send = vi.fn().mockRejectedValueOnce(lost()).mockResolvedValueOnce(saved('ready'))
    const operation = vi.fn(async () => ({
      status: 'unknown' as const,
      operationKey: 'key-lost-1',
    }))
    const deps = depsWith({ send, operation })

    const outcome = await attemptSave(command, deps, signal)
    expect(outcome).toEqual({ kind: 'unknown' })
    let state: SaveState = saveReducer({ phase: 'idle' }, { type: 'outcome', outcome, command })
    expect(state).toMatchObject({ phase: 'unknown', command })

    // Check result: no receipt means the original is safe to retry.
    state = saveReducer(state, { type: 'check-start' })
    const checked = await checkSave(command, deps, signal)
    expect(checked.kind).toBe('not-found')
    state = saveReducer(state, { type: 'check-done', outcome: checked })
    expect(state).toMatchObject({ phase: 'unknown', notFound: true, checking: false })

    const retried = await attemptSave((state as { command: GroundCommand }).command, deps, signal)
    expect(retried.kind).toBe('saved')
    // Both attempts carried the very same create id and operation key.
    const sent = send.mock.calls.map(([c]) => [c.operationKey, c.journeyId])
    expect(sent).toEqual([
      ['key-lost-1', journeyId],
      ['key-lost-1', journeyId],
    ])
  })

  it('finds the write when the receipt says it was saved', async () => {
    const { command } = commandFor(body(), null, () => 'key-lost-2')
    const deps = depsWith({
      operation: vi.fn(async () => ({
        status: 'saved' as const,
        journeyId,
        action: 'create' as const,
        savedVersion: 1,
        accountRevision: 7,
        derivedState: 'pending' as const,
        current: null,
      })),
    })
    const checked = await checkSave(command, deps, signal)
    expect(checked).toMatchObject({ kind: 'saved', result: { derivedState: 'pending', journeyId } })
  })

  it('treats a server error as unknown, a 4xx as rejected, 410 as gone', async () => {
    const { command } = commandFor(body(), null, () => 'key-errors-1')
    const failing = (error: unknown) => depsWith({ send: vi.fn().mockRejectedValue(error) })
    expect((await attemptSave(command, failing(new ApiError(503, 'down')), signal)).kind).toBe(
      'unknown',
    )
    expect(
      await attemptSave(command, failing(new ApiError(400, 'name is invalid')), signal),
    ).toEqual({
      kind: 'rejected',
      message: 'name is invalid',
    })
    expect((await attemptSave(command, failing(new ApiError(410, 'gone')), signal)).kind).toBe(
      'gone',
    )
  })

  it('reports a 409 with the saved version and keeps the form to the member', async () => {
    const { command } = commandFor(body(), null, () => 'key-conflict-1')
    const current = { id: journeyId, version: 5, status: 'planned' } as GroundJourneyDto
    const deps = depsWith({
      send: vi
        .fn()
        .mockRejectedValue(new ApiError(409, 'changed', 'VERSION_CONFLICT', { current })),
    })
    const outcome = await attemptSave(command, deps, signal)
    expect(outcome).toEqual({ kind: 'conflict', current })
    expect(
      saveReducer({ phase: 'saving', command }, { type: 'outcome', outcome, command }),
    ).toEqual({
      phase: 'conflict',
      command,
      current,
    })
    // Without the body, the saved version is read separately.
    const bare = depsWith({ send: vi.fn().mockRejectedValue(new ApiError(409, 'changed')) })
    expect(await attemptSave(command, bare, signal)).toMatchObject({
      kind: 'conflict',
      current: { version: 5 },
    })
  })

  it('reports a pending publication as saved, never as an error', async () => {
    const { command } = commandFor(body(), null, () => 'key-pending-1')
    const deps = depsWith({ send: vi.fn(async () => saved('pending')) })
    const outcome = await attemptSave(command, deps, signal)
    expect(outcome).toMatchObject({ kind: 'saved', result: { derivedState: 'pending' } })
  })
})
