import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { invalidateUserData } from './queryInvalidation'
import { useAuthStore } from '@/stores/authStore'
import i18n from './i18n'

import type { DerivedAck } from '@kuuki/client/derivedState'
export type { DerivedAck } from '@kuuki/client/derivedState'
interface DerivedStatus { derived_state: 'ready' | 'pending' | 'error'; revision: number; published_revision: number }

const polling = new Map<string, number>()
// Capped backoff; gives up after ~31s, like the former fifteen 2s polls.
const POLL_DELAYS_MS = [1000, 2000, 4000, 8000, 8000, 8000]

/** An accepted write may precede derived stats; keep it visible until published or timed out. */
export function reconcileDerivedState(ack: DerivedAck, queryClient: QueryClient, userId: string): void {
  const generation = getAuthGeneration()
  const current = () => getAuthGeneration() === generation && useAuthStore.getState().user?.id === userId
  if (!current()) return
  invalidateUserData(queryClient, userId)
  if (ack.derived_state !== 'pending') return
  const revision = ack.revision ?? 0
  if ((polling.get(userId) ?? -1) >= revision) return
  polling.set(userId, revision)
  toast.info(i18n.t('flights.statsUpdating'))
  void (async () => {
    try {
      for (const delay of POLL_DELAYS_MS) {
        await new Promise(resolve => setTimeout(resolve, delay))
        if (!current() || polling.get(userId) !== revision) return
        const status = await api.get<DerivedStatus>('/api/me/derived-state')
        if (!current() || polling.get(userId) !== revision) return
        if (status.derived_state === 'ready' && status.published_revision >= revision) {
          invalidateUserData(queryClient, userId)
          toast.success(i18n.t('flights.statsReady'))
          return
        }
        if (status.derived_state === 'error') break
      }
      if (current() && polling.get(userId) === revision) toast.warning(i18n.t('flights.statsDelayed'))
    } catch {
      if (current() && polling.get(userId) === revision) toast.warning(i18n.t('flights.statsCheckFailed'))
    } finally {
      if (polling.get(userId) === revision) polling.delete(userId)
    }
  })()
}
