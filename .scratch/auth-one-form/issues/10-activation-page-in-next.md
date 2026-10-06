# Activation Set-password page built by Next

Status: resolved
Type: task
Blocked by: 04
Spec: [spec.md](../spec.md) — "Set-password pages › Activation variant", "Other checks › Activation origin", user stories 42, 44–46, 68–69
Design: boards 2.3 (activation variant) and 2.4

## What to build
- Next's build emits its own static activation page and script, styled to board 2.3 (activation variant) and 2.4, using the text wordmark and both themes. It follows the existing isolated-origin gate contract: the gate runs before assets, API, rendering and session lookup, serves only the activation page, its script and the completion API, and keeps the emailed `/activate` URL. The page loads no app scripts and no session.
- Next stops copying the legacy app's activation files. The legacy app's own activation page stays in place for rollback.
- After saving, and for the activation origin's GET redirect, go to `/?notice=password-saved` on the main origin (same contract as ticket 09; there is no email in the URL). The legacy `mode=signin` query is accepted and ignored.
- A single password field plus a hidden username field holding the email when the page has it.

## Acceptance
`pnpm next:smoke` and `pnpm next:smoke:boundary` pass after the static page moves into Next's build, along with any existing activation tests. Typecheck passes.

## Answer

Next owns the isolated activation HTML/script, with the existing host gate and restrictive CSP, branded states, native help and paused motion. Completion returns to the main card without automatic sign-in. The conditional username requirement is implemented when email is known; unconditional token-only association remains in ticket 13.

## Comments

- 2026-10-06: Integrated and independently reviewed on `feat/auth-one-form-resume`. Full validation: 544 API tests, 1,060 Next unit tests and 143 browser journeys; applicable types, lint, production build and both Worker smokes pass. See the [handoff](../../../docs/plans/2026-10-06-auth-one-form-handoff.md) for commits, evidence, design decisions and the carried gap. No remote changes or deployment.
