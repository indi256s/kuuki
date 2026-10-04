# Architecture implementation evidence — 4 October 2026

Status: W1–W5 are accepted locally using the user-approved Cloudflare
standard-streaming fallback. The current scope and
release gates are in the [candidate runbook](2026-10-04-next-release-candidate.md). This is not a
release approval or a completed Redesign 2.0.

## Approved execution adjustment

On 4 October 2026 the user selected “Keep Cloudflare and use standard streaming,
deferring Instant Navigation.” This supersedes the source plan's requirements
for two active Instant Navigation flags and passing instant() assertions in
W2–W5. It does not relax privacy, identity, freshness, write, legacy upgrade or
rollback requirements. Next/OpenNext remain pinned; both flags are disabled,
runtime application-data caching remains disabled, and normal navigation plus
streamed/final authorized data must pass on built workerd before W3 starts.
The flags-on diagnosis below is retained as historical failed evidence. Instant
Navigation is a named deferred requirement, not a delivered capability.

The user authorized local implementation with subagents after the planning
request. No deployment, cloud-resource change, provider call or push
has been performed. After verification, the user authorized a local commit;
implementation commit `ab02241` preserves the verified application/CI/test source. Existing release/isolation flags and held maintenance
schedules remain unchanged. The source plan and audit inputs remain intact.

## Accepted W1 evidence

- API regression: 11 files, 82 tests passed; client regression: 10 files,
  58 tests passed. Filtered summary/route corrections passed their focused tests.
- API, maintenance and Vite types passed. Admission fixtures passed 10 tests,
  including invalid, missing, equal and misaligned binding identifiers.
- Vite build, generated Pages API build and synthetic workerd smoke passed.
  Provider/email calls were faked; the fixture denied other outbound traffic.
- Overview uses bounded summaries and server filters; duplicate checks cover
  full owned history without downloading it. Failed reads remain errors,
  accepted writes retain atomic dirty markers and receipt replay, and UTC
  overdue rollover stays compatible with existing behavior.
- Synthetic save sample: canonical commit 0 ms, repair 4 ms, response 16 ms.
  This is one local observation, not a production latency or speedup claim.

W1 patch identity: base `e5435b2671ff4cc2151f000d2facad9841a0ea3f`, tracked
patch SHA-256 `a02944a9208007aaa3686bbb3f9e2765159f54712b24dbffef23bf4e754e18dc`.
The execution ledger and raw logs are under
`/tmp/plan-execution/kuuki-20261004/`; this identity does not include later W2
changes or replace a final candidate identity.

## Historical W2 flags-on runtime reproduction

Installed candidate: Next `16.3.8`, OpenNext Cloudflare `1.20.8`,
`@next/playwright` `16.3.8`, React `19.2.4`, Node `24.18.0`,
Wrangler `4.147.0`, Miniflare `4.20260730.0`.

The initial required source configuration used `cacheComponents: true` and
`partialPrefetching: true`. These are disabled in the accepted fallback.
Cache interception was disabled. The initial
incremental cache is read-only Static Assets; no runtime application-data
cache or persistent cache resources have been provisioned. Production testing
APIs were enabled only for the explicit `next:build:test` fixture build.
That diagnostic build command and flag were removed on 5 October after the
streaming fallback was accepted. The artifact admission check still rejects
production testing APIs.

The stable local workerd `1.20260730.1` supports compatibility dates only through
`2026-08-06`; that supported date is selected for the candidate. A diagnostic
override to workerd `1.20261004.1` also failed and is not a selected workaround.

Observed isolation checks:

| Controlled check | Observed result |
| --- | --- |
| Both flags enabled, composed Worker | Next public/authenticated documents fail with workerd hung-request cancellation (500); APIs work |
| Both flags enabled, generated OpenNext Worker alone | Fresh `/bootstrap.js` returns JavaScript (200), then public `/` fails (500) |
| Both flags enabled, default dummy incremental cache | Same static-asset success and document failure |
| Both flags disabled, otherwise composed Worker | Public `/`, `/signin` and authenticated `/overview` served successfully in a diagnostic run |
| Both flags enabled, native `next start` on the same `.next` artifact | Public `/` returns 200, 9,673 bytes; artifact configuration confirms both flags |

The native test establishes public-page behavior only; it does not prove D1
binding, authentication or a replacement hosting architecture.

During the flags-on diagnosis, `pnpm next:build` and `pnpm next:smoke` reproduced
the document failure. The current approved flags-off configuration passes that
full gate; reproducing the historical failure requires restoring the two flags. `pnpm exec tsx scripts/smoke-next-runtime.ts --check --next-only`
isolates the generated OpenNext Worker from the compiled Pages API. Its fixture
uses synthetic D1 and denies outbound calls; it does not deploy or read live
credentials.

The precise cause remains unresolved. Next emits a warning about its Cache
Components timer assumptions. An independent source trace found that the
adapter resolves the streaming response only after headers are written;
rendering that never writes headers leaves it pending. Temporary rejection
instrumentation did not reveal an underlying thrown error and was removed.
Scheduler incompatibility is an inference, not an established root cause.

Cloudflare documents [restricted Worker timer behavior](https://developers.cloudflare.com/workers/runtime-apis/nodejs/timers/).
OpenNext [issue #1225](https://github.com/opennextjs/opennextjs-cloudflare/issues/1225)
reports an older Cache Components streaming failure with different symptoms;
it does not certify this failure's cause. Static Assets caching is documented
for static sites in the [OpenNext caching guide](https://opennext.js.org/cloudflare/caching),
so its dynamic-shell suitability is not accepted merely from configuration.

Raw diagnostic logs: `/tmp/kuuki-next-only.log`,
`/tmp/kuuki-next-only-dummycache.log`, `/tmp/kuuki-next-build-dummycache.log`,
`/tmp/kuuki-next-smoke-diag.log`. Native headers/body are retained as
`next-native.headers` and `next-native.html` in the execution directory.

## Historical W2 compatibility and failed gates

The composed boundary smoke proves synthetic signup/signin, the existing
PBKDF2 credential format, multiple cookies, CSRF rejection, JSON API 404/405,
owner summary reads, isolated activation headers/host denial, legacy direct
documents and missing-asset 404. A held fixture without a DB binding proves
API/private-route 503 with Retry-After and no-store before database access.
These results do not establish a working Next document runtime.

The final post-W2 regression run passed 82 API and 58 client tests again, plus
API/script/maintenance/Next types. Next lint and Worker types passed. A browser
check passed the API/asset error contract; the official `instant()` direct
Overview check failed because its shell never appeared. Its log is
`w2-navigation.log` in the execution directory. This is a failed gate, not an
unrun or assumed-passing feature.

The final fixture build after the Import return correction passed. The boundary
smoke on that artifact also passed: 11,505,209 bytes of bundled Worker code
(2,173,415 gzip), 91 static assets totaling 3,704,966 bytes, and 56 inventoried
API routes. These are artifact measurements, not startup, CPU, memory or
production latency measurements. Logs: `w2-build-final.log` and
`w2-boundary-final.log` in the execution directory. The full document/runtime
gate remains failed; a boundary-only pass does not satisfy W2 acceptance.

The separate Vite `/legacy/` artifact registers no service worker; the normal
root Vite artifact remains available for rollback. Typed add/edit/claim entries
validate parameters and use allowlisted full-document returns. Installed root
PWA retirement must be staged while Vite is still served: the old worker can
intercept the first Next document before Next code runs. A fresh-browser test
cannot prove this upgrade. The installed-old-worker test observed cached Vite
navigation, updated the actual registration to the retirement script, verified
that owned caches and registrations were removed, and verified unrelated cache
and localStorage preservation. It then failed at the Next landing shell (the
same runtime failure). Thus retirement itself has browser evidence, while the
complete upgrade/navigation gate remains red; see `w2-pwa.log`.

Final independent review found one missing legacy Import success return. The
explicit success action now honors a validated Next `returnTo` with full
document navigation while retaining the partial-save/retry screen. Normal
Vite navigation remains unchanged.

No product rule changed: five-flight leaderboard eligibility and airport-backed
city counts remain compatible; claims/ground/legacy visits remain Passport
evidence; Journey remains reachable through legacy compatibility; confirmation
and transit policy changes remain deferred. No draft/document-retention or
durable background parsing promise has been added.

The revised W2 gate passed: standard-streaming fixture build, full workerd smoke
including renewal/privacy/host/activation/maintenance and all 8 browser tests
(navigation, account isolation, foundation keyboard/RU layout and complete
installed-PWA upgrade). Renewal's fixture ages both expiry and update time,
matching Better Auth's actual refresh decision. Script types also passed.
The Worker is 10,166,968 bytes uncompressed / 1,888,434 gzip; 91 static assets
total 3,703,118 bytes. Logs: w2-fallback-build.log, w2-fallback-smoke.log and
w2-fallback-scripts-typecheck.log. This evidence accepts the user's fallback;
it does not establish Instant Navigation or hosted performance.

## Accepted W3–W5 integrated candidate

W3 delivered owner-scoped Overview/Journal/Passport and permitted public reads,
request-local identity, revision reconciliation and lazy map islands. Functional
browser checks covered privacy withdrawal, period/route geometry, theme, local
worker, unmount/reopen and disabled-WebGL fallback. W4 moved capture, reviewed
import, recovery and Settings through real Request/Response domain adapters while
retaining Pages compatibility. The final W4 regression passed 92 API and 58
client tests, with fake mail/provider behavior and synthetic credentials only.

The final W5 production build disables the testing API and both Instant flags.
Build ID: `mX4blKM7UpZLAbVgAmi9E`. Full composed workerd smoke and all 26 browser
checks pass, including installed-PWA upgrade, A/B isolation, final-data reads,
canonical receipt/draft recovery, account reset and actual Next → Vite → Next
edit/delete rollback. Conditional legacy assets/documents, activation and
retirement scripts preserve valid 304 responses; the smoke checks status, MIME
and required no-store headers. This repaired a real second-visit rollback failure.

Compiled Pages smoke and a compiled Next/Pages/maintenance rollback rehearsal
also pass at their actual configured compatibility dates. A simulated candidate
503 switches to Pages on the same synthetic D1, cookies and receipt; retained
writes, held cron without a DB binding and one draining maintenance owner pass.
No deployed route swap, backup restore or real inbox/provider proof is implied.

The separate local performance rehearsal passed 128 reload samples, 20 actual
Link transitions with no document requests, 20 single-flight saves and 18 map
actions at 50/500/5,000 synthetic routes. Save response median/p95 was 12.0/13.6 ms;
5,000 routes took 2,737.2 ms to first map controls and 2,245.5 ms to reopen. These
are local observations, with browser/CPU/memory limits and raw distributions in
[performance evidence](../research/2026-10-04-local-performance.md).

Types, lint, focused fixtures and separate Next/legacy candidate packaging are
accepted locally. Exact source/artifact hashes and final logs are retained under
`/tmp/plan-execution/kuuki-20261004/`; see the [candidate runbook](2026-10-04-next-release-candidate.md)
for identity, rollback, dashboard/alert definitions, ownership, proposed rollout
budgets and all remaining hosted gates. New product-rule decisions and Instant
Navigation remain deferred; full Redesign 2.0 and production release remain open.
