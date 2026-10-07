# ADR 0002: Flight metrics and duration provenance

- **Status:** Accepted for implementation, 2026-10-07.
- **Scope:** [Overview Release 1](../plans/2026-10-07-overview-release-1-migrations.md), with scheduled-duration acceptance in Release 2.
- **Vocabulary:** [GLOSSARY.md](../../GLOSSARY.md), flight metrics vocabulary.

## Decision

The server becomes the authority for distance, time zones, duration and zones
overflown on every flight write. The historical backfill uses the same resolver
and reviewed compare-and-set SQL; a concurrent edit must never be overwritten.

### Distance

Distance is the haversine great circle with Earth radius 6371 km, rounded to
integer kilometres and clamped to 20 000 km. The former ×1.10 routing adjustment
was an unobserved allowance for a flown path. Removing it makes routes
consistent across clients and the server and reduces affected stored totals by
approximately 9.1% (`1 - 1 / 1.10`), subject to rounding and clamps.
An airport without coordinates keeps the clamped client distance or NULL;
the historical backfill leaves its distance untouched.

### Duration ladder

First available source wins, with durations clamped to 1 200 minutes:

1. `times`: the flight's own local departure and arrival times with both time zones.
2. `route_median`: at least three `times` samples from awaiting or logged flights,
   pooled across users. Prefer the same airline and flight number on the same
   directional route, then the same directional route alone.
3. `schedule`: scheduled times written only through the Release 2 accept path.
4. `estimate`: the calibrated block-time model.

`duration_source` is NULL exactly when `duration_minutes` is NULL once the
resolver and backfill are in place. The additive migration allows old writers
and existing durations to remain temporarily unlabelled. Unexplained legacy
durations are retained, labelled `estimate` and reported as `kept_unexplained`;
they may represent real observations from the Supabase era.

### Zones and clock shift

Sample the great-circle route at intervals of at most 50 km, including both
endpoints. Resolve each sample with server-only `@photostructure/tz-lookup@11.7.0`,
then evaluate its UTC offset at one departure instant. Count consecutive offset
changes, skipping unknown offsets. Use `departure_utc` when known, otherwise
`${date}T12:00:00Z`. Missing endpoint coordinates produce NULL.

This count includes repeated transitions and ocean zones. It differs from the
net clock shift between endpoints and the number of distinct IANA zone names.
Daylight saving and historical offset rules come from `Intl.DateTimeFormat`.

The [tz-lookup README](https://github.com/photostructure/tz-lookup/blob/main/README.md#accuracy)
reports about 5% mismatches when equivalent offsets are treated as matches in
its random-location comparison with geo-tz. Its compressed boundaries can
mislabel points near borders, especially away from populated areas. This is an
approximation caveat, not an error-rate guarantee for a particular route or
departure date; sampled transitions can be affected by those labels.

### Additive schema and release operator

Migration 0008 only adds nullable metrics, private `profiles.overview_prefs`
with JSON/size checks, and a partial index for measured route durations.
It preserves flight IDs, lifecycle state and historical evidence. The home
override reuses private `profiles.home_airport`; aircraft families stay in
package data. Preferences never enter public profile responses.

The maintenance cron remains held. A temporary fixed-operation operator Worker
repairs derived state and refreshes leaderboards after the backfill, following
the 6 October release precedent. Repair is idempotent and badge publication is
award-only: earned badges are never revoked when totals decrease. The operator
is removed after verification rather than becoming a general administration API.

Remote operations follow the [audit remediation release gates](../runbooks/audit-remediation-release.md):
explicit target, writer hold, Time Travel bookmark, export and restore proof,
and schema admission. Each production write requires separate owner
authorization; local rehearsal grants no remote authority.
