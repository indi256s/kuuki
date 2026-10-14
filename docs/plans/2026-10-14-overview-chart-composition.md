Plan contract: wave-plan/v1

# Overview chart composition

Goal: implement the accepted differentiated analytical composition in three Overview chapters.
Architecture: shared KuukiChart interactions; section-specific chart geometry; opt-in adaptive desktop ChapterCard.
Success: meaningful and different primary representations, exact coverage and accessible alternatives, stable mobile stages, passing required checks.
Out of scope: backend/domain changes, production, dependency upgrades, other dirty feature work.
Constraints: exclusive path ownership, no parallel builds/browser fixture runs; preserve all existing changes; workers gpt-6.1-sol medium, independent reviewer gpt-6.1-sol high.
Planning basis: user-approved direction and [.scratch spec](../../.scratch/chart-composition/spec.md), installed source and DESIGN.md.
Execution profile: primary=runtime-selected; workers=runtime-selected; reviewers=independent-runtime-selected; exact-profile-attestation=not-requested
Authority evidence: user requested agents to begin work after accepting the design direction.

## Execution map

| Wave | Outcome               | Depends on          | Writes (active owner)                                                                                                                         | Reads / validates    | Parallel-safe with                 | Material risk → primary proof                                                 | Acceptance owner |
| ---- | --------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| W1   | Section compositions  | existing interfaces | aircraft + manufacturers + new arc-waffle (aircraft worker); rhythm (rhythm worker); rankings (rankings worker); ChapterCard layout (primary) | shared chart APIs    | all W1 owners                      | counts, selection, mobile regressions → section tests + layout checks         | primary          |
| W2   | Integrated acceptance | W1                  | scoped fixes after ownership transfer; DESIGN chart sections + docs wayfinding (primary)                                                      | complete scoped diff | read-only review and static checks | cross-chapter failures → full Next unit/build/navigation + independent review | primary          |

## W1: Different analytical compositions

Implement spec. Workers own only assigned directories, tests there, and named new files. Controller owns shared layout and docs. New shared chart API requests go through controller. Focused existing tests run in workers; no broad suite/build/browser from workers. Keep tasks recoverable through reports under `.scratch/chart-composition/`.

Accept when: source inspected, focused checks pass, exact counts/unknown/empty states preserved, all section changes use compatible shared APIs.

## W2: Integration and acceptance

Read full scoped diff including added files, reconcile DESIGN chart contract without reverting existing documentation work, obtain independent high-effort review, address material findings, and run required serial checks. Use existing navigation coverage first; focused agent-browser interaction only when it closes a remaining behavior/layout gap.

## Final evidence gate

Identity: starting SHA above plus retained scoped patch and new-file hashes in local progress ledger.

| Lane           | Proves                            | Command or scenario                            | Success signal                                      | Parallel-safe       |
| -------------- | --------------------------------- | ---------------------------------------------- | --------------------------------------------------- | ------------------- |
| lint           | design tokens and React rules     | focused oxlint, oxfmt check                    | exit 0                                              | yes                 |
| types          | Next contracts                    | pnpm --filter @kuuki/next typecheck            | exit 0                                              | separate from build |
| unit           | chart and section behavior        | pnpm --filter @kuuki/next test                 | pass                                                | before build        |
| production     | compiled application              | pnpm next:build                                | exit 0                                              | no                  |
| navigation     | broad browser journeys            | waived by user during execution                | not run                                             | —                   |
| focused layout | changed charts and mobile return  | agent-browser, synthetic fixture, 1440px/390px | no overflow, keyboard pick, 44px rows, focus return | no                  |
| review         | correctness, accessibility, scope | independent full scoped diff review            | material findings resolved                          | yes                 |

Final acceptance is serial by primary. Record actual limitations and unrelated baseline failures distinctly.

Execution status and final evidence: [handoff](2026-10-14-overview-chart-composition-handoff.md). Broad browser verification was explicitly waived; local unit, type, build and focused layout checks remain required.
