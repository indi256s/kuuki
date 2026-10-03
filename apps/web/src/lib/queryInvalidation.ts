import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

/** Refresh one account's cached data plus public rankings affected by its mutation. */
export function invalidateUserData(queryClient: QueryClient, userId: string): void {
  for (const queryKey of [queryKeys.user(userId), queryKeys.leaderboard(), queryKeys.totalRankedUsers()]) {
    void queryClient.invalidateQueries({ queryKey })
  }
}
