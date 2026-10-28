import { HttpError } from '../_lib/http'
import { isUserAnalyticsAdmin } from '../_lib/userAnalyticsAccess'

export interface UserAnalyticsData {
  days: 7 | 30 | 90
  asOf: string
  startDate: string
  activity: { since: string | null; daily: number; weekly: number; monthly: number }
  totals: {
    users: number
    onboarded: number
    withEntries: number
    publicProfiles: number
    flights: number
    railJourneys: number
    roadTrips: number
    importUsers: number
  }
  period: {
    newUsers: number
    previousNewUsers: number
    contributors: number
    flightsAdded: number
    groundAdded: number
  }
  daily: Array<{ date: string; users: number; flights: number; ground: number }>
}

// Records retained by current accounts, rather than a historical event ledger. Travel dates,
// automatic confirmations and session refreshes do not measure someone adding journal content.
const events = `WITH events AS (
  SELECT id AS user_id, created_at, 'users' AS kind FROM users
  UNION ALL
  SELECT f.user_id, f.created_at, 'flights' FROM flights f JOIN users u ON u.id = f.user_id
  UNION ALL
  SELECT g.user_id, g.created_at, 'ground' FROM ground_journeys g JOIN users u ON u.id = g.user_id
  WHERE g.deleted_at IS NULL
)`

export async function readUserAnalytics(
  env: Pick<Env, 'DB' | 'ADMIN_USER_ID'>,
  userId: string | null,
  days: 7 | 30 | 90 = 30,
  now: Date = new Date(),
): Promise<UserAnalyticsData> {
  if (!isUserAnalyticsAdmin(env, userId)) {
    throw new HttpError(403, 'Access denied', 'FORBIDDEN')
  }

  const asOf = now.toISOString()
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - days + 1)
  const previousStart = new Date(start)
  previousStart.setUTCDate(previousStart.getUTCDate() - days)
  const startIso = start.toISOString()

  const [totalsResult, periodResult, dailyResult, activityResult] = await env.DB.batch([
    env.DB.prepare(`SELECT
      COUNT(*) AS users,
      (SELECT COUNT(*) FROM profiles p JOIN users u ON u.id = p.id WHERE p.onboarded_at IS NOT NULL) AS onboarded,
      SUM(CASE WHEN
        EXISTS (SELECT 1 FROM flights f WHERE f.user_id = u.id)
        OR EXISTS (SELECT 1 FROM ground_journeys g WHERE g.user_id = u.id AND g.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM country_claims c WHERE c.user_id = u.id)
        OR EXISTS (SELECT 1 FROM ground_visits v WHERE v.user_id = u.id)
        THEN 1 ELSE 0 END) AS withEntries,
      (SELECT COUNT(*) FROM profiles p JOIN users u ON u.id = p.id
        WHERE p.is_public = 1 AND length(trim(COALESCE(p.username, ''))) > 0) AS publicProfiles,
      (SELECT COUNT(*) FROM flights f JOIN users u ON u.id = f.user_id) AS flights,
      (SELECT COUNT(*) FROM ground_journeys g JOIN users u ON u.id = g.user_id
        WHERE g.deleted_at IS NULL AND g.mode = 'rail') AS railJourneys,
      (SELECT COUNT(*) FROM ground_journeys g JOIN users u ON u.id = g.user_id
        WHERE g.deleted_at IS NULL AND g.mode = 'road') AS roadTrips,
      (SELECT COUNT(DISTINCT f.user_id) FROM flights f JOIN users u ON u.id = f.user_id
        WHERE f.source = 'ai_import') AS importUsers
      FROM users u`),
    env.DB.prepare(`${events} SELECT
      COUNT(CASE WHEN kind = 'users' AND julianday(created_at) >= julianday(?1) THEN 1 END) AS newUsers,
      COUNT(CASE WHEN kind = 'users' AND julianday(created_at) < julianday(?1) THEN 1 END) AS previousNewUsers,
      COUNT(DISTINCT CASE WHEN kind <> 'users' AND julianday(created_at) >= julianday(?1) THEN user_id END) AS contributors,
      COUNT(CASE WHEN kind = 'flights' AND julianday(created_at) >= julianday(?1) THEN 1 END) AS flightsAdded,
      COUNT(CASE WHEN kind = 'ground' AND julianday(created_at) >= julianday(?1) THEN 1 END) AS groundAdded
      FROM events WHERE julianday(created_at) >= julianday(?2) AND julianday(created_at) <= julianday(?3)`).bind(
      startIso,
      previousStart.toISOString(),
      asOf,
    ),
    env.DB.prepare(`${events} SELECT date(created_at) AS date,
      COUNT(CASE WHEN kind = 'users' THEN 1 END) AS users,
      COUNT(CASE WHEN kind = 'flights' THEN 1 END) AS flights,
      COUNT(CASE WHEN kind = 'ground' THEN 1 END) AS ground
      FROM events WHERE julianday(created_at) >= julianday(?) AND julianday(created_at) <= julianday(?)
      GROUP BY date(created_at)`).bind(startIso, asOf),
    env.DB.prepare(`SELECT
      (SELECT started_at FROM user_activity_collection WHERE id = 1) AS since,
      COUNT(DISTINCT CASE WHEN day = date(?1) THEN user_id END) AS daily,
      COUNT(DISTINCT CASE WHEN day >= date(?1, '-6 days') THEN user_id END) AS weekly,
      COUNT(DISTINCT user_id) AS monthly
      FROM user_activity_days a JOIN users u ON u.id = a.user_id
      WHERE day >= date(?1, '-29 days') AND day <= date(?1)
        AND julianday(first_seen_at) <= julianday(?1)`).bind(asOf),
  ])

  const totals = totalsResult.results[0] as UserAnalyticsData['totals']
  // SUM has no rows for an empty database; every count still has a numeric zero.
  totals.withEntries ??= 0
  const byDate = new Map(
    (dailyResult.results as UserAnalyticsData['daily']).map((row) => [row.date, row]),
  )
  const daily = Array.from({ length: days }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(day.getUTCDate() + index)
    const date = day.toISOString().slice(0, 10)
    return byDate.get(date) ?? { date, users: 0, flights: 0, ground: 0 }
  })

  return {
    days,
    asOf,
    startDate: startIso.slice(0, 10),
    activity: activityResult.results[0] as UserAnalyticsData['activity'],
    totals,
    period: periodResult.results[0] as UserAnalyticsData['period'],
    daily,
  }
}
