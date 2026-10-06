# Auth card shell, wordmark, taglines and routes

Status: resolved
Type: task
Blocked by: none
Spec: [spec.md](../spec.md) — "Routes", "Visual system" (Wordmark, Taglines, Mobile, Press and hover), user stories 1–6, 50, 54–57, 63, 66
Design: boards 1.1, 3.1, 3.2, 3.3 and 4.1 (design notes `00-index.md`, `1.1.md`, `3.*.md`, `4.1-build-notes.md`)

## What to build
The static frame that later tickets fill in:
- `/` renders the auth card for signed-out visitors and keeps the existing member redirect. `/signin` and `/signup` render the same card with a canonical link to `/`. Delete the landing hero, sample flight cards and FAQ, plus their tests and the strings only they use.
- Desktop layout: brand panel plus card, per boards 1.1 and 3.1, in light and dark. Mobile layout below the desktop breakpoint: brand header plus bottom sheet, per boards 3.2 and 3.3, with 48px inputs and 16px text. Leave a clearly named slot or component for the brand panel's plane field and watermark; ticket 06 fills it.
- Text wordmark component: one element with `aria-label="Kuuki"`, "Ku" in the accent-text token, "uki" in the text token, −0.04em tracking. It replaces the tile logo on auth surfaces.
- Card heading and subtitle copy ("Welcome to Kuuki", "Sign in, or use a new email to start your journal.") and the static form markup for the form step: Email (autocomplete `username`), Password (`current-password`) with the reveal control, the "Can't sign in?" link next to the password label, and Continue. Wire Continue to the existing sign-in behaviour for now; ticket 05 replaces that wiring with the state machine.
- Corner controls: language, theme (keep the current behaviour; ticket 07 swaps in the Horizon toggle) and help, each at least 44×44.
- Taglines: a rotation set in i18n seeded with the two board strings, one picked per page load, shown under the form. No animation under reduced motion.
- Press and hover rules: primary buttons scale to 0.96 over 120ms, 2px focus ring with 2px offset, hover only on fine pointers, 44px hit areas on text links.
- Every new string in EN and RU. Map every board colour to an existing token, or add a role-named token in the Next stylesheet. No raw values.

## Acceptance
- Playwright: `/` shows the card for signed-out visitors and redirects members; `/signin` and `/signup` show the same card; one light, one dark and one mobile-viewport journey check the key elements are visible (no pixel snapshots); sign-in with known credentials still lands in the journal.
- The full Next navigation suite, typecheck and unit tests pass.

## Answer

The shared card, text wordmark, localized controls, responsive layout and auth aliases are integrated; the guest landing content is removed.

## Comments

- 2026-10-06: Integrated and independently reviewed on `feat/auth-one-form-resume`. Full validation: 544 API tests, 1,060 Next unit tests and 143 browser journeys; applicable types, lint, production build and both Worker smokes pass. See the [handoff](../../../docs/plans/2026-10-06-auth-one-form-handoff.md) for commits, evidence, design decisions and the carried gap. No remote changes or deployment.
