# Audit remediation release

This runbook prepares the Cloudflare audit-remediation cutover. Local implementation does not authorize these release changes, production data writes, messages to users, or paid OCR calls. During cutover, keep the app on hold until the gates below have actual evidence. The separately authorized domain move uses the existing production deployment and does not satisfy the remediation release gates.

## Observed target and proposed changes

Read-only inspection on 2026-10-03 found:

| Resource | Observed value |
|---|---|
| Cloudflare account | `5cadcff0282e54f3ff1d7062d4dbb97a` |
| Existing Pages project | `kuuki`, production branch `main` |
| Production D1 | `2a8e3895-6a98-4473-8d7b-a43ca0c0026f` |
| Production `IMPORT_JOBS` KV | `15bad9e7dfa44f8382883513c8bff292` |
| Preview D1 | `80e0c789-c1ab-4aa5-a6fe-e65c6e6cb74c` (`kuuki-preview`) |
| Preview `IMPORT_JOBS` KV | `015fa195daf34090b3895197e291a814` (`kuuki-import-preview`) |
| Pages Git deployment | Disabled for production and preview; release readiness remains separately gated |
| Production data | One active user/profile/session, no flights/visits/claims/ground visits |
| Migration ledger | Empty; existing schema must be baselined, not initialized again |

Re-read these facts before release mutations. The inspected account had no ID, normalized-email, or username collision with the rehearsal snapshot. That observation does not replace the comparison after write hold. The local `cf` CLI is authenticated and was used for release resource setup. The authorized custom-domain move attached `kuuki.marchstudio.uk` to the existing production deployment and updated production `PAGES_ORIGIN` configuration for future deployments. March Studio remains at `marchstudio.uk`; existing mail DNS was preserved. Obtain fresh data, schema and release-binding evidence before using earlier observations for release.

The authorized staging setup created separate D1/KV resources, set a distinct staging auth secret, and disabled automatic Pages Git deployments. Actual deployed preview bindings were read back before the hosted synthetic smoke. Prove isolation with the preview write and a read-only production comparison before setting `PREVIEW_ISOLATION_VERIFIED=true`. Set `GIT_DEPLOY_DISABLED=true` only after reading back the disabled Git path. The user waived branch protection after GitHub rejected it for this private repository. Keep CI verification and explicit deployment selection; no visibility or billing change is authorized. Leave `PRODUCTION_RELEASE_SHA` unset until source freshness, restore, schema, data, activation and release identity gates are accepted. Then select the exact reviewed main-branch SHA; future unrelated commits cannot deploy through that selection.

Activation needs a fresh dedicated HTTPS hostname on this same Pages project. Record its exact origin, with no trailing slash, as `ACTIVATION_ORIGIN`. Do not reuse a hostname that has served the SPA/service worker. The alias serves only `/activate` (and the compatible `/activate.html` redirect), `/activate.js`, and the completion API. Pages redirects `.html` assets to extensionless URLs, so emailed links use `/activate`. The canonical origin remains `PAGES_ORIGIN`. Invalid activation-origin configuration fails closed and can make the main application unavailable, so validate it before deployment.

Staging uses `https://staging.kuuki.pages.dev` and the fresh activation hostname `https://activate-staging.kuuki.marchstudio.uk`. Its proxied CNAME must target `staging.kuuki.pages.dev` to route to preview; a CNAME to `kuuki.pages.dev` or an unproxied record can serve production. Check live routing and activation-only responses before issuing a link. [Cloudflare branch domains](https://developers.cloudflare.com/pages/how-to/custom-branch-aliases/)

## Activation delivery

The user selected Cloudflare Email Service's Email Sending for activation delivery. Use the [REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/) from the existing Pages Functions. The adapter sends text and HTML content to a fixed Cloudflare API endpoint, with a ten-second deadline and no automatic retry. It accepts only explicit delivery or queue acknowledgement for the intended recipient, with no provider errors or permanent bounces. Queue acknowledgement is acceptance for delivery, not proof that the user received the message. Failed sends remove the newly issued token and retain the same public response for missing, active and migrated accounts.

| Setting | Value / handling |
| --- | --- |
| `ACTIVATION_MAIL_ACCOUNT_ID` | Account hosting the verified sending domain; 32 hexadecimal characters; non-secret |
| `ACTIVATION_MAIL_FROM` | `accounts@marchstudio.uk` after sending-domain verification; non-secret |
| `ACTIVATION_MAIL_AUTH_TOKEN` | Cloudflare API token with Email Sending: Edit permission for this account; server secret |
| `ACTIVATION_ORIGIN` | Fresh dedicated HTTPS activation hostname; independent from the email sending domain |

Cloudflare account inspection confirmed ownership of the active `marchstudio.uk` zone. The authorized setup verified Email Sending DNS, disabled email previews, retained suppressed-recipient reporting and existing apex Email Routing records, and configured a scoped preview send token. Cloudflare acknowledged one setup test to the user-approved recipient; inbox receipt and activation completion are separate evidence. Production needs its own scoped send credential. The obsolete generic `ACTIVATION_MAIL_ENDPOINT` setting is no longer used.

Before enabling real delivery:

1. Onboard `marchstudio.uk` under Compute → Email Service → Email Sending. Confirm the account's sending entitlement and SPF, DKIM, DMARC and bounce DNS records. Cloudflare uses `cf-bounce.marchstudio.uk` for sending MX/SPF and a separate sending DKIM selector, so preserve the existing apex MX/TXT records for Email Routing. Review any existing DMARC policy before changing it. [Domain setup](https://developers.cloudflare.com/email-service/configuration/domains/)
2. Disable **Enable email preview** for the sending domain. New domains enable it automatically and retain sent message content for about seven days; activation links contain bearer tokens. Leave **Drop suppressed recipients** off, and verify an intended-recipient acknowledgement in the application. [Domain settings](https://developers.cloudflare.com/email-service/configuration/domains/)
3. Store the send token as a server secret; use separate preview and production tokens. Do not include credentials, complete provider responses or activation links in release logs. Remove obsolete generic sender configuration during the approved configuration change.
4. Send only to an explicitly approved test recipient, verify inbox delivery and one-use activation, and record sanitized evidence. Sending to the legacy cohort requires separate authorization. Local tests continue to use fake fetch/sender implementations and do not send email.

Email Sending remains in public beta. Arbitrary recipients require Workers Paid; current pricing includes 3,000 outbound emails per account/month and charges $0.35 per 1,000 beyond that. Verified destination test addresses are free on any plan. Confirm the actual subscription before authorizing billing changes. [Pricing](https://developers.cloudflare.com/email-service/platform/pricing/)

## Source admission and preservation

Use gitignored `db/_snapshot` for rehearsal, as authorized by the user. The originally inspected export JSON file-set digest was `9b630306c3399a8011d6d4ceccdf02af40a4e0e53d8f911263af6658d88def1b`. The importer's manifest hashes its 13 consumed source files and records `ec7483f6c79783c83dd9c63d9feed26f7707bcd3e3f594aef9dabfd2072249bc`; these hashes cover different file sets. File modification dates do not establish export freshness. Before production, compare against a fresh Supabase capture, record capture/review dates and hashes, then review any changed manifest or conflict map. The snapshot is not admitted as the authoritative final legacy source until that verification passes.

The rehearsal source contains 26 users/profiles, 343 flights, 171 visits, 37 country claims, and 15 ground visits. Compute expected production counts from the source/target union, rather than asserting a permanent total of 26 or 27. Preserve independent current accounts and owned data. Matching email with different IDs is a conflict requiring an explicit mapping decision. The 6 October release decision retains two current accounts and all 69 flights, replaces only the conflicting zero-flight account, and remaps 64 incoming flight-ID collisions; re-read these facts under the writer hold.

All 171 source visits are retained with their original fields and source JSON. The current package's 562 airport references plus eight supplements produce 570 D1 reference rows. Completed flights derive 165 visit keys; six additional keys use legacy evidence, including unresolved MOW and five without a matching completed flight. Another 134 overlapping archive rows contain higher observed counts or wider dates and also contribute, for 140 contributing rows in this snapshot. Merge overlapping counts with `max`, dates with `min`/`max`; do not add counters or infer extra trips. Unknown GAT/POD/MOW coordinates are not invented. Compare each user's raw records and report derived differences before accepting the import; neither 171 current keys nor 140 contributors is a permanent invariant.

The eight supplemental references use the pinned public-domain [OurAirports dataset](https://ourairports.com/data/). Keep its revision/hash in the supplemental manifest. The only proposed raw flight correction is the explicit `A380 → A388` mapping for source IDs 495 and 496, with an exact two-row delta in this snapshot. A fresh source may require a revised map.

Historical users enter as `RESET_REQUIRED` and establish a personal password through a one-use mail token. Preserve IDs and earned badges. Never copy a shared local test password or run `reset-passwords.ts` against production. The original preservation requirement assumed a recoverable production pepper. On 6 October the user explicitly authorized a new `AUTH_SECRET` and targeted resets for the two retained accounts because that pepper could not be recovered. After writer hold, backup/restore and schema admission, reset only those two credentials and revoke their legacy/Better Auth sessions, activation tokens and stale password-reset verifications. Preserve their IDs, profiles and owned data. See the [current release handoff](../plans/2026-10-06-next-release-handoff.md) for this superseding decision and rehearsal evidence.

## Local rehearsal

Create a separate migrated local D1 fixture using `createLocalSchemaFixture` in `scripts/migration-target.ts`, with a synthetic database ID and an absolute temporary persistence directory. This path must be outside the application's `.wrangler` state. Then run:

```sh
pnpm exec tsx scripts/sb-to-d1.ts --target local --database-id local-synthetic-d1 --persist /absolute/private/temp/d1 --apply
pnpm exec tsx scripts/derive.ts --target local --database-id local-synthetic-d1 --persist /absolute/private/temp/d1 --apply
pnpm exec tsx scripts/validate.ts --target local --database-id local-synthetic-d1 --persist /absolute/private/temp/d1
```

These commands use the gitignored snapshot and do not access remote D1. Retain private artifacts outside the repository. The rehearsal passed raw-record preservation, foreign-key validation, all 26 users' derived publication, and a second import without conflicts. A local SQL export restored into a separate SQLite database also matched all table contents and passed integrity/FK checks. Hosted synthetic staging export/restore now matches 24 application tables, 48 schema objects and sequence rows, with zero foreign key violations. Production backup restoration is still required against the held target. Cloudflare rejects `PRAGMA integrity_check` through the D1 API; that check was not claimed as passed.

The local restore proof used `sqlite3 .dump` and compared all 25 tables, including SQLite sequence state. Keep numeric precision in the export: a preliminary Python `iterdump` round trip changed some reference coordinates by up to `2.84e-14` and did not pass exact comparison. Prove the actual Cloudflare export/restore path separately before production.

`scripts/remote-migration-proposal.ts` only reads an explicitly identified target. Its optional mode-0600 SQL output contains missing-row INSERTs after identity, foreign-key and preservation preflight; a private `.manifest.json` sidecar binds the account, database, schema, source, references and expected union counts. The manifest fingerprints actual projected reference rows separately from the pinned dataset provenance. It never authorizes or applies that SQL.

Schema admission compares the actual application's object inventory and unmodified SQL text against a freshly migrated local D1 fixture, excluding known D1 internal objects. Unexpected application objects always fail. Current production still needs separately approved baseline/additive migrations. Its historical advanced-stats column order may also require an operator-reviewed variant. Use a private `--schema-admission` JSON file only after reviewing columns, defaults, primary keys, foreign keys, unique indexes, indexes and checks. The admission must bind both target IDs, the observed application schema hash, the fresh fixture hash, `semanticReview: true`, all seven `reviewedDimensions`, and a `reviewedAt` within 24 hours. This file records a semantic review; it does not perform that review or admit missing schema. No production variant has yet been admitted.

After a separately approved transfer and derivation, use the explicit read-only remote validator:

```sh
pnpm exec tsx scripts/migration-remote-validate.ts --account-id ACCOUNT_ID --database-id DATABASE_ID --manifest /absolute/private/migration.sql.manifest.json --snapshot-dir /absolute/private/reviewed-source
```

Supply the same reviewed `--schema-admission` if needed. The validator compares raw source records, visit evidence and derived keys/dates/counts, publication readiness, foreign keys and auto-increment behavior. Its `sourceFreshnessVerified: false` output deliberately leaves source freshness to the separate capture/review gate. Hold, backup, baseline and migration approval remain separate gates. Remote proposal generation, validation and hosted restore have not passed against the final target.

## Cutover order

1. Freeze one reviewed patch identity and retain its tracked diff plus related untracked file contents. Record Node, pnpm, Wrangler, SDK versions, source manifest, target IDs, and eventual deployment SHA.
2. On isolated staging, restore a backup/export into a separate database and verify restoration. Run fresh schema, safe references, import, rerun/resume, evidence-aware derivation, exact raw preservation/FK validation, synthetic activation, CRUD, import errors, and maintenance. Use fake sender and provider unless real calls are separately authorized. Real legacy data on hosted staging requires a protected or anonymized copy approved for that environment.
3. Enumerate every production writer: canonical/custom domain, immutable deployment URLs, cron, CI, and administrative scripts. Deploy the accepted hold-compatible version with `MAINTENANCE_MODE=true`, restrict or remove old write entrypoints only within approved authority, and suspend background writers. A new middleware does not protect older deployment URLs. Prove rejection and zero writes at every entrypoint; otherwise stop.
4. After full hold, read production rows/conflict keys/schema again. Compare with the reviewed manifest. Stop on drift or a new collision. Save a SQL export, available Time Travel bookmark, deployment/configuration, and the approved credential/pepper transition evidence. Prove restore on another DB before touching production.
5. Prove semantic compatibility with `0001_init.sql` across tables, columns, indexes, foreign keys, unique constraints, and checks. The initial inspection found matching application schema with a different advanced-stats column order. Register the verified initial migration in the existing D1 migration ledger using the supported D1 SQL interface, with the reviewed migration name and ledger schema; do not run `0001_init.sql` again. Baseline registration is a separate approved operation from additive migrations and import.
6. Apply reviewed additive auth and recovery migrations. Seed missing references safely, then import, load all legacy evidence, derive, and validate under hold. Do not enable new CRUD or cron before evidence is loaded. Never execute the old seed DELETE preambles, global derived-table deletion, or oracle table replacement on the populated target. Stop on any unreviewed conflict, preservation failure, FK violation, or unexplained derived delta.
7. Deploy the same accepted application and maintenance worker with the actual isolated bindings. Deploy the maintenance Worker by hand, and only after additive schema and legacy evidence are loaded and validated; CI no longer deploys it, so `MAINTENANCE_DEPLOY_READY` has no effect. Keep its `MAINTENANCE_MODE=true` until repair and refresh are authorized. Validate production data read-only while hold is active. Pass the full functional smoke on staging before releasing hold.
8. Release hold only after preservation and deployment identity match. Immediately perform authorized production smoke with the existing account owner and approved verification account: activation/sign-in, ownership A/B, CSRF, active/inactive expiry, account switch, CRUD, pending recovery, import/provider failure, export, and cron. Use no other person's credentials. Return to hold on failure.
9. Remove confirmed unused `VITE_SUPABASE_*` cloud variables only after cutover. Retain Supabase migrations and historical handoffs until preservation is confirmed; evaluate old Supabase access separately. Do not delete legacy data automatically.

Backup and restore behavior must follow the current [D1 Time Travel documentation](https://developers.cloudflare.com/d1/reference/time-travel/). A deployment rollback does not roll back D1.

## Recovery and monitoring

If migration/import fails while hold remains active, preserve the failure evidence and resume the idempotent operation only after its cause is fixed. Do not replace unrelated rows to make a count pass. Missing migrations, unknown conflicts, and credentials changes are stop conditions.

Canonical mutations and revision markers commit together. A late derived failure confirms the saved flight with `derived_state: pending`; retry its original `Idempotency-Key`, rather than creating a new action. Keys remain at least seven days, and replay of a deleted flight returns a deletion error. Maintenance retries pending users and atomically publishes only the current revision.

After reopening writes, prefer a compatible deployment rollback plus forward repair. Whole-database restore first requires hold, preservation of post-release writes, and an agreed reconciliation. Never erase new writes as an automatic rollback.

Review dirty-marker age, sanitized auth/import failures, and maintenance last success during the agreed observation window. A cron success older than 15 minutes needs investigation. Credentials, mail tokens, names, booking references, document bodies, and complete provider errors must not appear in operator logs.

Browser account coordination uses Web Locks plus peer notification. Complete a real two-tab test on supported browsers. Browsers lacking Web Locks retain only per-tab coordination; accept that compatibility limitation explicitly or close it before supporting those clients. Reload old application tabs during release so all current tabs participate.

The local Chromium fixture passed two-tab request draining and identity reconciliation, lost-response save recovery across reload with the original key/payload and no duplicate, visible dashboard/passport refresh, unknown-year confirmation, and export failure without a CSV or consumed quota. Repeat the relevant scenarios on hosted staging. A stale synthetic service-worker cache referenced a removed entry bundle after the local rebuild; clearing that fixture's cache restored it. Include old-client/service-worker upgrade behavior in the hosted release check and provide a force-reload/cache-reset recovery procedure.

OCR fake-provider tests prove contracts and errors. They do not establish model availability, accuracy, latency, or cost. Real release evidence requires the authorized 30–50-ticket redacted corpus comparison, usage/latency measurements, and data-use/retention settings. [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) is the preliminary supported default, not a quality result. Unknown years must remain review fields and cannot be saved as guessed facts.
