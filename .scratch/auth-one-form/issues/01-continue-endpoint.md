# `POST /api/auth/continue`

Status: resolved
Type: task
Blocked by: none
Spec: [spec.md](../spec.md) — "Continue endpoint", "Seam 1 › Continue", user stories 7, 14–15, 67

## What to build
The Continue endpoint exactly as the spec's "Continue endpoint" section describes: session on a verified password (same body shape as sign-in), 401 `INVALID_CREDENTIALS` on a wrong password or a RESET_REQUIRED account, `dummyVerify` and then 200 `{ next: 'create' }` with nothing stored for an unknown email, 400 with the existing codes for malformed input. It is same-origin and no-store. Rate limits: every call consumes `signin:<ip>`, and a `create` answer also consumes `signup:<ip>`. Record the accepted account-existence leak (security finding #8) in a handler comment.

Also add the one sign-up test from "Seam 1 › Sign-up": sign-up succeeds with no confirm field and returns 409 for a taken email.

Regenerate the API route inventory with its generator script. Never hand-edit it.

## Acceptance
- Every "Seam 1 › Continue" and "Seam 1 › Sign-up" case in the spec is a passing API integration test.
- API typecheck and the API test suite pass, and the route-inventory drift check is clean.
- No UI changes.

## Answer

Continue is integrated with canonical credential failures, dummy verification for unknown emails, shared rate limits and generated routing. API coverage also verifies sign-up without password confirmation and the taken-email response.

## Comments

- 2026-10-06: Integrated and independently reviewed on `feat/auth-one-form-resume`. Full validation: 544 API tests, 1,060 Next unit tests and 143 browser journeys; applicable types, lint, production build and both Worker smokes pass. See the [handoff](../../../docs/plans/2026-10-06-auth-one-form-handoff.md) for commits, evidence, design decisions and the carried gap. No remote changes or deployment.
