# Times-drift re-plan expectation contradicts canonical writes

Status: open — awaiting user decision

Release 1 Task 6 says rows whose metrics are already correct produce no change.
Its times-drift test also requires re-planning a row after an actual times PATCH
to list that row again with a new `before`. Task 5's PATCH already recomputes
all eight metric columns, leaving no correction to propose.

An isolated Miniflare probe starts with TBS–JFK distance 9878, duration 786,
NULL provenance and no local times. The actual PATCH adds 10:00 and 12:00.
An independent call to the write resolver confirms every stored metric is
canonical; a stale guarded UPDATE changes zero rows.

Verified output:
```json
{"patchStatus":200,"staleCasChanges":0,"allEightMetricsAlreadyCanonical":true,"stored":{"origin_tz":"Asia/Tbilisi","dest_tz":"America/New_York","departure_utc":"2025-01-01T06:00:00.000Z","arrival_utc":"2025-01-01T17:00:00.000Z","distance_km":8980,"duration_minutes":660,"duration_source":"times","zones_overflown":16}}
```

Synthetic probe and evidence:
`/tmp/kuuki-overview-execution/r1-t6-times-drift-probe.mts`
and `/tmp/kuuki-overview-execution/r1-t6-times-drift-probe.log`.

Requested correction: expect an empty re-plan after the canonical times PATCH,
while independently checking that airline-only drift rejects stale SQL and
produces a fresh proposal with the new CAS snapshot. No planner implementation
or conflicting test expectation has been written. User instruction requires
approval for a behavior-changing plan conflict.
