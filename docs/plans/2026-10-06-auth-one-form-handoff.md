# One-form authentication handoff — 6 October 2026

Delivery branch: published `main` in `/Users/indi256/Documents/kuuki/kuuki`.
Integration branch: `feat/auth-one-form-resume`.
Verification checkout: `/Users/indi256/Documents/kuuki/wt/auth-one-form-integration`.
Base: `9c550be`; specification: [auth-one-form](../../.scratch/auth-one-form/spec.md).

The Vite retirement in session `01a11217-6cc2-7da1-853c-926b7bbdc1e1` was committed as `30ad0bd`. This feature was implemented in its own worktree to preserve that work, then both branches were combined and verified before delivery to local `main`. The three pending Gemini skill-symlink deletions were preserved in `70d5fdc`.

## Implemented scope

Tickets 01–10 are integrated: Continue and generic get-back-in endpoints, five accents, one card and text wordmark, in-place creation and recovery, paused plane field, Horizon, single-password reset, and Next-owned isolated activation assets. Ticket 11 reconciles DESIGN, the domain glossary and the release runbook. Ticket 12 addresses the thread Insights: canonical credential errors, honest session-creation failures, background recovery lookup proof and reduced-motion sheet specificity.

The resumed implementation and independent reviews use `gpt-6.1-sol`. Review fixes reject malformed successful auth replies before identity cleanup, preserve inputs, follow recovery heading focus, and block entering recovery while Continue is pending. Reset language changes preserve the token and password in mounted memory while updating the persisted preference, form and skip-link language. An old sweep branch's Horizon regression was found and restored before integration. Final code and documentation reviews have no unresolved findings.

Implementation tips: 05 `a272603`, 06 `d79e47e`, 08 `937fc37` plus `8217fbd`, 09 `61bb28d` plus `9fcae50` and `0f16a68`, 10 `c50d66e`, 12 `7e39f0b`. Integration merge resolutions retain both auth test additions and the Horizon/create reduced-motion rules. The obsolete EmailLinkForm is removed after its last callers and tests moved to the card.

## Auth verification before Vite retirement

Integrated API types and all 544 API tests pass. Final Next types, lint and all 1,060 unit tests pass; scripts types and the legacy rollback build pass. Worker types, the production build and both Worker smokes pass. All 143 navigation journeys pass on port 8870 (2.7 minutes). The first run passed 133 tests and exposed ten test defects: application alerts accidentally included Next's route announcer, a color comparison sampled an unfinished transition, and deterministic plane sampling overrode the CSS playback later checked for pausing. Independent review approved the repairs, with feature assertions preserved; no production defect was found in those failures. Route-inventory drift and diff whitespace checks are clean. Raw logs use `/tmp/kuuki-auth-integration-*`, `/tmp/kuuki-auth-*-build.log` and `/tmp/kuuki-auth-*-smoke.log`; the first browser run is retained as `/tmp/kuuki-auth-integration-navigation-first.log`.

The reset browser fixture seeds a dedicated synthetic account and one hashed, expiring token. Its journey checks successful reset, old-session revocation, token reuse rejection, guest completion and explicit sign-in with the new password. No email provider, remote database or production account is used. A real-D1 refused-session regression proves operational failures return 503 rather than wrong-password 401 on both sign-in paths; account creation retains its SIGN_IN_REQUIRED response.

The final commit hook caught a DOM/Worker `Element.append` type collision in the test-only color probe. Using `appendChild` resolves it; Next types and all six affected recovery browser journeys pass after that one-line correction (`/tmp/kuuki-auth-integration-recovery-final.log`). Production code and the verified build are unchanged by the browser-test repairs.

## Combined integration verification

The merge preserves auth tip `d93117a` and cleanup tip `70d5fdc` (including `30ad0bd`). Activation HTML/JS retain the reviewed auth implementation. The build retains activation token compilation, removes the Vite build/copy, and reads retirement scripts from `apps/next/transition`. Independent 6.1 Sol code, build/dependency and documentation audits found no unresolved integration findings. Current APP_FLOW, SITEMAP and DESIGN descriptions now match the one-card flow and Overview/onboarding entry gate. The historical migration audit remains intact, with a [combined resolution note](../audits/2026-10-06-post-migration-audit.md#combined-integration-resolution).

All combined checks pass: 544 API tests, 1,075 Next unit tests, 145 browser journeys, workspace/API/scripts/maintenance/import/Worker types, lint, preview configuration and dependency-patch checks, frozen lockfile installation, fresh Next build, composed/boundary Worker smokes and standalone API/SDK smoke. Logs are `/tmp/kuuki-main-*`. The build emits 99 assets totaling 9,030,966 bytes; no legacy asset directory remains. Verification used the integration checkout and port 8870; rebuild from current source before using any older generated output in another checkout.

The fresh production dependency audit reports zero advisories. The full graph still reports the upstream high `braces` advisory; the registered local recursion-bound patch passes its regression check, including with a 128 KiB Node stack. The version-based audit remains nonzero; this advisory is not suppressed.

Preservation refs are `backup/auth-one-form-before-main-20261006` and `backup/vite-retirement-before-main-20261006`. Worktrees and private cleanup evidence remain. Generated Vite leftovers were moved out of this worktree to `/Users/indi256/Documents/kuuki/auth-one-form-notes/retired-vite-generated-artifacts-20261006`; no source, credentials or user data were deleted. The release below pushed and deployed this merge. No schema, account or flight-data changes were made; guest health checks incremented auth rate-limit counters.

## Deliberate limits and copy review

- Hosted email delivery and token completion remain unverified. This release checked the activation page and guest session without sending mail or changing production accounts.
- Activation stays on its isolated origin and uses system fonts under the existing restrictive CSP. Native help and paused plane motion are now present. Its Horizon artwork is a small isolated copy.
- A token-only activation visit cannot populate the hidden username from email metadata. Reset uses a valid, user-typed same-origin session hint when available. No token-to-email endpoint or email/token/password query parameter was introduced. Story 44's email association remains incomplete for token-only activation; safe email prefill after completion is conditional. This carried requirement is tracked in [ticket 13](../../.scratch/auth-one-form/issues/13-token-only-username.md).
- Exact Paper values came from the prior JSX/style extraction in `/Users/indi256/Documents/kuuki/auth-one-form-notes/design/`. Spec/build notes win the tracking conflict (−0.04em). The auth controls are language, theme and help; the proposed accent-picker redesign remains separate. The Password-label gap is 24px to keep its 44px recovery hit area clear of the input. The mobile band shrinks from 302px toward 160px on short screens. The Check-inbox footer absent from the state contract is omitted.
- Plane checks establish layout, motion vector, glyph rotation, pausing, reduced motion and the wordmark-clearance mask; they do not establish a pixel-level visual clearance audit.
- New Russian copy is implemented but remains a draft for product review. Read the paired strings in [form-step](../../apps/next/src/client/auth-card/form-step.tsx), [get-back-in-step](../../apps/next/src/client/auth-card/get-back-in-step.tsx), [reset-password-form](../../apps/next/src/client/account/reset-password-form.tsx), [corner-controls](../../apps/next/src/client/auth-card/corner-controls.tsx), and [activation markup](../../apps/next/activation/activate.html). The saved-password notice is «Пароль сохранён. Теперь войдите с ним.». Help content also remains subject to product wording review.

## Next action

Local implementation, combined audits and verification are complete for tickets 01–12; ticket 13 retains the token-only email association decision. Both implementations are preserved in published `main` and their integration/backup refs. The production release below is complete; ticket 13 and hosted email/token acceptance remain follow-up work.

## Production release — 6 October 2026

The user authorized publishing main and deploying this candidate. Source candidate `a39e7c1956ba49dbdb3d0bc87d2deece6ef685b8` is pushed to `origin/main`; [CI/CD run 37509999412](https://github.com/indi256s/kuuki/actions/runs/37509999412) passed all five jobs. `pnpm test` runs API and Next units; CI builds and tests Next, with no Vite application build or server. Vitest still has Vite as a test-tool dependency.

Read-only production and preview migration ledgers contain all seven local migration files, with zero rows written. Production's initial D1 query failed transiently; CLI retry and the Cloudflare API both confirmed the same checked-in/live database binding and complete ledger. All required production secret names are present on both Workers. No schema change, account write, secret rotation, maintenance deployment or hosted Pages change was made.

A fresh root-checkout build passed after stale generated `.next/dev/types` was moved to `/tmp/kuuki-release-stale-dev-types-20261006` and Next types regenerated. It emits 99 assets, 9,030,966 asset bytes and 71 API routes. The initial preview command failed before upload because OpenNext split the message argument; `--no-autoconfig` deploys the existing configured Worker directly, retaining strict configuration checks.

| Worker | Released version | Previous version |
| --- | --- | --- |
| `kuuki-next-preview` | `75162a04-70db-4928-b5a2-331e4a10a84d` | — |
| `kuuki-next` | `b012784a-8519-4c3f-94c2-2749afc346cb` | `4bb5ff0a-d6f6-4c4b-9201-b483fcf3cf56` |
| `kuuki-activation` | `030253b0-e3db-4079-adba-7d51c3889e2a` | `50ee6c9f-1e0d-4864-95e9-44b9f20b3f82` |

Preview and production `/` return 200 HTML; each `/api/auth/get-session` returns 200 with `null`. The isolated production `/activate` returns 200 HTML. The connected production error watch ran from at least 18:28:26 to 18:33:37 UTC (over five minutes), with zero error events and no stderr. Release logs are `/tmp/kuuki-release-*`. Rollback uses the previous versions above and leaves D1 unchanged.
