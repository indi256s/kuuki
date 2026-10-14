import { GroundFormSkeleton } from '../../../../client/ground/ground-skeleton'
import { copy } from '../../../../client/ground/copy'
import { getRequestLocale } from '../../../../server/locale'

export default async function Loading() {
  const locale = await getRequestLocale()
  return <GroundFormSkeleton label={copy[locale].loadingForm} title />
}
