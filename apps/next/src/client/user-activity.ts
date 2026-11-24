import { api, getAuthGeneration } from '@kuuki/client/apiClient'

let last: { ownerId: string; day: string } | undefined
let sending = false

export async function reportVisibleActivity(ownerId: string, signal: AbortSignal): Promise<void> {
  if (document.visibilityState !== 'visible' || signal.aborted || sending) return
  const day = new Date().toISOString().slice(0, 10)
  if (last?.ownerId === ownerId && last.day === day) return
  const generation = getAuthGeneration()
  sending = true
  try {
    await api.post('/api/me/activity', {}, { signal })
    if (!signal.aborted && generation === getAuthGeneration()) last = { ownerId, day }
  } catch {
  } finally {
    sending = false
  }
}
