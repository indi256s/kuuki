# pwa-upgrade browser test hard-codes port 8811 and needs a prior legacy build

Status: ready-for-agent
Owner task: test infrastructure (found during W4 parallel worktrees)
Source: T14 fix round 1 and T17 reports (2026-10-05). Verified at feature/redesign-2.0 8b6cbdf.

## What is wrong
`apps/next/tests/pwa-upgrade.test.ts:37` starts its legacy-app server on a fixed `127.0.0.1:8811`, unlike the navigation suite, which reads `KUUKI_NEXT_PORT` (`apps/next/tests/playwright.config.ts:5`). Two worktrees running the gate at once collide on 8811 and the test fails with a port error. In a fresh worktree it also fails until `apps/web/dist` exists (`pnpm build`), which the gate instructions do not mention.

## Expected behaviour
The legacy server listens on an ephemeral port (`listen(0)`, read back the bound port) or one derived from an env var. Fail with an explicit message naming `pnpm build` when `apps/web/dist` is missing.

## Acceptance check
Two worktrees run `pnpm test:next:navigation` concurrently with different `KUUKI_NEXT_PORT` values and both pass `pwa-upgrade.test.ts`. Removing `apps/web/dist` produces the explicit message rather than a navigation timeout.
