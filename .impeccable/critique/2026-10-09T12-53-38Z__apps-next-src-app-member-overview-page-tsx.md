---
target: overview page
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 0
target_identity: 'file:/Users/indi256/Documents/kuuki/kuuki/apps/next/src/app/(member)/overview/page.tsx'
target_fingerprint: 'sha256:8514df5467943315138056f75ff63e0750d02bf835b65807be7aeac5cb147b70'
target_path: /Users/indi256/Documents/kuuki/kuuki/apps/next/src/app/(member)/overview/page.tsx
timestamp: 2026-10-09T12-53-38Z
slug: apps-next-src-app-member-overview-page-tsx
---

# Overview critique — 2026-10-09

| #         | Heuristic                       | Score     | Key issue                                                |
| --------- | ------------------------------- | --------- | -------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | Replay scrubber years overlap on desktop                 |
| 2         | Match System / Real World       | 3         | "Time zones" counts UTC offsets                          |
| 3         | User Control and Freedom        | 3         | Phone "3 to review" has no action                        |
| 4         | Consistency and Standards       | 3         | Rankings legend hides series while names filter the page |
| 5         | Error Prevention                | 3         | Chart clicks filter immediately with little scaffolding  |
| 6         | Recognition Rather Than Recall  | 2         | Phone tile names omit their visible previews             |
| 7         | Flexibility and Efficiency      | 3         | Rankings length slows scanning                           |
| 8         | Aesthetic and Minimalist Design | 3         | Heavy analytical middle                                  |
| 9         | Error Recovery                  | 3         | Plain retry, zero-result recovery                        |
| 10        | Help and Documentation          | 2         | Chart keyboard controls not exposed                      |
| **Total** |                                 | **28/40** | Good                                                     |

## Priority issues

1. [P2] Rankings dominates desktop reading (distill): disclose annual rank, shares, head-to-head.
2. [P2] Replay years collide (adapt): width-aware ticks.
3. [P2] Phone review count has no action (adapt): link to /journal?queue=awaiting.
4. [P2] Tile accessible names omit previews (harden): aria-describedby.

## Minor

- Records precision (903.731 km/h, 1.139°); "Time zones" wording; RU review arrow wrap; caption at viewport edge (overlay); chart-theme.css:52 layout-transition (SVG geometry, low impact).

## Detector

CLI: 1 (layout-transition, chart-theme.css:52). Overlay: body-text-viewport-edge (verify), repeating-stripes-gradient on .ov3-crossing-dots (FP), repeated-container-text airline names (FP).
