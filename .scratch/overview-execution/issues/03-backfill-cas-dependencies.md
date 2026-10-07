# Backfill CAS omits median-key dependencies

Status: resolved — user approved both CAS guards

Release 1 Task 6 names ten CasColumns but omits `airline_iata` and
`flight_number`. Both select the same-number duration median. Its Review Focus
requires a changed row to reject the old proposal and preserve the newer edit.

An isolated Miniflare reproduction used the actual Task 5 airline-only PATCH
and median query. Three valid measured TK 381 flights give 170 minutes; three
valid measured DL 381 flights give 150. A no-times target starts with TK 381.
PATCH airline to DL succeeds and leaves all ten planned CasColumns unchanged,
as Task 5 requires. The planned predicate therefore still accepts the stale
170-minute proposal. Adding airline/number predicates rejects it.

Verified output:
```json
{"patchStatus":200,"plannedCasColumnsUnchanged":true,"proposedMedian":170,"currentMedian":150,"casChanges":1,"correctedCasChanges":0,"stored":{"duration_minutes":170,"airline_iata":"DL"}}
```

Probe (synthetic local data only):
`/tmp/kuuki-overview-execution/r1-t6-cas-probe.mts`.
Evidence: `/tmp/kuuki-overview-execution/r1-t6-cas-probe.log`.
No Task 6 implementation or plan behavior was changed.

Requested decision: add `airline_iata` and `flight_number` to the Task 6
CasColumns snapshot and WHERE guards, update its plan interface, and add drift
regressions. The user's explicit material-plan-conflict stop applies.

## Answer

On 7 October 2026 the user selected “Add both CAS guards (recommended)”.
Task 6 will include `airline_iata` and `flight_number` in CasColumns and SQL
WHERE guards, update its plan interface, and add regressions for each dependency.
