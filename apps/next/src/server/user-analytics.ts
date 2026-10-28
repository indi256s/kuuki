import 'server-only'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { isUserAnalyticsAdmin } from '../../../../functions/api/_lib/userAnalyticsAccess'
import { readUserAnalytics } from '../../../../functions/api/_services/userAnalytics'
import { getRequestEnv, getRequestIdentity } from './identity'

export const requireUserAnalyticsAdmin = cache(async () => {
  const identity = await getRequestIdentity()
  if (!identity) redirect('/signin')
  const env = await getRequestEnv()
  if (!isUserAnalyticsAdmin(env, identity.id)) notFound()
  return { env, ownerId: identity.id }
})

export async function getUserAnalytics(days: 7 | 30 | 90) {
  const { env, ownerId } = await requireUserAnalyticsAdmin()
  return readUserAnalytics(env, ownerId, days)
}
