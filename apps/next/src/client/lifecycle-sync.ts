// Owner sync trigger (ADR 0001 §2, R1). While the cron is held the Next shell is the only thing that moves a member's
// flights upcoming -> awaiting -> logged, so a confirmed owner session asks `POST /api/flights/sync-upcoming` itself:
// at most once per 10 minutes per owner across every tab (a shared localStorage timestamp, written before the request),
// never for a guest, with at most two follow-up passes while the server says `more`. The caller refreshes the page
// immediately and announces `kuuki:lifecycle-changed` when flights moved, then refreshes again if pending publication completes.

export const OWNER_SYNC_INTERVAL_MS = 10 * 60_000
/** After a failed attempt the next try waits this long, not the whole interval. */
export const OWNER_SYNC_RETRY_MS = 60_000
/** One pass plus at most two follow-ups (ADR 0001 section 2). */
export const OWNER_SYNC_MAX_PASSES = 3
/** Dispatched on `window` after flights moved, for Query-owned reads (queue, badges). */
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
  /** Some flight moved or derived state was repaired: what the member sees may be out of date. */
  changed: boolean
  /** Flights that changed state across the passes (sum of the replies' `synced`). */
  synced: number
  derivedState: 'ready' | 'pending' | 'error' | null
  revision: number | null
}

export interface OwnerSyncDeps {
  post: () => Promise<SyncReply>
  now: () => number
  /** localStorage, shared by every tab; null when the browser blocks it (then the in-memory guard below still limits the rate). */
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  sleep: (ms: number) => Promise<void>
  /** False once the account changed or the page was torn down. */
  current: () => boolean
}

const memory = new Map<string, number>()
let inFlight: Promise<OwnerSyncOutcome | null> | null = null

/** An identity reset removes every owner's throttle, so the next owner on this browser syncs on first sight. */
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
  } catch {
    /* blocked storage: nothing to clear */
  }
}

/** Test seam: the in-memory guard outlives a test otherwise. */
export function resetOwnerSyncMemory(): void {
  memory.clear()
  inFlight = null
}

function lastRun(key: string, deps: OwnerSyncDeps): number | null {
  let stored: number | null = null
  try {
    const raw = deps.storage?.getItem(key)
    stored = raw ? Number(raw) : null
  } catch {
    /* blocked storage falls back to memory */
  }
  const values = [stored, memory.get(key) ?? null].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  return values.length ? Math.max(...values) : null
}

function remember(key: string, at: number, deps: OwnerSyncDeps): void {
  memory.set(key, at)
  try {
    deps.storage?.setItem(key, String(at))
  } catch {
    /* ignore */
  }
}

/** Resolves null when nothing ran (guest, too soon, another run in flight, or failure before any pass completed). */
export function syncOwner(
  ownerId: string | null | undefined,
  deps: OwnerSyncDeps,
): Promise<OwnerSyncOutcome | null> {
  if (!ownerId) return Promise.resolve(null) // guests and unconfirmed identities never trigger a write
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
        // Never implies logout and never retries in a loop: try again soon, not at once.
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
      // A pass that moved nothing cannot be helped by another one right now (it lost a race, or hit a failure).
      if (!reply.more || synced === 0) break
      await deps.sleep(PASS_DELAY_MS)
    }
    return outcome
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}
