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
import { reportVisibleActivity } from './user-activity'
import { clearAirportReturns } from './airport-models/return-session'

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
  clearOwnerSyncMarkers(sharedStore())
  clearAirportReturns()
  window.dispatchEvent(new Event('kuuki:identity-reset'))
}

function resetPrivateState(previousOwner: string | null | undefined, targetPath?: string) {
  const target = safeTargetPath(targetPath)
  dropPrivateState(previousOwner)
  window.location.assign(target)
}

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

export type IdentityExit<T> = {
  inPlaceOwner?: (result: T) => string | null
  beforeNavigate?: (result: T) => Promise<void> | void
  target?: (result: T) => string
}

export async function withIdentityMutation<T>(
  run: (token: symbol) => Promise<T>,
  targetPath?: string,
  exit: IdentityExit<T> = {},
): Promise<T> {
  safeTargetPath(targetPath)
  const operation = beginIdentityOperation()
  await operation.ready
  try {
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
    } catch {}
    const result = await run(operation.token)
    const target = exit.target ? safeTargetPath(exit.target(result)) : targetPath
    const nextOwner = exit.inPlaceOwner?.(result) ?? null
    const inPlace = !!nextOwner && ownerKnown && previousOwner === null && target !== undefined
    publishIdentity(inPlace ? nextOwner : null)
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
    } catch {}
    resetPrivateState(previousOwner, target)
    return result
  } finally {
    operation.release()
  }
}

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
    void navigator.serviceWorker
      ?.getRegistration('/')
      ?.then((registration) => registration?.update())
      .catch(() => {})
    let active = true
    let checking = false
    let queued = false
    let syncing = new AbortController()
    let release = trackPrivateOperation(syncing)
    const refresh = async () => {
      if (!active || document.visibilityState === 'hidden') return
      if (checking) {
        queued = true
        return
      }
      checking = true
      try {
        const owner = await checkIdentity()
        if (owner && active) void reportVisibleActivity(owner, syncing.signal)
        if (owner && active)
          void syncOwnerFlights(owner, () => router.refresh(), syncing.signal).catch(() => {})
      } catch {
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
    const onIdentityReset = () => {
      syncing.abort()
      release()
      syncing = new AbortController()
      release = trackPrivateOperation(syncing)
      onFocus()
    }
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('kuuki-identity') : null
    channel?.addEventListener('message', onFocus)
    channel?.postMessage({ tabId })
    window.addEventListener('focus', onFocus)
    window.addEventListener('kuuki:identity-reset', onIdentityReset)
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
      window.removeEventListener('kuuki:identity-reset', onIdentityReset)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [router])
  return null
}
