import { redirect } from 'next/navigation'
export default async function Flights({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const allowed = new URLSearchParams()
  for (const key of ['q', 'year', 'sortField', 'sortOrder', 'page', 'isUpcoming', 'airlineIata', 'aircraftIcao', 'origin', 'destination', 'originCodes', 'destinationCodes', 'airlineIataCodes']) { const value = query[key]; if (typeof value === 'string') allowed.set(key, value) }
  if (typeof query.search === 'string' && !allowed.has('q')) allowed.set('q', query.search)
  if (typeof query.sort === 'string' && !allowed.has('sortField')) allowed.set('sortField', query.sort)
  if (typeof query.order === 'string' && !allowed.has('sortOrder')) allowed.set('sortOrder', query.order)
  if (query.status === 'upcoming' && !allowed.has('isUpcoming')) allowed.set('isUpcoming', 'true')
  if (query.status === 'past' && !allowed.has('isUpcoming')) allowed.set('isUpcoming', 'false')
  redirect(`/journal${allowed.size ? `?${allowed}` : ''}`)
}
