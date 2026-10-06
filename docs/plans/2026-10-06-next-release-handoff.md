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
created a test session and successful sign-out revoked it. No real mail or
provider calls were made; retain their separate recipient/provider gates.

Production pepper compatibility remains the pending credential gate:

1. The private `production.env` now contains AUTH_SECRET, BETTER_AUTH_SECRET,
   GEMINI_API_KEY and ACTIVATION_MAIL_AUTH_TOKEN. Better Auth was generated locally;
   none of these production values has been deployed. Presence does not establish
   provider/mail permission or delivery acceptance.
2. The user states AUTH_SECRET was copied from original production storage, but it
   does not verify the current production atlas test credential. The hash format
   is supported and the file has one unquoted AUTH_SECRET entry without escaping
   or inline comments. The same fixture successfully signed in against the live
   production app (HTTP 200), then signed out (HTTP 200). This establishes that the
   supplied value differs from the pepper currently used by production. Evidence:
   private `local-pepper-verification.json` and `live-pepper-fixture-check.json`.
   Obtain the retained Cloudflare Pages **kuuki production environment** AUTH_SECRET
   from its original store; Cloudflare API/CLI redact stored secret values. Do not
   rotate it while preserving the other two accounts' credentials.

Identity mapping: the verified fresh source and live production share one email
   and username across different IDs, and 64 differing flight rows share IDs.
   The user said the current production account need not be kept. Further read-only
   inspection found that the conflicting account owns zero flights; the other two
   production accounts own all 69 flights and both have personal password hashes.
   The user explicitly selected “Replace only conflicting account.” Preserve the
   other two accounts, all 69 flights and the original production pepper. Replace
   the conflicting account after backup/restore proof, retain the historical user's
   ID, and remap the 64 incoming flight-ID collisions. This authorizes no wholesale
   production reset or pepper rotation. New auth secrets cannot replace the existing
   production password pepper while those other credentials remain.
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

Next: correct and verify the retained production AUTH_SECRET; finish staging auth and
compatibility gates. Then enumerate and hold every production writer (including
immutable Pages deployment URLs), re-read source/target conflicts, export and
prove hosted restoration, baseline the ledger without running 0001, apply admitted
additive migrations, transfer/derive/validate reviewed data, deploy the same
candidate and only then release hold. Do not set release variables or enable
cron before their gates pass. Follow the
[audit release runbook](../runbooks/audit-remediation-release.md),
[lifecycle runbook](../runbooks/lifecycle-release.md) and
[Next candidate contract](../runbooks/2026-10-04-next-release-candidate.md).
