---
target: overview layout at 4K
total_score: 21
max_score: 36
na_heuristics: 9
p0_count: 2
p1_count: 2
target_identity: "file:/Users/indi256/Documents/kuuki/kuuki/apps/next/src/app/(member)/overview/page.tsx"
target_fingerprint: "sha256:2d7a26a88a20a14d78f1ada0354cf149597efc1740a9982634765fe1ac9a8ae8"
target_path: /Users/indi256/Documents/kuuki/kuuki/apps/next/src/app/(member)/overview/page.tsx
timestamp: 2026-10-09T07-36-58Z
slug: apps-next-src-app-member-overview-page-tsx
---
# Overview layout critique at 4K (2560 CSS px), 2026-10-09
Score 21/36 (h9 n/a). Acceptable.

## Priority issues
- [P0] Charts capped at 600-unit viewBox + fixed px height -> centered small charts. charts/kuuki-chart.tsx:30,102; rhythm/section.tsx:81; arc-brush.tsx:21; crossings/bars.tsx:17; arc-donut.tsx:26. Fix: measured width for time series; data-driven width, left-aligned for count charts.
- [P0] Static name-based pairing (layout/bento.ts:4-5) + align-items:start (layout.css:31, page.css:58) -> holes. Fix: shortest-lane two-column flow >=1800px (grid-lanes + JS fallback); gated sections become prompt rows.
- [P1] Controls stretch: ui/flight-controls.css:54 date fields; chart-theme.css:57-59 sliders. Fix: 18ch fields; one dual-thumb range over brush.
- [P1] space-between distances: ui/ui.css:146 disclosure trigger; rankings.css:32 share legend. Fix: fit-content trigger; legend 36ch/columns, top 8 + N more.
- [P2] Fleet body split flex:1 misrepresents 44/20 (fleet.css:2). Fix: flex-grow by count; cap ~960px.

## Detector
1 finding: layout-transition chart-theme.css:52, mostly false positive (SVG geometry); reduced-motion guard missing.

## Questions
Should Overview be 2560 wide? Duplicate period controls? Split Rhythm?
