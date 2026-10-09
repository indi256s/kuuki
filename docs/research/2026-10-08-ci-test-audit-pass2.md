# CI test audit — second pass, 8 October 2026

Baseline: published main `db0ecb18`. The user authorized another reduction and investigation of the slowest checks, then explicitly authorized skipping browser tests in CI. This pass removes two duplicate cases and repeated fixture startup. It does not impose another deletion quota.

## GitHub timing baseline

[CI run 37781828422](https://github.com/indi256s/kuuki/actions/runs/37781828422) passed. Durations come from job/step timestamps. Jobs ran in parallel; adding their durations does not measure workflow wall time.

| Job     | Duration | Slowest relevant steps                                                          |
| ------- | -------: | ------------------------------------------------------------------------------- |
| checks  |    250 s | Next unit tests 146 s; lint 25 s; setup 24 s; types 21 s                        |
| api (1) |    152 s | API tests 112 s; setup 23 s                                                     |
| api (2) |    189 s | API tests 152 s; setup 24 s                                                     |
| api (3) |    154 s | API tests 109 s; setup 33 s                                                     |
| e2e     |    259 s | Browser tests 119 s; Next build 58 s; Worker types 28 s; setup 25 s; smoke 12 s |

Next reported 144.71 s: test bodies 82.63 s, environments 29.02 s and setup 10.24 s. Its largest 61-case OverviewProvider file took 1.64 s. Deleting inexpensive cases would barely affect those bottlenecks.

## Changes and retained proof

- `ui/popover.test.tsx`: remove `outside click closes without taking focus from the clicked control` and `blank outside dismissal restores focus after content unmounts`. The retained ordinary/autoFocus/ref matrix exercises both paths, exact callback counts, removal/ref cleanup and focus restoration. Both removed tests and the stronger matrix came from `67fbf152`. PopoverContent and Radix 1.1.15 share the relevant nonmodal focus logic across controlled and uncontrolled roots. Keep registered-trigger Escape, fallback/cancellation, Chip opener and animated-reopen regressions. Remove unused fixture plumbing; no product code changes.
- `functions/test/overview-data.test.ts`: use one real migrated D1 fixture for 14 independent arrival-derivation rows and another for four malformed stored-arrival rows. Preserve every original input and expected result, keyed by distinct flight IDs. Keep DST, fractional-hour offset, midnight, malformed/missing evidence and suppression of fallback for invalid stored arrival text. This removes 16 Miniflare startups and migration replays; it consolidates cases without deleting their scenarios.
- `.github/workflows/ci.yml`: run Next unit tests with two isolated workers, matching API's bound. Keep local defaults and test isolation. Remove Playwright execution, browser download/cache/version lookup and trace upload from CI. Keep all 37 browser journeys and the local command for manual checks. Keep Next build, Worker types and full compiled Worker smoke in CI. Browser interaction regressions no longer block CI.
- `README.md`: describe browser journeys as manual verification and name the remaining CI checks.

## Kept slow tests

Import runtime's 34 cases took 62.95 s in the prior local report. Its 36.63 s provider-survival case intentionally crosses workerd's 30 s disconnected-request lifetime. The 5.45 s socket-disconnect and 5.35 s idle-provider cases exercise the real five-second heartbeat. ADR 0001 and fixes `85b028ee`/`9f5d5071` explain these contracts. Fake timers cannot replace this separate workerd transport proof. Keep auth/ownership, receipts/concurrency, destructive writes, schema/migration and preservation checks. Avoid shared mutable runtimes across lifecycle tests.

## Inventory and validation

| Suite               | Previous inventory | Current inventory | Current mandatory CI |
| ------------------- | -----------------: | ----------------: | -------------------: |
| API/shared/data     |                630 |               614 |                  614 |
| Next unit/component |                627 |               625 |                  625 |
| Browser             |                 37 |                37 |                    0 |
| Node                |                 11 |                11 |                   11 |
| Total               |              1,305 |             1,287 |                1,250 |

Mandatory CI cases decrease by 55 (4.21%) in this pass, and by 52.20% against committed Arc main's 2,615. Actual deleted scenarios: two duplicates. All 18 arrival-time inputs remain covered; 37 browser scenarios remain available manually.

Final API 614/614 and Next 625/625 passed, with no failures or skips; the exact two-worker CI command was exercised. Fresh Next build, targeted ESLint and API/Next/Worker type checks passed. Unchanged Node tests passed in the preceding CI run. Full compiled Worker smoke passed. Independent final review approved the complete change with no blockers.

An exploratory browser run before the user's skip instruction finished 36/37: the unchanged account-isolation journey intermittently matched two `.ov-globe` elements. It passed separately on the unchanged baseline. Prototype timer changes in the Undo journeys were reverted, so browser files are byte-identical to baseline. This attempted run is not claimed as a clean full-browser pass.

Separate focused Overview runs passed before (56 cases, 16.57 s) and after (40 cases, 11.34 s). This observed 5.23 s reduction is consistent with fewer fixture startups; it is not a statistical benchmark. Local full-suite runs overlapped other checks, so their timings are not a controlled performance comparison. Hosted comparison is recorded below. No deployment or remote database writes are performed; publish with normal Git updates and preserve unrelated local work.

## Hosted result

[CI run 37784558334](https://github.com/indi256s/kuuki/actions/runs/37784558334), for code commit `e03d1bf3`, passed all five jobs. React Doctor also passed. Browser execution/download steps are absent; build, lint, types, all API shards, Next/Node checks and compiled Worker smoke remain.

| Measurement                            | Before | After |
| -------------------------------------- | -----: | ----: |
| First job start to last job completion |  259 s | 183 s |
| checks job                             |  250 s | 159 s |
| Next unit test step                    |  146 s |  78 s |
| compiled Worker job (e2e)              |  259 s | 116 s |
| API shard 1 test step                  |  112 s | 110 s |
| API shard 2 test step                  |  152 s | 138 s |
| API shard 3 test step                  |  109 s | 123 s |

Observed active job span fell by 76 s (29.34%); Next unit execution fell by 68 s (46.58%). This compares two successful hosted runs, excludes queue time and does not establish a repeated benchmark. Runner/setup/build variability explains why unrelated timings also differ. API shard 2 is now the longest job (182 s), with its test step at 138 s. Its real import lifecycle proof remains intact.
