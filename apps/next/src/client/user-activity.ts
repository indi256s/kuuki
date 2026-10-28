import { api, getAuthGeneration } from '@kuuki/client/apiClient'

let last: { ownerId: string; day: string } | undefined
let sending = false

/** The identity bridge calls only after confirming a signed-in user; the server owns identity and date. */
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
    // Collection never blocks the app; a later visible identity check can retry.
  } finally {
    sending = false
  }
}
