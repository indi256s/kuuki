# Release 1 Task 5 acceptance checks

Status: open

Carried from Task 2 independent review:
- Missing, non-finite or out-of-range airport coordinates must not throw; keep the clamped client distance (or NULL) and zones NULL. Include these cases in the resolver's tests.
- Measure the Worker bundle after write paths import zones.ts. Task 2's unconsumed helper did not include tz-lookup's data in the production bundle.
- Zones are offset transitions, including repeated transitions and ocean zones; they are not net clock shift or distinct zone names.
