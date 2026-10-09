# 18 1k-flight measurement and DESIGN.md

Status: done
Type: task
Owner: orchestrator and measurement worker
Blocked by: 17
Spec: Open risks; D3, D8; Rule precedence

## What

Seed 1,000 flights on the local preview (`scripts/performance-audit.mjs` pattern, bulk endpoint), measure payload gzip size, hydration and time to interactive at 4× CPU throttle with `agent-browser`. Apply the D3 fallback if over 1.5 s. Record the result in the spec. Record every DESIGN.md deviation (weights, eyebrow, slot-text, split pane, firsts glyph) in a Journal section of DESIGN.md.

## Done

- Numbers recorded with method. DESIGN.md updated.

## Result (2026-10-09)

The production-mode local fixture seeded 1,000 flights successfully; eight upcoming flights were moved into awaiting, leaving 993 default matching flights. Three isolated `agent-browser` sessions ran Headless Chrome 151 at 4× CPU throttle, 1280×800, against port 8816 after other build/check processes finished.

The D3 fallback is implemented: first 60 ledger items on the server, then interruptible progressive mounting of real DOM rows. Initial interaction proxy (hydrated controls + first Distance-sort feedback): 2.284 / 1.240 / 1.052 s, median 1.240 s. Two-frame paint opportunity median: 1.282 s. Complete 993-row DOM verified by 3.932 / 2.455 / 2.236 s. First-run TTFB was 953 ms versus 147 / 112 ms; the outlier exceeds 1.5 s. These are local synthetic timings, not phone-hardware TTI.

Payload gzip: 41,366 bytes (751,504 raw); initial document gzip: 58,780 bytes (1,043,402 raw), gzip level 9 on identity responses. All probes and full-row assertions passed without runtime errors. Each run had six unused-CSS-preload warnings. Full-list search/clear feedback medians: 412 / 318 ms. No additional source optimization was required after the median passed; first-load and complete-DOM timing remain recorded limits.

DESIGN.md records Journal deviations. D3 now contains the method and numbers. Artifacts: [`runs-cpu4-progressive-chrome151.json`](../../performance-audit/journal-1k/runs-cpu4-progressive-chrome151.json), [`sizes-progressive.json`](../../performance-audit/journal-1k/sizes-progressive.json); reproduce summaries with `node .scratch/performance-audit/journal-1k/analyze.mjs .scratch/performance-audit/journal-1k/runs-cpu4-progressive-chrome151.json`.

The measurement scripts accept `KUUKI_JOURNAL_AUDIT_DIR` and `KUUKI_JOURNAL_ORIGIN` for isolated state and ports. Temporary credentials stayed outside the repository and outputs; sessions and the owned fixture were stopped after measurement.

## Integrated remeasurement (2026-10-10)

Repeated the same custom 1,000-flight fixture against the final Journal + Overview + dependency integration, including React 19.3 and local airline marks, after the Radix Dropdown 2.1.16 correction. Three fresh-cache Headless Chrome 151 sessions ran at 4× CPU throttle and 1280×800 on port 8816; the Worker stayed alive across runs. The seed and lifecycle assertions passed: 985 logged, 8 awaiting, 7 upcoming; all 993 matching flight rows reached the DOM and every probe completed without runtime errors.

Initial interaction proxy: **2.431 / 1.554 / 1.622 s**, median **1.622 s**. Two-frame paint opportunity: 2.504 / 1.602 / 1.667 s, median 1.667 s. Every proxy run exceeds 1.5 s; the earlier passing median is historical, and the integrated target is not demonstrated. Actual FCP: 1.140 / 0.464 / 0.508 s; actual LCP: 1.472 / 0.756 / 0.840 s. Complete matching DOM: 4.935 / 3.667 / 4.408 s. First-run TTFB: 606 ms versus 195 / 266 ms. Search/clear feedback medians: 626 / 549 ms. Seven unused-CSS-preload warnings occurred per run.

The pre-run host snapshot showed unrelated orphan Node processes at approximately 119% and 129% CPU; those processes were left untouched. This is a local interaction proxy under contention, not physical-phone or Lighthouse TTI. A quieter-host retest is needed before claiming the integrated 1.5-second target; no additional source optimization was performed in this measurement task.

Payload: 751,504 raw / **41,444 gzip** / 23,276 brotli bytes. Initial document: 1,056,660 raw / **58,887 gzip** / 34,492 brotli bytes. Compression settings match the earlier method. Current artifacts: [`runs-cpu4-integrated-chrome151.json`](../../performance-audit/journal-1k/runs-cpu4-integrated-chrome151.json), [`sizes-integrated-chrome151.json`](../../performance-audit/journal-1k/sizes-integrated-chrome151.json). The superseded pre-Radix-fix attempt was retained only outside the repository and is not acceptance evidence. No build was rerun; fixture bundling used the final production build. Owned fixture/browser sessions were stopped and temporary credentials removed after measurement.
