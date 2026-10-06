# Next release handoff — 6 October 2026

Owner: `chore/next-release` in `/Users/indi256/Documents/kuuki/kuuki`.
Locate the checkout with `git worktree list` before continuing. Runtime candidate
is `f3e2b1c`, already merged and pushed to `main`; this branch records release
evidence without changing that candidate. CI/CD run `37434105774` and React
Doctor run `37434105847` passed. Deployment jobs were skipped by release guards.

## Authorization and remaining decisions

The user requested merge/deploy, reviewed the database release proposal and
legacy activation flow, then said “let's do it.” Carry authorization for staging
preparation and the controlled production baseline/additive migration/import
release forward. Required preservation gates still apply. Production application data,
credentials, routing and deployments have not been changed. A diagnostic sign-in
created a test session and successful sign-out revoked it. One staging activation
request was made on 6 October at 09:46 UTC to the explicitly approved recipient. Inbox
receipt and activation completion were confirmed; no legacy-cohort mail or real
parsing-provider calls are authorized.

Production pepper rotation is now explicitly authorized:

1. The user cannot recover the retained production AUTH_SECRET and accepted
   generating a new one, with password resets for the two retained production
   accounts and preservation of their flights. This supersedes the earlier
   original-pepper preservation requirement for this release; it does not authorize
   deleting those users or their data.
2. A new AUTH_SECRET containing 48 cryptographically random bytes is saved in the
   private `production.env` (0600). The existing BETTER_AUTH_SECRET, GEMINI_API_KEY
   and ACTIVATION_MAIL_AUTH_TOKEN entries were verified unchanged. No production
   secrets have been uploaded. Presence does not establish provider/mail permission
   or delivery acceptance.
3. The earlier supplied AUTH_SECRET failed local verification against the current
   production atlas test credential, while that fixture successfully signed in to
   the live app and signed out (both HTTP 200). Retain that historical evidence;
   the newly generated secret is intentionally different and is not expected to
   verify the old hashes.
4. Under the full writer hold, after backup/restore proof and schema admission,
   make an explicitly reviewed reset of only the two retained accounts: set their
   `users.password_hash` to `RESET_REQUIRED`, remove their old credential-provider
   `auth_accounts` rows, and revoke both legacy and Better Auth sessions plus stale
   activation tokens and stale password-reset verifications. Preserve their IDs, profiles, 69 flights and other owned
   records. The existing activation flow then installs their new password in both
   users and auth_accounts. Rehearse this targeted reset and preservation check
   before production; do not run the blanket `reset-passwords.ts` script.

Identity mapping: the verified fresh source and live production share one email
   and username across different IDs, and 64 differing flight rows share IDs.
   The user said the current production account need not be kept. Further read-only
   inspection found that the conflicting account owns zero flights; the other two
   production accounts own all 69 flights and both have personal password hashes.
   The user explicitly selected “Replace only conflicting account.” Preserve the
   other two accounts and all 69 flights. Their passwords must now be reset under
   the separately accepted pepper rotation above. Replace
   the conflicting account after backup/restore proof, retain the historical user's
   ID, and remap the 64 incoming flight-ID collisions. This authorizes no wholesale
   production data reset. Remove the two retained old credentials as part of the
   approved targeted password reset before enabling the new pepper.
   Conflicts must be re-read under the production writer hold before applying.

Fresh source accepted on 6 October at 08:42 UTC: the user supplied the private
backup directory
`~/.local/share/kuuki/backups/supabase/20261006T083019Z`, captured at
`2026-10-06T08:32:07.4487+00:00` from Supabase project `cwmotwkvpdkfrtjxmoce`.
Offline capture/table/projection verification, archive SHA-256 and safe archive
member checks passed. Rebuilding the import manifest matched the supplied
manifest. All 13 datasets match `db/_snapshot` semantically; differing JSON
serialization gives the fresh importer source hash
`ce2b992d659d4f651d0b31197ae2bb3721bc111159f7fc256d353a4f2db89542`.
Counts remain 26 users and 343 flights. The supplied `query.py` can repeat a
read-only capture using the project-bound Codex Supabase OAuth credential in
Keychain; inspect it and write a new capture directory instead of overwriting
admitted evidence. Source freshness is accepted for this capture, not indefinitely.
Recheck it at cutover. Production conflict reads against this fresh source returned
the same pending identity/flight-ID conflicts. No production writes occurred.

## Accepted hosted progress

Account: `5cadcff0282e54f3ff1d7062d4dbb97a`.

| Target | D1 ID | Accepted observations |
| --- | --- | --- |
| Production | `2a8e3895-6a98-4473-8d7b-a43ca0c0026f` | 3 users/profiles, 69 flights; original schema, empty ledger; read-only inspection only |
| Preview | `80e0c789-c1ab-4aa5-a6fe-e65c6e6cb74c` | 6 users/profiles, 2 flights; migrations 0001–0007 recorded; original data preserved |
| Preview restore proof | `d4dcdc60-fcc4-40e4-afcd-f9b106c39d3f` | Separate hosted restoration of the pre-migration preview export |

The hosted restore was re-exported and compared with the original export: all
24 tables plus sequence rows and all 48 schema objects matched; no FK violations.
Local SQLite integrity checks on those exports passed; hosted integrity_check
was not claimed. After preview migrations 0004–0007, all original column values
across 23 application tables matched the original export. Users, profiles and
flights remained 6/6/2; no FK violations. Lifecycle prechecks passed for both
targets before schema changes.

Hosted A1: all six lifecycle triggers present; a D1 `db.batch` containing a trigger
violation rejected and rolled back its preceding write; the old flag adapter
produced valid lifecycle/deadline fields. The adapter UPDATE reported
`meta.changes = 2`. The token-protected, fixed-operation probe used synthetic
rows, cleaned them up, and its temporary Worker was deleted. No probe users remain.
Pre-lifecycle bundle CRUD/bulk/edit/sync/cron compatibility subsequently passed on the
isolated synthetic database below. The old cron handler was explicitly invoked; actual
current-candidate timer evidence is recorded below.

Next preview `https://kuuki-next-preview.indi256s.workers.dev` serves the frozen
candidate against the original preview D1. Hosted auth/CRUD/edit/bulk/sync,
ownership A/B, CSRF, authenticated shell routes, synthetic legacy cookies,
activation with a fake sender, one-use completion, reset revocation, activation
host isolation, provider-key failure and route/static boundaries passed. The
preview is temporarily unheld for staging verification with its own new
`AUTH_SECRET`; no existing preview password hashes were rotated. Original Pages
pepper compatibility remains unproven. Main preview version after restoration
of the frozen Next candidate: `62cf3b5a-eba3-4ba6-b839-eae1d8295be9`.
Temporary auth probe and synthetic users were removed.

The hosted browser service-worker upgrade passed on that same origin: actual
patched Vite Workbox registration/cache, then frozen retirement script while
Vite still served, then Next. Workbox registration/cache disappeared; unrelated
storage and a separate cache sentinel survived. Production must repeat the
retirement stage before routing switches to Next.

Synthetic compatibility D1: `8e89bffa-a09d-47b7-82c5-9646c0bec341`.
Byte-identical archived pre-lifecycle Pages/cron modules passed hosted create,
bulk, repeated edit, sync and explicitly invoked old cron. Lifecycle adapters
remained valid; current repair corrected the expected old counter inflation.
Temporary probe was deleted. Current frozen maintenance candidate passed two actual
five-minute timer invocations at 09:50:39 and 09:55:39 UTC. Both reported zero
overdue/dirty rows and no failure; the fixture Worker/schedule was deleted. No
production cron is enabled.

The targeted local rehearsal restored a read-only production export, applied
additive migrations, reset only two retained accounts, removed the one zero-flight
conflict through `deleteUserCascade`, remapped 64 incoming flight IDs, imported,
derived, validated and reran safely. Final union: 28 users/profiles and 412 flights.
All original retained owned data matched after derivation and after both accounts
activated with a fake sender; stale recovery tokens were revoked and an unrelated
verification survived. Mapping digest:
`ab708d946247d0a6e02b81029fe0b22af4530547a1236a451614b82c957f8787`.
This is rehearsal evidence, not production transfer or held backup proof.

All 540 enumerated historical Pages deployment URLs were tested for both auth
read and flight mutation: 1,080 requests denied by the reversible wildcard Access
hold (app `9cf9a36a-fbc3-47fd-86f5-cdf432748d6c`). Git production deployments remain
disabled and preview automatic deployments disabled. Canonical/custom production
origins are still live, so full production hold has not yet been established.
No account Worker binds production D1. Supabase has 15 app-owned public tables
with effective anonymous/authenticated/service-role write privileges. Independently
reviewed private SQL will install 17 statement-level `ENABLE ALWAYS` write-fence
triggers across those tables plus auth users/identities. It is not yet applied;
keep this source fence after D1 reopens until legacy writes are retired/reconciled.

Single real-email staging gate: a temporary Service Auth-only Pages alias
`mail-gate.kuuki.pages.dev` reuses the existing separate preview mail secret and
binds only the synthetic D1. Its deployment is
`04ab5680-9276-42c1-b5f5-c014c86b1c21`; public requests reject with 403. Fresh
Next main/activation Workers (`kuuki-mail-main-gate`, `kuuki-mail-activation-gate`)
share the synthetic D1 and staging secret. The approved address already has an
active account in original preview, which was untouched; only a separate synthetic
fixture receives this mail. One request returned 200 and its token remained after sender
acknowledgement. The user confirmed inbox receipt and successful activation; D1 readback
found matching installed user/auth-account credentials and zero remaining activation
tokens. Pages preview configuration is global: deployment
`5dd3ce65-9275-4c41-9d38-7f39dd9a333e` restored its original preview D1/origins. Project and deployment readback
confirmed secret bindings remained present; values were not retrievable or
written by this operation. The temporary mail alias deployment,
restricted Access app/service token, two Next Workers and synthetic fixture were
removed. No production
Next Worker or domain move has occurred.

Read-only baseline review compared production with 0001: same 17 application
tables and 35 named objects; column definitions/defaults/PK/FK/index metadata and
checks match. Differences are SQL whitespace and advanced-stats column order.
This is not final schema admission or permission to rerun 0001. Ledger baseline,
production backup/hosted restore and all-writer hold remain pending.

The fresh-source conflict report found 26 source users/343 source flights,
3 target users/69 target flights, one email and username conflict, no user-ID
conflicts, and 64 differing flight-ID conflicts. After the proposed identity map,
there were zero matching date/origin/destination candidates. This is not the
final under-hold deduplication decision.

## Private evidence and next action

Private evidence is retained in
`~/Library/Application Support/Kuuki/next-release-20261006` (0700 directory,
0600 files). It includes preview exports, full restoration and preservation
comparisons, schema inventories, A1 code/output, deployment logs, new preview
Better Auth secret, the private conflict report and `source-review.json` recording
the fresh-source verification. Temporary working copies are
in `/tmp/kuuki-release-20261006`; the read-only conflict helper is ignored at
`.scratch/legacy-cleanup/source-target-conflicts.ts`. Do not publish these files.

Next: finish hosted performance and monitoring gates. Then establish full production
hold (including Supabase and canonical/custom Pages origins), re-read source/target
conflicts, export and
prove hosted restoration, baseline the ledger without running 0001, apply admitted
additive migrations, transfer/derive/validate reviewed data, deploy the same
candidate and only then release hold. Do not set release variables or enable
cron before their gates pass. Follow the
[audit release runbook](../runbooks/audit-remediation-release.md),
[lifecycle runbook](../runbooks/lifecycle-release.md) and
[Next candidate contract](../runbooks/2026-10-04-next-release-candidate.md).

Private new evidence includes `targeted-rehearsal-proof-reviewed.json`,
`hosted-auth-smoke-proof.json`, `hosted-serviceworker-upgrade-proof.json`,
`pages-writer-inventory-complete.json`, `pages-all-url-hold-proof.json`,
`supabase-effective-writers.json`, reviewed hold/rollback SQL, and
`real-mail-gate-proof.json` and `targeted-rehearsal-proof-full-publication.json`. Full publication rehearsal also repaired the two retained dirty markers: all 28 users ready, canonical profiles/flights unchanged, 29 derived visits and 9 badges computed for the two current accounts (previously zero), with independently reviewed normal derived refresh. Duration totals and the 69-flight count remained unchanged; the shortest-flight ID changed within an equal-duration tie because the query has no tie ordering. Old-bundle and current timer details are in the
private `/tmp/kuuki-release-20261006` working directory. A 09:32 UTC fresh source
recheck found all 13 datasets semantically unchanged, but is not the final held
cutover capture. Do not overwrite the 08:32 admitted source.

## Production cutover — 6 October 2026 (current state)

Next serves production on `https://kuuki.marchstudio.uk` from 13:03:45 UTC. The
sections below this one are historical gate evidence.

1. **Writer hold.** The Supabase source fence is applied with 17 statement-level
   triggers, and the negative proof passed: 37 rejections, SQLSTATE `55000`.
   - The 15 `public` triggers are `ENABLE ALWAYS`.
   - The `auth.users` and `auth.identities` triggers are default-enabled (`O`).
     `ENABLE ALWAYS` needs table ownership, which belongs to `supabase_auth_admin`.
     Create and drop were proven reversible inside rolled-back transactions.
   - **Keep the fence.**
   - Pages production serves the held Vite build `4a779796`, with maintenance on all
     API paths and the retirement `sw.js`. It still serves `kuuki.pages.dev` and
     `kuuki.indi256.com`.
   - Rollback target: Pages deployment `22e26a40`.
2. **Held source capture.** `20261006T121819Z-cutover-held` is byte-identical to the
   admitted source on all 20 tables; only the hold triggers differ. Conflicts re-read
   under hold were unchanged.
3. **Backup.** Time Travel bookmark
   `00000032-00000000-000050fc-1bcf3d87ec1b7f3cdd614065e28eefb7`, plus the private
   SQL export (sha256 `99b76a69…`). The hosted restore into `c4f88d19` matched exactly
   on 37 schema objects, 18 tables and sequence rows, with 0 FK violations.
4. **Dress rehearsal.** The full sequence below ran first on that restored copy and
   passed.
5. **Production data.**
   - Ledger baselined with the `0001_init.sql` row (0001 was not rerun), then
     0002–0007 applied.
   - Semantic schema admission: only the `user_advanced_stats` column order differs,
     plus comment/whitespace text.
   - Targeted reset and replacement through a temporary fixed-operation Worker, which
     has since been deleted.
   - 64 flight IDs remapped (digest `ab708d94…`); the 1,623-statement import is
     byte-identical to the dress rehearsal.
   - All 28 users repaired to ready. Validator PASS; rerun found 0 missing or
     divergent rows.
   - The retained accounts' users, profiles and 69 flights match the pre-release
     export exactly. Totals: 28 users and profiles, 412 flights.
6. **Release identity.** Production runs the recovered frozen `teeDcJw9kXHTh4B5__Rpz`
   build. The local build had been regenerated, so the Worker bundle was recovered
   from `kuuki-next-preview` and the assets were reassembled. All 163 assets and the
   bundle (sha256 `52284abe…`) match `.wrangler/next-artifact-manifest.json`, and the
   `--no-bundle` dry run is byte-identical.
   - Workers: `kuuki-next` (route `kuuki.marchstudio.uk/*`, no `workers.dev`) and
     `kuuki-activation` (`kuuki-activation.indi256s.workers.dev`). Both use the new
     `AUTH_SECRET` with observability on.
   - No `GEMINI_API_KEY` and no import DO binding: the provider gate has not run.
7. **Smoke.** After the release, the hosted smoke passed with two synthetic accounts,
   which then deleted themselves. Totals were unchanged afterwards. The 60-minute
   monitoring window ran from 13:03Z.

**Rollback.** Delete the Workers route. The held Pages build serves maintenance
immediately and writes stop. Restore D1 only under hold, with reconciliation of
writes made after the release.

**Not done, by decision.**
- `PRODUCTION_RELEASE_SHA` and `MAINTENANCE_DEPLOY_READY` stay unset; CI would
  redeploy Vite with the old pepper.
- The production maintenance cron is not enabled.
- The `kuuki-next-preview` Worker stays up, since it is the source of the teeDc
  bundle.

**Open follow-ups.**
- Point `kuuki.indi256.com` (and optionally `kuuki.pages.dev`) at the canonical origin.
- The two retained accounts reset their passwords through activation; no bulk mail
  was sent.
- Click-navigation latency.
- D1 transient retry.
- The import provider gate.
- Delete the dress/restore DB `c4f88d19` after acceptance.

## Opus 5.5 thread: gates passed

Hosted performance **passed and was owner-accepted** with a 60-minute post-cutover
monitoring window. Region TBS, mobile viewport, frozen `teeDcJw9kXHTh4B5__Rpz`: at
2 and 343 flights, 100 samples per document/click group and 100–200 saves per
frontend, with zero harness failures in the final runs. Next document readiness p95
is ~1.05 s against Vite's ~2.45 s; LCP p75 ~0.95 s against ~2.05 s; CLS 0; INP p75
16 ms on both; save p95 ~1.9–2.0 s on both; no MapLibre or corpus requests. Accepted
follow-up: Next click navigation readiness p95 is ~1.2 s against Vite's ~50 ms. A
diagnostic D1 wrapper classified the earlier handled 500s as transient
`Network connection lost` errors in the shared API (no retry; same for both
frontends), at about 1 per 1,000 sampled invocations. That is also an accepted
follow-up. Kysely `sqlite_master` introspection is denied by D1 (SQLITE_AUTH) and
caught; it is benign noise. Workers analytics: 0 errors, no exceeded statuses, success
CPU p99 ~33 ms. Memory is observable only through limit statuses. Temporary
perf/diagnostic Workers are deleted. Private `perf-gate-proof.json` and
`perf-acceptance.json` hold the evidence.

The custom-domain routing gate **passed** on the first-level host
`kuuki-routing-stage.marchstudio.uk`. Universal SSL does not cover the second-level name
proposed earlier. A proxied CNAME plus an exact Workers route to the held frozen
Worker served Next documents, maintenance 503s, assets, retirement `sw.js` and
browser RSC; deleting the route restored the prior behaviour immediately. The test
Worker, DNS records and route are removed. The local teeDc build verifies against the
CI artifact manifest. The operator Worker for the targeted reset passed a local
rehearsal against the read-only production export: reset OK, idempotent rerun, repair
ready, 69 flights preserved.

## Opus 5.5 thread transition

The user requested continuing in a fresh Opus 5.5 thread. Stop new work in this
thread after this checkpoint. Production D1, application secrets, deployment and
canonical routing remain unchanged; only the historical Pages Access hold is
installed. No Supabase source fence is applied and no production Next Worker exists.

Hosted performance is **not passed**. The first isolated 2-flight run stopped at
210 owned-data navigation samples (53 Overview/53 Dashboard/52 Journal/52 Flights),
with one Vite 5xx subresponse and a later Journal navigation timeout. Provisional
p95 values improve against Vite, but failures block acceptance. LCP/CLS collected;
INP missing. A maplibre request observed on Overview needs exact-path/lazy-loading
triage. Large-history and 100 saves per frontend/stratum remain unfinished. The
fixture uses only synthetic D1 `8e89bffa-a09d-47b7-82c5-9646c0bec341`; no real mail
or parsing credentials are bound. Workers Paid was confirmed and frozen candidate
startup was 111 ms. Preserve failure evidence and complete the hosted monitoring
gates; the proposed 20% p95 budget and observation window are not owner-accepted.

Custom-domain canary routing gate is untested. Its task stopped before creating
any Worker/DNS/route. The proposed isolated test host is
`next-routing-stage.kuuki.marchstudio.uk`: first check that it is absent, then prove
a proxied Pages-origin CNAME plus exact Workers route to the frozen held candidate,
or use the supported custom-domain alternative. Preserve unrelated zone/mail DNS.

Prepared, unapplied private production hold assets/config are in
`/tmp/kuuki-release-20261006/production-held-vite-assets` and `production-hold/`.
They reuse the frozen Pages Worker/Vite assets with the frozen Next retirement
`sw.js` and explicit no-store, serving Vite during retirement. Generated
`production-worker-secrets.json` is private and **not uploaded**. Source hold
runner is ignored `.scratch/next-release/source-query.py`; it asserts exactly one
read_only payload substitution, uses project-bound OAuth, and fails on non-2xx or
DO errors. Reviewed DO-only `source-hold-negative.sql` has no unconditional success
SELECT; require exact 17 ALWAYS-trigger readback and successful 37 rejection probes.

Production sequence still requires full writer hold, a new source capture and
conflict read, hosted restoration of the held production export and Time Travel
bookmark, semantic baseline registration without 0001 replay, migrations 0002–0007,
targeted reset/replacement, reviewed remapped import, all-28 publication and
validation, held same-candidate routing/deployment, smoke and controlled reopening.
Keep the Supabase fence after D1 reopens while legacy clients can still write.
No additional approval is needed for the accepted pepper/reset/mapping decisions.

Performance checkpoint cleanup is complete: generated account deleted and temporary
`kuuki-perf-gate-20261006` Worker deleted (URL 404); the 343-flight account was never
created. No benchmark writer remains active. Read the private
`/tmp/kuuki-release-20261006/perf-gate/HANDOFF.md` and ignored
`.scratch/next-release/perf-gate.mjs`/`.toml` before resuming. CPU/memory usage,
INP, installed alerts and acceptance thresholds remain unproved. Both old-thread
subagents are finished; the new thread owns all subsequent work.
