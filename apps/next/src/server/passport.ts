import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'
import {
  readPassport,
  type PassportData,
  type readCountryDetail,
} from '../../../../functions/api/_services/passport'

export type {
  Visit,
  Claim,
  GroundVisit,
  PassportData,
} from '../../../../functions/api/_services/passport'
/** Published country evidence: `status` is `pressed` or `pending` (awaiting-only, never a stamp). */
export type PassportCountry = PassportData['countries'][number]
/** GET /api/passport/countries/:cc/stats: published status plus every contributing entry (ADR 0001 §4). */
export type CountryDetail = Awaited<ReturnType<typeof readCountryDetail>>

export async function getOwnPassport() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const data = await readPassport(env.DB, identity.id)
  return { ownerId: identity.id, data }
}
