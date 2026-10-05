import { redirect } from 'next/navigation'
import { normalizeOverviewQuery, withQuery } from '../../lib/url-state'

// Obsolete dashboard filters (airline, route, aircraft) are dropped; only the year survives.
export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { state } = normalizeOverviewQuery(await searchParams)
  redirect(withQuery('/overview', state.year ? `year=${state.year}` : ''))
}
