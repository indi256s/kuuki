# "Can't sign in?" request → check your inbox

Status: ready-for-agent
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
