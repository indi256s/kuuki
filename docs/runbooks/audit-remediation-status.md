# Audit remediation execution — 2026-10-03

Remediation is implemented on `audit-remediation-2026-10-03`, based on `bc897858e7a5b5670a03ba461e3d5d356be100a0`, and deployed to isolated staging. Production cutover remains pending. The original requested plan is preserved unchanged; this document records its execution.

The user authorized completion with subagents, snapshot rehearsal with freshness verification before production, Cloudflare Email Sending from `accounts@marchstudio.uk`, a test recipient, and moving Kuuki to `kuuki.marchstudio.uk` while keeping March Studio at the apex. Cloud resource setup and staging checks used authenticated `cf`; deployment retained the existing Wrangler project. Production data and the existing auth pepper were preserved.

| Wave | Accepted work | Remaining release evidence |
| --- | --- | --- |
| W1 | CI verification and release guards; distinct deployed preview D1/KV/auth secret; Pages automatic Git deploy disabled; hosted fixture isolation | Final committed CI deployment; branch protection waived by the user |
| W2 | Cookie/CSRF and account coordination; one-use activation; atomic limits; reviewed sender; isolated activation host and hosted activation/sign-in proof | User sign-in confirmation after return-link repair; production sender credential |
| W3 | Safe explicit-target import/validation; raw visit preservation; atomic CRUD/replay; recoverable derived state; hosted export/restore | Fresh Supabase source admission, target reread, schema baseline/additive migration, production preservation and maintenance proof |
| W4 | Structured text/image/PDF integration; bounded errors; durable retries; cache refresh; export errors; dependency review | Real-ticket corpus quality/cost/retention evaluation; remaining hosted browser upgrade checks |
| W5 | Isolated staging deployed; synthetic runtime, provider, activation and restore checks | Production hold, backup/restore, migration and same-commit release |

Workers and independent reviewers used `gpt-6-sol` / `medium`. Reviews covered auth, frontend, data, migration, API, OCR, CI and dependencies. Release follow-up repaired the Cloudflare REST sender payload, initially held the scheduled Worker, fixed Pages' `.html` redirect to the clean activation URL, and replaced workerd's unsupported redirect-error mode with manual redirect rejection. Each repair was checked independently. Investigation after the emailed activation test found a return-link bug: the activation alias dropped the sign-in mode. The repaired redirect preserves only that mode and explicitly clears fragments. A separate React Doctor run reported six baseline diagnostics; confirmed timeout/render/poll cleanup issues were repaired, and its CI gate now compares new issues against the base revision as documented by the tool. Existing baseline warnings are not claimed as resolved.

## Evidence

| Check | Result and scope |
| --- | --- |
| Local installation/types/build/lint | Frozen install; root/web/API/scripts/maintenance types; web/API/maintenance builds; actionlint; lint with 23 warnings and zero errors |
| Local regression suites | Latest API/migration: 9 files, 59 tests; web: 14 files, 192 tests plus one focused polling regression; return-link follow-up: 12 auth tests |
| Compiled local runtime | workerd/WebCrypto/D1 auth, cookies, CSRF, revocation, CRUD/replay, and text/JPEG/PDF with fake provider |
| Snapshot rehearsal | Repeated import/derive/validate preserved 26 users, 343 flights, 171 archived visits, 37 claims and 15 ground visits; all users ready, zero foreign key violations |
| Local restore | 25 tables matched the SQLite export exactly; integrity passed; foreign key check empty |
| Hosted runtime | 19 synthetic checks passed: signup/sign-in/sign-out, identity, CSRF, A/B ownership, CRUD, idempotent replay, derived publication and empty lists |
| Hosted isolation | Deployed preview D1/KV differ from production. All 18 production tables matched the pre-smoke read exactly; the comparison wrote zero rows |
| Hosted restore | Cloudflare export restored to a separate unbound D1; 24 application tables, 48 schema objects and sequence rows matched exactly; foreign key checks empty. D1 rejected `PRAGMA integrity_check` with `SQLITE_AUTH`; no integrity-check success is claimed |
| Hosted activation | Clean `/activate` and script served with isolated headers; SPA/service-worker/API discovery paths redirect. A synthetic completion race returned 200/400, revoked prior sessions, consumed the token, preserved profile/flight rows and allowed personal-password sign-in with the original ID |
| Actual provider | Gemini key accepted; `gemini-3.5-flash-lite` available. Three synthetic text/JPEG/PDF calls passed in 2.2–2.5 seconds. Missing years stayed blank for review. Provider usage/cost was not exposed by the endpoint |
| Mail setup | Sending DNS verified, email previews disabled, suppression reporting retained; one plain setup test acknowledged as queued. Initial activation attempt removed its token after workerd rejected the redirect mode; the repaired retry retained its issued token. The user confirmed receipt. Read-only staging inspection found the account active and its token consumed, but the user reported activation failure; sign-in confirmation remains open. The return link dropped the sign-in mode and has been repaired |
| Hosted maintenance | Actual five-minute schedule repaired a synthetic pending user from revision 1/0 to 1/1 and recorded success; preview Worker was immediately returned to hold, with its isolated D1 binding verified |

Local browser evidence covers two-tab identity/request draining, lost-response save recovery without duplication, immediate dependent queries, unknown-year review and export failure without CSV/quota loss. It used synthetic accounts and fake providers. Hosted browser upgrade/recovery remains open. Web Locks are required for cross-tab coordination; unsupported browsers have only per-tab coordination.

The rehearsal hashes 13 consumed files as `ec7483f6c79783c83dd9c63d9feed26f7707bcd3e3f594aef9dabfd2072249bc`; the application schema hash is `c203ddd8bd1deff18fe3203fbdc08e22a6340d4052a9c4373c07b252efd3cdd6`. All 171 visits retain raw JSON; 140 archived rows contribute to the 171-key union. References include 570 airports. Only source flight IDs 495 and 496 receive the reviewed `A380 → A388` correction. These are rehearsal results, not permanent counts or proof of source freshness.

Remaining dependency findings are assessed in [the applicability report](dependency-applicability-2026-10-03.md); no zero-vulnerability claim is made.

## Cloud configuration and release gates

Production remains deployment `22e26a40-ec0b-42b3-a847-8f10b6a0c6f9` at the base revision. Its D1 is `2a8e3895-6a98-4473-8d7b-a43ca0c0026f`, and KV is `15bad9e7dfa44f8382883513c8bff292`. No remediation production code or legacy-data migration has been deployed.

Preview uses D1 `80e0c789-c1ab-4aa5-a6fe-e65c6e6cb74c`, KV `015fa195daf34090b3895197e291a814` and a distinct auth secret at `https://staging.kuuki.pages.dev`. The activation hostname `https://activate-staging.kuuki.marchstudio.uk` has a proxied CNAME to the staging branch alias and serves only the activation entry/script/completion API. The restore D1 `fb69279d-8e83-4214-8cba-71900393df1e` is unbound. Staging deployments so far identify the base plus dirty patch; final CI must deploy the committed release identity.

Pages automatic Git deployment is disabled for production and preview. Repository variables `PREVIEW_ISOLATION_VERIFIED` and `GIT_DEPLOY_DISABLED` are true after actual readback and isolation proof. `PRODUCTION_RELEASE_SHA` remains unset, so those preparation flags cannot enable production release. The scheduled Worker initially holds writes; its deployment has a separate readiness gate.

GitHub rejected branch protection for the private repository; the user explicitly waived that gate. CI deployment gates remain required, with no visibility or billing change. Hosted negative run `37145678698` failed only its intentional API assertion and skipped all three deployment jobs. That temporary assertion was removed after the proof. Supabase initialization was attempted in an isolated workspace, but browser login was not completed, so project linking and fresh export capture have not occurred. The user supplied project `cwmotwkvpdkfrtjxmoce`; no Supabase data/schema was changed. The redacted 30–50-ticket corpus is still missing.

Follow [the release runbook](audit-remediation-release.md). Production still requires verified source freshness, a complete write hold including old deployment URLs, fresh target/conflict/schema admission, backup restoration, additive migrations and exact preservation checks, activation delivery, remaining runtime/browser gates, and a selected release SHA. Preserve the current account and pepper. Never reuse destructive legacy scripts or send activation mail to the legacy cohort without separate authorization.

Kuuki's authorized custom-domain move is live at `kuuki.marchstudio.uk`; March Studio and its original mail DNS remain at the apex. Earlier temporary artifacts under `/tmp/plan-execution/kuuki-20261003/` were lost during a session interruption. The preceding evidence records describe completed checks, but their raw files are no longer retained. New private evidence is stored outside Git under `~/Library/Application Support/Kuuki/audit-remediation-20261003`, with directory mode 0700 and files mode 0600. Recreate required release artifacts before production; cloud secrets and deployed resources persist.
