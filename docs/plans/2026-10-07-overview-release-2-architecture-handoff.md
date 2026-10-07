# Overview Release 2 execution handoff

Owning branch: `feat/overview-release-2-architecture`.
Owning checkout:
`/Users/indi256/.t3/worktrees/kuuki/feat-overview-release-1-migrations`.

Scope: the approved Overview data architecture plan, strictly in task order.
No UI or design work. Read the design-owned spec at
`/Users/indi256/Documents/kuuki/kuuki/.scratch/overview-redesign/decisions.md`;
never copy or edit it. Production/remote Cloudflare, GitHub/main, UI, Task 17
parity acceptance and material plan conflicts remain user approval gates.

## Accepted base

Release 1 is complete locally at
`903dd58ffb7efe1b95574a1783373f6fa9e0dbec`. Its final task commit is `c652772`;
`903dd58` fixes both verified whole-branch review findings: newly filled
estimates are not replacements, and the runbook provides per-statement batch
counts with a separate remote proof gate. Opus 5.5 round 2 reports:

> Round 2 re-review: no verified findings. Both round-1 findings are fixed, and
> the fixes introduce no new defects. Nothing found blocks Release 1.

The review was `claudeAgent` / `claude-opus-5-5`, task ID
`node:delegated-task:command%3Amcp%3A5a398576-8b63-488e-836d-f56e846f3e7f%3Adelegate-task%3Akuuki-overview-r1-whole-branch-review-round2-903dd58`.
This branch was created from that accepted HEAD with `git switch -c` in the
same worktree. The Release 1 branch remains at the accepted commit.

Final Release 1 output:

```text
Test Files  58 passed (58)
     Tests  636 passed (636)
Test Files  105 passed (105)
     Tests  1102 passed (1102)
```

API/scripts typechecks exited 0. The unaffected passing Next build and operator
checks remain applicable. The local repaired-export rehearsal ended with zero
further proposals. Release 1 has not been deployed; only the separately approved
read-only production export was remote. Full evidence and commits are in the
Release 1 handoff and local ledger.

## Release 2 progress

Task 1 is complete at `917665c`: family fields for all 215 entries, canonical
Aircraft type, lookup helper and tests. User approved replacing the absent AT76
example with existing AT72; issue 05 is resolved. Other reference fields and
entry order are unchanged. The given family groups are applied, with E175 wing
variants grouped as E-Jet; unlisted aircraft use their existing model.

```text
Focused: Test Files 1 passed (1), Tests 7 passed (7)
API:     Test Files 59 passed (59), Tests 643 passed (643)
```

API typecheck exited 0. The corrected focused tests failed before implementation
(1 file / 7 tests). No route or client code changed; Next tests/build are not
required for this task. No per-task review under the user's revised workflow.

## Continuation

Task 2 is complete at `0e118a1`: payload model, deterministic weighted
aggregation and the owner builder. Passport uses the existing batch-read pattern;
its original reader delegates to the same projection, preserving its response.
The builder shares one batch across canonical rows, suppressions, referenced
subsets, home override and Passport/state. Unknown references retain null
metadata; nullable aggregate sums stay null when all inputs are null, and mixed
endpoint timezone labels become null rather than selecting an arbitrary label.

Task 2 RED: 1 failed suite (missing module). Focused GREEN: 1 file / 16 tests;
full API: 60 files / 659 tests passed; API typecheck exited 0. Owner separation,
transit bits, 5001-row totals, empty payloads and revision readiness are covered.
No routes/client changes; Next tests/build are not required yet.

Task 3 is complete at `bc07f69`: owner GET with no-store/ETag, stamp-only
304 and auth before reads, plus the server data helper. The user approved issue
06's extension: a home-field profile PATCH atomically updates the profile and
conditionally marks its owner dirty, then uses the existing repair flow.
Other profile fields keep their previous behavior. Repeating a home value also
invalidates, matching the existing UPDATE semantics. Issue 06 is resolved.

Endpoint RED failed on the missing module. Home-regression RED: 4 failed /
1 passed / 19 skipped. Final focused GREEN: 1 file / 25 tests passed, including
replacement/clearing, unchanged unrelated fields, atomic rollback, failed repair
recovery and a missing profile. Full API: 60 files / 668 tests passed; API
typecheck exited 0. Next build passed with the generated 72-route inventory,
105 assets / 9226424 bytes, entry 2278 bytes. Next full suite passed: 105 files / 1102 tests. Existing navigation and
compiled Better Auth warnings remain.

Task 4 is complete at `787680d`: OR-within/AND-across facets, suppression-aware
country/region evidence, undirected routes, raw-country domestic comparison,
aggregate per-flight haul, local departure bands and equal-span previous periods.
Empty arrays clear a facet; unknown values remain active and match nothing.
Year sets are sorted/deduplicated; invalid periods fail closed without throwing.
Calendar-month arithmetic uses integer labels, independent of timezones.

Task 4 RED: 1 failed suite (missing module). Focused GREEN: 1 file / 15 tests;
full API: 61 files / 683 tests passed; API typecheck exited 0. No client/routes
changed; the Task 3 Next test/build evidence remains applicable.

Task 5 is complete at `cab7ba1`: counted weighted totals, separate awaiting,
precision coverage, Passport versus scoped air evidence, equal-period prior
values and home selection over all counted rows. Aggregate metric fields are
already sums. Missing/invalid metrics contribute no numeric value. Known home
metadata is included outside flown endpoints in the existing owner batch, as
approved by the user; unknown homes still fall back. Issue 07 is resolved and
Task 2's reference-subset rule/tests are updated.

Initial RED: 2 failed suites (missing compute). The subsequent integration
proved the known JFK home failure before the approved correction. Focused
GREEN: 2 files / 36 tests. Full API: 62 files / 694 tests passed; API typecheck
exited 0. No route or client code changed; Task 3's Next test/build evidence
remains applicable. No per-task review, as directed by the user. Task 5 boxes
are checked in its implementation commit.

Task 6 is complete at `3874bab`: weighted Records gate, distance and precise
duration extrema, signed DST-aware clock jumps with lowest-ID ties, all-endpoint
latitude records including transits, calendar-month streaks and date gaps.
Aggregate mode keeps day-level entries null. Busiest-day ties choose the first
calendar date; latitude ties choose the alphabetically first code. Malformed
legacy dates/metrics and missing zones remain finite and do not throw.

The user approved issue 08's aggregate contract change. Task 2's rows now retain
individual `recordExtrema` with real values/winning IDs and nullable absolute
`clockShiftMinutes`, computed before collapsing timestamps. Summaries survive
merging and re-aggregation. Missing summaries yield null unsupported individual
records. Task 7 consumes the shift sums. No canonical D1 fields/grouping/threshold
changed. The original mean-based regression expectation was corrected; issue
08 is resolved.

Initial RED: missing module/scope field; subsequent duration and DST regressions
failed on real information loss. Final focused GREEN: 3 files / 48 tests. Full
API: 63 files / 706 tests passed; API typecheck exited 0. Task 3's unaffected
Next evidence remains applicable. No per-task review under the revised user
workflow. Task 6 checkboxes are in its implementation commit.

Task 7 is complete at `df92407`: sampled great-circle crossings, per-call
memoization by directional route, weighted path counts, nullable stored zone
sums and individual DST clock-shift sums. Direction shares use rows with known
coordinates; missing coordinates cannot be classified. Latitude samples exactly
on a circle are skipped when counting sign transitions, avoiding double touches.

RED: two failed files (missing module/scope field). Focused GREEN: 2 files /
19 tests. All four package-coordinate plan goldens match, with additional
weight/SUM, DST, wrap, memoization, southern polar and missing-geometry checks.
First full API: 63 files passed / 1 failed, 715 tests passed / 1 failed. The
unchanged provider-gate child process returned 143 after about its existing
three-second timeout on a loaded run. It passed alone (1 file / 2 tests).
A full retry with `pnpm test:api --maxWorkers=4` passed: 64 files / 716 tests.
API typecheck exited 0. No baseline test/script was changed. The Task 3 Next
evidence remains applicable because no client/routes changed. No per-task review.

Task 8 is complete at `d960602`: weighted Fleet coverage, type shares, curated
family totals, sorted manufacturer/body chart rows, complete 24-hour and
three-haul Clock grids, night-band red eyes and precise-pair speed. Aircraft
without metadata remain typed but add no invented family/manufacturer/body.
Clock counts accepted departure times; only its duration-dependent speed needs
precise duration provenance, following the Task 8 Interfaces. Estimates,
missing pairs, invalid values and zero durations contribute no speed. Aggregate
metrics are already sums; haul uses per-flight distance, and counts use weights.

RED: missing Fleet module/scope field. Initial implementation exposed two
exact-float test assertions; these now use numeric tolerance without changing
the speed formula. Final focused GREEN: 2 files / 18 tests. Full API with four
workers: 65 files / 725 tests passed; API typecheck exited 0. Empty-scope tests
include the Fleet and Clock gates. No client/routes changed, so Task 3's Next
evidence remains applicable. No per-task review under the user's workflow.

Task 9 is complete at `23f95a7`: full zero-filled Rhythm grids with gap years,
weighted full rankings and undirected routes, scope/ghost globe data and a
visit-weighted spherical centroid. Countries use unsuppressed evidence once per
country per flight; airports retain both endpoint visits, including transits.
Upcoming rows stay only in chronological ghost entries. Ghost routes/countries
exclude in-scope keys. Sorted airport counts make centroid arithmetic independent
of row order; antipodal or unlocated scopes return null. The existing coordinate
validator moved from Crossings to geo for reuse, with no validation change.

RED: missing modules and scope fields. Final focused GREEN: 3 files / 28 tests,
including all Crossings regressions after the validator move. Full API with four
workers: 66 files / 734 tests passed; API typecheck exited 0. Empty scope checks
now cover all section gates, rankings and centroid; upcoming-only behavior is
also explicit. No routes/client changes; Task 3 Next evidence remains valid.
No per-task review under the revised workflow.

Task 10 is complete at `db0089c`: ten generated golden payloads/snapshots,
including 5001-row aggregate mode, and six deterministic fast-check properties
with 200 runs each. The generator uses package coordinates/timezones/aircraft
metadata and synthetic stored metrics/lifecycle/suppression combinations. The
value-expansion property starts with an active facet, because an empty facet
means clear. Exact fast-check 4.10.2 and its pure-rand dependency are development
only; pnpm also normalized three existing ESLint peer keys without version changes.

Initial RED: missing fast-check and ten missing fixtures. The generation run
passed ten explicit known-value tests and wrote ten snapshots. Primary review
inspected every snapshot section and independently verified weighted fixture
counts and stored distance/duration sums. Additional explicit values cover
polar/date-line geometry and a DST red-eye. The first property run found a test
callback returning the assertion object; a block callback fixed it. No engine
change was necessary. Per-task independent review is deferred to the final
whole-branch review, as the user instructed.

```text
Focused: Test Files 2 passed (2), Tests 16 passed (16)
API:     Test Files 68 passed (68), Tests 750 passed (750)
```

The full API command used `--maxWorkers=4` and passed in 156.11s. API and shared
package typechecks exited 0. No client/routes or runtime dependencies changed;
Task 3's Next test/build evidence remains applicable. Task 10 checkboxes are
checked in its implementation commit. Logs and compact full snapshot inspection
are under `/tmp/kuuki-overview-execution/r2-t10-*`.

Task 11 is complete at `7db82c7`: versioned shared preferences and owner
GET/CSRF-protected PUT, strict zod 4 validation, bounded JSON reads and 8192
serialized-character validation. Both order and hidden lists reject duplicates
and unknown sections. Partial order lists remain valid, as the Interfaces do
not require completeness. Unknown object fields are rejected on writes; unknown
facet strings survive. Home remains on profile PATCH, and preference writes do
not dirty the derived state or change the Overview ETag. Missing profiles return
404. No other owner is read or updated.

The user approved issue 09: valid known fields from numeric older versions merge
with defaults, with absent/invalid fields defaulted independently; malformed
JSON and unknown future versions reset completely. Read results own their
mutable defaults. The plan's Review Focus/Interfaces now agree and issue 09 is
resolved. Current-version writes require the complete declared shape.

RED: missing module. Final focused GREEN: 1 file / 18 tests. The first integration
run exposed an unseeded second-owner profile in the test fixture; adding it
made the owner-isolation assertion meaningful. Full API with four workers:
69 files / 768 tests passed in 89.28s. API/shared typechecks exited 0. Next build
passed: entry 2278 bytes, assets 105 / 9226424 bytes, routes 73 including new
GET/PUT prefs. Generated inventory is committed. Existing compiled Better Auth
warning remains. No client/UI code changed; prior Next unit evidence remains
applicable. Task 11 checkboxes are in its implementation commit. No per-task
review under the user's revised workflow.

Task 12 is complete at `a1fbe2f`: in-memory conditional revalidation, old-payload retention
on network/HTTP/JSON errors, request coalescing, 200 subscriber notification,
and per-store/ETag/serialized-filter memoization. Window focus and visible
Document events share a two-second throttle; detach removes both listeners.
No persistent storage or UI consumer is added. Platform abort timeout is 30s.
Issue 02 is resolved by optional read-only metric transport fields, with the
existing writable allowlist unchanged.

The user approved issue 10's correction from `Window & Document` to `Window`.
Both plan and helper accept real browser windows without casts, using
`target.document` for visibility events. Initial RED was the missing module.
Approved focused GREEN: `Test Files 1 passed (1); Tests 10 passed (10)`.
Next/client typechecks exit 0. Full API before this annotation-only correction:
`Test Files 69 passed (69); Tests 768 passed (768)` (87.64s). Full Next:
`Test Files 106 passed (106); Tests 1112 passed (1112)` (24.31s), with existing
jsdom navigation notices. API typecheck exit 0. Those full-suite results are
reused because runtime behavior did not change. Successful Task 11 build also
remains applicable; no route or UI change. Checkboxes are committed with code.

Task 13 is complete at `65d07f1`: exact Charts 1.0.0 in root and Next, direct engine-row
fixtures for Rhythm/Clock/Fleet, deterministic DOM-free SVG and React SSR.
Issue 11 is resolved under the user's revised instruction to make routine
best-practice API corrections without repeated questions. The mandatory scale
configuration is band/band for Rhythm and band/linear for bar fixtures, with
no product chart, tokens, colors or legends. Heterogeneous scenes are built in
individually inferred closures so shared test types remain valid.

Both initial RED suites failed with the missing dependency; the initial
post-install mark-only fixture failed for absent required scales. Final focused
DOM-free and SSR tests each pass 1/1. API/Next/shared typechecks exit 0 (shared
has no typecheck script; direct tsc --noEmit -p used). Full API: `Test Files
70 passed (70); Tests 769 passed (769)` in 99.68s. Full Next: `Test Files
107 passed (107); Tests 1113 passed (1113)` in 25.34s; existing navigation
notices remain. Build succeeds: entry 2278 bytes, assets 105 / 9226424 bytes,
routes 73; existing Better Auth duplicate-key warning remains. Full API evidence
is reused after the final test-only closure typing fix, verified by focused
GREEN. Route client JS before/after is 1,268,522 bytes across 18 deduplicated
route/root/polyfill files, delta 0 bytes. Full lock diff reviewed: Charts
transitive dependencies plus same-version ESLint peer-key normalization.

Task 13 checkboxes are committed with code. Task 14 is complete: public GET subset and shared server read helper, with
explicit public DTO types. Existing public-profile visibility gate runs before
owner flights; visibility/current section consent are rechecked after reading.
Projection allowlists records without day entries/flight IDs, Fleet only on
opt-in, sorted undirected routes without counts, and valid endpoint coordinates.
Upcoming and home-only airports are excluded. The owner's remembered filter
is ignored for the public empty scope. Existing private profile shells are
unchanged; the subset returns the existing unknown-profile 404 envelope for
both unknown and private accounts. Empty/below sections are omitted.

RED was missing endpoint. Final focused GREEN: `Test Files 1 passed (1); Tests
10 passed (10)` in 5.96s. Full API: `Test Files 71 passed (71); Tests 779 passed
(779)` in 90.96s. API/Next/shared typechecks exit 0. Build succeeds: entry 2278
bytes, 105 assets / 9226424 bytes, 74 routes including the new GET, generated
inventory committed. Existing Better Auth warning remains. Task 13 full Next
107/1113 evidence remains applicable to this server-helper-only addition.
Full owned code/tests/inventory reviewed. Checkboxes are committed with code.
Task 15 is complete; Tasks 16–17 remain unstarted.
No open routine decision; explicit production/GitHub/UI/parity gates remain.
No per-task review under
the user's revised workflow; final whole-branch Opus review over
`feat/overview-release-1-migrations...HEAD` remains required via T3 delegation.
Logs: `/tmp/kuuki-overview-execution/r2-t12-*`. Local execution ledger:
`.superpowers/sdd/2026-10-07-overview-release-2-architecture/progress.md`.

All production/remote, GitHub/main, UI, parity and material-conflict gates remain.

Task 15: owner-only no-store share PNG pipeline, strict bounded base64url filter,
remembered filter fallback, same Clock rows → TanStack SVG data-URI in the
expressly prescribed plain four-number paper stub. No product UI changed.
Exact @cf-wasm/og 0.5.0 workerd import, bundled default font, cache disabled,
async rendering errors caught by the standard API envelope. Context7 lacked
an applicable package; official package docs/installed exports used instead.
Current Cloudflare limit is 64 MiB uncompressed (4 September 2026 changelog);
plan measurement corrected under routine-choice authorization. Dry-run:
`Total Upload: 22461.50 KiB / gzip: 4640.51 KiB`, so render in-process.
No extra Worker/binding, remote calls or deployment.

RED: missing handler/service. Final focused: `Test Files 1 passed (1); Tests
12 passed (12)` in 2.60s, actual Node-adapter PNG plus filter/auth checks.
Full API: `Test Files 72 passed (72); Tests 791 passed (791)` in 95.32s.
Full Next: `Test Files 107 passed (107); Tests 1113 passed (1113)` in 22.79s.
API/scripts/Worker typechecks exit 0. Build succeeds, 75 generated routes,
105 assets / 9226424 bytes. Existing Better Auth warning/navigation notices.
Composed local Worker: `Share card workerd passed`, width 1200, height 1500,
bytes 12457, outboundCalls 0; `Next workerd smoke passed` and
`Next boundary smoke passed`. Harness now loads dry-run WASM modules in both
main and maintenance fixtures; the prior missing-module startup was fixed.
Complete source/test/inventory/lock diff reviewed: renderer dependencies plus
same-version optional Next/ESLint peer normalization. Task checkboxes committed
with code; final whole-branch Opus review remains pending, no per-task reviews.
Logs: `/tmp/kuuki-overview-execution/r2-t15-*`.
