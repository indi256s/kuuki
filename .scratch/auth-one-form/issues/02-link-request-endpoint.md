# `POST /api/auth/link/request` (get-back-in link)

Status: resolved
Type: task
Blocked by: none
Spec: [spec.md](../spec.md) — "Get-back-in link endpoint", "Seam 1 › Link request", user stories 39–43, 47, 67

## What to build
The link-request endpoint as the spec's "Get-back-in link endpoint" section describes. It always returns generic `{ ok: true }`. A background (`waitUntil`) lookup sends the activation email for RESET_REQUIRED accounts (existing activation helper, isolated activation origin), the reset email for accounts with a usable password (existing recovery helper), and nothing for unknown emails. The 503 check runs before any lookup and fires if either origin and sender pair is unconfigured. Rate limits: `link-ip:<ip>` at 10/h, then `link-email:<HMAC-keyed email>` at 3/h. Errors: 400 `INVALID_EMAIL`, 429 (existing code), 503. Keep the existing activation-request and password-reset-request endpoints unchanged. Tokens, expiry and revocation don't change.

Regenerate the API route inventory with its generator script. Never hand-edit it.

## Acceptance
- Every "Seam 1 › Link request" case in the spec is a passing API integration test, including the 503 being identical for known and unknown emails.
- API typecheck and the API test suite pass, and the route-inventory drift check is clean.
- No UI changes.

## Answer

The generic get-back-in endpoint is integrated with activation/reset dispatch, HMAC email rate limits and pre-lookup configuration checks. Held-lookup tests prove the response does not wait for account lookup.

## Comments

- 2026-10-06: Integrated and independently reviewed on `feat/auth-one-form-resume`. Full validation: 544 API tests, 1,060 Next unit tests and 143 browser journeys; applicable types, lint, production build and both Worker smokes pass. See the [handoff](../../../docs/plans/2026-10-06-auth-one-form-handoff.md) for commits, evidence, design decisions and the carried gap. No remote changes or deployment.
