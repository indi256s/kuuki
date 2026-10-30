import { OverviewSkeleton } from '../../../client/overview/page/overview-skeleton'
import { getRequestLocale } from '../../../server/locale'

export default async function Loading() {
  return <OverviewSkeleton locale={await getRequestLocale()} />
}
