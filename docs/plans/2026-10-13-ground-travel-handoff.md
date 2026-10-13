# Ground travel handoff

Plan: [2026-10-13-ground-travel.md](2026-10-13-ground-travel.md). Owner checkout:
`~/.t3/worktrees/kuuki/feature-ground-travel`, branch `feature/ground-travel` (base main `7188d198`,
seed docs commit `e5e0b657`).

## Status

- Wave 0 (shared contract): migration 0011 and `packages/shared/src/groundTravel.ts` written; migrations
  apply in the Miniflare harness; shared tests pass.
- Waves 1–3: in progress.

Source implementation is not release acceptance: no remote D1 migration, no remote GeoNames load and no
deploy were performed or authorized.

## Inputs needed to resume

- **Committed:** spec and contracts under `.scratch/ground-travel/`, this plan, migration 0011, shared module.
- **Reproducible:** GeoNames catalog via `scripts/generate-geonames-places.ts` (downloads pinned public
  dumps, records SHA-256 in its manifest; output SQL stays out of Git).
- **Checkout-local:** none required. Generated catalog SQL lives under `.wrangler/` and can be regenerated.
