# Release 3 consolidated delivery audit — 8 October 2026

Status: resolved

What this repo does: Kuuki keeps private flight journals and publishes owner-selected profile information. The audit assumes personal journal load, concurrent requests and multiple tabs; the real board has 69 completed flights, while the existing 5,001-flight fixture exercises aggregate volume.

The owner requested Thermos and a separate whole-repository Ponytail audit, followed by fixes, CI promotion and deployment. Three independent GPT-6.1 Sol reviewers ran with high reasoning. The root verified and consolidated their findings, implemented the fixes and requested one consolidated remediation review. No new test cases or visual checks were added or run.

## Scope and coverage

The effective deployment base is `origin/main` at `7d150c816bd3caaa0b8dbbe488102354c32353f9`, an ancestor of the original committed candidate `2a3addbcf3527c23d4899e846ab135e6a73f3f2c`. The supplied local-main reference `5673004` is also unreleased. The actual frozen deployment delta contains 449 paths, including Release 1 metrics/schema/operator work and Release 2 publication/runtime changes, not only the last Release 3 cutover commit.

Thermos branch review read authored hunks across all 319 paths in the source/test/config/script/migration inventory, checked deleted callers, dependency/patch wiring and relevant full runtime paths. The quality review covered runtime/shared source, scripts, migration, configuration and CSS. Ponytail separately traced high-risk unchanged auth/session/recovery/activation, import/cancellation, lifecycle/transit, publication and public-reader paths.

Large generated fixtures, snapshots and reference artifacts received exhaustive structural/byte/provenance comparisons rather than line-by-line review. Prior aircraft fields are preserved, AT76 is added, prior airports are unchanged and KTT is added. All ten protected existing fixtures retain their core fields and weighted totals. The board retains 69 completed flights, 14 countries and 141,204 km. The n5001 witness retains 641 groups, 5,001 source flights and 4,000 replay samples.

Historical planning/research prose and non-runtime scratch prototype implementations were not comprehensively read. Test assertions were reviewed selectively; the branch lane covered every changed authored hunk, but this is not a claim that every unchanged test body or every file in the repository was read. Physical GPU/touch/fullscreen behavior and visual/layout comparisons are unverified by owner instruction.

## Must fix

1. **Schema, backfill, publication and deployment — RESOLVED.**
   - **What this is:** Journal, flight writes and Overview read columns/indexes introduced by migrations 0008 and now 0009.
   - **Problem:** Initial read-only ledgers stopped at0007. Schema and publication admission were initially incomplete; both are now resolved by the approved cutover below.
   - **Fix:** Approved writer hold, fresh exact backup/restore, seven-dimension schema admission and standard0008+0009 application are complete on both targets; existing rows/columns are preserved. Exact reviewed backfills and publication passed on both targets after owner approval; temporary resources were deleted and R3 deployment/monitoring passed. [The resolved release record](issues/01-missing-flight-metrics-migration.md) records identities and authorization boundaries.
   - **If we skip it:** Existing metrics retain missing provenance and the required publication admission is incomplete. Without the approved cutover, deploying the current app would not be admitted.

2. **Background saves restore withdrawn publication consent — FIXED.**
   - **What this is:** Overview saves filters, layout and replay preferences in the same document as public-section flags.
   - **Problem:** An older tab sent stale consent after another session withdrew it, making Records/Fleet public again.
   - **Fix:** Background saves omit consent; the strict endpoint preserves current stored flags with an owner-bound compare-and-set update and bounded retries. Explicit full consent updates remain supported.
   - **If we skip it:** A private section can become public without a new publication choice. An actual-handler SQLite diagnostic reproduced restoration before the fix and preserved withdrawal during an interleaved write after it.

3. **Flight PATCH erases concurrent accepted corrections — FIXED.**
   - **What this is:** Ordinary PATCH writes a merged snapshot of the flight and its lifecycle fields.
   - **Problem:** Its old guard missed aircraft, schedule and other ordinary edits accepted after its initial read.
   - **Fix:** Compare every rewritten snapshot field, including complete lifecycle/transit and clock provenance. Keep owner predicates, the atomic dirty marker, existing 409 conflict handling and 404 for concurrent deletion.
   - **If we skip it:** Two successful requests can silently erase a saved correction.

4. **Schedule clocks become measured evidence — FIXED; SCHEMA REQUIRED.**
   - **What this is:** The approved duration ladder can select a measured route median ahead of accepted schedule times.
   - **Problem:** `duration_source` then loses the origin of those raw clocks; later edits/backfill promote them to observations. Calibration also admitted known schedules.
   - **Fix:** Add the internal `times_from_schedule` marker in additive migration 0009. Acceptance sets it atomically, edits preserve it unless a clock value changes, and measured pools, median admission and calibration exclude it. Backfill preserves it and guards all rewritten metrics plus eligibility. Migration 0008 and public DTOs are unchanged.
   - **If we skip it:** Schedule values contaminate shared measured evidence. Existing ambiguous historical clocks cannot be recovered reliably and are not guessed or relabelled; see [ADR 0002](../../docs/adr/0002-flight-metrics-provenance.md).

5. **Completed publication does not reach the retained Overview store — FIXED.**
   - **What this is:** Activity refreshes the server route when pending derived publication completes.
   - **Problem:** The same-owner provider retained its initial store and ignored the fresh incoming payload, leaving countries marked updating until another revalidation.
   - **Fix:** A changed incoming server ETag triggers the existing guarded data revalidation; one follow-up handles a request that began before publication. Filters, owner isolation and the single replay clock remain intact.
   - **If we skip it:** Completed country publication can remain stale on an open page.

6. **Filtered Rankings drops valid series and years — FIXED.**
   - **What this is:** The rank chart renders the scoped top-five series and a baseline ghost layer.
   - **Problem:** It admitted series and years from the unfiltered top five. The existing board's A9 filter could show valid table/leader data with no foreground chart marks.
   - **Fix:** Derive foreground entities, legend and year domain from scoped rows; restrict ghosts to represented years. The five-series limit and table alternative remain.
   - **If we skip it:** Valid filters produce a misleading empty chart.

## Should fix

7. **Public Overview loads unrelated profile data — FIXED.**
   - **What this is:** Public Overview needs the owner's ID and visibility before reading its permitted subset.
   - **Problem:** The full profile dependency also read stats, badges, revision and sometimes rankings, then discarded them; unrelated failures could break Overview.
   - **Fix:** Use the same case-insensitive owner lookup selecting only ID/visibility. Keep the final visibility and section-consent recheck after the private read.
   - **If we skip it:** Public reads perform four or five avoidable statements and inherit unrelated failure paths.

8. **Replay repeatedly rebuilds static SVG/table content — FIXED.**
   - **What this is:** One replay clock updates the globe host every frame.
   - **Problem:** Stable SVG props still caused route maps, formatted table rows and reference searches to rebuild, including after WebGL became ready.
   - **Fix:** Memoize the stable-prop SVG component boundary; local land loading remains reactive.
   - **If we skip it:** Replay performs avoidable work every frame. This is source-proven repeated work, not a measured frame-time claim.

9. **Filter memoization retains every historical result — FIXED.**
   - **What this is:** Each owner store memoizes computed filtered scopes until its ETag changes or it unmounts.
   - **Problem:** Repeated valid month-range changes grow the cache without a bound.
   - **Fix:** Retain the 16 most recently used scopes inside the existing store/ETag cache.
   - **If we skip it:** Long filter sessions retain unnecessary heap. The existing n5001 fixture with 120 valid ranges retained 19.25 MiB before and 2.74 MiB after; separate process timing is not evidence of a CPU improvement.

## Verification and release gates

- Focused existing API tests: seven files / 90 passes, `/tmp/kuuki-r3-audit-api-focused.log`.
- Existing mutation/lifecycle/operator tests: four files / 51 passes, `/tmp/kuuki-r3-audit-mutation-operator-focused.log`.
- Focused existing Next tests: five files / 123 passes, `/tmp/kuuki-r3-audit-next-focused.log`.
- Median admission SQL changed after that batch; its existing metrics/schedule tests passed again: two files / 42 passes, `/tmp/kuuki-r3-audit-median-admission.log`. These overlap the first batch and are not 42 additional cases.
- API, script and Next typechecks and affected Next lint passed. Source/test writers were frozen during Vitest.
- Migration 0009's local SQLite diagnostic preserved all prior sample columns and initialized only explicitly labelled schedule rows. Existing restore/migration tests also passed with the new migration.
- Three existing tests received fixture/migration expectation corrections only. No new tests or cases were introduced.
- CI navigation is restricted to the owner-accepted 101 functional cases across 15 files, with trace off and visual/layout cases excluded. Earlier candidate evidence was 99 initial passes plus five focused reruns, not a single final 101-case pass.
- Package and fresh production builds passed: 118 assets / 10,279,802 bytes / 73 API routes, `/tmp/kuuki-r3-audit-build.log`. Composed Worker smoke and API boundary checks passed on isolated port 8824, `/tmp/kuuki-r3-audit-{smoke,boundary}.log`; Worker types also passed.
- The consolidated remediation reviewer read the complete 557-line patch, all 20 changed/new files and relevant dependencies. All nine dispositions were checked. No additional defect was found in the fixes; the external schema/data admission sequence remained blocking at that review. GitHub promotion and post-merge CI are complete.
- Remediation commit `8b5e5c3` is pushed in registered [PR47](https://github.com/indi256s/kuuki/pull/47). [CI/CD run37745780614](https://github.com/indi256s/kuuki/actions/runs/37745780614) passed all five jobs: 1042 API cases, 1437 Next cases and a fresh single run of all101selected functional navigation cases. Its separate React Doctor job failed three errors; a URL-state method was mistaken for an observer and browser globals inside a Radix Portal were not recognized as client-only. A method rename and explicit browser guard clear all three; pinned0.9.17 reports zeroerrors/60warnings and73existing popover/context cases pass. Independent review validated all60warnings/15families; all eight PR checks passed on follow-up `ad17e99`. No rule suppressions or threshold changes.

Promotion uses the separate clean main checkout `/private/tmp/kuuki-r3-release-6cc8f8f`; dirty MAIN and unrelated worktrees were preserved. Fresh sequential production/preview ledger reads immediately after merge showed0001–0007. The later approved migration cutover below supersedes that observation. Initial authorization7403 errors were transient; existing OAuth retries succeeded without credential changes.

[Main CI](https://github.com/indi256s/kuuki/actions/runs/37747939613) and [main React Doctor](https://github.com/indi256s/kuuki/actions/runs/37747939621) succeeded for exact code SHA6cc8f8f. Clean frozen-lockfile install, package build and Next production build also passed; logs `/tmp/kuuki-r3-clean-main-{install,packages,build}.log`. A documentation-only promotion record can reuse this CI after its path-only diff is verified.

### Approved D1 migration cutover

The owner approved production and preview migrations. Clean admitted main `e37dc10200d30b1eac354cb329e7a3088fec557b` applied exactly0008+0009 via standard Wrangler, preview then production. Both ledgers now contain0001–0009. The writer hold preserved all four app Workers' code, runtime and other binding values; 568 discovered HTTP entrypoints rejected/blocked writes. Full before/after raw snapshots show zero writes. Fresh Cloudflare exports/Time Travel bookmarks, exact35-table NodeSQLite restore including sequences, integrity/FK checks, seven-dimension admission, localD1 rehearsal and remote post-migration preservation/schema proofs pass. Private evidence lives outside Git in `/private/tmp/kuuki-r3-d1-cutover-rZBTsHTx`.

The exact local backfill/publication rehearsal and independent GPT‑6.1 Sol high evidence review passed with no open correctness finding.

The owner approved the exact remote backfill, stats publication, temporary authenticated operators and isolated remote protocol proof. Fresh full-source snapshots matched every held table, including coordinates and median donors; both regenerated proposals matched the approved SQL hashes. The isolated remote D1 proof verified ordered per-statement results, CAS match 1/miss 0 and rollback on a failing CHECK, then the fixture was deleted. One-request batches applied exactly 2 preview and 411 production guarded flight updates, every UPDATE matching one row. Publication repaired 2 preview and 18 production journals, with dirty/metricsNull 0 on both; production has 25 leaderboard rows for 5 eligible users. Fresh snapshots confirm exact metric values, canonical and non-metric flight preservation, all 135 historical badges retained plus 4 new awards, correct journal totals and zero FK violations. Official new-file proposals return zero changes on both targets. Both temporary operators were deleted and their local tokens removed; all private proof/artifacts remain outside Git.

Release 3 deployed from clean main `bbb88414476ac9e571b8c729aaefe9cd44a199d7`, whose only differences from successful code CI `6cc8f8ff93664667637696a6b95d2395ebce1f78` are the four reviewed documentation records. The same accepted build was deployed with `--no-autoconfig --strict`, tag `bbb8841` and the exact commit subject. Interactive confirmation acknowledged replacing the temporary API writer hold with the admitted source config. Preview HTML/session passed before production; canonical HTML 200, session 200/`null` and activation `/activate` 200 passed after both production deploys. Each production Worker had a connected error tail for 300 seconds with zero error events. Writers are reopened; Task34 release is complete. No rollback was needed.

| Worker | Previous held rollback version | Release3 version |
| --- | --- | --- |
| `kuuki-next` | `0bc3863f-5e2d-4769-a65d-a421cdf6d79a` | `d91b1cb4-22bf-4147-b510-989594a433de` |
| `kuuki-activation` | `63dd4493-406c-49be-b8e1-c5859ef32f35` | `f8e53b74-f761-484c-a639-0ee137274826` |
| `kuuki-next-preview` | `894284b2-4aac-480f-85ce-ad5951644eaa` | `fa26ff19-964e-4588-9431-a2b832bc1f49` |

The existing preview activation code/bindings were preserved and its temporary hold released as version `9fccd8b7-e325-429d-b4dd-545daef9504a`; preview activation HTTP 200 passed. Historical Pages remains denied/held with Git deployments disabled. Existing preview maintenance stays held before DB access; no production maintenance Worker, cron, import provider, Pages frontend or framework experiment was deployed. Dirty MAIN, unrelated worktrees and port8800 remain preserved.

### React Doctor warning dispositions

All60warnings across15families were independently validated against source/callers. No additional correctness, security or accessibility defect was found. Root verified the journal rejection handler, render-time error delivery, tooltip event boundary, replay formatter and internal Journal destination.

- Mixed exports12, array lookups15 and complexity9: bounded helpers/collections and existing state branches; no demonstrated production defect.
- Static interaction1 and positional keys3: tooltip propagation boundary and stateless ordered actions/cells/spans; native controls own actions.
- Non-null assertions3: entries or daytime pairs are established before access.
- Atlas fetch effects2 and post-await updates2: public validated atlas, cancellation/current ownership guards and defined failure behavior.
- Deferred CSS1: intentional MapLibre loading boundary; nonmodal dialog1 retains focus/Escape/close handling.
- Intl construction7: real allocations, including replay-driven renders; slowdown is unmeasured. Internal anchor1 intentionally reaches Journal through a document navigation; no lost destination or permission bypass. Both remain bounded recommendations.
- Keyboard activation1 is confined to a synthetic existing test opener; no shipped UI defect.
- Journal handler-only state1 and missing catch1: state is consumed/thrown in render, `.then(success, failure)` handles rejection, and cleanup retires callbacks. Changing the error state to a ref would break boundary delivery.

One proposed review change was declined as an existing contract: airline-only PATCH retains stored metrics, including a previously selected median. [Release 1's explicit PATCH rule](../../docs/plans/2026-10-07-overview-release-1-migrations.md#task-5-server-authoritative-write-path) states recomputation triggers and separately requires airline-only retention; the existing `patch of airline or client metrics keeps all stored metric columns, including historical values` case passes. Ponytail independently excluded this behavior for the same reason. Changing it would revise the accepted rule, so no implementation or assertion change was made. A selected median can therefore remain from the former carrier until a supported recomputation trigger occurs.

The Overview manifest's 719,251 gzip bytes cover all 27 client files, including deferred MapLibre; they are not initial network transfer. MapLibre accounts for 279,398 gzip bytes and is dynamically imported. No invented byte budget or physical-device performance claim is made.

Verdict: all eight concrete code findings are fixed, focused checks pass and consolidated remediation review is resolved. PR47 merged as `6cc8f8ff93664667637696a6b95d2395ebce1f78`, with identical tree to audited head `ad17e99`. Post-merge CI/CD37747939613 and React Doctor37747939621 pass:1042API/1437Next/101functional navigation cases. Clean main build passed118assets/10,279,913bytes/73APIroutes. Approved0008+0009 migrations, exact guarded backfills and publication passed on both targets with fresh hold/restore/schema/preservation proof. R3 is deployed on preview and both production Workers from `bbb8841`; smoke and connected 300-second error monitoring passed. Task34 and delivery are complete.

Not checked: visuals, devices, screenshots, layout comparisons and new regression cases; historical/non-runtime unread areas are listed above. No authenticated production verification-account mutation was added. Error monitoring establishes the observed five-minute window only; historical ambiguous clock provenance remains preserved.
