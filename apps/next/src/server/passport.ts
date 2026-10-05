import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'
import { readPassport, type PassportData } from '../../../../functions/api/_services/passport'

export type { Visit, Claim, GroundVisit, PassportData } from '../../../../functions/api/_services/passport'
/** Published country evidence: `status` is `pressed` or `pending` (awaiting-only, never a stamp). */
export type PassportCountry = PassportData['countries'][number]

export async function getOwnPassport() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const data = await readPassport(env.DB, identity.id)
  return { ownerId: identity.id, data }
}
