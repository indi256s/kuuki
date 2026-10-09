# Kuuki performance audit — 7–8 October 2026

Started 7 October; final verification completed 8 October 2026 (Asia/Tbilisi).

Implemented and verified locally. Warm primary navigation fell from 343–350 ms to 49–51 ms median. Status controls now acknowledge changes in 19–28 ms median while server-backed results complete separately. Journal startup JavaScript fell by about 119 KiB gzip. No deployment or publication was performed.

These are local laboratory measurements, not production or field results. The 5,000-pair map still needs roughly 0.8 s to initialize, and some server-backed filter runs exceed 100 ms. Those misses remain visible below.

## Conditions and evidence

| Item                    | Recorded condition                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Source                  | HEAD `2b5b3a4b317c8cb7f6dede6272baa32a48810423`; dirty working tree with unrelated import/UI work retained                        |
| Before production build | `EQi_qGtAkEdHkILj16UUc`                                                                                                           |
| Final production build  | `xbg5FFLpzOMqAXuy19pzN`                                                                                                           |
| Build/runtime           | Node 24.18.0, pnpm 9.15.0, Next 16.3.8, React 19.2.4, OpenNext 1.20.8, Wrangler 4.147.0                                           |
| Local Worker            | Miniflare 4.20260730.0 / workerd 1.20260730.1; compatibility date 2026-08-06                                                      |
| Browser                 | agent-browser 0.38.1; headless Chromium 151.0.0.0                                                                                 |
| Host                    | macOS 27.0.1; Apple M1 Pro; 16 GiB RAM                                                                                            |
| Viewports               | Desktop 1280 × 800; supplemental mobile 390 × 844                                                                                 |
| CPU/network             | No throttling; localhost HTTP at 127.0.0.1:8817. Host activity was not controlled                                                 |
| Data                    | 5,000 synthetic flights, seven years 2020–2026, two airport pairs, two airlines, A320 or missing aircraft                         |
| Journal                 | 20 rows/page; 250 pages; full-dataset selection of 5,000 IDs                                                                      |
| Map limit test          | Synthetic 5,000-pair projection, 711,897-byte JSON; existing maximum projection size; actual renderer and 5,000 list rows         |
| Country catalog         | All 246 catalog entries; actual fixture collection has few visited countries                                                      |
| Cold cache              | Fresh browser process per sample; auth cookies only; empty browser HTTP and Next router caches; JavaScript body transfer asserted |
| Warm cache              | Same hydrated browser; HTTP and Next router caches enabled; destination prefetch allowed to settle                                |
| Server cache            | Local Worker/D1 already running and seeded; DB/runtime warming not reset between browser samples                                  |
| Sample counts           | Cold: 9 before, 9 final (3/route). Warm: 140 before plus 13 paging/selection, 176 final; supplemental counts below                |

The initial baseline's state replay had warmed shared JavaScript. Its load numbers are excluded. Corrected cold results are in [before-cold-5000.json](../../.scratch/performance-audit/before-cold-5000.json); warm interactions remain valid in [before-5000.json](../../.scratch/performance-audit/before-5000.json). An earlier preview started during the build and produced static errors; those attempts are also excluded.

The dirty workspace and uncontrolled host load limit causal interpretation of cold-load deltas. The navigation change has stronger evidence: the same repeated journeys remove route RSC requests from the click path and eliminate the approximately 300 ms content delay. No claims below rely on the intermediate after-build timings.

## Reproduction

Run from the workspace root. Build and runtime fixtures must be serialized because they share generated assets and local Worker state.

```sh
pnpm next:build
KUUKI_NEXT_PORT=8817 pnpm next:preview
# In another terminal, after the preview is listening:
KUUKI_NEXT_PORT=8817 node scripts/performance-audit.mjs after 5000
```

The runner creates a synthetic local account and seeds flights through the existing API in batches of 50. It fails if the fixture count or matching result IDs are wrong. It records the build ID, resource waterfall, Navigation Timing, FCP/LCP/CLS observations, long tasks and per-interaction samples. An optional third argument reuses an existing named agent-browser session/account.

`KUUKI_PERF_LOADS_ONLY=1` runs only the nine cold loads; `KUUKI_PERF_PAGES_ONLY=1` runs paging and selection only. Phase names determine output filenames; use a fresh phase name to retain previous evidence. The current runner measures the final implementation. Reproducing the exact historical before build requires restoring its source snapshot; HEAD alone does not reproduce the dirty workspace used for that build.

Browser timestamps exclude CLI startup overhead. Measurements end after the readiness predicate and two animation frames, providing a paint opportunity. They are not field INP, GPU completion, or proof of all background work finishing. Feedback and completed content are separate where the control has an independently observable value. Sort, reset, history and Overview feedback predicates coincide with content readiness; their numbers should not be interpreted as isolated input latency.

Readiness means hydrated route controls and the expected list/count, or the specified checked control and rows. Map initialization is measured separately through the renderer's ready state. The flight-detail check requires actual JFK/BOS/date ticket content, not just a dialog or loading message. API result oracles run outside the clock, warming DB reads equally in both runs. The paging/selection baseline did not include a profiler capture; the final run does.

The browser audit used independent named sessions. Trusted keyboard/focus journeys supplement the runner's DOM event collection. Raw HAR and traces remain under `/tmp/kuuki-perf-*-5000.har` and `/tmp/kuuki-perf-*-5000-trace.json`; these may contain local auth headers and are not copied into the report. Sanitized timing JSON is linked below.

## Confirmed findings and implemented fixes

| Priority | Finding and evidence                                                                                                                                                                                                                                 | Change                                                                                                                                                                                                                                           | Confidence / cost                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Primary links showed selected navigation around 50 ms but usable destination at 343–350 ms. A probe completed route RSC around 56 ms yet exposed usable content around 347 ms; a separate probe saw fallback around 12 ms and content around 340 ms. | Full Next Link prefetch for Overview, Journal and Passport on desktop/mobile. Final click windows have no route RSC requests and usable content at 49–51 ms median.                                                                              | High for behavior; React fallback throttle is the supported explanation. Low implementation cost, extra prefetch bandwidth.       |
| 2        | Journal eagerly imported the flight editor, including form/validation dependencies. Its observed startup JS closure was 508 KiB gzip. An initial React.lazy version still delayed the first editor behind a fallback.                                | Import the editor on an opened flight, then commit the loaded component through normal state. Keep localized loading feedback and ignore late imports after close/navigation. Final Journal closure is 388 KiB; first correct ticket 91 ms, n=1. | High bundle evidence. First-ticket sample is diagnostic, not a repeated before/after claim. Small change.                         |
| 3        | Status selects displayed only committed URL state: feedback waited 59–75 ms for server navigation, unlike text controls.                                                                                                                             | Reuse the existing pending values for select controls. Existing success, failure, reset and history handling clears pending state.                                                                                                               | High; feedback independently measured n=5 per status; regression test reproduces delayed acknowledgement. Very low cost.          |
| 4        | Every Passport Stamps/Map switch issued an unnecessary approximately 1.9 KiB RSC request, although both views use the same route data.                                                                                                               | Native history pushState for view changes, retaining URL state, Back/Forward, keyboard controls and heading focus.                                                                                                                               | High request evidence: 10 final switches, zero RSC. Wall-clock ranges overlap; no substantial latency win claimed. Very low cost. |
| 5        | The Worker applied no-store to versioned map assets, causing repeat transfer.                                                                                                                                                                        | Immutable caching for six exact versioned map paths only; GET/HEAD, successful/304, no Set-Cookie, non-HTML responses. Other mutable assets and private reads retain no-store.                                                                   | High header and zero-transfer evidence. No measured map-initialization win. Small, guarded change.                                |
| 6        | Overview eagerly imported the aircraft review while the sheet was closed.                                                                                                                                                                            | Defer the existing review component until targets are present in the opened sheet, with the existing loading copy.                                                                                                                               | High import-graph evidence; combined startup/prefetch results do not isolate a standalone latency benefit. Small change.          |

Changes are in [nav.tsx](../../apps/next/src/client/nav.tsx), [journal.tsx](../../apps/next/src/client/reads/journal.tsx), [journal-filters.tsx](../../apps/next/src/client/reads/journal-filters.tsx), [passport.tsx](../../apps/next/src/client/reads/passport.tsx), [missing-aircraft.tsx](../../apps/next/src/client/overview/missing-aircraft.tsx), and [worker.ts](../../apps/next/worker.ts). No dependencies were added.

Installed React's production implementation contains the 300 ms recent-fallback throttle in `react-dom-client.production.js`; installed Next's Link API documents full prefetch with `prefetch={true}`. This explains the otherwise unexplained network-complete/content-delayed gap, but the timing attribution remains an inference. [Next Link prefetch](https://nextjs.org/docs/app/api-reference/components/link#prefetch) and [native history integration](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api) match the installed architecture, whose source was also checked. Cache Components and partialPrefetching are disabled here; OpenNext's configured incremental cache is a dummy cache. No generic Next server cache was introduced.

## Before/after results

All times below are milliseconds, displayed as **median (minimum–maximum)**. Sample counts are before/final. Server-backed result completion includes local Worker/D1/network work and is separate from the 100 ms local-input/local-filter goal.

### Completed content: Journal, navigation, history and Overview

| Scenario           | n before/final | Before        | Final        |
| ------------------ | -------------- | ------------- | ------------ |
| q=Tbilisi          | 5/5            | 88 (81–93)    | 92 (82–101)  |
| year=2025          | 5/5            | 73 (71–76)    | 74 (71–92)   |
| airline=TK         | 5/5            | 72 (64–74)    | 73 (70–78)   |
| aircraft=A320      | 5/5            | 73 (70–77)    | 73 (63–81)   |
| airport=IST        | 5/5            | 72 (71–98)    | 73 (62–138)  |
| origin=TBS         | 5/5            | 72 (69–87)    | 73 (71–81)   |
| destination=IST    | 5/5            | 71 (61–80)    | 71 (62–72)   |
| status=completed   | 5/5            | 75 (68–85)    | 70 (67–138)  |
| status=upcoming    | 5/5            | 59 (56–72)    | 58 (57–60)   |
| status=awaiting    | 5/5            | 59 (56–91)    | 60 (58–101)  |
| status=logged      | 5/5            | 75 (68–77)    | 70 (68–78)   |
| combined           | 5/5            | 73 (71–77)    | 72 (58–78)   |
| reset              | 5/5            | 67 (66–75)    | 48 (47–58)   |
| rapid              | 5/5            | 105 (101–109) | 100 (84–101) |
| sort-Origin        | 5/5            | 73 (72–74)    | 68 (58–75)   |
| sort-Destination   | 5/5            | 74 (71–79)    | 73 (73–79)   |
| sort-Airline       | 5/5            | 72 (70–75)    | 64 (57–81)   |
| sort-Aircraft      | 5/5            | 72 (71–81)    | 74 (65–88)   |
| sort-Duration      | 5/5            | 74 (69–87)    | 74 (65–90)   |
| sort-Distance      | 5/5            | 74 (73–81)    | 72 (59–75)   |
| sort-Date          | 5/5            | 67 (59–73)    | 58 (54–72)   |
| /journal→passport  | 5/5            | 343 (339–358) | 51 (43–62)   |
| /passport→overview | 5/5            | 350 (341–359) | 51 (50–62)   |
| /overview→journal  | 5/5            | 348 (341–356) | 49 (46–55)   |
| history back       | 5/5            | 52 (51–61)    | 67 (64–74)   |
| history forward    | 5/5            | 58 (50–101)   | 52 (49–78)   |
| overview:year      | 5/5            | 68 (63–75)    | 66 (66–67)   |
| overview:reset     | 5/5            | 84 (82–88)    | 49 (48–51)   |
| page2              | 5/5            | 80 (67–83)    | 68 (65–75)   |
| page1              | 5/5            | 66 (66–71)    | 50 (49–51)   |
| select-all         | 3/3            | 67 (67–82)    | 69 (52–98)   |

Rapid Journal changes submit 2023 → 2024 → 2025 immediately and assert the final matching IDs, then wait 200 ms to detect stale replacement. Final input feedback is 35 (33–35) ms; the original rapid feedback predicate waited for results, so its feedback number is not compared. Final correct results are 100 (84–101) ms.

The navigation windows contain zero destination RSC requests. Two final windows overlap an existing background route-projection request, which does not block content. Repeated final primary navigation samples meet the 200 ms goal. Back/Forward remain below 200 ms but do not show a consistent improvement.

Additional Overview periods and rapid changes were added for final correctness coverage; they have no before baseline:

| Scenario           | n final | Final content |
| ------------------ | ------- | ------------- |
| overview:year-2026 | 3       | 67 (63–68)    |
| overview:year-2024 | 3       | 66 (65–69)    |
| overview:year-2023 | 3       | 67 (66–69)    |
| overview:year-2022 | 3       | 67 (67–68)    |
| overview:year-2021 | 3       | 67 (67–67)    |
| overview:year-2020 | 3       | 66 (65–68)    |
| overview:rapid     | 5       | 101 (99–183)  |

### Independent input feedback

Each row has n=5 before and n=5 final. These values mean visible control state, not completed results.

| Journal control  | Before     | Final      |
| ---------------- | ---------- | ---------- |
| q=Tbilisi        | 14 (13–21) | 17 (13–18) |
| year=2025        | 29 (27–33) | 26 (25–26) |
| airline=TK       | 31 (21–34) | 27 (25–29) |
| aircraft=A320    | 22 (19–35) | 27 (27–35) |
| airport=IST      | 27 (20–30) | 28 (23–88) |
| origin=TBS       | 31 (20–35) | 28 (26–29) |
| destination=IST  | 29 (22–31) | 26 (21–29) |
| status=completed | 75 (68–85) | 19 (19–21) |
| status=upcoming  | 59 (56–72) | 25 (24–27) |
| status=awaiting  | 59 (56–91) | 28 (25–72) |
| status=logged    | 75 (68–77) | 20 (19–22) |
| combined         | 28 (21–32) | 28 (25–29) |

All final independently measured Journal feedback samples are below 100 ms. Most individual server-backed filter medians are unchanged. Airport and Completed results reach 138 ms in an outlying sample, Awaiting and search reach 101 ms; these are completion misses under a 100 ms end-to-end interpretation.

### Cold loads and bundles

Each row has n=3 before and n=3 final. LCP/CLS are short-window observations collected through readiness plus 250 ms, not full-session Web Vitals. [Web Vitals definitions](https://web.dev/articles/vitals) distinguish lab observations from field measurements.

| Route    | Metric              | Before                 | Final                  |
| -------- | ------------------- | ---------------------- | ---------------------- |
| journal  | Usable content (ms) | 328 (302–385)          | 215 (207–219)          |
| journal  | TTFB (ms)           | 33 (33–37)             | 26 (23–33)             |
| journal  | FCP (ms)            | 176 (164–180)          | 144 (144–148)          |
| journal  | Observed LCP (ms)   | 572 (492–596)          | 436 (368–464)          |
| journal  | Observed CLS        | 0.0147 (0.0147–0.0147) | 0.0147 (0.0147–0.0147) |
| overview | Usable content (ms) | 319 (237–381)          | 205 (204–205)          |
| overview | TTFB (ms)           | 63 (62–66)             | 49 (45–49)             |
| overview | FCP (ms)            | 168 (164–180)          | 144 (144–148)          |
| overview | Observed LCP (ms)   | 308 (216–396)          | 180 (176–184)          |
| overview | Observed CLS        | 0.0123 (0.0123–0.0123) | 0.0123 (0.0123–0.0123) |
| passport | Usable content (ms) | 285 (273–341)          | 235 (219–262)          |
| passport | TTFB (ms)           | 26 (22–30)             | 17 (17–20)             |
| passport | FCP (ms)            | 204 (180–324)          | 172 (156–184)          |
| passport | Observed LCP (ms)   | 204 (180–324)          | 172 (156–184)          |
| passport | Observed CLS        | 0.0002 (0.0002–0.0002) | 0.0006 (0.0006–0.0006) |

| Route startup JS, gzip         | Before              | Final                               | Difference                       |
| ------------------------------ | ------------------- | ----------------------------------- | -------------------------------- |
| Journal                        | 519,847 B / 508 KiB | 397,555 B / 388 KiB                 | −119 KiB                         |
| Overview                       | 364,510 B / 356 KiB | 397,555 B / 388 KiB                 | +32 KiB                          |
| Passport                       | 332,618 B / 325 KiB | 397,555 B / 388 KiB                 | +63 KiB                          |
| Total built static assets, raw | 105 / 9,233,551 B   | 106 / 9,271,386 B                   | +37,835 B                        |
| Final Worker                   | —                   | 22,825,150 B raw / 4,711,870 B gzip | No before Worker-size comparison |

Startup JS is the sum of unique requested local JS files gzip-compressed from that build, including background prefetch during the collection window. It is not the strictly required route bundle. Full primary prefetch shifts some download work earlier: the Journal wins, while Overview and Passport spend more startup bytes to make subsequent navigation fast. Map and editor code remain deferred until used. Cold timing reductions are observed; uncontrolled host load and dirty-source differences prevent attributing all of them to these changes.

### Local controls, map and transitions

| Scenario                                  | Before                                                          | After                                       | Evidence / interpretation                                                                                |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Passport Stamps → Map view                | 19 (18–33), n=5                                                 | 18 (13–24), n=5                             | Selected radio/heading, not initialized map. One RSC per switch → zero.                                  |
| Passport Map → Stamps view                | 30 (16–32), n=5                                                 | 18 (14–25), n=5                             | Small sample; overlapping ranges.                                                                        |
| Stamp sort controls                       | 17.5 (15–25), n=6 total                                         | Not separately retimed                      | Existing source unchanged; functional checks passed.                                                     |
| Real one-route map layers                 | Countries 17 (17–18); Routes 17; Frequency 17 (16–17), n=5 each | Not separately retimed                      | No requests on layer changes.                                                                            |
| Country catalog search/reset              | 17–33, n=6 cases                                                | Not separately retimed                      | Empty 246, United 5, JP 1, no-match 0, Iceland 1, reset 246.                                             |
| Maximum 5,000-pair map reopen to ready    | 791 (765–806), n=3                                              | 833 (770–900), n=5 isolated                 | No improvement demonstrated; over completion goal.                                                       |
| Maximum-map Routes layer                  | 109 (35–149), n=3                                               | 98 (29–106), n=5                            | Completion outliers remain above 100 ms.                                                                 |
| Maximum-map Countries layer               | 59.5 (58–61), n=2                                               | 62 (60–64), n=3                             | Below 100 ms in this browser.                                                                            |
| Maximum-map Frequency layer               | 93, n=1                                                         | 107.5 (106–109), n=2                        | Too few samples for a strong comparison; current miss retained.                                          |
| Maximum-map fit animation                 | 37–38 frames/600 ms; p95 17 ms; max 20 ms                       | 37 frames/600 ms; p95 18 ms; max 19 ms      | Three runs each; zero frames over 50 ms. No smoothness win claimed.                                      |
| Mobile Status Apply                       | 70 (17–133), n=4                                                | 32 (32–207), n=4                            | After's first run overlapped other work. Different statuses; not paired distributions.                   |
| Mobile filter-sheet opening               | 17 (10–17), n=3                                                 | 17 (9–17), n=4                              | Staged edits leave URL/results unchanged before Apply.                                                   |
| Leaderboard → Profile designed transition | Forward 300 (284–308), n=7; Back 300 (283–300), n=7             | Not retimed; unchanged                      | Specified 280 ms route motion retained. This intentionally exceeds a universal 200 ms completion target. |
| Reduced-motion drill                      | Forward 17 (16–17), n=3; Back 64 (50–150), n=3                  | No duration change                          | No transition marker.                                                                                    |
| Final first flight detail                 | No equivalent original baseline                                 | Correct ticket 91; loading feedback 20, n=1 | Final warm correct-ticket reopen: 89 (84–104), n=3 during other work; 95 (67–185), n=3 later.            |

The maximum-map synthetic response isolates client rendering; it does not measure a real D1 query with 5,000 distinct route pairs or network transfer. One initial after stage reached 606 ms versus a single before 782 ms; that n=1 difference is not treated as a win. Three after reopens overlapping the root benchmark (886–956 ms) are retained in the raw evidence but excluded from the isolated comparison.

Map CSS, shared module, worker and geometry had zero body transfer on warm re-entry after the cache change. Caching removes repeat bytes; it does not remove MapLibre initialization or mounting 5,000 list rows.

Normal drill transitions had one 102 ms frame during the first six cycles and none during eight additional cycles (maximum 25 ms). No recurring cause was established, so their specified duration was left intact. Passport reduced-motion view changes completed in 11–17 ms over six after samples, with zero-duration thumb motion. Country-sheet close includes an intentional 300 ms exit.

### Long tasks and waterfalls

There were no observed >50 ms long tasks inside the 140 baseline or 176 final main-run timed interaction windows. The separate paging baseline lacks a profiler capture. One Passport cold load had a 50 ms task before, and one had a 57 ms task after; the other eight cold samples in each set had none.

Whole-capture renderer trace summaries contain two RunTask events over 50 ms before (maximum 197.844 ms) and three after (maximum 72.654 ms). Capture lengths/scenarios differ, and background GC contributes; these totals are not comparable TBT or evidence of an INP gain. See [before trace summary](../../.scratch/performance-audit/before-trace-summary.json) and [after trace summary](../../.scratch/performance-audit/after-trace-summary.json). The [Chrome Performance documentation](https://developer.chrome.com/docs/devtools/performance) informed trace inspection.

Per-sample resource start/end, transfer bytes and paths are recorded in the JSON. The strongest waterfall evidence is route work moving before navigation, not a faster server: primary route RSC leaves the click path, Passport view RSC is eliminated, immutable map bodies stop transferring, and the large editor chunk moves from Journal startup to the first detail opening.

## Repository coverage

The audit mapped the repository's performance-relevant structure before assigning implementation ownership. Browser journeys, React/bundles, and server/assets were initially delegated as separate read-only audits; findings were consolidated before edits. A fourth independent reviewer checked the substantial final diff and the benchmark, then the loader and pending-select corrections.

| Area                    | Coverage and result                                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active Next routes      | Enumerated 26 App Router page entrypoints, layouts/loading boundaries and navigation. Measured primary reads, Passport views/detail/catalog, Journal detail/filter/paging and Leaderboard/Profile transitions. Full navigation suite covers other route behavior.                                                     |
| React and shared client | Traced navigation intent, URL/pending filter state, flight-detail/import dependency graph, UI sheet/focus handling, Overview period/model/chart rendering, Passport collection and map controls. Reviewed packages/client API and write-feedback/freshness ownership boundaries.                                      |
| Map pipeline            | Projection fetch owner/period/revision keys, cancellation, geometry, MapLibre renderer/worker, layers, list rows, reduced motion, local asset paths and existing 50/500/5,000 benchmark generator. Executed maximum client result set.                                                                                |
| Server/API              | Reviewed 75-route generated dispatch inventory, read wrappers, Journal filtering/pagination/selection, Overview aggregate/derived state, Passport evidence/profile reads, owner gates, write publication and revision checks. Existing query/index/migration architecture considered; no production EXPLAIN executed. |
| API/Worker caching      | Traced outer middleware, API no-store policy, static passthrough, activation and service-worker retirement, maintenance gate and public/private boundaries. Added narrowly scoped versioned-asset caching; runtime boundary checks cover GET/HEAD/304/errors and mutable assets.                                      |
| Configuration/assets    | pnpm/build scripts, Next options, OpenNext adapter, Workers config, self-hosted fonts, map assets, client split chunks and generated asset totals.                                                                                                                                                                    |
| Background/write paths  | Risk-mapped import/SSE/watchers, enrichment/providers, capture/bulk writes, derived repair, maintenance and migration/operator scripts. Functional navigation/runtime evidence reused; no bulk-throughput/provider latency claim.                                                                                     |
| Historical code         | Legacy Vite/Supabase files are historical, outside the active Next/Workers path. Identified as such; not load-tested or refactored.                                                                                                                                                                                   |

This is a repository-wide risk map, not a claim that every source line or API endpoint was profiled. Initial owner Overview reads returned about 30 rows across 17 D1 statements (example local D1 durations 27–44 ms). The synthetic fixture's low route/country cardinality does not test production aggregate diversity. This did not justify new DB caching or query rewrites.

Caches remain scoped to owner/period/revisions; no new application-data cache was added. Existing write acknowledgement/publication handling refreshes route data; identity mutation cancels private operations and reloads the document. A supplemental local UI write verified 5,000 → 5,001 flights on Overview/Journal/Passport/Overview and the final page's one row against the API. That write check preceded the final loader/select build; final functional suites cover write freshness and private boundaries.

## Verification

All checks completed on the final implementation:

- `pnpm next:build` — passed; final build ID above.
- `pnpm --filter @kuuki/next test` — 107 files, 1,118 tests passed.
- `pnpm --filter @kuuki/next lint` — passed.
- `pnpm --filter @kuuki/next typecheck` — passed.
- `pnpm --filter @kuuki/next typecheck:worker` — passed.
- `KUUKI_NEXT_PORT=8817 pnpm test:next:navigation` — 151 passed.
- `KUUKI_NEXT_PORT=8817 pnpm next:smoke` — passed.
- `KUUKI_NEXT_PORT=8817 pnpm next:smoke:boundary` — passed, including all six versioned map GET/HEAD/conditional responses, mutable/missing assets and private boundaries.
- `node --check scripts/performance-audit.mjs` and `git diff --check` — passed.
- Independent final review — no blocking findings; late import cancellation, hook order, native history integration, cache scope and measurement limitations reviewed.

Focused regression tests verify optimistic Status feedback with delayed server acknowledgement and rollback on handled failure, and Passport view history without router navigation. Existing suites verify mobile filter staging, reset/detail URL handling, grouped sorting, full selection/deletion, queue states, arrival/deep links, private writes, account boundaries, reduced motion and keyboard/focus behavior.

Browser checks confirm Back/Forward, direct Map/frequency/country links, ArrowRight view switching, heading focus, reduced-motion behavior, flight-detail direct links, Escape/close row-focus restoration, rapid Status changes and resets. The headless mobile session did not open a virtual keyboard; visualViewport stayed 844 px. Hardware keyboard/viewport behavior is unmeasured.

Check logs are local files under `/tmp/kuuki-perf-*-final.log`. No deploy, remote D1 writes, publishing, or GitHub changes were performed. Unrelated work was preserved.

## Remaining misses and follow-ups

1. **Maximum-map completion:** 770–900 ms reopen; Routes/Frequency can exceed 100 ms. Capture a focused CPU profile with representative distinct airports/routes and a lower-end device before deciding whether list mounting, geometry, renderer initialization or GPU work dominates. Virtualization is a candidate only if the 5,000-row list is shown to dominate.
2. **Rapid/server-backed completion:** Journal reaches 101 ms, individual outliers 138 ms, and rapid Overview reaches 183 ms. Local input feedback meets the goal; server-dependent work is separately recorded. Reproduce under network latency and diverse D1 data before changing request scheduling, queries or caches.
3. **Prefetch tradeoff:** Overview/Passport startup closure increases by 32/63 KiB gzip. Test constrained mobile CPU/network and quick taps before prefetch finishes; the current warm measurements assume it settled. If transfer cost dominates, consider intent-based prefetch using the existing links rather than global caching.
4. **Production/field evidence:** No CDN, production Worker cold-start, WAN/mobile radio, low-end GPU, or field INP/LCP data was collected. Add representative production read-only measurements and RUM before making production-wide performance claims.
5. **Volume/cardinality gaps:** Journal/IDs have no finite owner-total maximum; 5,000 is a large controlled fixture, not a universal maximum. Empty upcoming/awaiting performance, high-cardinality aggregation, full visited-country collections, large reference dropdowns, real maximum-map SQL, import/provider throughput, and auth/settings performance need dedicated fixtures. Existing functional tests cover populated queue correctness.
6. **Intentional motion:** Leaderboard/Profile and sheet exits retain documented motion durations. A universal 200 ms completion requirement would require an explicit product motion decision; shortening these without one is not justified by the current evidence.

No blanket memoization, virtualization, server data caching, new dependency, font conversion or API rewrite was added. The measured changes address navigation waiting, misplaced loading work, pending-input acknowledgement and redundant requests.

## Raw evidence

- [Machine-readable summary](../../.scratch/performance-audit/summary.json)
- [Corrected cold baseline](../../.scratch/performance-audit/before-cold-5000.json)
- [Warm baseline](../../.scratch/performance-audit/before-5000.json)
- [Paging/selection baseline](../../.scratch/performance-audit/before-paging-5000.json)
- [Final main measurements](../../.scratch/performance-audit/after-5000.json)
- [Browser baseline](../../.scratch/performance-audit/browser-before.json) and [supplement](../../.scratch/performance-audit/browser-before-supplement.json)
- [Map/mobile after measurements](../../.scratch/performance-audit/browser-after.json) and [Passport after supplement](../../.scratch/performance-audit/browser-after-supplement.json) — unchanged map/Passport code, taken before final detail/select correction
- [Final detail/rapid Status checks](../../.scratch/performance-audit/browser-final.json)
- [Local write/last-page correctness](../../.scratch/performance-audit/correctness.json)
- [Reproduction runner](../../scripts/performance-audit.mjs)
