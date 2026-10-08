# Aggregate sums lose individual record winners and DST clock shifts

Status: resolved — user approved preserving individual aggregate summaries

Task 2's aggregate contract retains sums, the minimum flight ID and the first
day of the month, while clearing departure UTC. Task 6 needs individual record
extrema with their actual winning IDs. Task 7 needs the sum of individual
absolute clock shifts. Those values cannot be recovered from that contract.

## Verified evidence

The Task 6 regression uses five identical-group flights with precise durations
60, 180, 120, 120 and 120 minutes. Flight-mode records are shortest ID 1 / 60 and
longest ID 2 / 180. Aggregation produces one row, ID 1, weight 5, duration 600.
The prepared Task 6 implementation divides sums by weight, incorrectly returning
ID 1 / 120 for both records. A group mean is not an individual record.

A second case groups five JFK–LHR flights on 28 and 30 March 2026. The actual
largest clock jump is ID 2 / 300 minutes; the aggregated month date gives
ID 1 / 300. Summing the individual absolute clock jumps gives 1260 minutes;
using the aggregate's month date and weight gives 1500. This is the same sum
that Task 7's clockShiftHours contract requires, before division by 60.

Command:
`pnpm test:api packages/shared/src/overview/records.test.ts packages/shared/src/overview/figures.test.ts`
Output: `/tmp/kuuki-overview-execution/r2-t6-aggregate-red.log`.

```text
Test Files  1 failed | 1 passed (2)
     Tests  2 failed | 18 passed (20)
```

Before adding these stronger regressions, Task 6's initial tests passed:
focused 2 files / 18 tests; full API 63 files / 703 tests; API typecheck exited 0.
Those results do not make Task 6 complete. The original test's aggregate-mean
expectation was removed; its required day-level null assertions remain.

## Decision needed

Recommended: extend aggregate rows with per-group individual record extrema
(values and winning IDs, with the existing lowest-ID tie rule) and the sum of
individual absolute clock shifts. Compute them before clearing dates/times.
Records can then select real winners from filtered groups, and Crossings can
use the stored shift sum. Preserve the existing grouping, sum fields, row
threshold, day-level null restrictions and no additional canonical D1 fields.

Update the row/aggregation interfaces in Task 2, the consuming Tasks 6/7 and
their regression expectations. For aggregates without the added metadata,
return null for unsupported flight record references rather than fabricate
individual records from means.

An alternative is making individual flight record references unavailable in
aggregate mode and explicitly accepting approximate clock shifts. That changes
the intended behavior more substantially.

The user's material plan-conflict gate requires approval before either option.
Task 6 source/tests remain uncommitted and its boxes unchecked. Task 7 and later
tasks have not begun. No UI, production/remote or GitHub action was performed.

## Comments

The user answered “all approved” to the recorded change. Aggregate rows now
retain the five individual record extrema with real winning IDs and a nullable
absolute clock-shift sum before collapsing dates/times. Both survive merging
and re-aggregation. Records uses the stored summaries in aggregate mode;
missing summary metadata provides null references. No canonical D1 fields,
grouping dimensions or row thresholds changed. Tasks 2/6/7 are updated.
Focused GREEN: 3 files / 48 tests, including duration and DST regressions,
cross-group ties, re-aggregation, estimates and absent metadata.
