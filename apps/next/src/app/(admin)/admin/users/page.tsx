import { Suspense } from 'react'
import { IdentitySnapshot } from '../../../../client/activity'
import { UserAnalytics } from '../../../../client/admin/user-analytics'
import { LoadingScreen } from '../../../../client/loading-screen'
import { getRequestLocale, type Locale } from '../../../../server/locale'
import { pageMetadata } from '../../../../server/metadata'
import { getUserAnalytics, requireUserAnalyticsAdmin } from '../../../../server/user-analytics'

export const generateMetadata = () =>
  pageMetadata('Users', 'Пользователи', { robots: { index: false, follow: false } })

async function AnalyticsData({ days, locale }: { days: 7 | 30 | 90; locale: Locale }) {
  return <UserAnalytics data={await getUserAnalytics(days)} locale={locale} />
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { ownerId } = await requireUserAnalyticsAdmin()
  const locale = await getRequestLocale()
  const query = await searchParams
  const days = query.days === '7' ? 7 : query.days === '90' ? 90 : 30
  return (
    <IdentitySnapshot ownerId={ownerId}>
      <Suspense key={days} fallback={<LoadingScreen locale={locale} />}>
        <AnalyticsData days={days} locale={locale} />
      </Suspense>
    </IdentitySnapshot>
  )
}
