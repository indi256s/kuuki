# `POST /api/auth/continue`

Status: ready-for-agent
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
