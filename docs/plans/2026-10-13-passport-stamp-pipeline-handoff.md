# Passport stamp pipeline — handoff

Plan: [2026-10-13-passport-stamp-pipeline.md](2026-10-13-passport-stamp-pipeline.md). Branch `feat/passport-stamps`, worktree `~/.t3/worktrees/kuuki/feat-passport-stamps`. Not pushed, not landed, not deployed.

## Accepted progress (source implementation and local checks only)

- W1 engine, starter kit, six recipes (ME, TH, JP, DE, AM, GE), generator, stamp check: `c475be2d`; art pass to engraved vignettes after an art-direction review: `52ed81bd`, `948af094`.
- W2 `CountryStamp`, `--stamp-ink-*` tokens, `/dev/stamps` contact sheet with impression compare (B1) and owner marks (B2): `ed098779`; generated stamp index (ring names EN/RU, no ICU at render, kit kept out of the client): `2121c071`; design-review fixes (ring fit with short names, octagon ring on the corner cuts, impression tuning, motion split, focus-within, pending outline, tilt by shape, umber/ochre separation): `4c087284`.
- Latest checks at `4c087284`: `pnpm --filter @kuuki/next test` 1505/1505, typecheck, `pnpm check:stamps`, `pnpm format:check`, `pnpm lint` exit 0; `pnpm next:build` exit 0 at `ed098779`; no hydration errors on `/dev/stamps` (EN/RU).

## Next action / blocker

Waiting for the owner's sign-off of the six on `/dev/stamps` (marks land in `apps/next/src/lib/stamp-art/review.json`), the B1 decision (worn vs clean), and the dark-ink taste call (review finding: dark inks at L≈0.80 read pastel; option L 0.76, 0.75× chroma). W3 (full kit + 246 recipes) starts after that. Open for W3: old modules `water`, `cliff`, `fortress-wall`, `curved-eave`, `triumphal-arch` predate the tone/halo rules; RU ICU names with parentheticals (HK, MO, MM) may want overrides.
