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
release forward. Required preservation gates still apply. Production data,
credentials, routing and deployments have not been changed. No real mail or
provider calls were made; retain their separate recipient/provider gates.

Three input requests remain pending:

1. A fresh legacy export or authenticated Supabase access. This workspace has no
   Supabase CLI, service credential, database connection or completed CLI login.
   `db/_snapshot` is rehearsal evidence, not an admitted final source.
2. The retained Pages secret values or their storage location. Cloudflare exposes
   their names but redacts values. Preserve `AUTH_SECRET`; do not rotate it or
   infer that the local `.dev.vars` pepper matches production. Next also needs
   Gemini and activation-mail credentials. No existing pepper was changed.
3. Identity mapping: the rehearsal source and live production share one email
   and username across different IDs, and 64 differing flight rows share IDs.
   Proposed decision: retain the current D1 account/profile/password, attach its
   historical records to that ID, and allocate fresh IDs for conflicting source
   flights. Do not apply before the user resolves this decision. Source freshness
   must pass and conflicts must be re-read under the production writer hold.

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
Pre-lifecycle bundle CRUD/bulk/edit/sync/cron compatibility is still pending.

Next preview is deployed at
`https://kuuki-next-preview.indi256s.workers.dev`, bound to the preview D1 above,
with `PAGES_ORIGIN` set to that URL by CLI override and `MAINTENANCE_MODE=true`.
Initial deployment version: `cdd9fd21-791e-4a18-b336-27967eaeb7c6`; adding the
new preview-only `BETTER_AUTH_SECRET` subsequently created another version.
Read back the current version before release. The existing Pages secrets were
not retrievable and were not copied. Public entry/sign-in return 200; private
Overview and APIs return held 503 with no-store and Retry-After. BUILD_ID is
served. Authenticated journeys, legacy-cookie compatibility, activation delivery,
full hosted smoke and cron proof remain pending. No Next production Worker was
deployed and no custom domain was moved.

Read-only baseline review compared production with 0001: same 17 application
tables and 35 named objects; column definitions/defaults/PK/FK/index metadata and
checks match. Differences are SQL whitespace and advanced-stats column order.
This is not final schema admission or permission to rerun 0001. Ledger baseline,
production backup/hosted restore and all-writer hold remain pending.

The preliminary snapshot conflict report found 26 source users/343 source flights,
3 target users/69 target flights, one email and username conflict, no user-ID
conflicts, and 64 differing flight-ID conflicts. After the proposed identity map,
there were zero matching date/origin/destination candidates. This is not a fresh
source or final under-hold deduplication decision.

## Private evidence and next action

Private evidence is retained in
`~/Library/Application Support/Kuuki/next-release-20261006` (0700 directory,
0600 files). It includes preview exports, full restoration and preservation
comparisons, schema inventories, A1 code/output, deployment logs, new preview
Better Auth secret and the private conflict report. Temporary working copies are
in `/tmp/kuuki-release-20261006`; the read-only conflict helper is ignored at
`.scratch/legacy-cleanup/source-target-conflicts.ts`. Do not publish these files.

Next: resolve the pending source/secret/mapping inputs; finish staging auth and
compatibility gates. Then enumerate and hold every production writer (including
immutable Pages deployment URLs), re-read source/target conflicts, export and
prove hosted restoration, baseline the ledger without running 0001, apply admitted
additive migrations, transfer/derive/validate reviewed data, deploy the same
candidate and only then release hold. Do not set release variables or enable
cron before their gates pass. Follow the
[audit release runbook](../runbooks/audit-remediation-release.md),
[lifecycle runbook](../runbooks/lifecycle-release.md) and
[Next candidate contract](../runbooks/2026-10-04-next-release-candidate.md).
