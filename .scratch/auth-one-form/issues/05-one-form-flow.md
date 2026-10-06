# One-form flow: Continue → sign in / wrong password / create step

Status: resolved
Type: task
Blocked by: 01, 04
Spec: [spec.md](../spec.md) — "Client state machine", "Copy and i18n", "Seam 2", user stories 7–31
Design: boards 1.1–1.4 and 4.1 (focus, motion and reduced-motion rules)

## What to build
Replace the card's temporary sign-in wiring with the `CardState` machine from the spec (the `form`, `checking`, `create` and `creating` steps; ticket 08 adds `request`, `sending` and `sent`, so leave room for them):
- Continue posts to `/api/auth/continue`. A session lands in the journal. 401 shows "Email or password is incorrect." with an icon under the password field, keeps the email, and shows the "Email me a link to get back in" secondary action (it opens the request state once ticket 08 exists; until then a disabled or stub handler is fine). 429 shows the too-many-attempts message with an icon. Network errors are handled.
- "Checking…" with a spinner, full opacity and not clickable.
- `{ next: 'create' }` swaps the card in place into "Start your journal": a `role=status` line "No Kuuki journal uses {email} yet." with a **Change** link, the password kept and relabelled "Create a password" with the hint "At least 8 characters", autocomplete switched to `new-password`, and focus on **Create account**. Under reduced motion there is no slide.
- Create account calls the existing sign-up endpoint and goes to onboarding. Short password shows an inline error. 409 `EMAIL_TAKEN` returns to `form` with "This email just got a journal. Continue to sign in." Account created but not signed in shows a clear sign-in message.
- Change returns to `form` with focus on the email field and its text selected. Editing the email in `create` returns to `form`. Every other state change focuses the new heading (`tabindex=-1`).
- Remove the sign-in/sign-up mode switch, the confirm-password label and "Moving an existing account? Continue to activation" strings. EN and RU for every new string.

## Acceptance
Playwright journeys for every "Seam 2" case about Continue, wrong password, unknown email/create step, Change and short password. Full navigation suite, typecheck and unit tests pass.

## Answer

Continue, wrong-password recovery and in-place creation are integrated. Inputs and heading focus survive server failures; malformed success replies cannot mutate identity or navigate.

## Comments

- 2026-10-06: Integrated and independently reviewed on `feat/auth-one-form-resume`. Full validation: 544 API tests, 1,060 Next unit tests and 143 browser journeys; applicable types, lint, production build and both Worker smokes pass. See the [handoff](../../../docs/plans/2026-10-06-auth-one-form-handoff.md) for commits, evidence, design decisions and the carried gap. No remote changes or deployment.
