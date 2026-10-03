import { queryClient } from './queryClient'
import { useDashboardStore } from '@/stores/dashboardStore'

/** Clear data cached under a previous cookie identity before exposing a new one. */
export function resetPrivateClientState(): void {
  void queryClient.cancelQueries()
  queryClient.clear()
  useDashboardStore.setState({ filters: {}, availableYears: [] })
  // Drop the retired background-import store, which held a previous user's parsed flights.
  try { localStorage.removeItem('kuuki-import-jobs') } catch { /* storage unavailable */ }
}
