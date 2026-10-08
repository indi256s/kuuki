# Release 3 consolidated delivery audit — 8 October 2026

Status: promotion

What this repo does: Kuuki keeps private flight journals and publishes owner-selected profile information. The audit assumes personal journal load, concurrent requests and multiple tabs; the real board has 69 completed flights, while the existing 5,001-flight fixture exercises aggregate volume.

The owner requested Thermos and a separate whole-repository Ponytail audit, followed by fixes, CI promotion and deployment. Three independent GPT-6.1 Sol reviewers ran with high reasoning. The root verified and consolidated their findings, implemented the fixes and requested one consolidated remediation review. No new test cases or visual checks were added or run.

## Scope and coverage

The effective deployment base is `origin/main` at `7d150c816bd3caaa0b8dbbe488102354c32353f9`, an ancestor of the original committed candidate `2a3addbcf3527c23d4899e846ab135e6a73f3f2c`. The supplied local-main reference `5673004` is also unreleased. The actual frozen deployment delta contains 449 paths, including Release 1 metrics/schema/operator work and Release 2 publication/runtime changes, not only the last Release 3 cutover commit.

Thermos branch review read authored hunks across all 319 paths in the source/test/config/script/migration inventory, checked deleted callers, dependency/patch wiring and relevant full runtime paths. The quality review covered runtime/shared source, scripts, migration, configuration and CSS. Ponytail separately traced high-risk unchanged auth/session/recovery/activation, import/cancellation, lifecycle/transit, publication and public-reader paths.

Large generated fixtures, snapshots and reference artifacts received exhaustive structural/byte/provenance comparisons rather than line-by-line review. Prior aircraft fields are preserved, AT76 is added, prior airports are unchanged and KTT is added. All ten protected existing fixtures retain their core fields and weighted totals. The board retains 69 completed flights, 14 countries and 141,204 km. The n5001 witness retains 641 groups, 5,001 source flights and 4,000 replay samples.

Historical planning/research prose and non-runtime scratch prototype implementations were not comprehensively read. Test assertions were reviewed selectively; the branch lane covered every changed authored hunk, but this is not a claim that every unchanged test body or every file in the repository was read. Physical GPU/touch/fullscreen behavior and visual/layout comparisons are unverified by owner instruction.

## Must fix

1. **Required remote schema is missing — BLOCKED.**
   - **What this is:** Journal, flight writes and Overview read columns/indexes introduced by migrations 0008 and now 0009.
   - **Problem:** Read-only production and preview ledger queries returned exactly 0001–0007. Deploying the candidate to either target would fail ordinary SQL reads/writes.
   - **Fix:** Complete separate writer-hold, backup/restore, schema admission, migration, backfill and publication gates on each explicit target. [The blocker ticket](issues/01-missing-flight-metrics-migration.md) records identities and authorization boundaries.
   - **If we skip it:** The deployed journal and flight-saving flows fail. No remote schema write or application deployment was performed.

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
- The consolidated remediation reviewer read the complete 557-line patch, all 20 changed/new files and relevant dependencies. All nine dispositions were checked. No additional defect was found in the fixes; missing remote schema admission remains blocking. GitHub promotion/CI is pending at this report revision.
- Remediation commit `8b5e5c3` is pushed in registered [PR47](https://github.com/indi256s/kuuki/pull/47). [CI/CD run37745780614](https://github.com/indi256s/kuuki/actions/runs/37745780614) passed all five jobs: 1042 API cases, 1437 Next cases and a fresh single run of all101selected functional navigation cases. Its separate React Doctor job failed three errors; a URL-state method was mistaken for an observer and browser globals inside a Radix Portal were not recognized as client-only. A method rename and explicit browser guard clear all three; pinned0.9.17 reports zeroerrors/60warnings and73existing popover/context cases pass. Independent review validated all60warnings/15families; CI for this follow-up remains pending. No rule suppressions or threshold changes.

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

Verdict: all eight concrete code findings are fixed, focused checks pass and consolidated remediation review is resolved. GitHub promotion/CI remains pending. Remote schema admission is the explicit deployment blocker; the dated Release 1 rehearsal does not admit the amended schema.

Not checked: visuals, devices, screenshots and layout comparisons; historical/non-runtime unread areas are listed above. No remote D1 writes or deployment, and no new regression cases by owner instruction; historical clock provenance remains ambiguous.
