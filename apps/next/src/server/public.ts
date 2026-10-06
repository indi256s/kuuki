import 'server-only'
import { readPublicProfile } from '../../../../functions/api/_services/publicProfiles'
import { readPublicLeaderboard, readOwnLeaderboardEligibility, readOwnLeaderboardRank, type LeaderboardCategory } from '../../../../functions/api/_services/publicLeaderboard'
import { getRequestEnv, getRequestIdentity } from './identity'

export async function getPublicProfile(username: string) {
  const env = await getRequestEnv()
  return readPublicProfile(env.DB, username)
}

export async function getLeaderboard(category: LeaderboardCategory) {
  const env = await getRequestEnv()
  return readPublicLeaderboard(env.DB, category)
}

export async function getOwnLeaderboardEligibility(category: LeaderboardCategory) {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const [status, rank] = await Promise.all([readOwnLeaderboardEligibility(env.DB, identity.id), readOwnLeaderboardRank(env.DB, identity.id, category)])
  return { ownerId: identity.id, status, rank: status.isPublic && status.optedIn && !status.pending && status.totalFlights !== null && status.totalFlights >= 5 ? rank : null }
}
