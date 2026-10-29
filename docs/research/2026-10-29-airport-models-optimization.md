# Airport Models — Thermos/Ponytail optimization

Date: 2026-10-29. Local implementation commit: `1674d0f437ed48aa1c7cf86442598356cb1724ae`.
The subsequent optimization commit adds this report. Push, PR and deployment were not performed.

## Measured result

| Metric                                    | TBS before → after    | BER before → after    |
| ----------------------------------------- | --------------------- | --------------------- |
| GPU draw calls per unselected orbit frame | 440 → 10              | 951 → 11              |
| Submitted triangles                       | 7 639 → 7 639         | 36 365 → 36 365       |
| p95 CPU render work                       | 1.0 → 0.3 ms          | 2.1 → 0.3 ms          |
| Flat plan gzip                            | 23 635 → 22 559 bytes | 72 910 → 55 455 bytes |
| Flat plan records                         | 437 → 370             | 924 → 625             |
| Full-model identities                     | 437 → 437             | 924 → 924             |

Native WebGL `drawArrays`/`drawElements` instrumentation in the existing browser
case measures submissions; no production telemetry hook was added. It records
one scripted drag under Headless Chrome 156 / ANGLE Vulkan SwiftShader, DPR 1.
TBS uses 390×844/normal motion; BER uses 320×700/reduced motion. CPU timing covers
the requestAnimationFrame callback submitting a GPU frame, excluding unrelated
pointer/React work; it is not GPU execution time. The final navigation run has
zero idle frames. A ≤32 draw-call budget for this unselected orbit fails on the
baseline (440) and passes after batching (10/11).

The final untraced p95 intervals between GPU submissions are **17.6/34.2 ms**;
traced **17.4/34.3 ms**. BER still misses the **≤33 ms** goal. Earlier baseline
runs included both 34.2 and 50.4 ms for BER, so no frame-rate improvement is
claimed from the interval variation. Physical-phone/hardware-GPU performance
remains unmeasured; see the [open performance issue](../../.scratch/airport-models/performance-followup.md).

## Changes

- [Scene](../../apps/next/src/client/airport-models/viewer/scene.ts): merge exact geometry per layer/material using the installed Three utility. Original per-feature meshes remain on the CPU for picking and outlines; display batches acquire GPU buffers. Holes, heights, identities, coplanar ambiguity and layer visibility remain intact. Bounds and visible picking lists are cached.
- [Renderer](../../apps/next/src/client/airport-models/viewer/renderer.ts): coalesce hover picking to one pending frame, retain immediate taps, reuse the pointer vector and avoid redundant world updates. Insets still reach focus calculations; unchanged visual state does not submit a frame. Hide/retirement cancels pending work.
- [History service](../../functions/api/_services/airportHistory.ts): empty-filter history uses SQL date/id keyset pagination, LIMIT 51 and exact count/anchor validation in the same revision-bearing D1 batch. Refs and suppressions are skipped there. Filtered scopes retain the canonical raw-row projection and `matches()` with all facets. The 5 013-flight fixture now transfers at most 64 result rows including metadata; this bounds Worker transfer/projection, not database COUNT scan cost.
- [History lifecycle](../../apps/next/src/client/airport-models/use-airport-history.ts): guarded cancellation releases loading without dropping loaded pages/cursor. Closed-panel lifecycle invalidation marks the snapshot dirty and refreshes on reopening; ordinary panel transitions retain cached pages. Refreshing cached data has an explicit updating state.
- Cursor v2 carries an ID anchor, resolved against the bound snapshot's database order. Raw legacy date labels are not parsed or embedded in the cursor. Owner/airport/scope/revisions/evidence and canonical encoding remain validated; missing anchors return 400, changed revisions 409. There was no published v1 client contract.
- [Preparation](../../scripts/airport-models/prepare.ts): omit point markers and covered non-runway lines from flat plans because comparison draws nothing for them. Runway metadata remains; full models retain every object. Both complete models match the base except revision, previews are byte-identical, and displayed plan geometry matches exactly.
- [Projection](../../scripts/airport-models/normalize.ts): reuse one Proj4 converter per airport. A warm 10-iteration median coordinate-only benchmark gave TBS 10.42→0.95 ms and BER 28.12→2.94 ms, with identical results for all 9 300 nodes. This is not an end-to-end preparation speedup measurement.
- UI uses canonical date/number/plural formatters. The initial commit also excludes canonical generated airport assets and source snapshots from Oxfmt, following the existing maps policy; content-addressed bytes remain generator-owned.

New content revisions: TBS `e29cc4e107a9c2163615f7c17dd2d12b674d6d043f551f710a78840d9afd5b6e`, BER `22781513d732768ff7191fcc20363db4ede08a364c7fef2676c26f222c0aed9d`.
The old unpublished outputs are archived in execution evidence and remain in the
base commit. No immutable asset was overwritten. The renderer chunk is 144 966
gzip bytes against a 307 200-byte budget. Other sizes/topology diagnostics are
in the [generated report](../../scripts/airport-models/report.generated.json).

## Review and verification

Thermos ran two parallel independent `gpt-6.1-sol/high` reviews. Deduplication
produced three confirmed P2 bugs: cancelled pagination, missed closed-panel
invalidation and rejection of a cursor emitted at a legacy date boundary.
All three regressions failed before repair and pass afterward. A separate
independent recheck found no new material P1/P2, verified all 35 pinned paths and
independently confirmed asset equivalence. A later small primary correction to
two provenance formatter calls passed final types/build/browser checks.

- Pipeline: 11 tests; deterministic check of all 20 outputs; script types PASS.
- API: 81 files / 1 008 tests, including both SQL and canonical-filter pagination, owner/revision/readiness and bounded transfer PASS.
- Next: 218 files / 1 855 tests after the functional changes PASS; subsequent screen-only formatter correction verified through current types/build/browser gates.
- Lint: 0 errors, 15 existing warnings. API/Next/Worker types PASS.
- Production build and composed Worker smoke PASS; 85 API routes, 1 250 static assets. Exact asset GET/HEAD/304/MIME/missing cases and member boundaries remain covered.
- Full navigation script: 61 normal-fixture cases PASS, dock layout case intentionally skipped there and separately PASS with its dedicated binding-presence fixture. A final actual-canvas run with trace also PASS. Dock layout doubles do not establish background job execution.
- Portability: all 20 outputs reproduce in a non-Git source/data bundle without `.scratch` or workspace links; the installed pinned tsx CLI is tooling. No new checkout was created.

Reviews:

- [Airport Models Thermos branch audit](t3-thread://v1/thread:delegated-task:command%3Amcp%3A48421ff4-c656-474f-a649-22897cfacd17%3Adelegate-task%3A62841d27-83df-4496-b12c-3ce6d8b5280d)
- [Airport Models Thermos quality audit](t3-thread://v1/thread:delegated-task:command%3Amcp%3A48421ff4-c656-474f-a649-22897cfacd17%3Adelegate-task%3A217f84e9-cc91-4bf1-aa9c-72bb2d234686)
- [Airport Models optimization acceptance](t3-thread://v1/thread:delegated-task:command%3Amcp%3A48421ff4-c656-474f-a649-22897cfacd17%3Adelegate-task%3Acd5825b6-8a6b-44fe-acc7-a289bf067fe2)

Logs, profiles, asset-equivalence proof, pinned patches/inventories and commit
recovery records are in `/tmp/airport-models-optimization-20261029/`. Checks ran
in the shared tree under the explicit no-new-checkout constraint. Foreign work
and staging are preserved; no remote writes are part of this acceptance.
The exact snapshot date of OSM inputs remains unknown/null; estimated dimensions
remain labelled. Runtime has no Overpass dependency.

[Current implementation handoff](../plans/2026-10-29-airport-models-handoff.md).
