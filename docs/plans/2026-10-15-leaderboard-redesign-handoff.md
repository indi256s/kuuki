# Leaderboard redesign: handoff

Plan: [2026-10-15-leaderboard-redesign.md](2026-10-15-leaderboard-redesign.md). Spec: [.scratch/leaderboard-redesign/spec.md](../../.scratch/leaderboard-redesign/spec.md).

## Owner and checkout

- Branch `feat/leaderboard-redesign`, worktree `/Users/indi256/.t3/worktrees/kuuki/feat-leaderboard-redesign`, based on local `main` at `79d37815`.
- Authority: local edits and local commits on this branch only. Push, PR, merge into `main`, remote D1 migration `0014`, deploy and production checks are not authorized.

## Accepted waves

| Wave                 | Commit        | Acceptance evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inputs               | `e04ac67d`    | Spec and plan copied from the root checkout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| W2 shared primitives | `b9b3d0d1`    | `pnpm --filter @kuuki/next test`, typecheck, lint exit 0 (worker run, rechecked by lint/format before commit); browser before/after on the fixture at 1280 and 390: computed styles of the Next up flap cell, digit, seam and the profile gate tile/label/value identical to the base build except the keyframes name; one 390 label-width difference traced to tile order (the base build listed year rows).                                                                                                                                                                                                                                                                                                      |
| W1 data              | `fbc097bf`    | `pnpm test:api` 935/935, `pnpm typecheck:api`, `pnpm typecheck:maintenance` exit 0; preview on the new build applied migration 0014 and rendered the old page with the new fixture (tie at #3 then #5, private member absent, 26 rows); passport gates show five all-time sky tiles (the base build showed ten, the year rows leaking).                                                                                                                                                                                                                                                                                                                                                                            |
| W3 page              | (this commit) | Next tests 477/477 in the touched folders, full Next suite green apart from two load flakes that pass alone (`dev/stamps/page.test.tsx`, `overview/sections/rhythm/section.test.tsx`), typecheck, lint, format exit 0. Browser on the fixture (1280, 390): guest narrator and leader values; `a@example.test` #15 with the 2-flight gap to @fixture-hana, ground tiles locked; board 5–10, gap row, 13–17 with lead-in; category and period switches show no skeleton and mirror the URL; Show all focuses #11; no page or console errors; 390 has no horizontal overflow; podium rises once per session and not under reduced motion. Fixed during review: Free sign on a skipped rank, tied step taller than #1. |

## Decisions

- **Owner reads gain `is_public = 1`** (`/api/me/rankings`, `server/profile.ts` `readOwnRankings`). No test pinned the private-owner case; the rebuild no longer keeps a place for private members; the owner copy already says rankings need a public profile. Without the filter a private owner would see a stale place for up to one maintenance pass. Pinned in `functions/test/public-reads.test.ts`.
- **Zero values are not ranked**, except all-time sky boards (parity: every eligible member ranks there).
- **Viewer states** add `off` (private or opted out) and `unranked` (eligible, no place here) to the plan's `ranked / progress / blocked / pending`; the narrator has lines for both, plus `slipped` (rank down since the last publication, from `recordRank`) and `empty`.
- **Year sky countries** come from airport countries of that year's flights (no legacy evidence or transit rules), recorded in the rebuild header.
- **Podium medal tokens** `--gate-gold/silver/bronze`: light uses the dark-theme medal values (the light `--rank-*` measure about 2:1 on the ink sign), dark aliases `--rank-*`; `tokens.test.ts` holds them at 4.5:1 on `--gate-surface` in every mode and accent.
- **W3 additions beyond the brief:** podium `aria-label` "Top three", visually hidden Free-sign hints, guest tile name "no leader yet" on an empty board, strip centring by `scrollLeft` instead of `scrollIntoView`, `SplitFlap` `delay` prop for the podium.
- **Existing `--gate-rank`** measures 4.16:1 on the dark sign with the Shu accent; it is 36px display text (3:1 applies) and predates this work, so it is left alone.

## Latest checks

See the wave table; final gate pending.

## Next action

Accept W3, then run the final evidence gate (`pnpm verify:cloudflare`, browser lane, `pnpm test:next:navigation`, final review on GPT-6.1 Sol high).

## Inputs needed to resume

- Committed: `.scratch/leaderboard-redesign/spec.md` and the plan (`e04ac67d`).
- Reproducible: `pnpm install --frozen-lockfile`, `pnpm next:build`; preview with `KUUKI_NEXT_PORT=<free port> pnpm next:preview` (a stale preview from the root checkout holds 8800).
