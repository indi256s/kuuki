# Overview Release 1 execution handoff

Owning branch: `feat/overview-release-1-migrations`.
Owning checkout:
`/Users/indi256/.t3/worktrees/kuuki/feat-overview-release-1-migrations`.

Scope: both approved Overview data plans, Release 1 first, then Release 2.
No UI or design work. Read the design-owned spec at
`/Users/indi256/Documents/kuuki/kuuki/.scratch/overview-redesign/decisions.md`;
never copy or edit it. User hard stops for remote Cloudflare/D1 operations,
GitHub/main actions, parity acceptance, UI work and behavior-changing plan
conflicts still apply.

## Accepted progress

- Setup: `871a1f8` copied both plans. Dependency installation and all baseline
  checks passed; no baseline failure was fixed.
- Task 1: `260cb4a`, pure geometry and offsets; Opus 5.5 review no findings.
- Task 2: `a31d650`, zones overflown; Opus review no defects. Coordinate guards
  and consumed-bundle measurement carried to Task 5 and resolved there.
- Task 3: `8fbacd7`, additive 0008, DTOs, ADR and glossary; Opus review no
  blocking findings. Browser metric type gap remains in issue 02 for the first
  consumer, before design handoff.
- Task 4: `cdfcfaa`, calibrated model and local fitter. Opus found missing
  active-model monotonicity coverage; test-only fix `f6155cd` resolved it.
- Task 5: `8c2af66`, server-authoritative metrics. Opus found fractional fallback
  distance; one-line rounding fix `17a6be5` resolved it with rounding regressions.
  Both fixes were trivial; no non-trivial re-review required.

Each task received its required independent T3 review using
`claudeAgent` / `claude-opus-5-5`. Task IDs and full evidence remain in the local
ledger `.superpowers/sdd/2026-10-07-overview-release-1-migrations/progress.md`.

## Review workflow update

The user removed per-task reviews on 7 October: “do not run review for each
task, we will run a full review later, when you finish”. Task 6 review was
cancelled after dispatch; do not start further per-task reviews. Completed
Tasks 1–5 reviews and fixes remain valid. Review is deferred to the full branch.

## Latest checks

Final Release 1 checks, including the whole-branch review fix:

```text
API:     Test Files 58 passed (58), Tests 636 passed (636)
Next:    Test Files 105 passed (105), Tests 1102 passed (1102)
Focused: Test Files 2 passed (2), Tests 15 passed (15)
```

API/scripts typechecks and Next build exited 0. Operator typecheck passed in
Task 7; its source is unchanged. The current build reports:

```json
{
  "node": "v24.18.0",
  "openNextEntryBytes": 2278,
  "assetCount": 105,
  "assetBytes": 9285828,
  "apiRoutes": 71
}
```

Final backfill reporting edits are covered by the repeated API suite and
API/scripts typechecks. This planner is used by proposal tooling, not the app
bundle; the earlier passing build remains applicable. A SQLITE_BUSY fixture
failure was fixed by serializing runtimes for the same persistent namespace.

Existing navigation and compiled Better Auth duplicate-key warnings remain.
The restored-export operator bundle dry-run passed: 57.31 KiB / gzip 13.43 KiB.
Local compiled repair published 18 users with no failures; final status is
28 users / 412 flights / dirty 0 / metricsNull 0. Refresh produced 25 rows for
five eligible ready users; repeat repair and proposal both report zero work.
All 134 historical badge rows remain intact; four new awards are allowed.

## Tasks 6–8

- Task 6: `d627aba`, two-pass backfill planner / read-only proposal and both
  user-approved CAS/drift corrections. Issues 03/04 retain the decisions.
  Per-task review cancelled under the revised workflow.
- Task 7: `5726e13`, authenticated fixed-operation release operator; tests cover
  auth before D1, failure recovery, 50-user oldest-first cap and leaderboards.
- Task 8 calibration: `3c444cf`, 315 valid samples, 13 skipped, RMSE 51.516435.
  Prior retained as the sparse/singular fallback; coefficient diff shown.
- Task 8 tooling/runbook/evidence: this commit adds the isolated private restore
  tool and synthetic preservation/refusal tests, and documents all separately
  authorized production steps. Every Task 8 checkbox is complete.

The user explicitly approved one remote production export and the local-only
rehearsal. It is saved privately with mode 0600, SHA-256
`9c203950a2e7b8b62b7a0aaa7e893898ed0a8f96313b0e23271e066f3b51057c`.
Restore applied only 0008 after ledger 0001–0007 and passed raw preservation for
33 tables / 2221 records, foreign keys and local integrity. The initial Python
SQLite 3.39.4 baseline rounded coordinate literals; Node SQLite 3.53.3 compared
all records exactly without tolerance or data changes. All seven schema review
dimensions match, with historical advanced-stats column order admitted privately.

The proposal changed 411 of 412 flights / 18 users. Populated distance totals
773324 → 703878 km; one previously empty total gains 128414 km. Three unresolved
routes keep their stored distances; two unexplained durations (50/160) remain.
The private complete per-user/exception report is
`/var/folders/hy/6ftrhvk16w942tqtvgsxy6pc0000gn/T/kuuki-overview-release-1-f_cw0lq1/backfill-review.md`.
The export, local D1, admissions, manifests, snapshots and detailed logs are in
that private directory. Synthetic check logs are under
`/tmp/kuuki-overview-execution/r1-t8-*`.

## Whole-branch review fixes

Opus 5.5 round 1 over `main...c652772` found no blocking correctness or spec
compliance defect and two verified low findings:

1. A newly filled estimate with no old duration was counted as
   `estimate_replaced`. The reporting guard now requires a non-NULL old duration.
   The regression went RED before the one-line fix; affected tests pass. Recount
   of the saved rehearsal snapshot still reports 66 replacements and no newly
   filled estimates, and the complete SQL SHA-256 is unchanged.
2. Runbook step 7 referenced a nonexistent file-execution procedure and required
   per-UPDATE counts that Wrangler's aggregate import response cannot provide.
   The runbook now includes private payload preparation, a single query-API batch
   and a count-only response verifier before operator repair. Eight offline
   response checks pass, including CAS miss, missing results/metadata, API and
   statement failures, and invalid JSON. No remote request was made. Before
   production use, the query route needs its separately approved isolated remote
   proof of ordered counts, CAS miss and rollback.

This commit resolves both findings. The procedure correction receives a fresh
Opus review round before Release 2; per-task reviews remain removed.

## Next action

Release 1 local implementation is complete. Per-task reviews are removed by
user instruction; whole-branch review remains deferred to completion. The
original branch instruction calls for the Release 1 review over `main...HEAD`
and then creation of `feat/overview-release-2-architecture` from this HEAD in
this same worktree. Do not run production steps as part of that continuation.

No production hold/write, secret setting, operator/app deployment, GitHub
operation or UI change was performed. Only the explicitly approved production
export was remote. All later remote actions need fresh authorization under
`docs/runbooks/overview-release-1.md`. Release 1 is not deployed; Release 2 must
not ship until its production dependency is admitted.

Issue 02 (browser metric declarations) remains open for the first consumer,
before design handoff. All Release 2 tasks remain unstarted. Keep the original
UI, GitHub, production, parity-report and material-plan-conflict hard stops.
