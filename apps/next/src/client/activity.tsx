'use client'

import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api, beginIdentityOperation, getAuthGeneration } from '@kuuki/client/apiClient'
import { clearFlightCreateOperations } from '@kuuki/client/flightCreateOperations'
import { clearDeleteReceipts } from './journal/delete-receipts'
import { clearDrafts } from './capture/drafts'
import { clearCapturePreferences } from './capture/capture-preferences'
import {
  LIFECYCLE_CHANGED_EVENT,
  clearOwnerSyncMarkers,
  syncOwner,
  type SyncReply,
} from './lifecycle-sync'
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
  const allowed = new Set([
    '/',
    '/?notice=password-saved',
    '/overview',
    '/journal',
    '/passport',
    '/signin',
    '/signup',
    '/settings',
    '/welcome/name',
    '/account-deleted',
    '/password-updated',
  ])
  if (!allowed.has(path)) throw new Error('Invalid identity navigation target')
  return path
}

export function trackPrivateOperation(controller: AbortController): () => void {
  tracked.add(controller)
  return () => tracked.delete(controller)
}

/** Drop everything the departing owner left in this tab: tracked requests, local stores and sync markers. */
function dropPrivateState(previousOwner: string | null | undefined) {
  for (const controller of tracked)
    controller.abort(new DOMException('Session changed', 'AbortError'))
  tracked.clear()
  if (previousOwner) {
    clearDeleteReceipts(previousOwner)
    clearFlightCreateOperations(previousOwner)
    clearDrafts(previousOwner)
    clearCapturePreferences(previousOwner)
  }
  // Sync markers are only a request throttle; clearing every owner's lets the next owner sync on first sight.
  clearOwnerSyncMarkers(sharedStore())
  window.dispatchEvent(new Event('kuuki:identity-reset'))
}

function resetPrivateState(previousOwner: string | null | undefined, targetPath?: string) {
  const target = safeTargetPath(targetPath)
  dropPrivateState(previousOwner)
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
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * R1: move the owner's due flights (and repair a stale evidence stamp) once identity is confirmed, then refresh what
 * the page shows: canonical changes immediately, then derived results once publication finishes.
 */
async function syncOwnerFlights(ownerId: string, refresh: () => void, signal: AbortSignal) {
  const generation = getAuthGeneration()
  const current = () =>
    !signal.aborted && generation === getAuthGeneration() && knownIdentity === ownerId
  const outcome = await syncOwner(ownerId, {
    post: () => api.post<SyncReply>('/api/flights/sync-upcoming', undefined, { signal }),
    now: Date.now,
    storage: sharedStore(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    current,
  })
  if (!outcome?.changed || !current()) return
  // Server-owned routes re-render; Query-owned reads (queue, badges) listen for the event.
  const announce = () => {
    refresh()
    if (outcome.synced > 0) window.dispatchEvent(new Event(LIFECYCLE_CHANGED_EVENT))
  }
  announce()
  if (outcome.derivedState === 'pending' && outcome.revision !== null) {
    if ((await awaitPublication(outcome.revision, signal, current)) === 'ready' && current())
      refresh()
  }
}

/** How a successful identity mutation leaves the page (see `withIdentityMutation`). */
export type IdentityExit<T> = {
  /**
   * Guest → new member on a page that renders no private data (the auth card): publish the new owner and push
   * `targetPath` without a reload, so the card shell stays mounted. Returns the new owner's ID. Any other
   * transition (a departing member, or no owner in the result) still takes the document navigation.
   */
  inPlaceOwner?: (result: T) => string | null
  /** Runs after the mutation succeeded and before the document navigation, e.g. the card's dissolve. */
  beforeNavigate?: (result: T) => Promise<void> | void
  /** Picks the navigation target from the result; it must be one of the allowed identity targets. */
  target?: (result: T) => string
}

/**
 * Use for successful cookie-identity mutations. `run` must throw on API failure;
 * only a resolved result broadcasts and navigates. W3 sign-in passes `/overview`,
 * sign-out passes `/signin`.
 */
export async function withIdentityMutation<T>(
  run: (token: symbol) => Promise<T>,
  targetPath?: string,
  exit: IdentityExit<T> = {},
): Promise<T> {
  safeTargetPath(targetPath)
  const operation = beginIdentityOperation()
  await operation.ready
  try {
    // Resolve the departing cookie owner while the account lock is held. A newly
    // mounted tab may not have finished bootstrap, and its remembered owner may
    // already be stale after another tab changed the cookie.
    let previousOwner: string | null = null
    let ownerKnown = false
    try {
      previousOwner =
        (
          await api.get<IdentityReply>('/api/auth/me', undefined, {
            identityToken: operation.token,
          })
        ).user?.id ?? null
      ownerKnown = true
    } catch {
      /* An unavailable owner lookup must not block the account action. */
    }
    const result = await run(operation.token)
    const target = exit.target ? safeTargetPath(exit.target(result)) : targetPath
    const nextOwner = exit.inPlaceOwner?.(result) ?? null
    // In place only when the departing identity is a confirmed guest: there is nothing private to drop that a
    // reload would have to discard, and the card page rendered no owner-scoped payload.
    const inPlace = !!nextOwner && ownerKnown && previousOwner === null && target !== undefined
    publishIdentity(inPlace ? nextOwner : null) // Hide any previous owner's streamed payload immediately.
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('kuuki-identity')
      channel.postMessage({ tabId })
      channel.close()
    }
    if (inPlace) {
      dropPrivateState(previousOwner)
      window.history.pushState(null, '', safeTargetPath(target))
      return result
    }
    try {
      await exit.beforeNavigate?.(result)
    } catch {
      /* An exit animation never blocks the navigation. */
    }
    resetPrivateState(previousOwner, target)
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
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
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
    void navigator.serviceWorker
      ?.getRegistration('/')
      ?.then((registration) => registration?.update())
      .catch(() => {})
    let active = true
    let checking = false
    let queued = false
    const syncing = new AbortController()
    const release = trackPrivateOperation(syncing)
    const refresh = async () => {
      if (!active || document.visibilityState === 'hidden') return
      if (checking) {
        queued = true
        return
      }
      checking = true
      try {
        const owner = await checkIdentity()
        // Only a confirmed owner syncs; a guest or a switched identity never writes.
        if (owner && active)
          void syncOwnerFlights(owner, () => router.refresh(), syncing.signal).catch(() => {
            /* retried on a later check */
          })
      } catch {
        /* API errors never imply logout. */
      } finally {
        checking = false
        if (queued) {
          queued = false
          void refresh()
        }
      }
    }
    void refresh()
    const onFocus = () => {
      void refresh()
    }
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('kuuki-identity') : null
    channel?.addEventListener('message', onFocus)
    // A document load can follow an OAuth callback that changed the shared cookie outside this tab's client.
    channel?.postMessage({ tabId })
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const interval = window.setInterval(
      () => {
        void refresh()
      },
      15 * 60 * 1000,
    )
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
