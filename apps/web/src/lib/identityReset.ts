import { queryClient } from './queryClient'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useImportStore } from '@/stores/importStore'

/** Clear data cached under a previous cookie identity before exposing a new one. */
export function resetPrivateClientState(): void {
  void queryClient.cancelQueries()
  queryClient.clear()
  useDashboardStore.setState({ filters: {}, availableYears: [] })
  useImportStore.setState({ backgroundJobs: {} })
}
