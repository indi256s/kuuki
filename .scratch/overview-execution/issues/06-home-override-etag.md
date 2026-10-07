# Home-airport edits do not invalidate the Overview payload

Status: resolved — user approved home-edit revision invalidation

Release 2 Task 3 specifies `W/"ov2-<revision>-<evidence_revision>"` and a 304
fast path reading only `stateOf`. The payload includes `profiles.home_airport`,
but the existing authenticated profile PATCH does not change either stamp.
The spec requires an overridable home and revision-based memory revalidation.
An accepted home edit therefore leaves the client with stale payload data.

## Verified evidence

An isolated synthetic account with a TBS–JFK flight exercises the actual
profile PATCH and the new owner endpoint. Unconditional GET shows the changed
home, while a conditional GET using the preceding ETag returns an empty 304:

```json
{"initialStatus":200,"patchStatus":200,"freshStatus":200,"beforeHome":null,"afterHome":"JFK","beforeEtag":"W/\"ov2-1-1\"","afterEtag":"W/\"ov2-1-1\"","conditionalStatus":304,"conditionalBodyBytes":0}
```

Runnable proof: `/tmp/kuuki-overview-execution/r2-t3-home-etag-probe.mts`.
Output: `/tmp/kuuki-overview-execution/r2-t3-home-etag-probe.log`.
No production data or remote resources were used.

## Decision needed

Recommended: extend Task 3 to invalidate the existing revision on home-airport
edits through the profile write path, with an atomic profile update/dirty mark
and the existing derived repair flow. Add a regression for an old ETag after
the real home edit and confirm other profile edits do not invalidate Overview.
Preserve the planned ETag format and single-stamp 304 path.

The alternative is revising the ETag/read contract to include profile state,
which changes the explicitly specified format and stamp-only read.
Neither fix is implemented; the user's material plan-conflict gate applies.

## Comments

Task 3's basic endpoint and server helper are implemented but uncommitted.
Focused tests: 1 file / 19 tests passed; API typecheck exited 0. The initial
focused run failed on the missing endpoint. Build/route generation and full
API/Next checks are held until this behavior decision. No Task 3 checkbox is
checked and Tasks 4–17 have not begun.

On 7 October the user answered “yes” to the recommended extension. The plan now
includes the profile write path. A home-field PATCH uses an atomic update and
conditional dirty marker followed by existing repair; other fields keep their
original behavior. Regression tests cover replacement/clearing, rollback,
publication recovery and missing profiles. The format and stamp-only 304 path
are preserved. Every accepted home-field PATCH invalidates, including a repeated
value, matching the existing profile UPDATE behavior.
