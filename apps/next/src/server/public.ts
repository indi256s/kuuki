import 'server-only'
import { readPublicProfile } from '../../../../functions/api/_services/publicProfiles'
import { readPublicLeaderboard, readOwnLeaderboardEligibility, type LeaderboardCategory } from '../../../../functions/api/_services/publicLeaderboard'
import { getRequestEnv, getRequestIdentity } from './identity'

export async function getPublicProfile(username: string) {
  const env = await getRequestEnv()
  return readPublicProfile(env.DB, username)
}

export async function getLeaderboard(category: LeaderboardCategory) {
  const env = await getRequestEnv()
  return readPublicLeaderboard(env.DB, category)
}

export async function getOwnLeaderboardEligibility() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  return { ownerId: identity.id, status: await readOwnLeaderboardEligibility(env.DB, identity.id) }
}
