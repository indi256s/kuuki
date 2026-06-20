// GET /api/passport/countries — raw passport collections for the FE to merge with countries.json.

import { runHandler, json } from '../../_lib/http'
import { requireUser, type RequestData } from '../../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const db = context.env.DB

    const [visits, claims, groundVisits] = await Promise.all([
      db
        .prepare(
          'SELECT country_code, first_visit, last_visit, visit_count, airport_iata, city FROM visits WHERE user_id = ?',
        )
        .bind(user.id)
        .all(),
      db
        .prepare('SELECT country_code, claimed_at FROM country_claims WHERE user_id = ?')
        .bind(user.id)
        .all(),
      db
        .prepare('SELECT country_code FROM ground_visits WHERE user_id = ?')
        .bind(user.id)
        .all(),
    ])

    return json({
      visits: visits.results ?? [],
      claims: claims.results ?? [],
      groundVisits: groundVisits.results ?? [],
    })
  })
