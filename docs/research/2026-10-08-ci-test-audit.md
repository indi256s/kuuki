# CI test audit — 8 October 2026

The user explicitly chose to delete at least half of all test cases, accepting
less regression coverage. The audit prioritizes auth, ownership, durable writes,
destructive operations and recovery. Many retired cases protected useful behavior;
this reduction does not preserve equivalent coverage.

## Measured reduction

The initial working-checkout audit at `4b4fe54e` removed 1,367 of 2,671
cases (51.18%), including the pre-existing uncommitted tests. Before publication,
Arc integration and release receipts advanced remote `main` to `d19b1d6a`.
The merge preserves both histories and every Arc application change.

The final comparison below uses **committed Arc main** as its baseline;
unrelated local work is excluded. Counts include expanded runner cases.
Standalone smoke assertions and build steps are not counted as runner cases.

| Suite                                          | Full inventory before | CI cases before |     After | Net retired |
| ---------------------------------------------- | --------------------: | --------------: | --------: | ----------: |
| API, shared and data Vitest                    |                 1,047 |           1,047 |       630 |         417 |
| Next component/unit Vitest                     |                 1,456 |           1,456 |       627 |         829 |
| Playwright browser journeys                    |                   161 |             101 |        37 |         124 |
| Preview config and dependency-patch Node tests |                    11 |              11 |        11 |           0 |
| **Total**                                      |             **2,675** |       **2,615** | **1,305** |   **1,370** |

Net case retirement is **51.21%** of the full inventory; CI executes
**50.10% fewer cases** (2,615 → 1,305). The old browser filename/grep selection
excluded 60 cases; CI now runs every remaining browser case. No retired cases
were moved behind tags, skips, manual jobs or change-based routing.

Application behavior, fixtures and unrelated local work are preserved. Unused
browser transition-recording helpers were removed.

## Coverage decisions

| Retired coverage                                                                                                    | Remaining primary protection                                                                                                                                                                | Accepted loss                                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Overview math/classification matrices, randomized properties, alliance/manufacturer catalogs and reader parity      | Shared golden fixtures with independent oracles, aggregate/prefs, API overview data/country policy/route projection, generated region admission                                             | Fewer statistical, date, geometry, classification and volume edge probes                          |
| Overview/globe/replay/narrator/layout, formatting, palette and display suites                                       | Owner-scoped OverviewProvider, server adapters, actual chart SSR/keyboard/touch tests, map asset and WebGL fallback journeys                                                                | Less motion, contrast, viewport, copy, ordering and offscreen lifecycle coverage                  |
| Journal presentation/filter matrix and Passport model/grid/collection cases                                         | Deferred delete/Undo/arrival queue units; real filtered bulk delete, cancel-on-leave, retry, keyboard and country mutation journeys                                                         | Less navigation timing, focus restoration, sorting and URL permutation coverage                   |
| Import prompt/text and subordinate question/review/error catalog cases                                              | Provider/runtime/draft/receipt tests; client recognition/review reload, typed correction, partial retry, confirm and manual-save tests                                                      | Less recognition quality, prompt wording, candidate, confidence, error-code and locale coverage   |
| Browser visual/theme/locale/route animation matrices and overlapping happy paths                                    | Actual sign-in/signup/reset/session revocation, privacy isolation, safe downloaded CSV, uncertain capture retry, settings deletion/history guard, PWA retirement and persisted/system theme | Less malformed UI-reply, legacy URL, mobile geometry, reduced-motion and language-switch coverage |
| Repeated enabled Button click, EN offline/error/focus matrix, airport query permutations and calendar display cases | Full Button pending/failure/retry lifecycle; RU offline/error/focus; both locales' manual writes, typed dates and calendar keyboard controls                                                | Less EN outcome wording, name-search variation, month-end clamping and today decoration coverage  |

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

## Arc merge decisions

Preserve the new Arc proof for actual DOM-free SVG rendering, replay pointer
preview/commit/Escape rollback and focus, saved exact-day preferences recovering
from legacy monthly data, exact-day Journal bookmarks, and previous-period
leap-day/early-year arithmetic. Each formerly retired file keeps only the
relevant regression, apart from the single-case SVG suite.

Keep every newly added Arc suite, including Journal mutation/receipt/ownership
cases, range draft admission, daily weighted series, category evidence,
comparison arithmetic, and accessible chart targets. Keep the two early-year
calendar regressions added to the retained controls suite.

Retire five further locale-matrix cases to preserve the quota: Russian match
announcements keep count 2 while dropping 1/5/21; mobile selection/Escape and
calendar Escape focus keep RU while dropping their EN duplicates. Both locales
still exercise date admission and their distinct calendar week boundaries.

## Validation

Initial working-checkout API: 1,059 passed. Initial Next: three failures under
load, then the complete affected files passed a serial rerun (76 cases). The
initial retained Next suite passed 616/616 and browsers 37/37; API passed 639/640
with an unchanged database setup/teardown failure, then its whole file passed
15/15 in isolation. These are historical checks before the Arc merge.

Final merged candidate: **630 API/shared/data, 627 Next component/unit, 37
browser and 11 Node tests passed**, with zero failures or skips. Next build,
Next lint, API/Next/Worker type checks and full compiled Worker smoke passed.
The unchanged map-geometry and preview-isolation checks passed in the initial
audit; the full smoke also verifies the current compiled Worker boundary.

Independent preservation review approved the final merge with no blockers.
All 13 brand-new Arc test files and every Arc application change are preserved
byte-for-byte against `d19b1d6a`. `git diff --check` passed.

Publication preserves the audit commit `91e1b4bb` and Arc main `d19b1d6a` as
merge parents, with a normal push. Unrelated local edits remain uncommitted;
backup branch refs and a local preservation snapshot are retained.

CI runtime savings have not been measured on GitHub; halving case count does not
halve build, fixture startup or total workflow duration. No production deploy or
remote database writes are part of this publication.
