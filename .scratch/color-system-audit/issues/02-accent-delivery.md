# Accent delivery: profile persistence, public owner context, favicon

Status: resolved
Type: task
Node: B (execution map T4, T5, T8)
Blocked by: 01

Acceptance:
- Precedence exactly as T4: cookie bootstraps the device; member shell reconciles with profile `theme_color` (recognized profile wins; null/unrecognized profile receives the device accent); picker saves optimistically, PATCHes when signed in, reverts and shows EN/RU error on failure.
- `PATCH /api/profiles/me` validates `theme_color` against canonical names; others → 400 `BAD_REQUEST`. Existing authorization tests stay green; add one test for rejection and one for a canonical write.
- `/fly/[username]` (public profile only) applies the owner accent through `OwnerAccent` (inline parse-time script + layout effect + restore on leave), sets `data-accent-scope="owner"`, never writes cookie/profile; visitor mode untouched. Private shell / not-found keep the visitor accent. Preserve the pre-existing FoundingCrew diff in page.tsx.
- `FaviconSync` in the root layout: data-URI SVG of the existing icon geometry in the current accent/mode from the shared table; updates on accent/theme change and in owner scope; restores on leave. Static icon files unchanged.
- Activation static script: canonical `shu` instead of `terracotta`; legacy names map per `resolveAccent`; update `activation-static.test.ts` expectation (F2).
- Tests: unit tests for `resolveAccent` and the reconciliation decision function; a test that owner scope does not touch `document.cookie`. Browser proof is node G.

## Comments
