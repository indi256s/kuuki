import { redirect } from 'next/navigation'
import { normalizeOverviewQuery, withQuery } from '../../lib/url-state'

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { state } = normalizeOverviewQuery(await searchParams)
  redirect(withQuery('/overview', state.year ? `year=${state.year}` : ''))
}
