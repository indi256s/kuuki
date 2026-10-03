import type { QueryClient } from '@tanstack/react-query'

const OWN_KEYS = new Set([
  'flights', 'flight', 'flight-popover', 'flightRoutes', 'recentFlights', 'upcomingFlights',
  'flightYears', 'flightAirlines', 'flightAircraft', 'allFlightIds', 'flightStats',
  'flightDurations', 'dashboardStats', 'userStats', 'userBadges', 'userRankings',
  'advancedStats', 'unlockProgress', 'compareStats', 'passportCountries',
  'passportClaims', 'countryStats', 'groundVisits', 'isCountryClaimed',
  'userLeaderboardPositions',
])
const PUBLIC_KEYS = new Set(['leaderboard', 'totalRankedUsers'])

/** Refresh one account's dependent data plus public rankings affected by its mutation. */
export function invalidateUserData(queryClient: QueryClient, userId: string): void {
  void queryClient.invalidateQueries({
    predicate: query => {
      const [kind, scope] = query.queryKey
      return typeof kind === 'string' && (PUBLIC_KEYS.has(kind) || (OWN_KEYS.has(kind) && scope === userId))
    },
  })
}
