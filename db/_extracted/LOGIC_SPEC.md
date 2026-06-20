# Live Supabase logic — extraction & TS porting spec

> Extracted verbatim from the live project `cwmotwkvpdkfrtjxmoce` (pg_get_functiondef) on
> 2026-06-20. These PL/pgSQL functions + triggers are the **source of truth** for the
> TypeScript service reimplementation (D1 has no PL/pgSQL). Port EXACTLY — the quirks are
> intentional parity, not bugs to fix. Invite functions (`check_invite_code`,
> `use_invite_code`, `generate_invite_code`) are intentionally **dropped** (open registration).

## Live data snapshot (rows): 26 users/profiles · 343 flights · 171 visits · 37 country_claims ·
## 15 ground_visits · 17 user_stats · 17 user_advanced_stats · 26 user_badges · 25 leaderboard_cache
## · ref: 214 aircraft · 525 airports · 60 badges · 50 adjectives · 50 nouns

## Trigger chain (what fires when)

| Table | Trigger | When | Function | Port target |
|---|---|---|---|---|
| flights | trg_fill_flight_distance | BEFORE INS/UPD | fill_flight_distance → haversine_km | TS: in create/update flight handler, before insert |
| flights | flights_enrichment_status_trigger | BEFORE UPD | trigger_update_enrichment_status | TS: in update handler |
| flights | flights_stats_trigger | AFTER INS/UPD/DEL | trigger_update_user_stats → recalculate_user_stats | TS: after write → recomputeUserStats |
| flights | flights_visits_trigger | AFTER INS/UPD (NOT del) | update_visits_from_flight | TS: after write → syncVisitsFromFlight |
| ground_visits | ground_visits_stats_trigger | AFTER INS/UPD/DEL | trigger_update_stats_from_ground_visits → recalculate_user_stats | **NO-OP** (recalc ignores ground_visits) — skip |
| profiles | founding_badge_trigger | AFTER INS | award_founding_badge_on_signup | TS: in signup, after profile insert |
| profiles | profiles_leaderboard_refresh_trigger | AFTER UPD | refresh on show_on_leaderboards change | Cron handles refresh |
| profiles | profiles_updated_at | BEFORE UPD | update_updated_at | TS: set updated_at in handler |
| user_stats | stats_leaderboard_refresh_trigger | AFTER INS/UPD | refresh_leaderboards (30s debounce) | **Cron** (every 5 min) instead |
| user_stats | user_stats_unlock_trigger | AFTER INS/UPD | update_advanced_stats_unlocks | TS: chain after recomputeUserStats |
| auth.users | on_auth_user_created | AFTER INS | handle_new_user | TS: in signup handler |

**Write-path order** (port into flight create/update handlers):
1. fill distance/duration (if null) → 2. enrichment_status (on update) → write row →
3. syncVisitsFromFlight → 4. recomputeUserStats → 5. updateAdvancedStatsUnlocks → 6. evaluateBadges →
7. (advanced stats: see D4 decision — recommend refreshAdvancedStats here too). Leaderboards = Cron.

**Duration precedence (RESOLVED — implemented in Phase 4, do not re-litigate):** when both the
tz-aware path and the distance fallback could set `duration_minutes`, run them in this order so they
never clobber: (a) `computeFlightDuration` FIRST, passing the incoming `duration_minutes` as
`existingDurationMinutes` — it sets `departure_utc`/`arrival_utc` and the authoritative tz-aware
`duration_minutes` (returns the existing value unchanged when times/tzs are incomplete); (b)
`fillDistanceAndDuration` SECOND, seeded with that tz duration — its `duration == null` guard means
the distance-derived duration only fills when the tz path produced nothing. Implemented in
`functions/api/flights/index.ts` (create) and `flights/[id].ts` (update).

## Geometry / distance

```
haversine_km(lat1,lon1,lat2,lon2): r=6371; ROUTING_FACTOR=1.10;
  a = sin(Δlat/2)² + cos(lat1)cos(lat2)sin(Δlon/2)²  (lat/lon in radians)
  c = 2*atan2(√a, √(1-a));  return round(r*c*1.10)   // integer km
```
`fill_flight_distance` (only when `distance_km IS NULL`): look up origin+dest in airports_reference;
if both have lat/long → distance = haversine. Then if `duration_minutes IS NULL` and dist>0:
`overhead = dist>3000 ? 45 : 30; duration = round(dist/800*60 + overhead)` (800 km/h cruise).

## recalculate_user_stats(user) — writes user_stats

Completed flights only = `is_upcoming IS NULL OR is_upcoming=FALSE`.
- total_flights = COUNT(completed)
- total_distance_km = COALESCE(SUM(distance_km),0)
- longest_flight_minutes = COALESCE(MAX(duration_minutes),0)
- total_duration_minutes = COALESCE(SUM(duration_minutes),0)
- airlines_count = COUNT(DISTINCT airline_iata WHERE not null, completed)
- aircraft_count = COUNT(DISTINCT aircraft_icao WHERE not null, completed)
- airports_count = COUNT(DISTINCT airport_iata) **from visits** (not flights)
- countries_count = COUNT(DISTINCT country_code) **from visits only** (NOT ∪ claims)
- cities_count = COUNT(DISTINCT city) **from visits**
- continents_count = COUNT(DISTINCT continentOf(country_code)) **from visits**, using the **7-bucket map**
  below (NA/SA separate); 'OTHER' is counted as a bucket too (CASE has no exclusion).
- has_night_departure = EXISTS(completed flight with departure_time in [00:00,05:00))
- **Does NOT set**: most_visited_country, most_visited_count, world_completion_pct, time_zones_count
  (remain at default 0/null — match prod; frontend tolerates).
- Upsert ON CONFLICT(user_id).

### Continent map A — used by recalculate_user_stats (7 buckets: NA, SA, EU, AS, OC, AF, OTHER)
NA: US CA MX GT BZ SV HN NI CR PA CU JM HT DO PR BS TT BB
SA: BR AR CL CO PE VE EC BO PY UY GY SR
EU: GB DE FR IT ES PT NL BE CH AT PL CZ HU RO BG GR SE NO DK FI IE LU SK SI HR RS UA BY LT LV EE MD AL MK ME BA XK IS MT CY MC SM AD LI VA
AS: RU CN JP KR IN TH VN MY SG ID PH TW HK MO KZ UZ TM KG TJ MN NP BD LK PK AF IR IQ SA AE QA KW BH OM YE JO LB SY IL PS TR GE AM AZ MM LA KH BN TL
OC: AU NZ FJ PG NC PF WS TO VU SB GU FM MH PW KI NR TV CK NU TK WF AS
AF: ZA EG MA DZ TN LY NG KE ET GH TZ UG SD SS SN CI CM ZW AO MZ MG ZM BW NA MU RE RW BJ TG ML BF NE TD SO DJ ER MW LS SZ GM GN GW SL LR GA CG CD CF GQ ST CV KM SC YT
else OTHER.

### Continent map B — used by compute_continent_breakdown & compute_region_breakdown
Same country lists BUT keys are lowercase and **NA+SA both → 'americas'**: americas/europe/asia/
oceania/africa/other. `compute_continent_breakdown` EXCLUDES 'other' from output; `compute_region_
breakdown` INCLUDES it. Value = COUNT(DISTINCT country_code) per bucket.

→ Put both maps in `packages/data` once; expose `continentOf7(cc)` and `regionOf(cc)`.

## update_visits_from_flight(NEW) — derives visits (INS/UPD only)

- DELETE → no-op (visits are cumulative; deleting a flight does NOT remove/decrement visits).
- Skip if `NEW.is_upcoming = TRUE`.
- For origin AND destination: look up airports_reference by iata; if found, upsert visits:
  `INSERT (user_id, country_code, city, airport_iata, first_visit=NEW.date, last_visit=NEW.date, visit_count=1)
   ON CONFLICT(user_id, airport_iata) DO UPDATE SET last_visit=max(existing,NEW.date),
   first_visit=min(existing,NEW.date), visit_count=visit_count+1`.
- Unknown airports (not in reference) are skipped silently.

## evaluate_badges(user) — awards user_badges (ELSIF: first matching criterion wins per badge)

Load user_stats; if none, return. Compute `user_number = 1 + COUNT(profiles WHERE created_at < this
profile.created_at)`. For each badge_definitions row, check its `criteria` JSON (only ONE key matters
due to ELSIF order):
1. flights: total_flights >= criteria.flights
2. distance_km: total_distance_km >= criteria.distance_km
3. airlines: airlines_count >= criteria.airlines
4. aircraft: aircraft_count >= criteria.aircraft
5. continents: continents_count >= criteria.continents   (scalar only — NO per-continent logic)
6. flight_minutes: longest_flight_minutes >= criteria.flight_minutes
7. night_departure: has_night_departure = TRUE
8. early_adopter: user_number <= criteria.early_adopter
9. beta_invite: **always TRUE** (any badge whose criteria has this key is auto-awarded)
If earned → INSERT user_badges ON CONFLICT(user_id,badge_id) DO NOTHING.

`award_founding_badge_on_signup`: on profile INSERT, award badge where `code='founding-user'`.

## update_advanced_stats_unlocks(user_stats NEW) — upserts user_advanced_stats unlock flags
avia_geek_unlocked = aircraft_count>=5; country_geek_unlocked = countries_count>=5;
duration_unlocked = total_flights>=10. Upsert ON CONFLICT(user_id).

## refresh_leaderboards() — full rebuild of leaderboard_cache (run via CRON, not per-write)

`v_total_users = COUNT(user_stats JOIN profiles WHERE total_flights>=5 AND show_on_leaderboards=TRUE)`.
`DELETE FROM leaderboard_cache` (all rows). Then for each of **5 categories**, INSERT one row per
eligible user:
| category | value column | (eligibility = total_flights>=5 AND show_on_leaderboards) |
|---|---|---|
| flights | total_flights |
| distance | total_distance_km |
| countries | countries_count |
| cities | **airports_count** (quirk: "cities" ranks airports, preserve) |
| airlines | airlines_count |
rank = ROW_NUMBER() OVER (ORDER BY <value> DESC, profiles.created_at ASC).
percentile = ROUND((1 - rank/v_total_users)*100, 1).  (Guard total>0 in TS; prod can't hit 0 because
rows only exist when ≥1 eligible user.)
metadata = {username, display_name, avatar_url} from profiles.

## refresh_advanced_stats(user) — composes compute_* into user_advanced_stats

Requires user_stats to exist. Computes & upserts (ON CONFLICT user_id):
- avia_geek/country_geek/duration unlocks (same thresholds 5/5/10)
- aircraft_breakdown = compute_aircraft_breakdown()->'aircraft'  (top-10 icao→count map)
- manufacturer_breakdown = compute_aircraft_breakdown()->'manufacturers' (manufacturer→count via aircraft_reference, COALESCE 'Unknown')
- aircraft_type_breakdown = compute_aircraft_type_breakdown()  ({types:{type→count}, most_flown:{icao,name,count,total_flights}})
- continent_breakdown = compute_continent_breakdown()  (map B, excludes 'other')
- region_breakdown = compute_region_breakdown()  (map B, includes 'other')
- duration_stats = compute_duration_stats()  ({total_minutes, avg_minutes, longest_minutes, longest_flight_id, shortest_minutes(NULLIF 0), shortest_flight_id, flight_count}; completed + duration not null)
- departure_patterns = compute_departure_patterns()  (buckets by EXTRACT(HOUR): red_eye [22..6), early [6..12), business [12..18), evening [18..22); + total_with_time; returns NULL if total=0; ALL flights incl upcoming)
- duration_coverage = compute_duration_coverage()  (ROUND(count(duration>0)/count(all)*100, 1); all flights)
- fleet_insights = compute_fleet_insights()  (hero = top aircraft by count; fun_fact by distance/duration thresholds — GLaDOS prose, see source)
- manufacturer_insights = compute_manufacturer_insights()  (dominant manufacturer + loyalty_label/quip by pct thresholds ≥80/≥60/≥40/else)
NOTE: `card_insights` and `duration_year_comparison` are populated by SEPARATE functions
(compute_card_insights, compute_duration_year_comparison), NOT by refresh_advanced_stats. They UPDATE
user_advanced_stats directly. Port them and call from the advanced-stats refresh path.

All `aircraft_*`/`manufacturer_*` aggregations use completed flights (is_upcoming false/null) with
aircraft_icao not null, LEFT JOIN aircraft_reference on icao.

## handle_new_user (signup) — minimal
Insert profiles(id=auth.user.id, display_name = metadata.full_name || metadata.name,
avatar_url = metadata.avatar_url). **No username, no user_stats row** (user_stats is created lazily by
recalculate_user_stats upsert; advanced_stats by its upserts). username stays NULL until set in app.

## GLaDOS prose strings (fleet_insights / manufacturer_insights) — copy verbatim
See the extracted function bodies (re-query live DB or git history) for the exact `format()` template
strings and thresholds. They are user-facing copy; reproduce character-for-character.
