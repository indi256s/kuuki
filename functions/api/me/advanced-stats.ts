// GET /api/me/advanced-stats — the requester's pre-computed user_advanced_stats row, or null.
// Reads the derived table only (no recompute). JSON-TEXT columns are parsed and the three
// *_unlocked flags are coerced to booleans. The shape mirrors the raw Supabase row the
// frontend's useAdvancedStats hook consumes (snake_case keys; the hook maps to camelCase).

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'

interface AdvancedStatsRow {
  user_id: string
  aircraft_breakdown: string | null
  aircraft_type_breakdown: string | null
  manufacturer_breakdown: string | null
  manufacturer_insights: string | null
  fleet_insights: string | null
  continent_breakdown: string | null
  region_breakdown: string | null
  departure_patterns: string | null
  duration_stats: string | null
  duration_year_comparison: string | null
  patterns: string | null
  card_insights: string | null
  duration_coverage: number | null
  duration_unlocked: number
  avia_geek_unlocked: number
  country_geek_unlocked: number
  featured_fact: string | null
  featured_fact_index: number | null
  created_at: string
  updated_at: string
}

function parseJson(text: string | null): unknown {
  if (text == null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function toAdvancedStats(row: AdvancedStatsRow) {
  return {
    user_id: row.user_id,
    aircraft_breakdown: parseJson(row.aircraft_breakdown),
    aircraft_type_breakdown: parseJson(row.aircraft_type_breakdown),
    manufacturer_breakdown: parseJson(row.manufacturer_breakdown),
    manufacturer_insights: parseJson(row.manufacturer_insights),
    fleet_insights: parseJson(row.fleet_insights),
    continent_breakdown: parseJson(row.continent_breakdown),
    region_breakdown: parseJson(row.region_breakdown),
    departure_patterns: parseJson(row.departure_patterns),
    duration_stats: parseJson(row.duration_stats),
    duration_year_comparison: parseJson(row.duration_year_comparison),
    patterns: parseJson(row.patterns),
    card_insights: parseJson(row.card_insights),
    duration_coverage: row.duration_coverage,
    duration_unlocked: !!row.duration_unlocked,
    avia_geek_unlocked: !!row.avia_geek_unlocked,
    country_geek_unlocked: !!row.country_geek_unlocked,
    featured_fact: row.featured_fact,
    featured_fact_index: row.featured_fact_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const row = await context.env.DB.prepare('SELECT * FROM user_advanced_stats WHERE user_id = ?')
      .bind(user.id)
      .first<AdvancedStatsRow>()
    return json(row ? toAdvancedStats(row) : null)
  })
