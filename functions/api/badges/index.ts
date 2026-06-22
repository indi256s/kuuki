// GET /api/badges — public list of all badge definitions (criteria JSON-parsed by the mapper).

import { runHandler, json } from '../_lib/http'
import type { RequestData } from '../_lib/auth'
import { toBadgeDefinition } from '../_lib/badges'
import type { BadgeDefinitionRow } from '../_lib/badges'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { results } = await context.env.DB
      .prepare('SELECT * FROM badge_definitions ORDER BY category, tier')
      .all<BadgeDefinitionRow>()
    return json((results ?? []).map(toBadgeDefinition))
  })
