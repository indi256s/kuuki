import { redirect } from 'next/navigation'
import { normalizeJournalQuery, withQuery } from '../../lib/url-state'
export default async function Flights({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  if (query.status === 'past') query.status = 'completed'
  redirect(withQuery('/journal', normalizeJournalQuery(query).query))
}
