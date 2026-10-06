# Reset Set-password page and the "Password saved" notice

Status: ready-for-agent
Type: task
Blocked by: 05
Spec: [spec.md](../spec.md) — "Set-password pages" (reset variant, after saving), "Seam 2 › Reset link / Expired token", user stories 43–48
Design: boards 2.3 (reset variant) and 2.4

## What to build
- Restyle the existing Next reset-password route to board 2.3 with reset copy ("Choose a new password" / "Save password"): a single password field plus a hidden username field holding the email when the page knows it. Expired or used tokens show board 2.4 "Link expired" with a way to request a new link (to `/forgot-password`). Session revocation on reset stays.
- After saving, go to `/` on the main origin, where the card's `form` step shows the `password-saved` notice "Password saved. Sign in with it now." Contract: the notice is signalled by the query `?notice=password-saved`. The email is pre-filled only when it can be passed without putting it in the URL (for example `sessionStorage` on the same origin). Never pass the token or the password. There is no automatic sign-in.
- The existing password-updated route resolves to the same `/` notice. The legacy `mode=signin` query is accepted and ignored.
- EN and RU for every new string.

## Acceptance
Playwright: a reset link through the set-password page lands on `/` with "Password saved. Sign in with it now." (token from the mail capture or a seeded token, as current recovery journeys do); an expired token shows "Link expired". Full navigation suite, typecheck and unit tests pass.
