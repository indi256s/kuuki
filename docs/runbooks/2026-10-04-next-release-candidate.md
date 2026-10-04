# Next release candidate — 4 October 2026

This runbook covers the locally implemented architecture slice. The user selected
Cloudflare with standard React streaming and deferred Instant Navigation. Both
`cacheComponents` and `partialPrefetching` are false. Private reads are request-local
and uncached; the production build exposes no Next testing API. No deployment,
cloud resource change, provider call, real email or push is authorized by
this implementation request. The user subsequently authorized a local commit.

The [original plan](../plans/2026-10-04-kuuki-architecture-implementation.md),
[runtime diagnosis](2026-10-04-next-runtime-evidence.md),
[map provenance](../research/2026-10-04-map-implementation.md), and
[performance evidence](../research/2026-10-04-local-performance.md) identify the
selected behavior and its limits. The approved fallback replaces the plan's
Instant flag and `instant()` gates. It preserves privacy, freshness, canonical
writes, legacy upgrade and rollback requirements.

## Candidate contract

Next owns entry/auth/public pages, Overview, Journal, Passport, manual capture,
reviewed import, recovery and Settings. Server pages read bounded owner-scoped D1
data; owner/filter query keys and revision reconciliation preserve freshness.
The route map is lazy, uses local MapLibre assets, grouped directed routes and
one GeoJSON source. Lists and the Overview SVG remain available when rendering
fails. Journal pages are bounded; duplicate candidates search complete owned
history. Search values are literal bound data.

The composed Worker has one dispatcher per API family. New direct handlers take
the actual Request, environment and execution context through the shared API
middleware; retained Pages wrappers invoke those same domain handlers. The
remaining API families use the compiled Pages Worker. Exact routing rejects
unknown APIs and unsupported methods as JSON; assets never fall through to HTML.
Host isolation, CSRF, multiple cookies, no-store and maintenance checks precede
private database access. Request-local server identity does not renew cookies;
the serialized client activity endpoint owns renewal.

Canonical writes and dirty revisions commit together. An accepted pending write
is saved; bounded polling reports publication separately. Ambiguous saves retain
their original key and exact payload. Import drafts store reviewed normalized
fields only, are bounded/expiring/owner-scoped, preserve partial acceptance and
have an explicit checked-Journal recovery path. Identity changes abort work and
clear only owned local receipts/drafts. Recovery uses expiring hashed one-use
tokens, atomic credential changes and revokes legacy and Better Auth sessions.
Fragments are consumed and removed before hydration; sender acknowledgement is
not inbox delivery.

No migration or new lifecycle, transit, auto-confirm or undo rule was introduced.
Existing UTC rollover, eligibility and airport-backed city semantics remain.
Journey stays available through `/legacy/`. Next's current rank/month summaries
use CSS; the retained Vite app keeps its existing Recharts journeys. A new chart
engine, persistent cache, Queue, Workflow, detailed basemap provider, deck.gl,
database/provider swap and Supabase retirement remain separate conditional work.
Default Worker placement and authoritative D1 reads are retained. No D1 Sessions
or bookmark-based replica freshness claim is made.

## Local verification and identity

Raw logs and the chronological execution ledger are in
`/tmp/plan-execution/kuuki-20261004/`. W1–W4 checks include 92 API tests, 58 client
tests, workerd runtime checks and capture/account/navigation/map scenarios.
Recovery tests use fake mail and synthetic credentials. W5 passed the integrated
local checks below; earlier scoped evidence is reused for unchanged code.

Run builds and browser fixtures serially: the scripts share `.wrangler/next-build`
and port 8800. Freeze source/test writers while Vitest runs. The normal browser
suite tests production behavior; the opt-in performance suite is separate.

```sh
pnpm lint
pnpm typecheck
pnpm typecheck:api
pnpm typecheck:scripts
pnpm typecheck:maintenance
node --test scripts/draft-storage.test.mjs scripts/check-preview-config.test.mjs
pnpm exec tsx scripts/map-geometry.test.ts
node scripts/check-preview-config.mjs --config apps/next/wrangler.toml --maintenance-config workers/maintenance/wrangler.toml
pnpm --filter @kuuki/web build
pnpm build:api
pnpm build:maintenance
pnpm smoke:runtime
pnpm next:build
pnpm --filter @kuuki/next typecheck:worker
pnpm next:smoke
pnpm exec tsx scripts/rehearse-next-rollback.ts
pnpm test:next:navigation
pnpm --filter @kuuki/next exec playwright test --config tests/performance.config.ts
node scripts/next-artifact-manifest.mjs
```

CI packages `web-dist` and `next-candidate` separately. Next does not enter any
deployment job. The candidate includes the actual standalone dry-run Worker,
compiled API, versioned Next and legacy assets, root Vite rollback files,
configuration, lockfile, build IDs and sorted file SHA-256 manifest. Preserve the
whole archive. Implementation commit `ab02241` contains the verified application,
CI and test source; the documentation is committed separately. Verification and
raw artifact/source identities were captured before committing. This later
documentation metadata update does not change the runtime build.
The manifest records base SHA plus tracked patch and untracked
content hashes for a dirty local candidate; a base commit alone is insufficient.
The final source patch/manifest identity is retained with raw evidence, separately
from generated build identity. CI has not been run on GitHub in this task.

Bundle admission checks uncompressed Worker size, individual assets and file
count against [current Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/).
The account tier, startup CPU, request CPU and total runtime memory require fresh
hosted evidence. A local dry-run or gzip figure does not prove those limits.

Final integrated local result: W1–W5 are accepted under the approved fallback.
The final production build has testing APIs disabled, build ID
`mX4blKM7UpZLAbVgAmi9E`, 132 assets totaling 10,252,471 bytes and 59 API routes.
The final composed workerd smoke, all 26 browser checks, compiled Pages smoke,
failed-candidate/maintenance rollback rehearsal, artifact admission, types and
lint passed. API regression (92 tests) and client regression (58 tests) are reused
from the unchanged W4 code. Lint retains 22 existing legacy warnings and no
errors. The local performance suite passed 128 paired reloads, 20 Link transitions,
20 saves and 18 map actions; [results and limitations](../research/2026-10-04-local-performance.md)
include the 5,000-route map hotspot. No universal speedup or hosted SLO is claimed.

Raw final proofs: `w5-cache-fix-build.log`, `w5-next-smoke-final.log`,
`w5-navigation-final.log`, `w5-legacy-smoke-final.log`,
`w5-rollback-runtime-accepted.log`, `w5-performance-results.log`,
`w5-performance-raw.json` and `w5-artifact-manifest-final.log` in the execution
directory. The compiled legacy and rollback fixtures use the actual Pages
compatibility date `2025-09-23`; Next uses `2026-08-06`. Independent review covered
CI/artifact completeness, auth/write rollback, conditional asset revalidation and
measurement semantics. Missing-input, flags-on, oversized Worker and oversized
asset admission negatives were checked in disposable local fixtures. Source and
artifact identities are preserved in that directory after the final document
freeze, without committing or pushing the checkout.

## Local rollback rehearsal

The compiled Pages workerd smoke exercises the retained API transport separately.
The rollback harness also runs compiled Next, Pages and maintenance Workers
against one disposable D1. A simulated candidate 503 switches subsequent calls to
Pages; the same session and receipt must survive replay, edit, claim, ground visit
and deletion. A held scheduled Worker deliberately lacks DB access; the single
selected draining owner then rolls over an overdue flight and publishes dirty
state. The router failure is synthetic, not a deployed Cloudflare routing proof.
The Next browser rollback scenario creates through the actual Next form, replays
its receipt, edits and deletes through the actual Vite `/legacy/flights` UI, then
checks Next and API reads against the same synthetic D1 state. Both frontends use
the compatible API and unchanged schema. This proves local client compatibility;
it does not prove a hosted route swap, old deployed artifacts or a live restore.
The full Next smoke also checks held API/private routes without a DB binding.
Existing maintenance tests exercise overdue rollover and publication recovery.

Minimum rollback is the **patched Vite frontend plus compatible API/maintenance**,
not the unpatched audited API. Retain database IDs, account/flight IDs, pepper and
signing secrets, both credential/session tables, cookie variants/attributes,
CSRF behavior, receipt format/retention and derived revision semantics. Do not
rotate secrets, shorten receipt cleanup or rewrite evidence during a route rollback.
No schema reversal is needed for this candidate. Browser-local Next drafts do not
become Vite drafts; unfinished review must remain available through the retained
Next import URL or export its reviewed rows before a full frontend withdrawal.

Before any authorized cutover, record the last healthy frontend/API/maintenance
artifact hashes, actual route mapping, schema version, secrets references and
maintenance state. Keep matching versioned assets for open tabs. Route selection
must cover documents, RSC/prefetch, scripts and API consistently for each client.
Do not randomly mix builds per request. Stage the root service-worker retirement
while Vite is still served: an installed old worker can intercept the first Next
document before Next code runs. Local installed-PWA tests cover the actual worker
update and preserve unrelated storage; repeat against the hosted old version.

On disclosure, credential/CSRF/host regression, lost/duplicate write or unbounded
backlog: apply the separately authorized hold to all mutation and recovery
entrypoints, preserve receipts and revisions, and stop cohort advancement. For
frontend-only failure, restore the retained consistent frontend/asset mapping
while keeping the compatible API and one scheduled recovery owner. Verify old
and new cookies, canonical create/replay/edit/delete, claims/ground visits and
publication. Forward repair follows committed receipts. A whole-database restore
requires separate authorization, held writers and reconciliation of writes after
the backup; a frontend rollback does not roll back D1.

## Monitoring contract for authorized staging

The candidate emits sanitized structured events. These are local instrumentation
and concrete dashboard/alert definitions, not installed hosted dashboards. The
release operator owns configuration and alert delivery; the application owner
owns correctness/publication incidents. Confirm access, sampling, retention and
cost before enabling [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).
Exclude credentials, owner IDs, emails, route labels, documents, reset links and
complete provider responses. Invocation logging can include URLs: review its
content and query policy separately from the application's sanitized events.

| Panel / event selection | Fields / aggregation | Initial staging gate and owner |
| --- | --- | --- |
| API `api_request` | status, method, durationMs; count and latency quantiles | Operator: any unexpected 5xx during synthetic proof blocks; later alert at >1% 5xx over 5 min with >=100 requests; treat 4xx input separately |
| Worker platform metrics | requests, errors, CPU, memory-limit failures | Operator: any startup/CPU/memory rejection blocks; compare representative-region samples with actual account entitlement |
| D1 / `overview_read` | statements, rows (returned), d1Ms, durationMs | App owner: Overview stays 13 bounded statements; platform scanned rows/time are distinct from returned rows |
| `flight_save` | outcome, canonicalMs, repairMs, durationMs, derivedState | App owner: separate created/replayed and canonical/pending; report p50/p95 from >=100 samples |
| Publication / `overview_read` and derived status | revisionLag; status dirty count and oldest age | App owner: revision never moves backwards; investigate oldest dirty age >15 min; pending polling expiry alone is not repair failure |
| `maintenance_success` / `maintenance_failure` | duration_ms, rolled_over, overdue_remaining, dirty_count, dirty_oldest_age_seconds, failure code | Operator: success older than 15 min or any failure alerts; maintenance holds are labelled intentionally paused |
| `import_provider_result` and usage buckets | model, outcome, duration_ms; admitted quota consumption | App owner: separate timeout/provider errors from validation/quota denial; fake-provider success is not accuracy/availability proof |
| Aggregate Web Vitals | LCP, INP, CLS by frontend/build and viewport only | Operator: no collector is installed by this candidate; authorized hosted aggregate measurement is a release gate |

Local browser ScriptDuration/TaskDuration and JS heap samples are explicitly
proxies, not hydration CPU, GPU completion, Web Vitals or D1 cost. The paired
baseline is the retained **patched** Vite build in the same final artifact; the
original W1 binary is not archived for an exact W1-versus-final benchmark.

Before a cohort, collect >=100 representative staging samples per important
history/region and choose a budget against that fresh baseline: proposed gate is
no more than 20% regression in p95 final-data navigation and save response, zero
correctness/privacy failures and zero eager map/large-corpus requests outside
their consumer. This is a proposed acceptance budget, not a passing local SLO.
The operator and application owner must record the accepted thresholds and
observation window before rollout. Detailed map/provider experiments are
conditional on a measured deficit and an approved cost/retention envelope.

## External gates still held

1. Re-read live source/target/configuration and deployment identities. Static D1
   ID comparison does not establish deployed isolation. Preserve all safeguards
   in [audit remediation release](audit-remediation-release.md), including any
   still-pending Supabase source freshness, conflict admission, hold and restore.
2. On explicitly authorized isolated staging, verify actual D1/auth/mail bindings,
   backup restore, old/new cookies and all writer/cron entrypoints. Prove one
   recovery owner. Validate the packaged artifact identity without rebuilding it.
3. Confirm account tier, startup/CPU/memory and content-safe observability. Install
   dashboards/alerts and aggregate Web Vitals only in that authorized environment.
   Compare default placement with Smart Placement and eligible D1 Sessions from
   representative regions; retain defaults unless measured proof wins.
4. Real activation/recovery inbox proof needs an approved recipient and current
   email configuration. Real parsing comparisons need 30–50 consented/redacted
   documents and provider billing/retention review. No real calls occurred here.
5. Keep `PREVIEW_ISOLATION_VERIFIED`, `GIT_DEPLOY_DISABLED`, exact
   `PRODUCTION_RELEASE_SHA` and `MAINTENANCE_DEPLOY_READY` semantics. This task sets
   none of them. Next routing/cutover requires a separate explicit deployment
   decision; CI's existing guarded Vite deployment path is unchanged.
6. Instant Navigation and new lifecycle/transit/auto-confirm/undo remain named
   deferred requirements. Full Redesign 2.0 and production release are incomplete.
