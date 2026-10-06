# "Can't sign in?" request → check your inbox

Status: resolved
Type: task
Blocked by: 02, 05
Spec: [spec.md](../spec.md) — "Client state machine" (request/sending/sent), "Routes", "Seam 2", user stories 5, 12, 32–41, 48–49
Design: boards 2.1, 2.2 and 4.1

## What to build
- Add the `request`, `sending` and `sent` steps. "Can't sign in?" and the wrong-password "Email me a link to get back in" action open `request` with the typed email prefilled and no error when it's empty.
- Send posts to `/api/auth/link/request`. A malformed email gets an inline field error. "Sending…" is disabled at full opacity. 429 shows "Too many links requested. Try again in an hour." 503 shows "Email links are paused right now. Try again later."
- `sent` is "Check your inbox" with a `role=status` body naming the email. "Send again" becomes available after 60s and is announced once, not every second.
- Recovery states show no tagline. Every state change focuses the new heading.
- `/forgot-password` and `/activation-request` render the card in the `request` state.
- EN and RU for every new string.

## Acceptance
Playwright: `/forgot-password` opens the request state; Can't sign in? with an empty email opens without an error; Send shows "Check your inbox"; the resend control starts disabled and enables after the cooldown via the clock API (no real wait). Full navigation suite, typecheck and unit tests pass.

## Answer

Request, sending and inbox states are integrated in place, including generic replies, distinct failures, preserved inputs, heading focus and the announced 60-second resend cooldown. Pending authentication blocks recovery entry.

## Comments

- 2026-10-06: Integrated and independently reviewed on `feat/auth-one-form-resume`. Full validation: 544 API tests, 1,060 Next unit tests and 143 browser journeys; applicable types, lint, production build and both Worker smokes pass. See the [handoff](../../../docs/plans/2026-10-06-auth-one-form-handoff.md) for commits, evidence, design decisions and the carried gap. No remote changes or deployment.
