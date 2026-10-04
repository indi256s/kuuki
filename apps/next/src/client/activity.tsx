'use client'

import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { api, beginIdentityOperation } from '../../../web/src/lib/apiClient'
import { clearFlightCreateOperations } from '../../../web/src/lib/flightCreateOperations'
import { clearDrafts } from './capture/drafts'

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
  const allowed = new Set(['/', '/overview', '/journal', '/passport', '/signin', '/signup', '/settings', '/onboarding'])
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
  }
  window.dispatchEvent(new Event('kuuki:identity-reset'))
  // A document navigation discards Next segment cache as well as client stores.
  window.location.assign(target)
}

async function checkIdentity() {
  const reply = await api.get<IdentityReply>('/api/auth/me')
  const id = reply.user?.id ?? null
  if (knownIdentity !== undefined && knownIdentity !== id) {
    const previousOwner = knownIdentity
    publishIdentity(id)
    resetPrivateState(previousOwner)
    return
  }
  publishIdentity(id)
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
  useEffect(() => {
    // Ask an installed root-scope legacy worker to pick up its retirement script.
    // The old worker may have served this first document; rollout must stage that
    // retirement while Vite is still live before routing users here.
    void navigator.serviceWorker?.getRegistration('/')?.then(registration => registration?.update()).catch(() => {})
    let active = true
    let checking = false
    let queued = false
    const refresh = async () => {
      if (!active || document.visibilityState === 'hidden') return
      if (checking) { queued = true; return }
      checking = true
      try { await checkIdentity() } catch { /* API errors never imply logout. */ }
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
      window.clearInterval(interval)
      channel?.close()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])
  return null
}
