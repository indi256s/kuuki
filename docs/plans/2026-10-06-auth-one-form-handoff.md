# One-form authentication handoff — 6 October 2026

Owning branch: `feat/auth-one-form-resume`.
Owning checkout: `/Users/indi256/Documents/kuuki/wt/auth-one-form-integration`.
Base: `9c550be`; specification: [auth-one-form](../../.scratch/auth-one-form/spec.md).

The original checkout is concurrently removing the old Vite stack in session `01a11217-6cc2-7da1-853c-926b7bbdc1e1`. This feature was integrated in its own worktree to preserve that work. Do not reset or merge into the original checkout without first reconciling its current changes.

## Implemented scope

Tickets 01–10 are integrated: Continue and generic get-back-in endpoints, five accents, one card and text wordmark, in-place creation and recovery, paused plane field, Horizon, single-password reset, and Next-owned isolated activation assets. Ticket 11 reconciles DESIGN, the domain glossary and the release runbook. Ticket 12 addresses the thread Insights: canonical credential errors, honest session-creation failures, background recovery lookup proof and reduced-motion sheet specificity.

The resumed implementation and independent reviews use `gpt-6.1-sol`. Review fixes reject malformed successful auth replies before identity cleanup, preserve inputs, follow recovery heading focus, and block entering recovery while Continue is pending. Reset language changes preserve the token and password in mounted memory while updating the persisted preference, form and skip-link language. An old sweep branch's Horizon regression was found and restored before integration. Final code and documentation reviews have no unresolved findings.

Implementation tips: 05 `a272603`, 06 `d79e47e`, 08 `937fc37` plus `8217fbd`, 09 `61bb28d` plus `9fcae50` and `0f16a68`, 10 `c50d66e`, 12 `7e39f0b`. Integration merge resolutions retain both auth test additions and the Horizon/create reduced-motion rules. The obsolete EmailLinkForm is removed after its last callers and tests moved to the card.

## Verification

Integrated API types and all 544 API tests pass. Final Next types, lint and all 1,060 unit tests pass; scripts types and the legacy rollback build pass. Worker types, the production build and both Worker smokes pass. All 143 navigation journeys pass on port 8870 (2.7 minutes). The first run passed 133 tests and exposed ten test defects: application alerts accidentally included Next's route announcer, a color comparison sampled an unfinished transition, and deterministic plane sampling overrode the CSS playback later checked for pausing. Independent review approved the repairs, with feature assertions preserved; no production defect was found in those failures. Route-inventory drift and diff whitespace checks are clean. Raw logs use `/tmp/kuuki-auth-integration-*`, `/tmp/kuuki-auth-*-build.log` and `/tmp/kuuki-auth-*-smoke.log`; the first browser run is retained as `/tmp/kuuki-auth-integration-navigation-first.log`.

The reset browser fixture seeds a dedicated synthetic account and one hashed, expiring token. Its journey checks successful reset, old-session revocation, token reuse rejection, guest completion and explicit sign-in with the new password. No email provider, remote database or production account is used. A real-D1 refused-session regression proves operational failures return 503 rather than wrong-password 401 on both sign-in paths; account creation retains its SIGN_IN_REQUIRED response.

The final commit hook caught a DOM/Worker `Element.append` type collision in the test-only color probe. Using `appendChild` resolves it; Next types and all six affected recovery browser journeys pass after that one-line correction (`/tmp/kuuki-auth-integration-recovery-final.log`). Production code and the verified build are unchanged by the browser-test repairs.

## Deliberate limits and copy review

- Hosted email delivery and activation acceptance remain release gates; no push or deployment was performed.
- Activation stays on its isolated origin and uses system fonts under the existing restrictive CSP. Native help and paused plane motion are now present. Its Horizon artwork is a small isolated copy.
- A token-only activation visit cannot populate the hidden username from email metadata. Reset uses a valid, user-typed same-origin session hint when available. No token-to-email endpoint or email/token/password query parameter was introduced. Story 44's email association remains incomplete for token-only activation; safe email prefill after completion is conditional. This carried requirement is tracked in [ticket 13](../../.scratch/auth-one-form/issues/13-token-only-username.md).
- Exact Paper values came from the prior JSX/style extraction in `/Users/indi256/Documents/kuuki/auth-one-form-notes/design/`. Spec/build notes win the tracking conflict (−0.04em). The auth controls are language, theme and help; the proposed accent-picker redesign remains separate. The Password-label gap is 24px to keep its 44px recovery hit area clear of the input. The mobile band shrinks from 302px toward 160px on short screens. The Check-inbox footer absent from the state contract is omitted.
- Plane checks establish layout, motion vector, glyph rotation, pausing, reduced motion and the wordmark-clearance mask; they do not establish a pixel-level visual clearance audit.
- New Russian copy is implemented but remains a draft for product review. Read the paired strings in [form-step](../../apps/next/src/client/auth-card/form-step.tsx), [get-back-in-step](../../apps/next/src/client/auth-card/get-back-in-step.tsx), [reset-password-form](../../apps/next/src/client/account/reset-password-form.tsx), [corner-controls](../../apps/next/src/client/auth-card/corner-controls.tsx), and [activation markup](../../apps/next/activation/activate.html). The saved-password notice is «Пароль сохранён. Теперь войдите с ним.». Help content also remains subject to product wording review.

## Next action

Local implementation, reviews and verification are complete for tickets 01–12; ticket 13 retains the token-only email association decision. Preserve this isolated branch for review. Before combining it with the concurrent Vite cleanup, reconcile both branches' build, activation and legacy-reference changes and run the affected checks again. Hosted acceptance and deployment remain separate release work.
