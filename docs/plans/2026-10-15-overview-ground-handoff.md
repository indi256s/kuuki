# Overview ground journeys: handoff

Plan: [2026-10-15-overview-ground.md](2026-10-15-overview-ground.md) (wave-plan/v1). The plan file is untracked in the root checkout and was not committed: committing it would collide with that untracked copy during landing. The worktree copy used for execution was byte-identical to it.

## Owner and scope

- Branch `feat/overview-ground`, worktree `/Users/indi256/.t3/worktrees/kuuki/feat-overview-ground`, base local `main` 79d37815.
- Scope: all four waves and the final evidence gate, except the Sol review (the owner waived it on 2026-10-15).
- Authorization: local commits and landing on local `main`. Push, PR, deploy and remote D1 writes were not authorized.

## Accepted progress

| Commit   | Content                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5af62764 | W1: payload schema 4 with `ground`, `OverviewFilter.scope`, scope-aware countries, distance and globe; etag prefix `ov5-day-` with the matching client guard; preview fixture seeds four European ground journeys            |
| 8b44e502 | W2: ground layers on the globe (ink line over casing, rail ties and road dots from zoom 4, city squares, planned at 35%), ground fit, replay hidden under ground, legend by scope                                            |
| ed6d4a41 | W3: scope segment, hero, sections, narrator, share-card km; km label becomes "as the crow flies" when ground counts                                                                                                          |
| 97bc943b | W4: Passport map segment over canonical `src`, with a named fallback for other source combinations                                                                                                                           |
| a3ad470b | Browser-lane fixes: bar rows measured by vertical centre, aviation note only in the zero state, ground fit clears the overlays                                                                                               |
| 403007cc | dxe review fixes: one "Below: flights only" line, scope-change announcement, hero hugs its figures under ground, empty ground view frames the ground, Passport segment adds no badge/Reset and matches the view control size |

Decisions taken during execution:

- `figures.countries.source` stays `by_air` for filtered views without ground data.
- Treemap hidden under ground, because its evidence is flights only.
- The zero state is ground-aware.

## Latest checks

- `pnpm typecheck`, `pnpm typecheck:api`, `pnpm lint` (0 errors, 14 existing warnings) and `pnpm next:build` all exit 0 on 403007cc.
- Unit tests:
  - Full `pnpm test` passed on 97bc943b: 203 files, 1788 tests.
  - After that, app tests were run with `--testTimeout=30000` because the machine was under load (load average 30–80). All passed except one load flake in `missing-aircraft.test.tsx`, which passed twice in isolation.
- `pnpm test:next:navigation` (port 8803): the full run on a3ad470b had 49 passed and 5 failed (timeouts, closed context, doubled Journal rows, fullscreen WebGL readiness). Every one of the five failing files then passed when rerun on 403007cc: `map.test.ts` 3/3 and the other four 15/15.
- Browser (synthetic fixture, `a@example.test`), every scope at 390 and 1280 in light and dark:
  - totals agree: Всё 110,534 km = 109,166 flights + 1,368 ground; countries 10 (Passport) / 8 by air / 4 by ground;
  - the Passport map gives 8 of 10 and 4 of 10 with matching fills;
  - no console errors.

## Inputs

- Committed: everything above.
- Reproducible: `pnpm next:preview` seeds the ground journeys (`scripts/smoke-next-runtime.ts`).
- Checkout-local: the plan file in the root checkout (untracked; its owner decides whether to commit it).

## Next action

- No Sol review was run.
- Deploying needs separate authorization through the `deploy-kuuki` skill.
