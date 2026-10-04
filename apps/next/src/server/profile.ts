import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'
import { getProfileRow, toOwnProfile } from '../../../../functions/api/_lib/profiles'
import { readPublicProfile } from '../../../../functions/api/_services/publicProfiles'

export async function getOwnProfile() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const profile = await getProfileRow(env.DB, identity.id)
  return profile ? { ownerId: identity.id, profile: toOwnProfile(profile), publicView: profile.username ? await readPublicProfile(env.DB, profile.username) : null } : null
}

export async function getOwnProfileStats(userId: string) {
  const identity = await getRequestIdentity()
  if (!identity || identity.id !== userId) return null
  const env = await getRequestEnv()
  return env.DB.prepare('SELECT total_flights, countries_count, total_distance_km FROM user_stats WHERE user_id = ?')
    .bind(userId).first<{ total_flights: number; countries_count: number; total_distance_km: number }>()
}
