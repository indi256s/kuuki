# Five accents: drop kincha/sumi, add asagi

Status: resolved
Type: task
Blocked by: none
Spec: [spec.md](../spec.md) — "Visual system › Accents", "Other checks › Tokens", "Seam 2 › Accents", user stories 64–65
Design: board "4.2 Spec — accent proposal" (see the design notes `4.2-accents.md`)

## What to build
- The accent list becomes terracotta (default), ai, matcha, asagi and sakura, with the exact light and dark values from board 4.2. Remove the kincha and sumi token blocks from the Next stylesheet and add asagi.
- A stored `kincha` or `sumi` in the `kuuki_accent` cookie is rewritten to `terracotta` the first time it's read, in both the bootstrap script and the appearance client.
- Bootstrap legacy localStorage colour map: yellow → terracotta, teal and cyan → asagi. Nothing may resolve to a removed accent.
- Update the token test's expectations to the five accents. The swatch picker should follow the list without a redesign (redesigning the picker is out of scope).
- Leave the legacy Vite app untouched.

## Acceptance
- The token test passes with five accents.
- A Playwright journey with a `kincha` cookie renders terracotta.
- Next typecheck, unit tests and the affected Playwright files pass.

## Answer

Five exact Paper accents are integrated with legacy cookie/localStorage migrations and contrast checks. The picker follows the shared list.

## Comments

- 2026-10-06: Integrated and independently reviewed on `feat/auth-one-form-resume`. Full validation: 544 API tests, 1,060 Next unit tests and 143 browser journeys; applicable types, lint, production build and both Worker smokes pass. See the [handoff](../../../docs/plans/2026-10-06-auth-one-form-handoff.md) for commits, evidence, design decisions and the carried gap. No remote changes or deployment.
