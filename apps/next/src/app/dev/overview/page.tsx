import { notFound } from 'next/navigation'
import { DevOverview } from './dev-overview'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'

export const dynamic = 'force-dynamic'
export default async function DevOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string; theme?: string; locale?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { fixture, theme, locale } = await searchParams
  // JSON stays at this server boundary; only the selected fixture reaches the dev client.
  const payload =
    fixture === 'empty'
      ? (await import('../../../../../../packages/shared/src/overview/__fixtures__/n0.json'))
          .default
      : fixture === 'n1'
        ? (await import('../../../../../../packages/shared/src/overview/__fixtures__/n1.json'))
            .default
        : fixture === 'aggregate'
          ? (await import('../../../../../../packages/shared/src/overview/__fixtures__/n5001.json'))
              .default
          : (await import('../../../../../../packages/shared/src/overview/__fixtures__/board.json'))
              .default
  const prefs = structuredClone(DEFAULT_PREFS)
  if (fixture === 'zero') prefs.filter = { period: { years: [2016] }, airlines: ['QR'] }
  return (
    <DevOverview
      payload={payload as OverviewPayload}
      prefs={prefs}
      theme={theme === 'dark' ? 'dark' : 'light'}
      locale={locale === 'ru' ? 'ru' : 'en'}
    />
  )
}
