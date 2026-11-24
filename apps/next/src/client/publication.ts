import { api } from '@kuuki/client/apiClient'

type Publication = { derived_state: 'ready' | 'pending' | 'error'; published_revision: number }
const delays = [1000, 2000, 4000, 8000, 8000, 8000]

export async function awaitPublication(
  revision: number,
  signal: AbortSignal,
  current: () => boolean,
): Promise<'ready' | 'delayed' | 'stale'> {
  try {
    for (const delay of delays) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer)
          signal.removeEventListener('abort', finish)
          resolve()
        }
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
  } catch {}
  return current() ? 'delayed' : 'stale'
}
