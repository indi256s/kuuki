// Bounded backoff poll for derived publication. Kept apart from write-feedback so the owner-sync trigger in
// activity.tsx can use it without an import cycle.
import { api } from '../../../web/src/lib/apiClient'

type Publication = { derived_state: 'ready' | 'pending' | 'error'; published_revision: number }
const delays = [1000, 2000, 4000, 8000, 8000, 8000]

/** Bounded backoff poll for derived publication; 'stale' means the caller was aborted or the account changed. */
export async function awaitPublication(revision: number, signal: AbortSignal, current: () => boolean): Promise<'ready' | 'delayed' | 'stale'> {
  try {
    for (const delay of delays) {
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
        const timer = setTimeout(finish, delay)
        signal.addEventListener('abort', finish, { once: true })
        if (signal.aborted) finish()
      })
      if (!current()) return 'stale'
      const result = await api.get<Publication>('/api/me/derived-state', undefined, { signal })
      if (!current()) return 'stale'
      if (result.derived_state === 'ready' && result.published_revision >= revision) return 'ready'
      if (result.derived_state === 'error') break
    }
  } catch { /* reported as delayed */ }
  return current() ? 'delayed' : 'stale'
}
