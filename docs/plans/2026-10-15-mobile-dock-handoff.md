# Mobile dock handoff

Plan: [2026-10-15-mobile-dock.md](2026-10-15-mobile-dock.md). Spec: [`.scratch/mobile-dock/spec.md`](../../.scratch/mobile-dock/spec.md).

- Branch `feat/mobile-dock`, worktree `/Users/indi256/.t3/worktrees/kuuki/feat-mobile-dock`.
- Base: local `main` at `7f4afa94` (worktree creation); latest local `main` `5c23a187` merged in at `e4c9eb54`.
- Waves: W1 `306501b0` (rail + key, grouped Add list), W2 `83a93748` (Journal sections, instant swap, section memory, transport chip), W3 `1a8a5549` (DESIGN.md, GT-01 note, navigation suite).
- Tip: the commit adding this file; landing target recorded in the owner report.

## Lane results

| Lane    | Command                                                                               | Result                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| format  | `pnpm exec oxfmt --check $(git diff --name-only 7f4afa94..HEAD)`                      | pass (27 files)                                                                                                                                                                                                             |
| lint    | `pnpm lint`                                                                           | 0 errors; 14 pre-existing warnings in untouched files                                                                                                                                                                       |
| types   | `pnpm typecheck`                                                                      | pass (also after merging `main`)                                                                                                                                                                                            |
| unit    | `pnpm test`                                                                           | pass: API 949 tests, Next 1818 tests; Next suite re-run after the merge                                                                                                                                                     |
| build   | `pnpm next:build`                                                                     | pass (before the merge; `main` changed only dev tooling)                                                                                                                                                                    |
| browser | `KUUKI_NEXT_PORT=8840 pnpm test:next:navigation` (8800 was taken by another checkout) | 54/55 passed; `welcome.test.ts` "I’ll do this later is final" timed out. Pre-existing flake: fails 3 of 5 runs on base `7f4afa94` in a clean worktree, 1 of 3 on this branch. `navigation.test.ts` re-run alone: 9/9 passed |
| layout  | agent-browser at 320×568 / 390×844, EN and RU, desktop 1280×800                       | waived by the owner (2026-10-15: "этих тестов достаточно")                                                                                                                                                                  |
| review  | Sol `gpt-6.1-sol` high via T3 `delegate_task`                                         | waived by the owner with the same instruction; not run                                                                                                                                                                      |

## Deviations from the spec

- D6: the transport filter is one "Transport" facet chip (as in the Journal toolbar) with a Rail / Road menu; no value means all, × clears it. The spec's "no chip selected" is read as "the chip has no value".
- D2: Road trip RU is «Автопоездка» per the spec table, replacing «Поездка на авто» in `ground/copy.ts` (also on the empty-state link).
- D1: the + rotation runs over `--dur-fast` (150ms) in step with the card's entrance, instead of 8441ef07's `--dur-base`.
- D7: `AddChooser` is now two links (Train journey, Road trip) used only by the empty ground state.
- Both loading screens show the Journal heading and the section switch, so the switch does not appear late.
- The Add card keeps 8441ef07's visible title, now "Add" / «Добавить».

## Remaining gate

Landing on local `main` (owner go-ahead 2026-10-15) overlaps foreign uncommitted root-checkout edits in `DESIGN.md` and `apps/next/src/client/ground/ground.css` and the untracked spec/plan inputs; integration preserves those hunks. Push, deploy and visual verification remain separate decisions.
