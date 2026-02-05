# Phase 4: Social

**Status:** ✅ Complete
**Depends on:** Phase 3 complete

## Tasks

### Public Profiles ✅

**Skill:** `/frontend-design`
**Workflow:** `/code-review:code-review` (security review before exposing)

**URL:** `/u/{username}` (aliased to `/fly/{username}`)

**What's public:**

- [x] Username, display name, avatar, bio (140 chars)
- [x] Stats: flights, distance, countries, cities, airlines
- [x] Badges earned
- [x] Leaderboard percentile rankings

**What's private:**

- [x] All individual flights
- [x] Route map

**Compare feature:** ✅

- [x] Curated comparison (top 5 most interesting stats)
- [x] Option for full side-by-side ("You vs Them")
- [x] Overlaid bar charts

### Leaderboard System ✅

**Skill:** `/interface-design`
**MCP:** `supabase` (materialized views with trigger refresh)

**Categories:**

| Category | Metric |
|----------|--------|
| countries | Unique countries visited |
| cities | Unique cities visited |
| flights | Total flight count |
| distance | Total km flown |
| airlines | Unique airlines |

- [x] **Display:** Percentile only ("You're in the top 15%")
- [x] **Opt-in:** User must enable `show_on_leaderboards` in settings
- [x] **Anti-gaming:** Community trust, public profiles, reporting

### Badge Evaluation ✅

**MCP:** `supabase` (database triggers on flight insert)

**Categories:**

| Type | Examples |
|------|----------|
| Milestones | First Flight, Frequent Flyer (50), Centurion (100), Circumnavigator |
| Explorer | Arctic Circle, Equator Hopper, Island Collector |
| Collector | Fleet Master, Alliance Ace, Retro |
| Achievement | Iron Butt (12+ hr), Night Owl, Jet Setter |

- [x] **Display:** Earned badges only, no progress indicators

## Files to Create

```
apps/web/src/
├── components/
│   ├── profile/
│   │   ├── PublicProfile.tsx
│   │   ├── ProfileStats.tsx
│   │   ├── ProfileBadges.tsx
│   │   └── CompareView.tsx
│   └── leaderboard/
│       ├── Leaderboard.tsx
│       ├── LeaderboardCategory.tsx
│       └── PercentileRank.tsx
├── hooks/
│   ├── useProfile.ts
│   ├── useLeaderboard.ts
│   └── useBadges.ts
└── routes/
    ├── ProfilePage.tsx
    └── LeaderboardPage.tsx
```

## Database

```sql
-- Materialized view for stats
CREATE MATERIALIZED VIEW user_stats_mv AS
SELECT
  user_id,
  COUNT(*) as total_flights,
  SUM(distance_km) as total_distance_km,
  COUNT(DISTINCT origin) + COUNT(DISTINCT destination) as airports_count,
  -- ... more aggregations
FROM flights
WHERE is_upcoming = false
GROUP BY user_id;

-- Refresh trigger
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats_mv;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```
