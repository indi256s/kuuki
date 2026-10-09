import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewScope } from '@kuuki/shared/overview/figures'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'

type Revalidation = 'unchanged' | 'updated' | 'failed'
export type OverviewDataStore = ReturnType<typeof createOverviewDataStore>

export function createOverviewDataStore(
  initial: OverviewPayload | null,
  fetcher: typeof fetch = fetch,
  canPublish?: (response: Response) => boolean,
) {
  let payload = initial
  let pending: Promise<Revalidation> | null = null
  const subscribers = new Set<() => void>()
  async function refresh(): Promise<Revalidation> {
    let next: OverviewPayload
    try {
      const response = await fetcher('/api/me/overview/data', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: payload ? { 'If-None-Match': payload.etag } : {},
        signal: AbortSignal.timeout(30_000),
      })
      if (response.status === 304) return 'unchanged'
      if (response.status !== 200) return 'failed'
      next = (await response.json()) as OverviewPayload
      // Admission and publication share this synchronous continuation after the final await.
      if (canPublish && !canPublish(response)) return 'failed'
    } catch {
      return 'failed'
    }
    payload = next
    for (const notify of subscribers) notify()
    return 'updated'
  }
  return {
    get: () => payload,
    revalidate(): Promise<Revalidation> {
      if (!pending)
        pending = refresh().finally(() => {
          pending = null
        })
      return pending
    },
    subscribe(notify: () => void): () => void {
      subscribers.add(notify)
      return () => {
        subscribers.delete(notify)
      }
    },
  }
}

export function attachRevalidation(store: OverviewDataStore, target: Window): () => void {
  const document = target.document
  let last = -Infinity
  const revalidate = () => {
    const now = Date.now()
    if (document.visibilityState !== 'visible' || now - last < 2000) return
    last = now
    void store.revalidate()
  }
  target.addEventListener('focus', revalidate)
  document.addEventListener('visibilitychange', revalidate)
  return () => {
    target.removeEventListener('focus', revalidate)
    document.removeEventListener('visibilitychange', revalidate)
  }
}

const scopes = new WeakMap<
  OverviewDataStore,
  { etag: string; values: Map<string, OverviewScope> }
>()
export function scopeFor(store: OverviewDataStore, filter: OverviewFilter): OverviewScope | null {
  const payload = store.get()
  if (
    !payload ||
    (payload.mode === 'aggregate' &&
      payload.aggregateResolution !== 'day' &&
      filter.period &&
      'from' in filter.period &&
      filter.period.from.length === 10)
  )
    return null
  let cache = scopes.get(store)
  if (!cache || cache.etag !== payload.etag) {
    cache = { etag: payload.etag, values: new Map() }
    scopes.set(store, cache)
  }
  const key = JSON.stringify(filter)
  let scope = cache.values.get(key)
  if (!scope) scope = computeOverview(payload, filter)
  cache.values.delete(key)
  cache.values.set(key, scope)
  if (cache.values.size > 16) cache.values.delete(cache.values.keys().next().value!)
  return scope
}
