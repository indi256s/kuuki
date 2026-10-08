# CI test audit — 8 October 2026

The user explicitly chose to delete at least half of all test cases, accepting
less regression coverage. The audit prioritizes auth, ownership, durable writes,
destructive operations and recovery. Many retired cases protected useful behavior;
this reduction does not preserve equivalent coverage.

## Measured reduction

Baseline: checkout `4b4fe54e`, including the pre-existing local edits. Counts are
discovered Vitest/Playwright cases and Node test-runner cases, including expanded
parameterized cases. Standalone smoke assertions and build steps are unchanged
and are not counted as runner cases.

| Suite | Full inventory before | CI cases before | After | Deleted |
| --- | ---: | ---: | ---: | ---: |
| API, shared and data Vitest | 1,059 | 1,059 | 640 | 419 |
| Next component/unit Vitest | 1,440 | 1,440 | 616 | 824 |
| Playwright browser journeys | 161 | 101 | 37 | 124 |
| Preview config and dependency-patch Node tests | 11 | 11 | 11 | 0 |
| **Total** | **2,671** | **2,611** | **1,304** | **1,367** |

Physical deletion removes **51.18%** of the full inventory. CI executes
**50.06% fewer cases** (2,611 → 1,304). The old browser filename/grep selection
excluded 60 cases; CI now runs every remaining browser case. No retired cases
were moved behind tags, skips, manual jobs or change-based routing.

Deleted 104 whole test files and reduced cases in five unit files and twelve browser
files. Removed unused browser transition-recording helpers. Application behavior,
fixtures, dependencies and unrelated local work are preserved.

## Coverage decisions

| Retired coverage | Remaining primary protection | Accepted loss |
| --- | --- | --- |
| Overview math/classification matrices, randomized properties, alliance/manufacturer catalogs and reader parity | Shared golden fixtures with independent oracles, aggregate/prefs, API overview data/country policy/route projection, generated region admission | Fewer statistical, date, geometry, classification and volume edge probes |
| Overview/globe/replay/narrator/layout, formatting, palette and display suites | Owner-scoped OverviewProvider, server adapters, actual chart SSR/keyboard/touch tests, map asset and WebGL fallback journeys | Less motion, contrast, viewport, copy, ordering and offscreen lifecycle coverage |
| Journal presentation/filter matrix and Passport model/grid/collection cases | Deferred delete/Undo/arrival queue units; real filtered bulk delete, cancel-on-leave, retry, keyboard and country mutation journeys | Less navigation timing, focus restoration, sorting and URL permutation coverage |
| Import prompt/text and subordinate question/review/error catalog cases | Provider/runtime/draft/receipt tests; client recognition/review reload, typed correction, partial retry, confirm and manual-save tests | Less recognition quality, prompt wording, candidate, confidence, error-code and locale coverage |
| Browser visual/theme/locale/route animation matrices and overlapping happy paths | Actual sign-in/signup/reset/session revocation, privacy isolation, safe downloaded CSV, uncertain capture retry, settings deletion/history guard, PWA retirement and persisted/system theme | Less malformed UI-reply, legacy URL, mobile geometry, reduced-motion and language-switch coverage |
| Repeated enabled Button click, EN offline/error/focus matrix, airport query permutations and calendar display cases | Full Button pending/failure/retry lifecycle; RU offline/error/focus; both locales' manual writes, typed dates and calendar keyboard controls | Less EN outcome wording, name-search variation, month-end clamping and today decoration coverage |

All auth/CSRF/ownership, schema/migration/preservation, receipt/concurrency/rollback
and flight-write suites remain. This does not claim that every security or
lifecycle scenario at every layer is still covered.

## CI and maintenance

- Remove `next:smoke:boundary` from CI: `next:smoke` already executes its boundary
  checks before continuing with the full smoke. Keep the shorter command for
  manual diagnosis.
- Run all remaining browser journeys, replacing the obsolete filename and
  grep exclusions.
- Update README and coding standards to require tests for credible owner-boundary
  risks rather than one test per design/plan clause.

## Validation

Baseline API: 1,059 passed. Baseline Next: 1,437 passed and three failed under
load; the complete affected files passed a focused serial rerun (76 cases).
The two affected capture cases remain. The overview presentation suite was
retired for scope/coverage reasons; its deletion is not a flaky-test fix.

Final Next unit run: 616 passed, zero failed or skipped. Next build, Next lint,
API/Next/Worker type checks, map geometry self-check, preview configuration
isolation check and full compiled Worker smoke passed. The unchanged 11 Node
tests passed during the baseline audit.

Final API run: 639 passed, one failed, zero skipped. The unchanged flight-metrics
case failed in database fixture setup after 10.6 seconds and reported a server
teardown error. The entire affected file then passed in isolation (15/15),
including that case in 479 ms. This is consistent with a load-related fixture
failure; the complete API run was not repeated or represented as a clean pass.
Final browser run: all 37 passed (2.7 minutes).

Independent preservation review found no critical keeper restoration necessary;
its two documentation/evidence corrections were applied. `git diff --check`
passed. No application code or test assertions were changed to conceal failures.
CI runtime savings have not been measured on GitHub; halving case count does not
halve build, fixture startup or total workflow duration.
