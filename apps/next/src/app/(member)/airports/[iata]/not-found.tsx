import { requireOnboardedMember } from '../../../../server/gates'
import { AirportNotFound } from '../../../../client/airport-models/airport-states'
import { getRequestLocale } from '../../../../server/locale'
export default async function NotFound() {
  await requireOnboardedMember()
  return <AirportNotFound locale={await getRequestLocale()} />
}
