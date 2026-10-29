import { LoadingScreen } from '../../../../client/loading-screen'
import { getRequestLocale } from '../../../../server/locale'
export default async function Loading() {
  return <LoadingScreen locale={await getRequestLocale()} />
}
