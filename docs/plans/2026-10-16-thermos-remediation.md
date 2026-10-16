Plan contract: wave-plan/v1

# Thermos remediation

Execution status and evidence: [handoff](2026-10-16-thermos-remediation-handoff.md).

Goal: address all three findings and four maintainability items in `.scratch/thermos-2026-10-16-096badbb/review.md`.
Architecture: preserve existing owners; reject obsolete pagination by generation, reuse canonical journey distances, publish aircraft facts independently of art, validate catalogs before writes, pin generator inputs, and use a shared own-flight DTO with separate write types.
Success: regression cases pass; duplicated semantics and obsolete compatibility branches are removed; existing journeys continue to pass.
Out of scope: commits, push, PR publication, deployment, remote data writes, and unrelated journal changes.
Constraints: shared dirty main; preserve other owners' edits. Workers use gpt-6.1-sol/medium; reviewers gpt-6.1-sol/high. Primary coordinates all Git and shared-output operations. Run expensive build/runtime checks in an isolated candidate. No visual inspection required.
Planning basis: completed Thermos audit at 096badbb and user's “address all”. Use existing ground journey distance semantics, including unknown-distance exclusion and per-journey rounding.
Execution profile: primary=runtime-selected; workers=runtime-selected; reviewers=independent-runtime-selected; exact-profile-attestation=not-requested
Authority evidence: user explicitly requested all reported items addressed; no additional integration/publication authorization.

## Execution map

| Wave | Outcome                                                | Depends on | Writes (active owner)                                                                                                                      | Reads / validates                       | Parallel-safe with | Material risk → primary proof                                           | Acceptance owner |
| ---- | ------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------ | ----------------------------------------------------------------------- | ---------------- |
| W1a  | Correct leaderboard requests and metric/art boundaries | —          | leaderboard client, API lib/service, relevant tests, shared ground metric helper if needed (leaderboard worker)                            | existing mode totals, generated art map | W1b/W1c            | late response/data semantics → regression tests                         | primary          |
| W1b  | Preserve catalogs and pin generation                   | —          | OpenFlights importer/test, lane generator common/README, shared anatomy verifier and Concorde setup only if needed (tooling worker)        | raw inputs and anatomy lock             | W1a/W1c            | data loss/input trust → isolated failing-input checks                   | primary          |
| W1c  | Canonical flight DTO and direct write preparation      | —          | shared flight types, client flight transports, API flight mapper types, capture/import callers and directly affected tests (flight worker) | canonical server metrics and validators | W1a/W1b            | DTO/write drift → typechecks plus existing capture/import tests         | primary          |
| W2   | Integrated verification and review                     | W1a/b/c    | report/plan/ledger and review fixes after explicit ownership transfer (primary)                                                            | complete scoped patch                   | —                  | interaction regressions → build, full navigation and independent review | primary          |

## W1: independent fixes

### Task 1: leaderboard (W1a)

- [x] Invalidate successful, failed and finalizing pagination responses after every selection change, including A→B→A. Preserve FLIP reuse. Add one component regression that fails before the fix and proves newer rows/paging survive an obsolete response.
- [x] Use the canonical all-segments-known and rounded-per-journey distance rule for ground Countries vehicle selection. Group rail children by journey and preserve year/status filtering. Add one incomplete-journey regression through the leaderboard refresh boundary.
- [x] Remove API artwork inventory and GENERIC conversion; preserve normalized actual aircraft ICAO in cache/DTO, including unsupported artwork codes. Client generated mapping retains GENERIC fallback. Update relevant existing tests.
- [x] Remove the generated CSS's extra trailing blank line through installer output formatting.

### Task 2: tooling (W1b)

- [x] Treat only ENOENT as an absent existing catalog. Validate existing JSON/row shape before either output is replaced. Malformed row, invalid JSON or read errors must fail without losing manual data. Add a regression at the executable importer boundary using temporary catalogs; no live/project catalog writes.
- [x] Replace home-directory anatomy fallback with the existing pinned checkout and checksum verification before imports/writes. Reuse the Concorde lock/setup, include consumed files and CSS/license dependencies. Verify correct inputs and checksum rejection; preserve existing generated art.

### Task 3: flight contracts (W1c)

- [x] Share the actual own-flight DTO fields between mapper and browser transport, with required canonical lifecycle fields. Remove ApiFlight duplication and synthetic user_id attachment; keep API JSON behavior stable.
- [x] Define write input separately from read DTO using server-admitted fields; remove fake ownership and row-only fields from writes/callers. Preserve idempotency recovery semantics.
- [x] Delete write-side duration estimation/aircraft lookup from manual capture and import input preparation, keeping actual UI previews. Remove lifecycle casts/fallbacks made obsolete by required DTO state.
- [x] Trace consumers and update realistic test fixtures rather than weakening canonical fields to accommodate mocks. Use typechecks and existing capture/import/export tests.

## W2: integrated evidence and acceptance

Freeze final candidate as base 096badbb plus scoped changes/new files, excluding unrelated journal/docs changes from verification while preserving them in the shared checkout; save diff and hashes in the task ledger. Reuse focused red/green evidence. Run shared-output operations serially in an isolated candidate with a normal frozen-lockfile install.

| Lane               | Proves                          | Command or scenario                                                     | Success signal                                             | Parallel-safe                           |
| ------------------ | ------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| regressions        | reported failures are fixed     | owning component/API/tooling tests                                      | fail pre-fix, pass fixed                                   | coordinate all edits before runs        |
| types/lint         | contracts and static rules hold | API/import/maintenance/scripts/client/Next/Worker typechecks; Next lint | exit 0                                                     | no overlapping generators               |
| unit               | integration across owners       | `pnpm test` plus importer regression if outside default include         | passing suite or investigated explicit baseline limitation | independent of build except edit freeze |
| build              | Next and static assets compile  | package builds then `pnpm next:build`                                   | exit 0                                                     | serial                                  |
| navigation         | real journeys still work        | `pnpm test:next:navigation` after build                                 | passing full suite                                         | serial                                  |
| independent review | requirements and correctness    | complete integrated diff plus test evidence                             | material findings resolved                                 | read-only                               |

Final acceptance: primary reads full patch, confirms all seven items addressed, documents checks and remaining limitations, updates the audit and handoff, and leaves shared staging untouched.
