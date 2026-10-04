import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'
import { readPassport } from '../../../../functions/api/_services/passport'

export type { Visit, Claim, GroundVisit, PassportData } from '../../../../functions/api/_services/passport'

export async function getOwnPassport() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const data = await readPassport(env.DB, identity.id)
  return { ownerId: identity.id, data }
}
