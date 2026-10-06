type UserId = string | null | undefined

/** Account-scoped keys all start with ['user', userId], so that one prefix covers the account's whole cache. */
const scoped = (kind: string) => (userId: UserId, ...parts: unknown[]) => ['user', userId, kind, ...parts] as const

export const queryKeys = {
  user: (userId: UserId) => ['user', userId] as const,
  flights: scoped('flights'),
  flight: scoped('flight'),
  flightRoutes: scoped('flightRoutes'),
  recentFlights: scoped('recentFlights'),
  upcomingFlights: scoped('upcomingFlights'),
  flightYears: scoped('flightYears'),
  flightAirlines: scoped('flightAirlines'),
  flightAircraft: scoped('flightAircraft'),
  allFlightIds: scoped('allFlightIds'),
  flightStats: scoped('flightStats'),
  flightDurations: scoped('flightDurations'),
  dashboardStats: scoped('dashboardStats'),
  advancedStats: scoped('advancedStats'),
  userBadges: scoped('userBadges'),
  leaderboardPositions: scoped('leaderboardPositions'),
  passportCountries: scoped('passportCountries'),
  passportClaims: scoped('passportClaims'),
  countryStats: scoped('countryStats'),
  // Public rankings that any account's writes can move.
  leaderboard: (...parts: unknown[]) => ['leaderboard', ...parts] as const,
  totalRankedUsers: () => ['totalRankedUsers'] as const,
}
