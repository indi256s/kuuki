'use client'

import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api, beginIdentityOperation, getAuthGeneration } from '@kuuki/client/apiClient'
import { clearFlightCreateOperations } from '@kuuki/client/flightCreateOperations'
import { clearDrafts } from './capture/drafts'
import { clearCapturePreferences } from './capture/capture-preferences'
import { LIFECYCLE_CHANGED_EVENT, clearOwnerSyncMarkers, syncOwner, type SyncReply } from './lifecycle-sync'
import { awaitPublication } from './publication'

type IdentityReply = { user: { id: string } | null }
let knownIdentity: string | null | undefined
const tracked = new Set<AbortController>()
const listeners = new Set<() => void>()
const tabId = Math.random().toString(36).slice(2)

function publishIdentity(id: string | null) {
  knownIdentity = id
  for (const listener of listeners) listener()
}

function safeTargetPath(path?: string): string {
  if (path === undefined) return window.location.pathname + window.location.search
  const allowed = new Set(['/', '/overview', '/journal', '/passport', '/signin', '/signup', '/settings', '/onboarding', '/account-deleted', '/password-updated'])
  if (!allowed.has(path)) throw new Error('Invalid identity navigation target')
  return path
}

export function trackPrivateOperation(controller: AbortController): () => void {
  tracked.add(controller)
  return () => tracked.delete(controller)
}

function resetPrivateState(previousOwner: string | null | undefined, targetPath?: string) {
  const target = safeTargetPath(targetPath)
  for (const controller of tracked) controller.abort(new DOMException('Session changed', 'AbortError'))
  tracked.clear()
  if (previousOwner) {
    clearFlightCreateOperations(previousOwner)
    clearDrafts(previousOwner)
    clearCapturePreferences(previousOwner)
  }
  // Sync markers are only a request throttle; clearing every owner's lets the next owner sync on first sight.
  clearOwnerSyncMarkers(sharedStore())
  window.dispatchEvent(new Event('kuuki:identity-reset'))
  // A document navigation discards Next segment cache as well as client stores.
  window.location.assign(target)
}

/** The confirmed owner, or null for a guest or when the identity just changed (the page is navigating away). */
async function checkIdentity(): Promise<string | null> {
  const reply = await api.get<IdentityReply>('/api/auth/me')
  const id = reply.user?.id ?? null
  if (knownIdentity !== undefined && knownIdentity !== id) {
    const previousOwner = knownIdentity
    publishIdentity(id)
    resetPrivateState(previousOwner)
    return null
  }
  publishIdentity(id)
  return id
}

function sharedStore(): Storage | null {
  try { return window.localStorage } catch { return null }
}

/**
 * R1: move the owner's due flights (and repair a stale evidence stamp) once identity is confirmed, then refresh what
 * the page shows: immediately when the repair published, after the derived-publication poll when it is pending.
 */
async function syncOwnerFlights(ownerId: string, refresh: () => void, signal: AbortSignal) {
  const generation = getAuthGeneration()
  const current = () => !signal.aborted && generation === getAuthGeneration() && knownIdentity === ownerId
  const outcome = await syncOwner(ownerId, {
    post: () => api.post<SyncReply>('/api/flights/sync-upcoming', undefined, { signal }),
    now: Date.now,
    storage: sharedStore(),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    current,
  })
  if (!outcome?.changed || !current()) return
  // Server-owned routes re-render; Query-owned reads (queue, badges) listen for the event.
  const announce = () => {
    refresh()
    if (outcome.synced > 0) window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
  }
  if (outcome.derivedState === 'ready') announce()
  else if (outcome.derivedState === 'pending' && outcome.revision !== null) {
    if (await awaitPublication(outcome.revision, signal, current) === 'ready') announce()
  }
}

/**
 * Use for successful cookie-identity mutations. `run` must throw on API failure;
 * only a resolved result broadcasts and navigates. W3 sign-in passes `/overview`,
 * sign-out passes `/signin`.
 */
export async function withIdentityMutation<T>(run: (token: symbol) => Promise<T>, targetPath?: string): Promise<T> {
  safeTargetPath(targetPath)
  const operation = beginIdentityOperation()
  await operation.ready
  try {
    // Resolve the departing cookie owner while the account lock is held. A newly
    // mounted tab may not have finished bootstrap, and its remembered owner may
    // already be stale after another tab changed the cookie.
    let previousOwner: string | null = null
    try {
      previousOwner = (await api.get<IdentityReply>('/api/auth/me', undefined, { identityToken: operation.token })).user?.id ?? null
    } catch { /* An unavailable owner lookup must not block the account action. */ }
    const result = await run(operation.token)
    publishIdentity(null) // Hide any previous owner's streamed payload immediately.
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('kuuki-identity')
      channel.postMessage({ tabId })
      channel.close()
    }
    resetPrivateState(previousOwner, targetPath)
    return result
  } finally {
    operation.release()
  }
}

/**
 * W3 private read islands must wrap their owner-scoped RSC payload with this
 * boundary. The server owner is visible in the initial document; on client
 * navigation, a late A payload is suppressed once bootstrap has confirmed B.
 */
export function IdentitySnapshot({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const current = useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener) },
    () => knownIdentity,
    () => ownerId,
  )
  return current === undefined || current === ownerId ? children : null
}

export function ActivityBridge() {
  const router = useRouter()
  useEffect(() => {
    // Ask an installed root-scope legacy worker to pick up its retirement script.
    // Keep updating old installations until their root registration is retired.
    void navigator.serviceWorker?.getRegistration('/')?.then(registration => registration?.update()).catch(() => {})
    let active = true
    let checking = false
    let queued = false
    const syncing = new AbortController()
    const release = trackPrivateOperation(syncing)
    const refresh = async () => {
      if (!active || document.visibilityState === 'hidden') return
      if (checking) { queued = true; return }
      checking = true
      try {
        const owner = await checkIdentity()
        // Only a confirmed owner syncs; a guest or a switched identity never writes.
        if (owner && active) void syncOwnerFlights(owner, () => router.refresh(), syncing.signal).catch(() => { /* retried on a later check */ })
      } catch { /* API errors never imply logout. */ }
      finally {
        checking = false
        if (queued) { queued = false; void refresh() }
      }
    }
    void refresh()
    const onFocus = () => { void refresh() }
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('kuuki-identity') : null
    channel?.addEventListener('message', onFocus)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const interval = window.setInterval(() => { void refresh() }, 15 * 60 * 1000)
    return () => {
      active = false
      syncing.abort()
      release()
      window.clearInterval(interval)
      channel?.close()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [router])
  return null
}
