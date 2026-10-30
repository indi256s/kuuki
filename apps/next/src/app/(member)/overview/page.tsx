import { Suspense } from 'react'
import { DEFAULT_ORDER } from '@kuuki/shared/overview/prefs'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getOwnOverviewData,
  getOwnOverviewPrefs,
  preloadOwnOverview,
} from '../../../server/overview'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { requireOnboardedMember } from '../../../server/gates'
import { normalizeOverviewQuery, withQuery } from '../../../lib/url-state'
import { IdentitySnapshot } from '../../../client/activity'
import { OverviewPage } from '../../../client/overview/page/overview-page'
import { ChapterPreloads } from '../../../client/overview/sections/registry'
import Loading from './loading'
import type { Locale } from '../../../server/locale'

async function OverviewData({
  year,
  locale,
  ownerId,
  name,
}: {
  year: string | null
  locale: Locale
  ownerId: string
  name: string
}) {
  const [data, preferences] = await Promise.all([getOwnOverviewData(), getOwnOverviewPrefs()])
  if (!data || !preferences || data.ownerId !== ownerId || preferences.ownerId !== ownerId)
    redirect('/signin')
  const prefs = structuredClone(preferences.prefs)
  if (year) prefs.filter.period = { years: [Number(year)] }
  return (
    <IdentitySnapshot ownerId={ownerId}>
      <OverviewPage
        payload={data.payload}
        prefs={prefs}
        ownerKey={ownerId}
        locale={locale}
        name={name}
      />
    </IdentitySnapshot>
  )
}

export const generateMetadata = () => pageMetadata('Overview', 'Обзор')
export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  preloadOwnOverview()
  const own = await requireOnboardedMember()
  const locale = await getRequestLocale()
  const normalized = normalizeOverviewQuery(await searchParams)
  if (!normalized.canonical) redirect(withQuery('/overview', normalized.query))
  // A phone draws tiles, so only a larger screen fetches the chapter code while the data is still being read. A wrong guess only costs or skips that early fetch.
  const requestHeaders = await headers()
  const phone =
    requestHeaders.get('sec-ch-ua-mobile') === '?1' ||
    /Mobi|iPhone|iPod/.test(requestHeaders.get('user-agent') ?? '')
  return (
    <>
      {phone ? null : <ChapterPreloads ids={DEFAULT_ORDER} />}
      <Suspense fallback={<Loading />}>
        <OverviewData
          year={normalized.state.year}
          locale={locale}
          ownerId={own.ownerId}
          name={own.profile.display_name?.trim() || own.profile.username || ''}
        />
      </Suspense>
    </>
  )
}
