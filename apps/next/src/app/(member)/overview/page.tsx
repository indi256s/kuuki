import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOwnOverview } from '../../../server/overview'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { requireOnboardedMember } from '../../../server/gates'
import { normalizeOverviewQuery, withQuery } from '../../../lib/url-state'
import { IdentitySnapshot } from '../../../client/activity'
import { ReadFreshness } from '../../../client/freshness'
import { S, t } from '../../../client/overview/copy'
import { referenceLabels } from '../../../client/overview/labels'
import { OverviewFailure, OverviewView } from '../../../client/overview/view'
import type { Locale } from '../../../server/locale'
import type { OverviewPeriod } from '../../../../../../packages/shared/src/overview'
import '../../reads.css'

type Owned = NonNullable<Awaited<ReturnType<typeof getOwnOverview>>>

// A failed read is an explicit state with a retry, never an empty summary.
async function readOrFail(period: OverviewPeriod): Promise<Owned | 'failed' | null> {
  try { return await getOwnOverview(period) } catch (error) {
    console.error(JSON.stringify({ event: 'overview_read_failed', message: error instanceof Error ? error.message : 'unknown' }))
    return 'failed'
  }
}

async function OverviewData({ period, locale }: { period: OverviewPeriod; locale: Locale }) {
  const owned = await readOrFail(period)
  if (!owned) redirect('/signin')
  if (owned === 'failed') return <OverviewFailure period={period} locale={locale} />
  return <IdentitySnapshot ownerId={owned.ownerId}>
    <ReadFreshness ownerId={owned.ownerId} revision={owned.summary.revision} publishedRevision={owned.summary.publishedRevision} derivedState={owned.summary.derivedState} locale={locale} />
    <OverviewView ownerId={owned.ownerId} summary={owned.summary} locale={locale} labels={referenceLabels(locale)} />
  </IdentitySnapshot>
}

export const generateMetadata = () => pageMetadata('Overview', 'Обзор')
export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOnboardedMember()
  const locale = await getRequestLocale()
  const normalized = normalizeOverviewQuery(await searchParams)
  if (!normalized.canonical) redirect(withQuery('/overview', normalized.query))
  const period: OverviewPeriod = (normalized.state.year ?? 'all') as OverviewPeriod
  return <><div className="page-heading"><p className="eyebrow">{t(S.eyebrow, locale)}</p><h1>{t(S.heading, locale)}</h1><p className="lead">{t(S.lead, locale)}</p></div>
    <Suspense key={period} fallback={<p className="loading" data-testid="overview-loading" role="status">{t(S.loading, locale)}</p>}><OverviewData period={period} locale={locale} /></Suspense></>
}
