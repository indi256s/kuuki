import { GroundSkeleton } from '../../../client/ground/ground-skeleton'
import { getRequestLocale } from '../../../server/locale'

export default async function Loading() {
  return <GroundSkeleton locale={await getRequestLocale()} />
}
