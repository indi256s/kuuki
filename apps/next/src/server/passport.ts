import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'
import { readPassportCollection } from '../../../../functions/api/_services/passport'

type Collection = Awaited<ReturnType<typeof readPassportCollection>>
export type Visit = Collection['visits'][number]
export type Claim = Collection['claims'][number]
export type GroundVisit = Collection['groundVisits'][number]
/** Published country evidence: `status` is `pressed` or `pending` (awaiting-only, never a stamp). */
export type PassportCountry = Collection['countries'][number]
export type PassportData = Collection & { updatedAt: number }

export async function getOwnPassport() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const data: PassportData = { ...(await readPassportCollection(env.DB, identity.id)), updatedAt: Date.now() }
  return { ownerId: identity.id, data }
}
