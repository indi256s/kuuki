# Brand panel plane field and くうき watermark

Status: resolved
Type: task
Blocked by: 04
Spec: [spec.md](../spec.md) — "Visual system › Plane field", user stories 51–53
Design: boards 1.1, 3.1–3.3 and 4.1 (design notes)

## What to build
Fill ticket 04's brand-panel slot. Desktop gets 30 planes (12 small, 10 medium, 8 large), and the mobile sheet header gets 14. Each plane is rotated −18.4° and drifts along (+400, −800) using transform only. Planes stay clear of the wordmark. The くうき watermark sits behind them. The field pauses when off screen (IntersectionObserver) or when the page is hidden, and freezes under reduced motion. Use exact values from the boards and the 4.1 motion notes.

## Acceptance
- Playwright: with reduced motion emulated, the planes are present and not animating; the field is present in desktop and mobile layouts.
- Full navigation suite, typecheck and unit tests pass.

## Answer

The exact desktop/mobile plane field is integrated with transform-only drift, glyph rotation, wordmark masking, visibility/offscreen pausing and reduced-motion freeze. Browser checks use fresh animations after deterministic sampling.

## Comments

- 2026-10-06: Integrated and independently reviewed on `feat/auth-one-form-resume`. Full validation: 544 API tests, 1,060 Next unit tests and 143 browser journeys; applicable types, lint, production build and both Worker smokes pass. See the [handoff](../../../docs/plans/2026-10-06-auth-one-form-handoff.md) for commits, evidence, design decisions and the carried gap. No remote changes or deployment.
