import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER_SYNC_INTERVAL_MS, OWNER_SYNC_MAX_PASSES, OWNER_SYNC_RETRY_MS, resetOwnerSyncMemory, syncOwner, type OwnerSyncDeps, type SyncReply } from './lifecycle-sync'

const quiet: SyncReply = { synced: 0, awaited: 0, autoConfirmed: 0, more: false }

function harness(replies: Array<SyncReply | Error>, start = 1_000_000) {
  let clock = start
  const values = new Map<string, string>()
  const post = vi.fn(async () => {
    const next = replies.shift() ?? quiet
    if (next instanceof Error) throw next
    return next
  })
  const deps: OwnerSyncDeps = {
    post, now: () => clock,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } },
    sleep: async () => {}, current: () => true,
  }
  return { deps, post, values, advance: (ms: number) => { clock += ms }, at: () => clock }
}

beforeEach(() => resetOwnerSyncMemory())

describe('owner sync trigger', () => {
  it('never writes for a guest or an unconfirmed identity', async () => {
    const h = harness([])
    expect(await syncOwner(null, h.deps)).toBeNull()
    expect(await syncOwner(undefined, h.deps)).toBeNull()
    expect(await syncOwner('', h.deps)).toBeNull()
    expect(h.post).not.toHaveBeenCalled()
    expect(h.values.size).toBe(0)
  })

  it('runs at most once per interval per owner and again after it', async () => {
    const h = harness([])
    expect(await syncOwner('u1', h.deps)).toMatchObject({ changed: false })
    expect(h.post).toHaveBeenCalledTimes(1)
    h.advance(OWNER_SYNC_INTERVAL_MS - 1)
    expect(await syncOwner('u1', h.deps)).toBeNull()
    expect(await syncOwner('u1', h.deps)).toBeNull()
    expect(h.post).toHaveBeenCalledTimes(1)
    h.advance(1)
    await syncOwner('u1', h.deps)
    expect(h.post).toHaveBeenCalledTimes(2)
    // A different owner in the same session has its own clock.
    await syncOwner('u2', h.deps)
    expect(h.post).toHaveBeenCalledTimes(3)
  })

  it('keeps the rate limit when sessionStorage is blocked', async () => {
    const h = harness([])
    const blocked: OwnerSyncDeps = { ...h.deps, storage: { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } } }
    await syncOwner('u1', blocked)
    expect(await syncOwner('u1', blocked)).toBeNull()
    expect(h.post).toHaveBeenCalledTimes(1)
  })

  it('follows up while the server says more, and stops when it does not', async () => {
    const h = harness([
      { synced: 100, awaited: 100, autoConfirmed: 0, more: true, derived_state: 'ready', revision: 3 },
      { synced: 100, awaited: 0, autoConfirmed: 100, more: true, derived_state: 'ready', revision: 4 },
      { synced: 7, awaited: 0, autoConfirmed: 7, more: false, derived_state: 'ready', revision: 5 },
      { synced: 1, more: true }, // never requested
    ])
    expect(await syncOwner('u1', h.deps)).toEqual({ changed: true, derivedState: 'ready', revision: 5 })
    expect(h.post).toHaveBeenCalledTimes(3)
  })

  it('bounds the follow-ups and stops when a pass made no progress', async () => {
    const endless = harness(Array.from({ length: 20 }, () => ({ synced: 5, more: true, derived_state: 'ready' as const, revision: 1 })))
    await syncOwner('u1', endless.deps)
    expect(endless.post).toHaveBeenCalledTimes(OWNER_SYNC_MAX_PASSES)

    resetOwnerSyncMemory()
    const stuck = harness([{ synced: 3, more: true, derived_state: 'ready', revision: 1 }, { synced: 0, more: true, derived_state: 'pending', revision: 2 }, { synced: 9, more: true }])
    const outcome = await syncOwner('u1', stuck.deps)
    expect(stuck.post).toHaveBeenCalledTimes(2) // the second pass lost its race: do not spin
    expect(outcome).toEqual({ changed: true, derivedState: 'pending', revision: 2 })
  })

  it('reports a change for a stamp-only repair but not for a quiet pass', async () => {
    const repaired = harness([{ synced: 0, awaited: 0, autoConfirmed: 0, more: false, derived_state: 'ready', revision: 9 }])
    expect(await syncOwner('u1', repaired.deps)).toEqual({ changed: true, derivedState: 'ready', revision: 9 })
    resetOwnerSyncMemory()
    expect(await syncOwner('u1', harness([quiet]).deps)).toEqual({ changed: false, derivedState: null, revision: null })
  })

  it('passes a pending publication through so the caller can poll', async () => {
    const h = harness([{ synced: 2, more: false, derived_state: 'pending', revision: 12 }])
    expect(await syncOwner('u1', h.deps)).toEqual({ changed: true, derivedState: 'pending', revision: 12 })
  })

  it('treats a failure as non-fatal and retries soon, not at the next interval or in a loop', async () => {
    const h = harness([new Error('offline'), { synced: 1, derived_state: 'ready', revision: 2 }])
    expect(await syncOwner('u1', h.deps)).toEqual({ changed: false, derivedState: null, revision: null })
    expect(h.post).toHaveBeenCalledTimes(1)
    h.advance(OWNER_SYNC_RETRY_MS - 1)
    expect(await syncOwner('u1', h.deps)).toBeNull()
    h.advance(1)
    expect(await syncOwner('u1', h.deps)).toMatchObject({ changed: true })
    expect(h.post).toHaveBeenCalledTimes(2)
  })

  it('coalesces overlapping triggers into one run', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const h = harness([])
    h.post.mockImplementation(async () => { await gate; return quiet })
    const first = syncOwner('u1', h.deps)
    expect(await syncOwner('u1', h.deps)).toBeNull()
    expect(await syncOwner('u2', h.deps)).toBeNull()
    release()
    await first
    expect(h.post).toHaveBeenCalledTimes(1)
  })

  it('stops as soon as the account is no longer current', async () => {
    const h = harness([{ synced: 5, more: true, derived_state: 'ready', revision: 1 }, { synced: 5, more: true }])
    let alive = true
    h.post.mockImplementationOnce(async () => { alive = false; return { synced: 5, more: true, derived_state: 'ready', revision: 1 } })
    await syncOwner('u1', { ...h.deps, current: () => alive })
    expect(h.post).toHaveBeenCalledTimes(1)
  })
})
