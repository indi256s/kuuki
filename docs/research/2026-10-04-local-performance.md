# Local performance rehearsal

The opt-in benchmark passed on 4 October 2026: 128 paired reloads, 20 Next Link transitions, 20 single-flight saves and 18 map actions. Raw samples are written to the ignored `docs/research/.local-performance.json` and retained with `w5-performance-results.log` in `/tmp/plan-execution/kuuki-20261004/`. The final patched legacy Vite pages are a compatible local baseline; an archived W1 performance artifact is unavailable, so this is not a measured W1-before/W5-after comparison.

Measured at `2026-10-04T19:28:36.844Z` on Apple M1 Pro (arm64), 16 GiB RAM, Node 24.18.0, Playwright 1.63.0 and Chromium 153.0.8010.12. The production Next build ID is `mX4blKM7UpZLAbVgAmi9E`; source/artifact hashes are in the candidate manifest and execution ledger. Network was loopback `127.0.0.1:8800`, with no shaping or geographic region. One browser worker ran against local workerd; no concurrent builds or other benchmark fixtures ran. Ordinary desktop background activity was not controlled. Medians use the middle value (mean of the two middle values for even n); p90/p95 use the nearest-rank order statistic. Durations below are milliseconds; heap uses MiB.

## Run

1. Freeze application writers and rebuild the production preview with the repository's `next:preview` setup.
2. Run `pnpm --filter @kuuki/next exec playwright test --config tests/performance.config.ts` from the repository root. The default `playwright.config.ts` matches only `*.test.ts`, so it excludes this `*.bench.ts` suite.
3. Record machine, browser/Playwright version, commit, build identifier, local port, and whether other services were running. Preserve the raw JSON with the review artifact or paste summary statistics here. Do not commit account identifiers or logs containing session data.

## Paired read journeys

Four new, separate accounts receive 0, 1, 10 and 500 completed synthetic JFK→BOS flights through the real auth and bulk-flight APIs. Batches contain at most 50 items and the API list total is checked before measurement. The 500-flight history is intentionally repeated on one directed route; it stresses journal length and aggregate count, not route diversity. Each account drives Next Overview and Journal alongside legacy Dashboard and Flights in one browser context. Their order alternates each iteration. Three iterations disable browser cache; five enable it. All are full document navigations. The labels **cold-cache reload** and **warm-cache reload** describe cache policy only: browser process, authenticated context, JS heap and workerd remain warm. This suite does not measure a fresh OS/browser process or a deployed CDN.

Readiness is observed from owned UI data: Overview flight count, Journal total, legacy Dashboard flight count/empty state, and legacy Flights total. The suite fails rather than timing an error/skeleton. `responseMs` is the browser event for the matching document response; `readyMs` is wall time until that UI assertion settles. Request count and response `Content-Length` sum stop at readiness; responses without that header are omitted from bytes. Next’s zero values below mean no header-known bytes were observed, not zero network payload. Distinct requested JS asset URLs are mapped to the local `.open-next/assets` build and gzip-compressed once; this is a loaded closure estimate, not transfer size and not total available build JS. CDP `ScriptDuration` and `TaskDuration` deltas, plus `JSHeapUsedSize`, are browser-main-process proxies. They are not hydration CPU, total memory, or server/D1 cost. D1 query counts and server CPU, if needed, must be extracted separately from correlated local workerd logs.

For each history, route, and cache phase, report median and p90 of raw `readyMs` and `responseMs`, plus median request count, header-known response bytes, unique loaded JS gzip bytes, and CDP duration/heap. Include all raw values or the JSON artifact. Three or five samples are too few for a stable p95 or an operational SLO. Any comparison is local synthetic evidence only.

| History | Route | Cache | n | Ready median / p90 (ms) | Response median / p90 (ms) | Requests median | Known response bytes median | Loaded JS gzip | Script / task delta median | Heap median |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | next overview | cold | 3 | 64.7 / 493.9 |21.2 / 295.0 | 16 | 0 | 147909 | 0.5 / 17.1 | 22.8 |
| 0 | legacy dashboard | cold | 3 | 870.2 / 950.8 |9.2 / 50.2 | 49 | 132722 | 381040 | 30.2 / 100.0 | 21.6 |
| 0 | next journal | cold | 3 | 43.6 / 60.5 |17.4 / 29.9 | 17 | 0 | 73185 | 0.3 / 14.7 | 23.4 |
| 0 | legacy flights | cold | 3 | 867.8 / 868.3 |12.2 / 14.0 | 45 | 132722 | 377788 | 28.7 / 90.6 | 19.1 |
| 0 | next overview | warm | 5 | 54.7 / 96.1 |15.5 / 17.4 | 16 | 0 | 147909 | 4.5 / 29.9 | 56.1 |
| 0 | legacy dashboard | warm | 5 | 834.3 / 852.0 |8.4 / 17.9 | 49 | 132722 | 381040 | 29.4 / 76.0 | 35.7 |
| 0 | next journal | warm | 5 | 45.1 / 54.7 |13.9 / 16.6 | 18 | 0 | 172148 | 4.5 / 25.1 | 33.7 |
| 0 | legacy flights | warm | 5 | 826.4 / 837.2 |4.7 / 5.6 | 45 | 132722 | 377788 | 26.9 / 77.0 | 40.5 |
| 1 | next overview | cold | 3 | 56.3 / 141.4 |17.3 / 27.4 | 17 | 0 | 146932 | 0.7 / 16.1 | 38.7 |
| 1 | legacy dashboard | cold | 3 | 881.7 / 903.9 |10.4 / 25.1 | 60 | 247724 | 519883 | 73.6 / 176.6 | 27.4 |
| 1 | next journal | cold | 3 | 41.7 / 46.9 |14.7 / 17.4 | 18 | 0 | 146932 | 0.5 / 14.9 | 23.3 |
| 1 | legacy flights | cold | 3 | 857.0 / 861.4 |6.0 / 8.3 | 45 | 132722 | 377788 | 28.7 / 83.0 | 26.7 |
| 1 | next overview | warm | 5 | 50.7 / 109.6 |14.2 / 16.6 | 17 | 0 | 147909 | 4.2 / 28.9 | 62.9 |
| 1 | legacy dashboard | warm | 5 | 834.5 / 850.3 |8.0 / 17.6 | 60 | 247724 | 519883 | 70.6 / 165.0 | 56.1 |
| 1 | next journal | warm | 5 | 46.2 / 49.4 |14.9 / 15.7 | 19 | 0 | 172148 | 4.3 / 25.1 | 58.5 |
| 1 | legacy flights | warm | 5 | 833.2 / 847.0 |4.3 / 11.1 | 46 | 208898 | 377788 | 27.9 / 75.7 | 62.9 |
| 10 | next overview | cold | 3 | 63.0 / 144.9 |15.9 / 26.8 | 17 | 0 | 146932 | 0.5 / 16.0 | 36.2 |
| 10 | legacy dashboard | cold | 3 | 876.2 / 901.2 |11.8 / 21.5 | 63 | 247724 | 519883 | 88.2 / 183.2 | 34.7 |
| 10 | next journal | cold | 3 | 47.5 / 51.5 |17.1 / 19.0 | 18 | 0 | 146932 | 0.5 / 18.6 | 27.9 |
| 10 | legacy flights | cold | 3 | 865.6 / 876.6 |9.6 / 26.0 | 49 | 132722 | 377788 | 33.9 / 95.1 | 26.7 |
| 10 | next overview | warm | 5 | 50.5 / 56.2 |14.2 / 15.9 | 22 | 0 | 147909 | 5.2 / 31.8 | 65.6 |
| 10 | legacy dashboard | warm | 5 | 831.9 / 836.8 |4.3 / 15.1 | 61 | 247724 | 519883 | 73.0 / 162.9 | 70.7 |
| 10 | next journal | warm | 5 | 48.2 / 65.8 |16.7 / 32.2 | 24 | 0 | 172148 | 6.3 / 28.6 | 79.3 |
| 10 | legacy flights | warm | 5 | 834.7 / 841.8 |3.9 / 7.9 | 46 | 208898 | 377788 | 34.0 / 92.3 | 82.7 |
| 500 | next overview | cold | 3 | 93.2 / 141.7 |17.9 / 65.3 | 17 | 0 | 147909 | 0.8 / 15.7 | 51.4 |
| 500 | legacy dashboard | cold | 3 | 857.2 / 901.4 |11.1 / 12.1 | 60 | 247724 | 519883 | 73.4 / 162.8 | 35.8 |
| 500 | next journal | cold | 3 | 44.9 / 58.6 |20.4 / 21.4 | 18 | 0 | 62368 | 0.5 / 16.5 | 30.6 |
| 500 | legacy flights | cold | 3 | 869.5 / 878.7 |11.9 / 13.6 | 45 | 132722 | 377788 | 37.1 / 102.7 | 29.4 |
| 500 | next overview | warm | 5 | 61.0 / 72.0 |20.8 / 28.2 | 22 | 0 | 147909 | 5.0 / 30.8 | 64.5 |
| 500 | legacy dashboard | warm | 5 | 835.5 / 856.3 |6.6 / 11.7 | 60 | 247724 | 519883 | 73.8 / 161.8 | 62.0 |
| 500 | next journal | warm | 5 | 50.5 / 74.4 |16.9 / 29.5 | 19 | 0 | 172148 | 5.0 / 29.5 | 61.7 |
| 500 | legacy flights | warm | 5 | 844.1 / 868.4 |4.4 / 20.1 | 46 | 208898 | 377788 | 37.8 / 103.9 | 59.1 |

## Next shell transitions

After the reloads, each account starts on Overview and clicks five real Next `Link` elements in this sequence: Journal → Passport → Overview → Journal → Passport. The benchmark requires a URL change, an owned final UI count, and zero document requests; otherwise it fails instead of labeling a reload as client navigation. `urlMs` stops at URL change, `readyMs` stops at the owned content assertion, and `rscResponseMs` records an RSC response when one occurs after the click. A prefetched or cached transition can have no observed RSC response, represented by `null`. URL change is a shell cue, not an Instant navigation claim. Five sequential transitions at each history size are descriptive only and share a warm browser and app session.

| History | Transition | n | URL median (ms) | Owned ready median / p90 (ms) | Observed RSC response median (ms) | Document requests |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 0 | Overview/Journal/Passport sequence | 5 | 47.0 | 64.8 / 850.8 | 40.5 (5/5 observed) | 0 |
| 1 | Overview/Journal/Passport sequence | 5 | 46.7 | 48.4 / 866.9 | 38.4 (5/5 observed) | 0 |
| 10 | Overview/Journal/Passport sequence | 5 | 49.6 | 57.6 / 845.0 | 40.3 (5/5 observed) | 0 |
| 500 | Overview/Journal/Passport sequence | 5 | 44.9 | 48.9 / 834.2 | 34.8 (5/5 observed) | 0 |

Within each warmed context, the first Overview → Journal transition took 356–404 ms to owned content, and the first Journal → Passport took 834–867 ms. Repeated visits took about 45–65 ms. URL/RSC response clocks settled sooner; these samples do not establish why content was slower. The medians above therefore must not be used alone for the proposed staging p95 navigation budget.

## Single-flight saves

A separate fresh account performs 20 sequential `POST /api/flights` requests with valid JFK→BOS input, the real CSRF token, and a distinct idempotency key for every save. Each response must be `201`; the final owned API list total must be 20. `responseMs` measures client request-to-response completion. `apiDurationMs` parses `Server-Timing: api;dur=…` only if the runtime exposes it, and retains the raw header. The API logs `flight_save` with `canonicalMs`, `repairMs`, and total duration; those fields are not returned by the endpoint. Correlate the 20 local workerd JSON log lines to these 20 saves before claiming canonical/repair distributions. If logs cannot be reliably isolated, report response and available Server-Timing only. The 20-sample p95 is a descriptive order statistic, not an SLO or load test. The scenario never invokes a provider.

| n | Response median / p95 (ms) | Server-Timing API median / p95 (ms) | Canonical median / p95 (ms) | Repair median / p95 (ms) | Derived states |
| ---: | ---: | ---: | ---: | ---: | --- |
| 20 | 12.0 / 13.6 | 9.5 / 11.0 | 1.0 / 1.0 | 2.0 / 3.0 | 20 ready |

The save log summary excludes the fixture’s initial pre-ready save. After the ready marker, exactly 20 `flight_save` events correspond to the sole sequential single-flight save scenario; all are created/ready. No owner identifiers or credentials are retained in this summary.

## Map renderer load

The map scenario starts from a new empty account and intercepts only the private route-projection HTTP response. It supplies 50, 500 and 5,000 distinct synthetic directed routes in the endpoint's production shape, leaving the real MapLibre island, local worker, country GeoJSON, GeoJSON source, layers and route list running. This isolates browser rendering from D1 projection and network payload time. The first open includes clicking the actual Stamps → Map control, its RSC view navigation and renderer controls becoming visible; reopen uses the Map panel’s actual Open map control. The benchmark records open-to-controls, route selection, theme change, Fit routes, close, and reopen-to-controls. Each clock stops after the expected UI state and two `requestAnimationFrame` callbacks. The two frames establish a lower-bound UI settlement point; they do not prove worker completion, map idle, GPU completion or smooth frame rate. Heap is Chromium's used-JS-heap sample, not total browser or GPU memory. Read the 5,000-route result alongside the separate Node geometry/serialization benchmark in [map implementation](2026-10-04-map-implementation.md); neither substitutes for the other.

| Routes | Open (ms) | Select | Theme | Fit | Close | Reopen | Heap after reopen |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | 1100.5 | 73.6 | 61.6 | 148.0 | 187.2 | 186.2 | 17.1 MiB |
| 500 | 565.6 | 474.7 | 68.3 | 263.6 | 383.7 | 227.4 | 55.1 MiB |
| 5,000 | 2737.2 | 373.7 | 65.3 | 128.1 | 1043.1 | 2245.5 | 139.2 MiB |

## Interpretation

Next’s measured loaded JS closure was smaller than the paired legacy surfaces, but final-data readiness varied by route/cache/history and these small samples establish no universal speedup. The 5,000-route map took 2,737.2 ms to first controls and 2,245.5 ms to reopen, with 139.2 MiB used JS heap after reopen. That is a recorded high-volume hotspot; the accessible list/fallback remains available. This single local observation does not justify a provider/renderer swap or claim smooth GPU rendering. More representative sampling and a route-list/rendering investigation should precede a large-route cohort.

Before a performance claim, verify source commit and build freshness, check benchmark failures and missing metrics, and compare the paired distributions at each history size. A single outlier or one rehearsal does not establish a regression. The local result can guide a decision to ship or investigate; it cannot represent production latency, varied devices, real histories, CDN caching, D1 load, or WebGL frame pacing.

The accompanying sanitized log contains 72 Overview read events, each with 13 statements; returned `rows` ranged from 3 to 10, D1 time median/p90 1.0/3.0 ms, and revision lag remained zero. These combined scenario events are not per-history, per-frontend or platform scanned-row distributions. Provider accuracy/usage and Web Vitals were not measured by this run.
