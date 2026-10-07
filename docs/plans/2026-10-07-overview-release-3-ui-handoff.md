# Overview Release 3 UI — initial handoff

Date: 2026-10-07. Scope: Task 1 preparation only; application implementation has not started.

## Owning checkout and revisions

- Branch: `feat/overview-release-3-ui`.
- Worktree: `/Users/indi256/.t3/worktrees/kuuki/feat-overview-release-3-ui`.
- Base: `feat/overview-release-2-architecture` at `548407290d4b4eab4e644c7d1d3a467564b6d205`.
- Release 2 checkout was clean before preparation. Its final review remediation is recorded in [the Release 2 handoff](2026-10-07-overview-release-2-architecture-handoff.md#final-review-remediation-2026-10-07).
- Design branch: `overview-redesign-design` at `cb4f173b1d522e1e76ab0f57619f6f6bc4c71820`.
- Design merge: `d5b7b8a706403ec7e2eab63159c60caa0c374685`, made with `git merge --no-ff overview-redesign-design`.
- Task 1 reference/handoff commit: this document's introducing commit; resolve with `git log -1 --format=%H -- docs/plans/2026-10-07-overview-release-3-ui-handoff.md`.

## Completed preparation

Created a clean worktree from the reviewed Release 2 tip. The merge brought in the product and design decisions, critique snapshot and design-owned `DESIGN.md` updates. The two add/add conflicts were the Release 1 and Release 2 plan files; both retained the release branch's ticked versions using `git checkout --ours`, then `git add`. Both release plans and both handoffs are byte-identical to the base.

Copied the untracked plan, all 15 prototype files and all nine board PNGs from the main checkout. Excluded every prototype `node_modules` directory. The 24 references match the source byte-for-byte; the copied plan matches before ticking Task 1. Main's untracked content and the existing checkouts were preserved.

## Exact local verification

All commands run from the new worktree root, serially:

- `pnpm install --frozen-lockfile`: exit 0; lockfile unchanged.
- `pnpm test:api`: exit 0; 74 files / 834 tests passed.
- `pnpm --filter @kuuki/next test`: exit 0; 107 files / 1,113 tests passed. jsdom emitted navigation-to-another-Document diagnostics; no tests failed.

Full logs and the SHA-256 reference manifest: `/tmp/kuuki-r3-task1-logs/` (`install.log`, `api.log`, `next-unit.log`, `reference-manifest.txt`, `design-merge.diff`).

Checks also confirmed the merge adds only the four intended design-record paths, identical to the design branch, and leaves `apps/`, `functions/`, `packages/`, manifests and the lockfile unchanged. No build or browser fixture was requested or run. No push, deployment or remote D1 operation was performed.

## Next work

Continue with Tasks 2–11 and 13–15 from [the copied implementation plan](2026-10-07-overview-release-3-ui.md):

- Task 2: payload v3, arrival minute and the board fixture.
- Task 3: maker and alliance tables.
- Task 4: facets v2 and normalized seven-section prefs.
- Task 5: figures v2, upcoming flights and replay list.
- Task 6: records cabinet.
- Task 7: rankings v2.
- Task 8: makers and fleet v2.
- Task 9: clock and rhythm v2.
- Task 10: crossings v2.
- Task 11: narrator engine with neutral placeholders.
- Task 13: Shu accent, data tokens and kana logo.
- Task 14: shared UI controls and category marks.
- Task 15: chart kit and table/touch/lazy-loading paths.

Task 12 is the separate narrator corpus owner-review gate; do not mark it accepted without owner review. All later tasks remain unchecked. The user requests GPT-6.1 Sol for every agent, overriding the plan's executor/reviewer model choices. Builds and browser fixtures must stay serial.

Retain Release 2's owner-qualified ETags and account isolation when Task 2 changes the version prefix to `ov3`; its plan example omits the owner qualifier. Preserve the reviewed aggregate-metric distinctions. Imported `DESIGN.md` contains an older Overview summary (six sections, scatter/jet-lag arrows, narrator hairline); the Release 3 Global Constraints and later dated design decisions supersede it. Reconcile documentation in Task 34 rather than implementing those historical descriptions.

The plan's open-decision defaults remain in effect: endpoint hourly UTC offsets; haul split at 4,000 km; `--mark-2` for far-side haul/red-eye segments. No additional product decision was made in Task 1.
