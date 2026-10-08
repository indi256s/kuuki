import { Skeleton } from '../../../client/ui/skeleton'
import { getRequestLocale } from '../../../server/locale'

export default async function Loading() {
  const locale = await getRequestLocale()
  const label = locale === 'ru' ? 'Загрузка обзора…' : 'Loading overview…'
  return <div className="ov3-page" lang={locale}>
    <Skeleton height={36} label={label} />
    <Skeleton height={436} label={label} />
    <Skeleton height={240} label={label} />
  </div>
}
