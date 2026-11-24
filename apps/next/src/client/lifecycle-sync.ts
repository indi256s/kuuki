export const OWNER_SYNC_INTERVAL_MS = 10 * 60_000
export const OWNER_SYNC_RETRY_MS = 60_000
export const OWNER_SYNC_MAX_PASSES = 3
export const LIFECYCLE_CHANGED_EVENT = 'kuuki:lifecycle-changed'
const PASS_DELAY_MS = 400
const KEY_PREFIX = 'kuuki:lifecycle-sync:'

export interface SyncReply {
  synced?: number
  awaited?: number
  autoConfirmed?: number
  more?: boolean
  derived_state?: 'ready' | 'pending' | 'error'
  revision?: number
}

export interface OwnerSyncOutcome {
  changed: boolean
  synced: number
  derivedState: 'ready' | 'pending' | 'error' | null
  revision: number | null
}

export interface OwnerSyncDeps {
  post: () => Promise<SyncReply>
  now: () => number
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  sleep: (ms: number) => Promise<void>
  current: () => boolean
}

const memory = new Map<string, number>()
let inFlight: Promise<OwnerSyncOutcome | null> | null = null

export function clearOwnerSyncMarkers(
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | null,
): void {
  memory.clear()
  try {
    if (!storage) return
    const keys: string[] = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (key?.startsWith(KEY_PREFIX)) keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {}
}

export function resetOwnerSyncMemory(): void {
  memory.clear()
  inFlight = null
}

function lastRun(key: string, deps: OwnerSyncDeps): number | null {
  let stored: number | null = null
  try {
    const raw = deps.storage?.getItem(key)
    stored = raw ? Number(raw) : null
  } catch {}
  const values = [stored, memory.get(key) ?? null].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  return values.length ? Math.max(...values) : null
}

function remember(key: string, at: number, deps: OwnerSyncDeps): void {
  memory.set(key, at)
  try {
    deps.storage?.setItem(key, String(at))
  } catch {}
}

export function syncOwner(
  ownerId: string | null | undefined,
  deps: OwnerSyncDeps,
): Promise<OwnerSyncOutcome | null> {
  if (!ownerId) return Promise.resolve(null)
  if (inFlight) return Promise.resolve(null)
  const key = KEY_PREFIX + ownerId
  const started = deps.now()
  const last = lastRun(key, deps)
  if (last !== null && started >= last && started - last < OWNER_SYNC_INTERVAL_MS)
    return Promise.resolve(null)
  remember(key, started, deps)

  inFlight = (async () => {
    const outcome: OwnerSyncOutcome = {
      changed: false,
      synced: 0,
      derivedState: null,
      revision: null,
    }
    for (let pass = 0; pass < OWNER_SYNC_MAX_PASSES; pass++) {
      if (!deps.current()) break
      let reply: SyncReply
      try {
        reply = await deps.post()
      } catch {
        remember(key, started - OWNER_SYNC_INTERVAL_MS + OWNER_SYNC_RETRY_MS, deps)
        break
      }
      const synced = reply.synced ?? 0
      outcome.synced += synced
      if (synced > 0 || reply.derived_state !== undefined) outcome.changed = true
      if (reply.derived_state !== undefined) {
        outcome.derivedState = reply.derived_state
        outcome.revision = typeof reply.revision === 'number' ? reply.revision : outcome.revision
      }
      if (!reply.more || synced === 0) break
      await deps.sleep(PASS_DELAY_MS)
    }
    return outcome
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}
