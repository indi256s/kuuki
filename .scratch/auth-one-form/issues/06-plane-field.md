# Brand panel plane field and くうき watermark

Status: ready-for-agent
Type: task
Blocked by: 04
Spec: [spec.md](../spec.md) — "Visual system › Plane field", user stories 51–53
Design: boards 1.1, 3.1–3.3 and 4.1 (design notes)

## What to build
Fill ticket 04's brand-panel slot. Desktop gets 30 planes (12 small, 10 medium, 8 large), and the mobile sheet header gets 14. Each plane is rotated −18.4° and drifts along (+400, −800) using transform only. Planes stay clear of the wordmark. The くうき watermark sits behind them. The field pauses when off screen (IntersectionObserver) or when the page is hidden, and freezes under reduced motion. Use exact values from the boards and the 4.1 motion notes.

## Acceptance
- Playwright: with reduced motion emulated, the planes are present and not animating; the field is present in desktop and mobile layouts.
- Full navigation suite, typecheck and unit tests pass.
