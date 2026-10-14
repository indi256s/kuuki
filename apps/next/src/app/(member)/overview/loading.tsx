import { OverviewLoadingScreen } from '../../../client/loading-screen'
import { getRequestLocale } from '../../../server/locale'

export default async function Loading() {
  return <OverviewLoadingScreen locale={await getRequestLocale()} />
}
