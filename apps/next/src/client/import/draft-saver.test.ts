import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import { DraftSaver, type SaveState } from './draft-saver'
import { draft } from './fixtures'
import type { Draft, DraftPatchBody } from './import-types'

function setup(patch: (id: string, body: DraftPatchBody) => Promise<Draft>) {
  const states: Array<[string, SaveState | null]> = []
  const drafts: Draft[] = []
  const saver = new DraftSaver({ patch, onDraft: d => drafts.push(d), onState: (id, s) => states.push([id, s]) })
  return { saver, states, drafts }
}
const deferred = <T,>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

describe('DraftSaver', () => {
  it('sends the known version, shows saving, then clears and reports the server draft', async () => {
    const patch = vi.fn(async (_id: string, body: DraftPatchBody) => draft({ id: 'd1', version: body.version + 1, fields: { date: '2026-03-01', origin: 'JFK', destination: 'LAX', airline_iata: 'AA' } }))
    const { saver, states, drafts } = setup(patch)
    await saver.save(draft({ id: 'd1' }), { fields: { destination: 'LAX' } })
    expect(patch).toHaveBeenCalledWith('d1', { version: 1, fields: { destination: 'LAX' } })
    expect(states.map(([, s]) => s?.status ?? null)).toEqual(['saving', null])
    expect(drafts[0].version).toBe(2)
    expect(saver.hasUnsaved()).toBe(false)
  })

  it('serialises edits made while a save is in flight and merges them, using the newest version', async () => {
    const first = deferred<Draft>()
    const patch = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementation(async (_id: string, body: DraftPatchBody) => draft({ id: 'd1', version: body.version + 1 }))
    const { saver } = setup(patch)
    const a = saver.save(draft({ id: 'd1' }), { fields: { origin: 'LAX' } })
    const b = saver.save(draft({ id: 'd1' }), { fields: { flight_number: '12' } })
    const c = saver.save(draft({ id: 'd1' }), { fields: { flight_number: '13' }, selected: true })
    expect(patch).toHaveBeenCalledTimes(1)
    first.resolve(draft({ id: 'd1', version: 2 }))
    await Promise.all([a, b, c])
    expect(patch).toHaveBeenCalledTimes(2)
    expect(patch).toHaveBeenLastCalledWith('d1', { version: 2, fields: { flight_number: '13' }, selected: true })
  })

  it('keeps the unsent change after a failure, reports it, and a retry sends the same change', async () => {
    const patch = vi.fn()
      .mockRejectedValueOnce(new ApiError(503, 'down', 'UNAVAILABLE'))
      .mockImplementation(async (_id: string, body: DraftPatchBody) => draft({ id: 'd1', version: body.version + 1 }))
    const { saver, states } = setup(patch)
    await saver.save(draft({ id: 'd1' }), { fields: { destination: 'LAX' } })
    const failed = states.at(-1)![1]!
    expect(failed).toMatchObject({ status: 'error', unsent: { fields: { destination: 'LAX' } } })
    expect(saver.hasUnsaved()).toBe(true)
    await saver.retry('d1')
    expect(patch).toHaveBeenLastCalledWith('d1', { version: 1, fields: { destination: 'LAX' } })
    expect(states.at(-1)![1]).toBeNull()
    expect(saver.hasUnsaved()).toBe(false)
  })

  it('on a version conflict adopts the newer server row, keeps my change as conflicted and applies it only on request', async () => {
    const current = draft({ id: 'd1', version: 4 })
    const patch = vi.fn()
      .mockRejectedValueOnce(new ApiError(409, 'changed', 'DRAFT_VERSION_CONFLICT', { draft: current }))
      .mockImplementation(async (_id: string, body: DraftPatchBody) => draft({ id: 'd1', version: body.version + 1 }))
    const { saver, states, drafts } = setup(patch)
    await saver.save(draft({ id: 'd1' }), { fields: { destination: 'LAX' } })
    expect(drafts.at(-1)).toBe(current)
    expect(states.at(-1)![1]).toMatchObject({ status: 'conflict', unsent: { fields: { destination: 'LAX' } } })
    expect(patch).toHaveBeenCalledTimes(1)
    await saver.retry('d1')
    expect(patch).toHaveBeenLastCalledWith('d1', { version: 4, fields: { destination: 'LAX' } })
  })

  it('discard drops the unsent change without a request', async () => {
    const patch = vi.fn().mockRejectedValue(new ApiError(503, 'down', 'UNAVAILABLE'))
    const { saver, states } = setup(patch)
    await saver.save(draft({ id: 'd1' }), { selected: false })
    saver.discard('d1')
    expect(states.at(-1)![1]).toBeNull()
    expect(saver.hasUnsaved()).toBe(false)
    expect(patch).toHaveBeenCalledTimes(1)
  })

  it('tracks drafts independently', async () => {
    const patch = vi.fn().mockRejectedValueOnce(new ApiError(500, 'x', 'INTERNAL')).mockImplementation(async (id: string, body: DraftPatchBody) => draft({ id, version: body.version + 1 }))
    const { saver } = setup(patch)
    await Promise.all([saver.save(draft({ id: 'a' }), { selected: false }), saver.save(draft({ id: 'b' }), { selected: false })])
    expect(saver.unsentIds()).toEqual(['a'])
  })

  it('dispose fences an in-flight save and drops parked edits, so nothing reaches the next import', async () => {
    const pending = deferred<Draft>()
    const patch = vi.fn(() => pending.promise)
    const { saver, states, drafts } = setup(patch)
    const first = saver.save(draft({ id: 'd1' }), { fields: { destination: 'LAX' } })
    void saver.save(draft({ id: 'd1' }), { fields: { flight_number: '12' } })
    expect(states).toHaveLength(1)
    saver.dispose()
    pending.resolve(draft({ id: 'd1', version: 2 }))
    await first
    expect(drafts).toEqual([])
    expect(states).toHaveLength(1) // no state published after dispose
    expect(patch).toHaveBeenCalledTimes(1) // the queued second edit is never sent
    expect(saver.hasUnsaved()).toBe(false)
    await saver.save(draft({ id: 'd2' }), { selected: false })
    expect(patch).toHaveBeenCalledTimes(1)
  })

  it('dispose after a failed save forgets the failed edit', async () => {
    const patch = vi.fn(async () => { throw new ApiError(503, 'down', 'INTERNAL') })
    const { saver } = setup(patch)
    await saver.save(draft({ id: 'd1' }), { fields: { destination: 'LAX' } })
    expect(saver.hasUnsaved()).toBe(true)
    saver.dispose()
    expect(saver.hasUnsaved()).toBe(false)
  })
})
