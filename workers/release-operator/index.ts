import { timingSafeEqual } from '../../functions/api/_lib/crypto'
import {
  STALE_DERIVED_PREDICATE,
  repairUserDerivedState,
} from '../../functions/api/_services/derivedState'
import { refreshLeaderboards } from '../../functions/api/_services/leaderboard'

interface OperatorEnv {
  DB: D1Database
  OPERATOR_TOKEN: string
}

export default {
  async fetch(request: Request, env: OperatorEnv): Promise<Response> {
    const authorization = request.headers.get('Authorization')
    if (
      !env.OPERATOR_TOKEN ||
      !authorization?.startsWith('Bearer ') ||
      authorization.length === 7
    ) {
      return new Response(null, { status: 401 })
    }
    // Hash first so the existing byte comparator always receives two fixed-length values.
    const encoder = new TextEncoder()
    const [actual, expected] = await Promise.all(
      [authorization.slice(7), env.OPERATOR_TOKEN].map((value) =>
        crypto.subtle.digest('SHA-256', encoder.encode(value)),
      ),
    )
    if (!timingSafeEqual(new Uint8Array(actual), new Uint8Array(expected)))
      return new Response(null, { status: 401 })

    const path = new URL(request.url).pathname
    if (request.method === 'GET' && path === '/status') {
      return Response.json(
        await env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM flights) AS flights,
        (SELECT COUNT(*) FROM user_derived_state WHERE ${STALE_DERIVED_PREDICATE}) AS dirty,
        (SELECT COUNT(*) FROM flights WHERE duration_minutes IS NOT NULL AND duration_source IS NULL) AS metricsNull`).first(),
      )
    }
    if (request.method === 'POST' && path === '/repair') {
      const dirty = await env.DB.prepare(`SELECT user_id FROM user_derived_state
        WHERE ${STALE_DERIVED_PREDICATE} ORDER BY updated_at ASC, user_id LIMIT ?`)
        .bind(50)
        .all<{ user_id: string }>()
      let repaired = 0,
        failed = 0
      for (const { user_id } of dirty.results) {
        try {
          const result = await repairUserDerivedState(env.DB, user_id)
          if (result.derived_state === 'ready') repaired++
          else failed++
        } catch {
          failed++
        }
      }
      const remaining = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM user_derived_state WHERE ${STALE_DERIVED_PREDICATE}`,
      ).first<{ n: number }>()
      return Response.json({ repaired, failed, remaining: remaining!.n })
    }
    if (request.method === 'POST' && path === '/refresh-leaderboards') {
      await refreshLeaderboards(env.DB)
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM leaderboard_cache').first<{
        n: number
      }>()
      return Response.json({ rows: count!.n })
    }
    return new Response(null, { status: 404 })
  },
}
