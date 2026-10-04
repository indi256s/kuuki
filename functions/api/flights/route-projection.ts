// Private, compact route projection for the opened map. Directed duplicates are
// aggregated; coordinates come from D1's authoritative airport reference.
import { runHandler, json, HttpError } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'

type RouteRow = {
  origin: string; destination: string; count: number; last_date: string
  origin_lat: number | null; origin_lng: number | null
  destination_lat: number | null; destination_lng: number | null
  origin_country: string | null; destination_country: string | null
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = context => runHandler(async () => {
  const user = requireUser(context.data)
  const period = new URL(context.request.url).searchParams.get('period') ?? 'all'
  if (period !== 'all' && !/^\d{4}$/.test(period)) throw new HttpError(400, 'Invalid period')
  const where = period === 'all' ? '' : 'AND f.date >= ? AND f.date <= ?'
  const binds = period === 'all' ? [user.id] : [user.id, `${period}-01-01`, `${period}-12-31`]
  const result = await context.env.DB.prepare(`
    SELECT f.origin, f.destination, COUNT(*) AS count, MAX(f.date) AS last_date,
      o.latitude AS origin_lat, o.longitude AS origin_lng, o.country_code AS origin_country,
      d.latitude AS destination_lat, d.longitude AS destination_lng, d.country_code AS destination_country
    FROM flights f
    LEFT JOIN airports_reference o ON o.iata = f.origin
    LEFT JOIN airports_reference d ON d.iata = f.destination
    WHERE f.user_id = ? AND f.is_upcoming = 0 ${where}
    GROUP BY f.origin, f.destination
    ORDER BY last_date DESC, f.origin, f.destination
  `).bind(...binds).all<RouteRow>()
  if (!result.success || !Array.isArray(result.results)) throw new Error('Route projection query failed')
  return json({ period, ownerId: user.id, routes: result.results.map(row => ({
    origin: row.origin, destination: row.destination, count: row.count, lastDate: row.last_date,
    originCountry: row.origin_country, destinationCountry: row.destination_country,
    from: row.origin_lat === null || row.origin_lng === null ? null : [row.origin_lng, row.origin_lat],
    to: row.destination_lat === null || row.destination_lng === null ? null : [row.destination_lng, row.destination_lat],
  })) })
})
