# Kuuki load performance, 28 October 2026

The Overview map activation and scroll-triggered card-loading policies measured here were superseded on 29 October: the map loads automatically on every connection, and eligible cards start loading with the page. The figures below retain the original deferred-loading baseline and do not measure the current Overview experience.

Cold-load JavaScript fell **51.5%** across the measured routes and device profiles: **51.3% on mobile** and **51.7% on desktop**. Control hydration readiness improved **11.8–27.3%**, or **19.2%** across the six measured combinations. The 50% result describes JavaScript download weight. These are compiled local-fixture results; no production deployment was performed.

## Measured results

Median of three cold loads. JavaScript uses decimal gzip KB; lower is better.

| Profile | Route    | Before KB | After KB | Reduction |
| ------- | -------- | --------: | -------: | --------: |
| Mobile  | Overview |   1,215.7 |    544.4 |     55.2% |
| Mobile  | Journal  |     802.6 |    404.7 |     49.6% |
| Mobile  | Passport |     780.8 |    413.3 |     47.1% |
| Desktop | Overview |   1,268.8 |    560.8 |     55.8% |
| Desktop | Journal  |     802.6 |    404.7 |     49.6% |
| Desktop | Passport |     780.8 |    413.3 |     47.1% |

The overall gzip reduction compares the sum of route medians for one visit to each route in each profile. It is not weighted by production traffic. Recorded JavaScript resource-transfer totals also fell 51.3% overall: 5,756,482 → 2,804,936 bytes across the six combinations, including the response overhead reported by Resource Timing.

| Profile | Route    | Controls before → after | Improvement | LCP before → after |
| ------- | -------- | ----------------------: | ----------: | -----------------: |
| Mobile  | Overview |           5.90 → 4.28 s |       27.3% |      1.13 → 0.83 s |
| Mobile  | Journal  |           5.16 → 4.50 s |       12.7% |      0.99 → 0.96 s |
| Mobile  | Passport |           5.73 → 4.54 s |       20.9% |      5.72 → 0.78 s |
| Desktop | Overview |           5.59 → 4.22 s |       24.5% |      1.11 → 0.83 s |
| Desktop | Journal  |           5.12 → 4.52 s |       11.8% |      0.97 → 0.94 s |
| Desktop | Passport |           5.72 → 4.78 s |       16.4% |      3.33 → 3.14 s |

All 18 final samples had no horizontal overflow or Next error overlay. The largest final CLS was below 0.014. Mobile Passport LCP improved 86.4%; desktop Passport improved 5.9%. Mobile Journal script execution time rose 13.0% in this collection window, despite earlier control readiness. CPU and paint gains vary by route.

The complete published static-asset archive grew from 24,302,042 to 25,172,709 bytes (+3.6%) as separate feature chunks and font shards were added. The savings above measure the code a cold route actually requests; deferred editors, recognition and maps remain available.

## Changes

- Navigation links prefetch on mouse or keyboard intent. Offline and constrained connections skip speculative prefetches.
- Overview uses airport and aircraft references already carried by its payload. The larger offline capture catalogs stay with the editor.
- Overview tile drawings and desktop chapter bodies mount as they approach the viewport, using the existing loading bands. Passport achievement figures use the same approach. Offscreen analysis text becomes available when its content mounts.
- Save-Data, 2G/3G, or an advertised downlink of 2 Mbps or less keeps the globe behind **Load map**. Fullscreen and replay also request the renderer. Browsers without connection information retain automatic loading.
- Shared sheet controls remain eager. Flight detail and calendar bodies load on demand. Toasts, swipe rows and bottom sheets bind animated values directly to DOM nodes while retaining the existing gesture physics and reduced-motion behavior.
- The import dock first loads for an unviewed run and remains mounted through its exit. Acknowledged cookie notices load their presentation code only when reopened.
- Removed unused `d3-geo` and `@types/d3-geo`; their unused transitives were pruned without upgrading dependencies.
- Unicode-range font shards reduce Latin-only font downloads. Original WOFF2 files and OFL licenses remain available, including the map's original Paper Mono URL.

## Measurement contract

Use the compiled OpenNext Worker and local synthetic fixture, rather than the development server. Baseline and candidate use the same existing dirty checkout; unrelated edits are preserved. The base commit was `0898cea7`.

Measure the signed-in synthetic `a@example.test` account with the default fixture's 27 flights, English UI and acknowledged cookie notice. Each route starts with a cold browser HTTP cache. Network settings are 1.6 Mbps download, 750 Kbps upload and 150 ms latency. Mobile uses 390 × 844 with 4× CPU throttling; desktop uses 1440 × 900 with 1× CPU. Run three trials for Overview, Journal and Passport in each profile.

The readiness measurement waits for the route's primary control to have React event props attached, then two animation frames. It is a local hydration-readiness proxy, not the standardized INP metric. Resource collection continues for three seconds afterward to include post-hydration downloads and prefetching. JavaScript sizes sum unique requested static script files using gzip compression; the local server's gzip response encoding was verified. Raw and Brotli sizes, resource timings, LCP, CLS, script time and horizontal overflow are also recorded.

The weak-connection Overview comparison includes the intentional change from automatic map loading to explicit activation. Requesting the map or scrolling through deferred content downloads additional code. These measurements do not describe every feature loaded together or predict production latency on every device.

## Reproduce

From the workspace root, run `pnpm next:build`, then `pnpm next:preview`. Open the printed loopback URL with an isolated `agent-browser` session and sign in to the synthetic fixture. Set the fixture's `kuuki-kuukies` localStorage value to `1`, matching the browser suite.

```sh
KUUKI_PERF_SESSION=kuuki-performance \
KUUKI_PERF_ORIGIN=http://127.0.0.1:8800 \
KUUKI_PERF_OUTPUT=.scratch/performance-2026-10-27 \
node scripts/performance-load.mjs final
```

Use the preview's actual port. `PERF_TRIALS`, `PERF_PROFILE` and `PERF_ROUTE` optionally restrict a run. The script uses agent-browser for navigation and CDP for instrumentation, cache control and throttling unavailable in the CLI. It resets throttling and removes its instrumentation afterward. Run it while builds and other checks are idle, and stop the fixture and isolated browser when finished.

Raw logs and measurements live under `.scratch/performance-2026-10-27/`. The baseline source diff is preserved there as `foreign-baseline.diff`; raw fixture/browser data are local artifacts.

## Font coverage

Regenerate with `python3 scripts/subset-ui-fonts.py`; verify without writing with `--check`. The script documents its fontTools/Brotli versions. These are generation tools, not application dependencies.

Coverage is derived from the original cmap. All original characters are retained, with combining marks shared between shards for decomposed text. Checks cover deterministic bytes, character advances, layout feature tags and variable axes. The four fonts used by the initial English screen fall from 260,544 to 158,468 bytes, saving 102,076 bytes (39.2%). Mixed or Russian content can load both shards, adding 33,300 bytes (12.8%) compared with the original four full fonts. Paper Mono's existing lack of Cyrillic continues to use the Commissioner fallback.

## Verification

The final source passes the production build, lint, application and Worker TypeScript checks, all 1,838 unit tests, all 56 browser journeys, Worker runtime/boundary/share-card smoke checks, formatting and deterministic font checks. Independent review covered the task diff and shared animation lifecycle changes. All 21 unrelated tracked files compared with the initial diff remain unchanged by this task. After measurement, a focused run at the same throttling loaded all six visible Overview sections on both viewport sizes. The mobile sheet dismissed during first opening, restored opener focus and reopened with its ready chapter. Both sizes retained the optional map action and had no horizontal overflow. Browser font comparison covered 20 cases across all five fonts, including English, Russian, Greek, decomposed accents and ligature contexts; every measured text width matched the original fonts exactly. These checks are saved as `weak-controls.json` and `font-parity.json` beside the raw load samples.
