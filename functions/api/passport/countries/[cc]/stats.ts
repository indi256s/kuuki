// GET /api/passport/countries/:cc/stats — CountryStats for one country (FE fills countryName).

import { runHandler, json } from '../../../_lib/http'
import { requireUser, type RequestData } from '../../../_lib/auth'
import { toGroundVisit, type GroundVisitRow } from '../../../_lib/passportDtos'

interface VisitRow {
  first_visit: string
  last_visit: string
  visit_count: number
  airport_iata: string | null
  city: string | null
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const db = context.env.DB
    const cc = context.params.cc as string

    const [visitsRes, claimRes, groundRes] = await Promise.all([
      db
        .prepare(
          'SELECT first_visit, last_visit, visit_count, airport_iata, city FROM visits WHERE user_id = ? AND country_code = ?',
        )
        .bind(user.id, cc)
        .all<VisitRow>(),
      db
        .prepare('SELECT id FROM country_claims WHERE user_id = ? AND country_code = ? LIMIT 1')
        .bind(user.id, cc)
        .first<{ id: string }>(),
      db
        .prepare(
          'SELECT id, user_id, country_code, visit_year, note, entry_method, created_at FROM ground_visits WHERE user_id = ? AND country_code = ? ORDER BY created_at DESC',
        )
        .bind(user.id, cc)
        .all<GroundVisitRow>(),
    ])

    const visits = visitsRes.results ?? []
    const groundVisits = (groundRes.results ?? []).map(toGroundVisit)
    const isClaimed = !!claimRes

    let firstVisit = ''
    let lastVisit = ''
    let totalVisits = 0
    const airportStats = new Map<string, { name: string; city: string; visitCount: number }>()

    for (const v of visits) {
      const count = v.visit_count ?? 1
      totalVisits += count
      if (!firstVisit || v.first_visit < firstVisit) firstVisit = v.first_visit
      if (!lastVisit || v.last_visit > lastVisit) lastVisit = v.last_visit
      if (v.airport_iata) {
        const existing = airportStats.get(v.airport_iata)
        if (existing) {
          existing.visitCount += count
        } else {
          airportStats.set(v.airport_iata, { name: v.airport_iata, city: v.city ?? '', visitCount: count })
        }
      }
    }

    totalVisits += groundVisits.length

    const airports = Array.from(airportStats.entries())
      .map(([iata, s]) => ({ iata, name: s.name, city: s.city, visitCount: s.visitCount }))
      .sort((a, b) => b.visitCount - a.visitCount)

    return json({
      countryCode: cc,
      countryName: '',
      firstVisit,
      lastVisit,
      totalVisits,
      airports,
      isClaimed,
      groundVisits,
    })
  })
