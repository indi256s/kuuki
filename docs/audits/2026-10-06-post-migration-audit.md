# Post-migration audit — 6 October 2026

Audited checkout: `9c550be4183d70ab947ca3433adb54aa7fbe9c67`.
The user explicitly said Vite no longer needs to be retained. This report treats
its retirement as the intended direction, superseding the earlier rollback
preference. The initial audit was read-only. The user subsequently authorized
all findings except signup (F01); the local cleanup is recorded below.
No deployment or remote database operation was performed.
Three pre-existing deletions under `.gemini/skills/` were left untouched.

At the audited commit, checks passed but the source still built and served the old app.
The largest useful cleanup is Vite retirement with its build, test and release
wiring. There is also a current registration gap that green tests do not catch.
Several old backend paths remain live independently of the old frontend.

## Findings at the audited commit

### F01 — P1: the current Next signup route cannot create an account

`apps/next/src/app/(card)/signup/page.tsx:5` renders `CardPage`, which renders
`AuthCard` at `apps/next/src/app/(card)/card-page.tsx:22`.
`apps/next/src/client/auth-card/auth-card.tsx:47` only posts to
`/api/auth/sign-in/email`; it has no create-account step. A public visitor's
join link still points to `/signup` at
`apps/next/src/app/(public)/fly/[username]/page.tsx:56`.
The card's subtitle promises that a new email can start a journal, but the
current submit path only attempts sign-in.

This is an unfinished auth feature, not dead code. Commit `cb7c04a` deliberately
installed the card before the one-form state machine; the comment at
`auth-card.tsx:34` names ticket 05. The accepted
`.scratch/auth-one-form/spec.md` requires `/api/auth/continue` to lead an unknown
email to a create step. The backend continuation endpoint already exists.

The current browser suite checks card aliases and existing-user sign-in
(`apps/next/tests/auth-entry.test.ts:100,248`), but never creates a new user
through the card. All 113 browser tests pass despite this gap.
Finish the existing auth work and add one real unknown-email → create →
authenticated/onboarding journey. Do not remove signup or duplicate the existing
workstream as cleanup. This is a source-level finding; live deployment identity
was not inspected.

### F02 — P1: Vite is still part of the release build and runtime

`scripts/build-next.mjs:39` builds `@kuuki/web`; lines 42–51 copy its
`dist-legacy` into Next's assets. `apps/next/worker.ts:12,50,86` implements and
dispatches the `/legacy` app. This is active runtime code, not an unused archive.
Deleting `apps/web` alone would break the current build and test pipeline.

The Vite workspace has **215 tracked files**. A manifest comparison finds
**22 production and 14 development dependency names declared only by Vite**
among the current workspaces/root. These declarations can leave with the app;
some packages may remain as dependencies of surviving packages. Regenerate the
lockfile rather than deleting transitive entries by hand.

The current build contains **2,226,043 bytes** of `dist-legacy` files. The
artifact recorder also includes **2,285,830 bytes** of standalone Vite fallback
files. These are asset totals, not expected reductions in the Next Worker code.

Two other features currently take their source assets from Vite:

- `scripts/build-next.mjs:52–56`: activation HTML/JS, served by
  `apps/next/activation-asset.ts` and linked by the activation API.
- `scripts/build-next.mjs:57–58`: root service-worker retirement scripts,
  requested by `apps/next/src/client/activity.tsx:143` for existing installations.

Move those assets to Next ownership before removing Vite. Keeping a small
service-worker retirement response does not require keeping the old app.
The activation page is live functionality until its Next replacement is ready.

The coherent removal must also cover:

| Item | Location | Notes |
|------|----------|-------|
| `@kuuki/web` and `/legacy` | `apps/web/`, `scripts/build-next.mjs:39`, `apps/next/worker.ts:12` | Live only because the old app is deliberately bundled; remove the workspace, packaging and route branch together after moving activation and retirement assets. |
| Vite dev/test/build commands and cache outputs | `package.json:8,15`, `.github/workflows/ci.yml:41,76`, `turbo.json:7` | Remove commands that execute Vite and its `dist-legacy` output pattern; keep the generic Turbo build task used by surviving workspaces. |
| Vite rollback browser journey | `apps/next/tests/rollback.test.ts:19` | Its owner contract disappears with the removed frontend; retire the test with that frontend. |
| Old-PWA upgrade fixture | `apps/next/tests/pwa-upgrade.test.ts:10` | The storage-preservation/retirement contract remains useful; replace its full Vite fixture with a small fixed old-worker fixture. |
| Legacy runtime/asset expectations | `scripts/smoke-next-runtime.ts:221`, `apps/next/tests/navigation.test.ts:57` | Remove legacy app expectations while keeping API misses, method errors, activation and Next security checks. |
| Pages/Vite fallback rehearsal | `scripts/rehearse-next-rollback.ts:47`, `scripts/smoke-local-runtime.ts:38`, `wrangler.toml:5` | Remove frontend fallback ownership; decide whether the separate Pages API smoke still adds coverage and give it minimal assets if retained. |
| Vite performance baseline | `apps/next/tests/performance.bench.ts:194` | A running Vite comparator becomes obsolete; keep useful Next measurements and label historical comparisons as historical. |
| Artifact requirements | `scripts/next-artifact-manifest.mjs:17,28,124` | Remove Vite required paths and measurements while retaining Worker, asset and build-identity admission. |
| Current fallback instructions and app ownership docs | `docs/skills/deploy-kuuki/SKILL.md:36`, `docs/runbooks/2026-10-04-next-release-candidate.md:239`, `AGENTS.md:10`, `CODING_STANDARDS.md:5`, `README.md:9` | Align source ownership/commands with retirement and revise hosted Pages emergency-fallback instructions when a replacement is verified; preserve historical release records. |

The deploy skill already documents previous-version Next Worker rollback at
line 35; its emergency route-deletion procedure at line 36 still assumes held
Pages maintenance. Local source retirement does not remove that hosted build.
Verify a replacement emergency maintenance response before retiring the hosted
fallback or declaring its operational instructions obsolete.

Keep `pnpm build:api`: the composed Next Worker still imports the compiled Pages
Functions Worker at `apps/next/worker.ts:2`. The name “Pages Functions” does not
make that implementation obsolete. Removing the root Wrangler config requires
checking that compiler and remaining fixture callers first.

CI is currently verification-only. The previous audit's original statement
about a Vite deployment job describes its old base commit; it is not a current
finding. Next-to-Vite source imports were already removed in cleanup commit
`f3e2b1c`; current Next source uses `@kuuki/client`.

### F03 — P2: three shared-client suites are owned by the retiring app

These files are under Vite's runner but test production helpers still used by
Next. Deleting the whole Vite test tree would discard useful proof:

| Item | Location | Notes |
|------|----------|-------|
| Identity-safe API transport tests | `apps/web/src/lib/apiClient.test.ts:17` | Move tests for cross-account read/mutation rejection, cross-tab cookie changes and stalled refresh into a surviving runner. |
| Durable create receipt tests | `apps/web/src/lib/flightCreateOperations.test.ts:15` | Move tests for uncertain retries, account isolation, expiry, unavailable storage and damaged receipts into a surviving runner. |
| Timezone/DST duration tests | `apps/web/src/lib/geo.test.ts:4` | Move the table of independently expected durations; Next's capture form calls this helper. |

Prefer Next's existing Vitest runner if that avoids introducing package-level
test tooling. Compare existing Next coverage before copying overlapping cases.
Do not preserve Vite aliases or global setup merely to run three files.

`apps/web/src/lib/passport.test.ts` is different: its seven tests call only
`getUserCountries`, `getPassportStats` and `getCountryStats`, whose production
consumers are Vite-only. Remove those tests with the obsolete projections.
The eight remaining Vite test files cover retiring Vite modules.

### F04 — P2: shared packages still carry Vite-only adapters

These declarations are currently live through Vite, and become removal
candidates once F02 removes those consumers. Current Next callers were checked;
matching names in Next's own flight-write module are separate implementations.

| Item | Location | Notes |
|------|----------|-------|
| `getFlights`, `createFlight`, `createFlights`, `updateFlight`, `deleteFlights` | `packages/client/src/flights.ts:152,194,217,259,276` | No Next production caller of these shared wrappers was found; remove with Vite, keeping Next's write module and shared receipt helpers. |
| `getFlightStats`, `getFlightRoutes`, `getRecentFlights`, `getUpcomingFlights`, `getFlightYears`, `getFlightAirlines`, `getFlightAircraft`, `getAllFlightIds`, `syncUpcomingFlights` | `packages/client/src/flights.ts:305,324,332,340,348,356,364,382,394` | Current frontend consumers are Vite-only; remove wrappers and their newly orphaned types/helpers, while keeping independently live server routes. |
| `getUserCountries`, `getUserClaims`, `getCountryStats`, `getPassportStats`, `getAllCountries`, `getCountryByCode` | `packages/client/src/passport.ts:105,201,270,304,368,375` | The old passport projection and lookup path has no Next production caller; remove it and its Vite-owned projection tests. |
| `searchAircraft`, `searchAirports`, `findAirline`, `searchAirlines`, `getAirlineLogoUrl`, country barrel and airline lookup map | `packages/data/src/index.ts:19,30,42,54,58,69,81,84` | Application consumers are Vite-only; remove after retirement, retaining the raw airport/aircraft/airline arrays used by Next CSV export. |

Keep shared `getFlight`, `checkDuplicateFlight`, `deleteFlight`, `getAllFlights`,
flight row types, passport mutation helpers and `CountryClaim` where Next still
uses them. `filterParams` can leave after its Vite-only wrapper callers leave.
An exposed HTTP endpoint is not dead merely because the current frontend no
longer calls it; endpoint retirement needs its own compatibility decision.

### F05 — P2: several layout tests assert exact CSS syntax

These tests protect real requirements, but can fail after an equivalent CSS
rewrite and can pass without proving the browser's computed layout:

- `apps/next/src/client/ui/flight-controls.test.tsx:264,270`: exact rule parsing
  and arithmetic standing in for an anchored calendar with 44px day targets.
- `apps/next/src/client/reads/journal.test.tsx:834,840`: regexes for baseline
  alignment, absolute overlay placement, mobile cell order and checkbox outline.
- `apps/next/src/client/public/onboarding-flow.test.tsx:126`: exact animation
  declarations used to check reduced-motion support.

Rewrite at the browser/computed-style boundary when changing those owners.
Do not blindly delete accessibility or reduced-motion assertions. The existing
read-journey/foundation browser checks do not prove every exact requirement
above, so replacement proof is needed before removing these tests.
Keep canonical palette/contrast tests and real activation asset execution tests:
their independent contracts remain meaningful.

### F06 — P2: the dependency graph has unresolved security advisories

`pnpm audit --prod --json` exited 1. Registry metadata reports **1 critical,
17 high, 41 moderate and 6 low**; the response contains 64 advisory records
across 14 module names. These are registry graph findings, not 65 demonstrated
production exploits. OpenNext is declared as a production dependency even
though much of it is build tooling.

Important paths to triage include:

- `proxy-addr@2.0.7`, through Gemini's MCP/Express graph and OpenNext's AWS/Express
  graph. The advisory concerns particular proxy trust-subnet configurations;
  patched version is 2.0.8. [Maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).
- `sharp@0.35.4`, through Next/OpenNext and peer graphs; the reported librsvg
  fix starts at 0.35.5. [Advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).
- `d3-color@2.0.0`, whose reported paths are through Vite's map/chart packages;
  retiring those consumers eliminates that graph path.
- Remaining advisories in Gemini's Hono/MCP/auth graph and shared build/Next
  dependencies: `qs`, `minimatch`, `@hono/node-server`, `express-rate-limit`,
  `path-to-regexp`, `postcss`, `ip-address`, `@babel/core`, `body-parser`, `nanoid`.

The freshly built API metafile selects `@google/genai/dist/web/index.mjs` and
has no inputs from `proxy-addr`, Express, Hono, Sharp or MCP. This narrows API
exposure; it does not establish the exposure of every Next/build/local-tool
path. There are no current `next/image` consumers found, but that alone does
not prove image-related tooling unreachable. Triage the surviving graph and
update compatible versions with build/runtime checks. Do not add blanket
overrides or claim a production compromise from severity counts alone.

Raw registry response and exact dependency paths:
`/tmp/kuuki-migration-audit-20261006/dependency-audit.json`.

The full graph scan (`pnpm audit --json`) also exited 1: **1 critical, 37 high,
56 moderate and 9 low** in registry metadata, with 101 advisory records.
It adds tooling paths involving `serialize-javascript`, `ajv`, `flatted`,
`brace-expansion`, `js-yaml`, `undici`, `@humanfs/node`, `braces` and an older
Sharp version. Review surviving ESLint/Next/Wrangler paths as well as Vite-only
build tooling. These also require reachability/context triage, not automatic
production vulnerability attribution. Exact paths are saved in
`/tmp/kuuki-migration-audit-20261006/dependency-audit-all.json`.

### F07 — P2: React Doctor runs an unlocked remote version

`.github/workflows/react-doctor.yml:18` invokes `react-doctor@latest` without
the locked workspace setup. Different upstream releases can produce different
checks for the same commit. Pin its version or use a lockfile-resolved command;
this is a diagnostic reproducibility issue, not a reason to add new tooling.

### F08 — P3: a compatibility test overstates its persistence contract

`functions/test/import-drafts.test.ts:206` says old parsing clients are answered
“without persisting anything.” The assertion at line 214 only proves no import
batch was created. `functions/api/import/parse.ts:26` calls `rateLimit`, whose
UPSERT at `functions/api/_lib/ratelimit.ts:18` persists a counter.
Rename the test to say “without creating an import batch.” Retain its current
response and batch assertions while the compatibility endpoint remains.

### F09 — P3: unused internal re-exports

| Item | Location | Notes |
|------|----------|-------|
| `createFlightStatements`, `digestInput`, `isIdempotencyKey` re-exports | `functions/api/flights/index.ts:21` | Zero repository importers through this route module were found; remove the re-exports while keeping the imports/local calls and sibling-used `FLIGHT_COLUMNS` export. |
| `FLIGHT_COLUMNS` re-export | `functions/api/_services/journal.ts:6` | Zero repository importers through this service were found; remove only the re-export and retain its local SQL use. |

These are export hygiene, not dead implementations or a runtime fault. No new
abstraction or replacement test is needed; existing API tests/typechecking are
sufficient checks if edited.

## Test disposition evidence

The exact candidate groups, ownership and validation are recorded here so
retirement does not become deletion of useful tests. History `f3e2b1c` extracted
the shared implementations but left their tests in the old runner.

| Candidate | Failure detected and surviving owner | Disposition / deletion unlocked / risk / validation |
|-----------|--------------------------------------|---------------------------------------------------|
| `apiClient.test.ts`: “never retries a previous user mutation under the new cookie identity”, “does not return an old user read after an identity switch”, “rejects a mutation queued behind another tab changing the session cookie”, “drains a bootstrap response before sending sign-in under a new cookie identity”, “bounds a stalled refresh so a later account action can enter” | Shared `apiClient` is used throughout Next; these protect identity/order/timeout behavior, with no demonstrated complete stronger replacement. | Move or consolidate into Next; permits deleting the Vite runner; security-sensitive coverage loss if dropped; run the moved file with Next Vitest and existing account/identity checks. |
| `flightCreateOperations.test.ts`: “reuses both key and original payload after an uncertain response”, “clears only the acknowledged operation and keeps users isolated”, “recovers only the current user import receipts”, “refuses to replay a receipt older than the safe retention window”, “does not permit a create when its durable receipt cannot be written”, “does not mint a new key over a damaged receipt” | Next flight writes and import reuse the same durable receipt owner; UI journeys are complementary and do not prove every storage failure here. | Move/consolidate; permits deleting the Vite runner; duplicate-write/data-loss risk if dropped; run the moved file and Next capture/import checks. |
| `geo.test.ts`: `calculateFlightDuration` table | Next flight capture calls the helper; expected values independently protect timezone, overnight, DST and invalid-input behavior. | Move the table; permits deleting the Vite runner; duration regressions if dropped; run the moved file. |
| `passport.test.ts`: five `getUserCountries` cases, “calculates stats from passport entries”, “returns stats with ground visits for claimed country” | Its three covered projection helpers have only Vite production consumers; Next has separate passport models and server contracts. | Delete with the helpers; no replacement required for an absent projection; keep Next passport/server coverage; package types and Next passport/settings checks. |
| `rollback.test.ts`: “a Next flight remains editable and deletable in the legacy app on the same worker and database” | Contract exists only while the second frontend is retained; current Next write/API proof remains. | Delete with `/legacy`; replace operational rollback instructions separately; full navigation and runtime smoke after retirement. |
| `pwa-upgrade.test.ts`: “installed root PWA retires before Next routing, preserving unrelated storage” | Existing installed-client cleanup remains observable after app retirement; same SW scripts and ActivityBridge remain owners. | Keep behavior, replace full Vite fixture; stale-worker interception/storage risk if dropped; focused upgrade journey plus composed smoke. |
| Five CSS inspection cases in F05 | Layout, hit-target and reduced-motion owners survive; no complete stronger proof was established for all five. | Rewrite before deleting; no production seam is unlocked; focused browser geometry/computed-style proof and full navigation suite. |
| Parse compatibility test in F08 | Old-client HTTP response/no-batch behavior remains an exposed API contract; rate-limit persistence is separate. | Rename, retain; no code deletion unlocked; `pnpm test:api`. |

The manual `scripts/sb-to-d1.smoke.ts` is outside automatic test discovery,
but is documented and ran successfully during this audit. Its absence from CI
does not make it dead. Consider consolidating only after comparing its wiring
invariants against `scripts/migration.test.ts`.

## Retained code and corrected assumptions

- **Legacy session support is current Next behavior.**
  `apps/next/src/server/identity.ts:20` and `functions/_middleware.ts:28` accept
  old sessions under defined cookie precedence. Removing Vite does not remove
  users' sessions, migration activation needs, receipt formats or database history.
- **Shared identity locking is current Next behavior.**
  `apps/next/src/client/activity.tsx:100` calls `beginIdentityOperation`; retain
  its generation/cookie/lock protections and the tests that prove them.
- **Old URL aliases are useful compatibility.** `/flights`, `/journey`,
  `/dashboard`, old query keys and country links lead to current Next routes.
  Their navigation tests pass and do not require keeping the Vite app.
- **Exposed API contracts are still reachable.** The compiled Pages dispatcher
  and direct handlers remain used. Old parsing routes and aggregate endpoints
  cannot be classified dead from current frontend import counts alone.
- **Import Worker is explicitly deferred, not accidentally unreachable.**
  `workers/import/wrangler.local.toml` supplies local Durable Object bindings;
  the Next config does not bind `IMPORT_JOBS`. Runtime fallback and tests are
  intentional, and ADR 0001 section 9 records the deferred production wiring.
- **Database/migration history is preservation evidence.** Keep additive D1
  migrations, imported historical evidence, Supabase migration sources and
  migration/rehearsal tools. No schema/data cleanup is justified by frontend
  retirement. Generated reference/performance tools have manual consumers.
- **No cap removal was established.** Provider output/replay/subscriber queues,
  request/page/batch limits and UI presentation caps have defensive or product
  purposes. Raw versus route-adjusted geometry, different endpoint limits and
  some DTO duplication are not proven interchangeable.
- **Earlier fixes remain fixed.** Shared-client isolation and old local-draft
  cleanup are already applied. Historical audit findings were not counted again
  merely because their original write-up remains in the repository.
- **Tracked project skills and ignored local build/worktree evidence are not
  application runtime garbage.** No local checkout or evidence was discarded.

## Initial audit verification

All application commands ran in `/Users/indi256/Documents/kuuki/kuuki`.
Build/runtime/browser steps were serialized around shared artifacts and fixtures.
Tests used synthetic/local data; no real inbox or paid provider was contacted.

| Check | Result |
|-------|--------|
| `pnpm test` | Pass: 539 API/migration tests, 1,053 Next unit tests, 65 Vite tests; 1,657 total across 158 files. |
| `pnpm lint` | Pass: zero errors; 15 warnings in the retiring Vite workspace. |
| `pnpm typecheck` | Pass; Turbo reused four existing valid task results and checked Next afresh. |
| API, scripts, maintenance and import typechecks | All pass. |
| `pnpm next:build` | Pass; 71 API routes, 166 static assets, 11,251,903 asset bytes. |
| `pnpm --filter @kuuki/next typecheck:worker` | Pass against the current build. |
| `pnpm next:smoke`, `pnpm next:smoke:boundary` | Both pass against the compiled composed Worker. |
| Standalone Vite build and `pnpm test:next:navigation` | Pass; all 113 browser tests, including retained legacy/PWA behavior. |
| Preview-config tests and config admission | Pass: 10 tests; checked-in D1 origins/bindings consistent and isolated. |
| `scripts/map-geometry.test.ts` | Pass. |
| `scripts/sb-to-d1.smoke.ts` | Pass; no import/database write performed. |
| Maintenance and import Worker dry-run builds | Both pass; neither deployed. |
| Artifact admission | Pass; current Worker is 19,004,180 uncompressed bytes, gzip reference 3,648,250 bytes, largest asset 1,272,299 bytes. |
| `pnpm audit --prod --json` | Exit 1: unresolved registry advisories detailed in F06. |
| `pnpm audit --json` | Exit 1: additional development/tooling advisories detailed in F06. |

The artifact admission's 64 MiB uncompressed Worker limit and 25 MiB asset
limit match the current [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/).
No hosted startup/CPU/memory acceptance is inferred from local admission.
Build ID: `iCI9yQxVzf15m4s1H0R2t`; the manifest records the pre-existing dirty
checkout identity. It was generated before adding this report.

The build emits an upstream duplicate-key warning in bundled Better Auth code;
unit tests emit jsdom navigation notices; browser logs contain workerd broken-pipe
messages during navigations. The checks completed successfully. These messages
were not established as product failures or silently counted as failed tests.

Logs, registry response and artifact identity are in
`/tmp/kuuki-migration-audit-20261006/`. Discovery lane notes are
`/tmp/kuuki-audit-20261006-{apps,backend,tooling}.md`.

## Original suggested execution order

1. Finish the already planned new-user auth flow and its missing real journey.
2. Move the three surviving shared-client test suites and activation/SW assets.
3. Remove Vite, `/legacy`, its dependent gates/fixtures/artifact requirements and
   the newly orphaned package adapters in one coherent retirement change.
4. Verify the documented Next version rollback and a replacement emergency
   maintenance response before retiring the hosted Pages fallback; update
   operational instructions and preserve historical deployment evidence.
5. Triage/update the surviving dependency graph; pin the diagnostic workflow.
6. Apply the small naming/export cleanups; rewrite brittle layout tests with
   their owning UI changes rather than introducing a separate test framework.

Scope covered current source/config, runtime entrypoints and caller searches,
selected history, all configured unit/API tests, the production build, composed
runtime checks, the full navigation suite and current dependency advisories.
It is not a proof that every symbol is unreachable or every advisory is
exploitable. Hosted traffic, deployment identities, credentials, account tier,
live D1 preservation, real mail/provider behavior and installed-client population
were not inspected. The following resolution records the subsequently authorized
local cleanup; signup remains outside its scope.

## Authorized resolution

The user's instruction was: “Address all, do not do the sign up, it's still in work.”

| Finding | Resolution |
|---------|------------|
| F01 | Deferred at the user's request. Signup/AuthCard implementation is unchanged. |
| F02 | Removed `apps/web`, `/legacy` serving, Vite build/dev/test wiring, rollback rehearsal and comparator. Moved activation and service-worker retirement assets unchanged to Next ownership. Retained compiled Pages Functions for the composed Worker and reduced its standalone smoke to API/SDK behavior. Replaced the full old-app PWA fixture with a synthetic old shell exercising automatic retirement through the deployed registration script. Updated the Next-only benchmark's mobile navigation, flight-count expectations, map radio controls and typed route-pair fixture using the current owner's publication metadata. Updated current docs and marked old journey tools historical; removed the obsolete Vite fixture launcher. |
| F03 | Moved the API identity, receipt and geo suites to Next: 21 surviving cases. Removed the Vite-only pending-import case with its helper. The quota-failure case now mocks `Storage.prototype.setItem`, matching the surviving browser-storage tests. |
| F04 | Removed 624 lines of unused private shared-client/data adapters after checking surviving callers. Kept live API handlers, DTOs, session compatibility, mutations, export data and migration history. |
| F05 | Replaced five CSS-source inspection cases with three browser tests covering a 320px calendar's geometry/hit targets, desktop/mobile journal geometry and checkbox outline, and onboarding stagger/reduced-motion behavior. Seeded the two required international fixture airports. Corrected the existing mobile hero test's timing-dependent DOM-attribute expectation: the journey owns zero hero copies and below-fold placement; the unit test owns attribute pruning. |
| F06 | Refreshed compatible dependencies, updated GenAI within major 1, and constrained vulnerable undici/sharp versions. Kept pinned application versions and the existing SSGOI patch. Applied a bounded-recursion patch to braces with a native regression check in CI; details below. |
| F07 | Pinned the React Doctor workflow to `0.9.17`. |
| F08 | Renamed the parsing compatibility test to describe its actual guarantee: no import batch is created. Retained rate-limit persistence and API coverage. |
| F09 | Removed unused API-module re-exports while retaining their internal implementation imports and public routes. |

Hosted Pages fallback, remote bindings, databases and deployment identities were
not changed. Current operational docs preserve that distinction and retain
previous-version Next Worker rollback. Local source retirement does not authorize
deleting the held hosted fallback. Useful old URL redirects remain supported.
Vite remains a transitive Vitest dependency; no Vite application, frontend build
or compatibility route remains. Shared translation JSON remains live through
Next's badge-name helpers and was preserved.

### Dependency outcome

The production-only audit reports zero advisories. The full refreshed graph has
no registry-reported critical, moderate or low advisories.
One high advisory remains in the registry report: `braces@3.0.3`,
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
whose upstream advisory lists no patched release. It is locally mitigated by
`patches/braces@3.0.3.patch`: parsing rejects more than 100 nested braces, and the
compile/expand/stringify AST walkers also have a depth bound. Ordinary patterns
retain their behavior. The native check fails on the original package, passes
on the patched package, and also passes with a 128 KiB Node stack. No audit
advisory was suppressed; the version-based audit still exits 1 for this entry.

The lockfile refresh would also enable new React Compiler lint checks through
`eslint-plugin-react-hooks@7.1.1`. An override retains the audited baseline's
`7.0.1` rule profile, avoiding unrelated UI changes during migration cleanup.
This does not disable any previously enabled lint rule. GenAI's refreshed graph
no longer installs the vulnerable optional MCP SDK, so no unused SDK override
is retained.

The compatible refresh also selected Radix dialog `1.2.0` and newer dropdown
dependencies. The full browser suite exposed intermittent dismissal of both a
delete confirmation and its underlying editor on one Escape press. Pinning the
previously audited dialog `1.1.15` and dropdown `2.1.16` preserves the baseline
interaction while retaining the security remediation. The capture test now
waits for the confirmation's initial Cancel focus before pressing Escape. That
journey and the corrected mobile hero journey passed five consecutive runs each.

### Final cleanup verification

Local logs are in `/tmp/kuuki-cleanup-20261006/`. These are checks of the final
cleanup, separate from the initial audit's baseline results above.

| Check | Result | Evidence file |
|-------|--------|---------------|
| API unit suite | 47 files, 539 tests passed | `unit-tests.log` |
| Next unit suite | 102 files, 1,068 tests passed | `next-unit-final.log` |
| Full Next browser suite | 115 tests passed | `browser-accepted-final.log` |
| Repeated capture/mobile-import regression journeys | 10 tests passed | `browser-regression-final.log` |
| Preview configuration and dependency patch checks | 11 tests passed | `config-final.log` |
| Braces check with a 128 KiB Node stack | Passed | `braces-small-stack.log` |
| Root lint and application/API/script/Worker type checks | Passed | `lint-final.log`, `app-types-final.log`, `script-types-final.log`, `worker-types.log`, `types.log` |
| Frozen lockfile installation | Passed | `install-frozen-final.log` |
| Fresh Next production build | Passed; 71 compiled API routes, 99 static assets | `next-build-final.log` |
| Standalone compiled API/SDK smoke | Passed; activation, identity, cookies, CSRF, revocation, create/replay/repair and text/image/PDF provider boundaries | `api-runtime-smoke.log` |
| Composed Next Worker and runtime-boundary smokes | Passed; activation, retired-PWA assets, legacy 404 and API boundary | `next-smoke-final.log`, `next-boundary-final.log` |
| Maintenance and import Worker dry builds | Passed; no deployment | `maintenance-build.log`, `import-build.log` |
| Next-only performance benchmark | Passed; completed 96 page-read samples, 20 shell navigations, 20 saves and 18 map actions | `performance-accepted-final.log` |
| Benchmark lint/type checks | Passed | `benchmark-lint-final.log`, `benchmark-types-final.log` |
| Pinned React Doctor CLI/flags | Verified with `0.9.17 --help` | `react-doctor-help.log` |
| Production dependency audit | Zero advisories | `audit-prod-final.json` |
| Full dependency audit | One upstream high braces advisory, locally patched as described above | `audit-final.json` |

The performance raw samples are the ignored local file
`docs/research/.local-performance.json` with `completed: true`. Its map workloads
use synthetic route pairs at 50, 500 and 5,000 pairs to exercise the renderer;
they are not evidence of equivalent backend airport-catalog workloads. No
performance threshold or hosted latency claim is inferred from this local run.

The final build has 99 static assets totaling 8,972,216 bytes, compared with the
initial audit's 166 assets and 11,251,903 bytes. The composed dry-run Worker is
19,082,856 uncompressed bytes (3,657,779 gzip reference bytes). Asset retirement
reduced the static payload; the dependency refresh did not reduce Worker size.
The local artifact manifest is generated as
`/tmp/kuuki-cleanup-20261006/artifact-manifest-final.json`, including file hashes,
matching build IDs, pinned runtime versions, production flags and dirty-source
identity. The cleanup diff exceeded Node's default 1 MiB subprocess buffer;
the manifest now uses the repository's existing 16 MiB convention and its
recorded diff hash is checked against the complete binary diff. This checks
local artifact limits; it does not establish hosted
startup, CPU/memory behavior, account tier or deployment readiness.

Generated API-route source remains unchanged, moved activation/PWA assets retain
their original bytes, and the final whitespace check passes. Signup/AuthCard
implementation and the three pre-existing `.gemini/skills` deletions remain
untouched. All runtime mail/provider behavior uses local synthetic fixtures;
no remote database, hosted fallback, deployment or external notification was
changed.
