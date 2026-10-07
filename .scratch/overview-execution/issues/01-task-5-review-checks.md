# Release 1 Task 5 acceptance checks

Status: resolved in Release 1 Task 5

Carried from Task 2 independent review:
- Missing, non-finite or out-of-range airport coordinates must not throw; keep the clamped client distance (or NULL) and zones NULL. Include these cases in the resolver's tests.
- Measure the Worker bundle after write paths import zones.ts. Task 2's unconsumed helper did not include tz-lookup's data in the production bundle.
- Zones are offset transitions, including repeated transitions and ocean zones; they are not net clock shift or distinct zone names.

Resolution:
- The resolver accepts only finite reference coordinates in latitude/longitude
  bounds. Tests cover unresolved reference rows, null/out-of-range coordinates,
  non-finite input, clamped client fallback and NULL zones. Historical MOW/POD
  PATCH regression also passes.
- Final consumed Worker dry-run: `Total Upload: 19323.96 KiB / gzip: 3740.62 KiB`.
  Pre-consumption Task 2 measurement was 18865.21 / 3617.02 KiB: an increase of
  458.75 KiB raw / 123.60 KiB gzip, including resolver and other code changes.
  This is a local dry-run; no production deployment or remote D1 operation.
- Offset transition implementation stays unchanged. Save-path tests additionally
  distinguish departure instant from date noon across DST (TBS-LHR: 4 versus 3).
