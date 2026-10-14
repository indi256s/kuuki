# Passport stamp pipeline — handoff

Plan: [2026-10-13-passport-stamp-pipeline.md](2026-10-13-passport-stamp-pipeline.md). Branch `feat/passport-stamps`, worktree `~/.t3/worktrees/kuuki/feat-passport-stamps`. Not pushed, not landed, not deployed.

## Accepted progress (source implementation and local checks only)

- W1 engine, starter kit, six recipes (ME, TH, JP, DE, AM, GE), generator, stamp check: `c475be2d`; art pass to engraved vignettes after an art-direction review: `52ed81bd`, `948af094`.
- W2 `CountryStamp`, `--stamp-ink-*` tokens, `/dev/stamps` contact sheet with impression compare (B1) and owner marks (B2): `ed098779`; generated stamp index (ring names EN/RU, no ICU at render, kit kept out of the client): `2121c071`; design-review fixes (ring fit with short names, octagon ring on the corner cuts, impression tuning, motion split, focus-within, pending outline, tilt by shape, umber/ochre separation): `4c087284`.
- dxe review fixes (stamp host on the stamp area only, per-copy compare replay IDs, one press memory shared with the legacy `Stamp`, reduced-motion fade at `--dur-base`, mark polish: `aria-pressed`, note-only save, inline save error, focus after marking): `0708fb70`; checks at `0708fb70`: next tests 1507/1507, typecheck, lint, format, `check:stamps` exit 0; agent-browser: Rest stays tilted on card hover, compare Replay plays both copies, no console errors.
- Checks at `4c087284`: `pnpm --filter @kuuki/next test` 1505/1505, typecheck, `pnpm check:stamps`, `pnpm format:check`, `pnpm lint` exit 0; `pnpm next:build` exit 0 at `ed098779`; no hydration errors on `/dev/stamps` (EN/RU).

- Owner sign-off (2026-10-14): six accepted, worn impression kept, current dark inks kept; oval made rounder (176×192, `e256f450`); JP replaced by Mount Fuji with a `volcano` module (`fbbc1375`).
- W3 pilot, two parallel Sonnet workers in separate worktrees, merged at `dcd19d2c`: PH TZ ZA CH VN (modules `volcano` massif profile, `mesa`, `peak`, `karst`, `acacia`) and EG MX IT FR GR (`pyramid`, `stepped-pyramid`, `amphitheatre`, `dunes`, `rooftops`, signature `lattice-tower`). ~16 min wall clock and ~35k tokens per country. `lint.test.ts` now covers every committed recipe without a hard-coded list. check:stamps, next tests 1507/1507, typecheck green.

## Next action / blocker

Pilot review (primary): CH, GR and ZA read poorly (CH a flat triangle, GR a temple on a hull, ZA an iceberg); EG is marginal. Proposed next, waiting on owner go: one prep worker (`preview:stamps` PNG contact sheet via resvg with no browser, generated `recipes/index.ts`, a `rock-hill` module, redo CH GR ZA), then three parallel regional workers of ~25 countries each, with primary review after each batch. Workers' self-checks were unreliable (blank screenshots, weak art accepted), so primary review stays mandatory. Open: `ground` draws its bold line unoccluded; FR registry row still lists `tower`; RU ICU names with parentheticals (HK, MO, MM).
