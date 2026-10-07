# Overview Release 1

This releases the server-authoritative flight metrics and additive `0008` schema
before Release 2. Use the writer-hold, preservation and recovery requirements in
[audit remediation release](audit-remediation-release.md), then deploy through
[deploy-kuuki](../skills/deploy-kuuki/SKILL.md). A local rehearsal authorizes no
production action. Every numbered production step below needs its own explicit
authorization, including reads. Substeps labelled **separate authorization** are
independent gates; approval of one never authorizes the next. GitHub actions and
merging to main also require the user's approval.

## Target and artifacts

| Item | Required value |
|---|---|
| Account | `5cadcff0282e54f3ff1d7062d4dbb97a` |
| Production D1 | `kuuki-db`, `2a8e3895-6a98-4473-8d7b-a43ca0c0026f` |
| Application Workers | `kuuki-next`, `kuuki-activation` |
| Temporary operator | `kuuki-overview-release-operator` |
| Migration | `0008_flight_metrics.sql` |
| Operator config | `.scratch/overview-release-1/operator-prod.toml` (gitignored) |

Pin `CLOUDFLARE_ACCOUNT_ID` to the account above for Wrangler commands. Commands
run from the workspace root except the app deploy commands, which follow the
deploy skill. Record the accepted Release 1 main-branch SHA and successful CI
identity before deploying. Use that exact checkout, with no later migration
files or unrelated changes. Do not run migration application from a Release 2
checkout.

Keep exports, restored databases, SQL, manifests, admission evidence, credentials
and per-user review reports outside git. Use a mode-0700 private directory and
`umask 077`; export and artifact files must have mode 0600. Never print export
download URLs, tokens, emails, names or complete SQL/data rows to release logs.

The operator config uses `main = "../../workers/release-operator/index.ts"`,
`compatibility_date = "2026-01-01"`, the explicit account/D1 IDs above, no routes,
`workers_dev = true`, `preview_urls = false`, and `[secrets] required =
["OPERATOR_TOKEN"]`. The token belongs to that Worker and stays outside the
config. Recheck the named Worker before any setup or deployment; an unexpected
existing Worker is a stop condition.

## Local rehearsal

An approved export can be restored only into an empty, isolated local namespace:

```sh
pnpm exec tsx scripts/restore-export-local.ts --sql /absolute/private/export.sql --database-id LOCAL_ID --persist /absolute/private/d1
```

The tool reuses `parseLocalTarget`'s refusals, requires an absolute private input
file, drops transaction/PRAGMA/`sqlite_sequence` statements, and restores in D1
batches of 200. It validates that the export ledger is a known ordered migration
prefix, applies only the subsequent migrations, and records their names locally.
It refuses a populated namespace, including a partially restored one. After a
failed restore, retain its diagnostics and use a fresh private namespace.

Compare every original application column/row against an independent export
restore before backfill. Verify foreign keys and the local SQLite integrity
check. `sqlite_sequence` rows are deliberately omitted by this restore tool;
exact sequence-state preservation is not claimed. This rehearsal does not
replace the separate held-production backup/restore proof in the audit runbook.

Review the restored application schema against a fresh migrated fixture:
columns, defaults, primary keys, foreign keys, unique indexes, indexes and
checks, plus trigger/view/index SQL and object inventory. If SQL text differs
only semantically, record a private admission JSON binding account ID, local
database ID, observed/fresh schema SHA-256, all seven reviewed dimensions,
`semanticReview: true` and a `reviewedAt` within 24 hours. Do not reuse it for
another namespace or for production. An unexpected object or semantic
difference is a stop condition.

```sh
pnpm exec tsx scripts/fit-block-time.ts --database-id LOCAL_ID --persist /absolute/private/d1 --schema-admission /absolute/private/review.json
pnpm exec tsx scripts/fit-block-time.ts --database-id LOCAL_ID --persist /absolute/private/d1 --schema-admission /absolute/private/review.json --write
pnpm exec tsx scripts/overview-backfill-proposal.ts --target local --database-id LOCAL_ID --persist /absolute/private/d1 --schema-admission /absolute/private/review.json --output-sql /absolute/private/backfill.sql
```

Inspect the fit before `--write`; fewer than 30 valid samples, sparse distance
bands or an unidentifiable fit retain the fixed prior. Commit and show the
coefficient diff. Check model monotonicity, clamps and the full plan checks.
`--write` changes only the coefficient module, never D1.

Review the proposal's schema/SQL hashes, per-user totals and every
`kept_unexplained` / `no_coordinates` row. Populated legacy distances should be
close to old totals divided by 1.1; missing or zero distances can instead gain
their computed great-circle values. Unresolved routes keep their stored
distance. Do not silently remap historical airport codes. Explain other deltas
from the underlying rows before application.

Execute the reviewed SQL on the local copy in one D1 batch. Bundle the operator
with `wrangler deploy --dry-run --config <operator-config> --outdir <private-dir>`.
Run the bundle in Miniflare with explicit `modulesRoot`/`scriptPath`, a local-only
token, and the same `d1Databases` ID / `d1Persist` as the restore. Call authenticated
`POST /repair` until `remaining` is zero, then `POST /refresh-leaderboards`.
Stop on any failed repair or lack of progress. `GET /status` must report `dirty:
0` and `metricsNull: 0`; repeat repair must report zero work. Leaderboard rows
must equal five times the eligible ready-user count.

Generate a new proposal to a new filename; require zero changes. Verify all
non-metric flight columns and canonical/reference records remain unchanged,
foreign keys remain valid, and every original earned badge row is intact. New
awards are allowed; revocation or changed historical award evidence is not.

## Rehearsal evidence — 7 October 2026

The user authorized one read-only production export and local rehearsal. No
production hold, mutation, operator deployment, secret setting, app deployment
or further remote read was performed. This export was not taken under a proven
writer hold; regenerate and compare under the production gates below.

| Check | Result |
|---|---|
| Export SHA-256 | `9c203950a2e7b8b62b7a0aaa7e893898ed0a8f96313b0e23271e066f3b51057c` |
| Export size / mode | 825,958 bytes / 0600 |
| Restore | 2,308 statements; ledger through `0007`; only `0008` added |
| Raw preservation before backfill | 33 application tables, 2,221 records, exact match |
| Foreign keys / local integrity | Zero violations / `ok` |
| Restored schema SHA-256 | `07ad94687c76d731e57b89b889084f3c6cc089f4334829853e617b27a756e902` |
| Fresh schema SHA-256 | `5a9c8f4e206985818971d176c52f053fed9d87fa30897de081a5cf878d8da359` |
| Semantic admission | All seven dimensions match; historical `user_advanced_stats` column order differs |
| Calibration | 315 valid samples, 13 skipped; RMSE 51.516435 minutes; commit `3c444cf` |
| Proposal | 411 of 412 flights, 18 users; SQL SHA-256 `ee40516fbd85d3652e4842c74d26b3acc96a0fd49984a60f576f1a7c77c5d8f2` |
| Classes | `times` 328, `route_median` 15, `estimate_replaced` 66, `kept_unexplained` 2, `distance_changed` 408, `zones_set` 408, `tz_filled` 39, `no_coordinates` 3 |
| Distance for previously populated journals | 773,324 → 703,878 km |
| Previously empty distance total | One journal gains 128,414 km; overall changed-user total becomes 832,292 km |
| Compiled local operator | Dry-run 57.31 KiB / gzip 13.43 KiB; 18 repaired, 0 failed, 0 remaining |
| Final status | 28 users, 412 flights, `dirty 0`, `metricsNull 0` |
| Leaderboards | 25 rows = 5 categories × 5 eligible ready users |
| Rerun | Zero proposal changes; repeat repair zero work |
| Preservation after repair | 26 canonical/reference tables unchanged outside approved metrics; all 134 historical badges preserved; 4 new awards |
| Checks | API 58 files / 635 tests; Next 105 files / 1,102 tests; API/scripts types and Next build passed |

The initial Python SQLite 3.39.4 comparison baseline rounded 58 airport
coordinate fields differently from the export literals. Node SQLite 3.53.3
restored those literals exactly; the complete comparison passed without a
tolerance or data rewrite. The full API suite includes the synthetic restore
preservation, private-path, populated-target and unknown-ledger refusal checks.
The populated-target regression also checks an ordinary table whose name would
match a reserved prefix through SQL LIKE wildcards; the guard uses literal-prefix
GLOB matching. A test-fixture SQLITE_BUSY failure was resolved by opening only
one Miniflare runtime at a time for each persistent namespace.

The three exceptional rows were flight 454 (MOW → MRU, distance 9,549 km kept),
486 (SAW → POD, unknown distance and unexplained duration 50 minutes kept) and
487 (POD → IST, unknown distance and unexplained duration 160 minutes kept).
Complete per-user manifests and exception reports remain in private temporary
storage; no journal records are committed here.

## Production sequence

1. **Separate authorization — writer hold.** Enumerate and hold every writer
   using the audit runbook: both app Workers, canonical/custom hosts, older
   immutable/Pages URLs, maintenance/import/background Workers, CI and operator
   scripts. Prove rejection and zero writes at every entrypoint. Keep cron held
   throughout migration, backfill, repair and app admission. Stop if any writer
   remains reachable.
2. **Separate authorization — backup/restore proof.** Under that hold, record
   the Time Travel bookmark, deployment/configuration identity and a fresh
   private export. Export is a remote read and briefly blocks D1. Restoration
   into another remote database is a separate approved write; local rehearsal
   is not permission for it. Prove exact raw preservation and recoverability
   before touching production.
3. **Separate authorization — read-only ledger check.** Use the deploy skill's
   `SELECT name FROM d1_migrations ORDER BY id`; do not use `migrations list`
   because it creates the ledger if absent. Require exactly the known prefix
   through `0007`. Missing, extra, reordered or partially applied schema is a
   stop condition. A pending `0008` blocks app deployment until this sequence
   admits and applies it.
4. **Separate authorization — pre-migration schema admission.** Review the held
   target against a fresh `0001`–`0007` fixture and the exact additive `0008`
   diff. Review all seven dimensions, object inventory and preservation. No
   missing objects or unexplained semantic differences may be waived by a hash
   file. Save the admitted target, schema, backup and candidate identities.
5. **Separate authorization — apply `0008`.** From the accepted Release 1
   checkout, confirm `0008` is the only pending file, then use the standard
   `wrangler d1 migrations apply kuuki-db --remote` procedure. Verify the new
   ledger row, both flight columns, the profile preference column and the route
   index on the explicit target; that remote verification also needs authorization. Do not run `0001` again, apply later
   migrations, or rewrite historical values during this schema step.
6. **Separate authorization — regenerate held-production proposal.** Review the
   post-`0008` schema against a fresh `0001`–`0008` fixture; create a new private
   pinned admission if needed. Run `overview-backfill-proposal.ts --target
   remote --account-id <explicit-account> --database-id <explicit-d1-id>
   --schema-admission <private-review> --output-sql <new-private-file>`. Compare
   the manifest and exceptions to rehearsal. Stop on unexplained drift; recheck
   source under hold immediately before application. Review CAS guards and SQL
   SHA-256. The artifact's `sourceFreshnessVerified: false` is not an acceptance.
7. **Separate authorization — execute the reviewed backfill SQL.** Confirm
   target IDs, hold, backup/restore proof, admission and exact file hash again.
   Apply the private SQL only to the named D1 using the audited file-execution
   procedure. Require each proposed flight UPDATE to affect one row; zero means
   drift, not permission to remove its guards. Keep the hold and forward-fix
   unexplained failures.
8. **Operator setup and publication — separate authorizations.** Set the named
   Worker's `OPERATOR_TOKEN` only after approval. If secret setup offers to
   create a missing Worker, stop for additional creation approval. Deploy the
   reviewed operator with the private explicit-target config only after a
   separate deployment approval. Then obtain separate approvals for the
   `/repair` loop and `/refresh-leaderboards`. Use authenticated requests with
   the token in private curl configuration, never command output. Require no
   failed repairs, `remaining 0`, and five categories for every eligible ready
   user. The authenticated status read also requires approval. Do not enable
   the maintenance cron or any Gemini provider.
9. **Separate authorization — final read-only verification.** Regenerate to a
   new private output filename and require zero changes. Read status and verify
   `dirty 0`, `metricsNull 0`, canonical preservation, historical badges and
   leaderboard/profile totals. Stop on any discrepancy; keep writers held.
10. **Separate authorization — delete the temporary operator.** Remove only
    `kuuki-overview-release-operator` after accepted verification. Deleting it
    neither deploys the app nor releases the hold. Retain private evidence.
11. **Separate authorization — deploy Release 1.** Follow every deploy-kuuki
    gate for the accepted main SHA, including separate preview/production
    approvals and remote ledger checks on both D1 targets. Preview migrations
    need their own isolated authorization; production success does not admit
    preview. Require the `0008` ledger row before either app deploy. Record the
    previous and new versions for both `kuuki-next` and `kuuki-activation`.
12. **Separate authorization — release hold, then smoke.** Reopen writers only
    after preservation and release identity are accepted. Separately authorize
    a verification-account flight creation; verify server distance, duration
    source and zones, plus profile and leaderboard totals. Remote reads and
    deletion of the verification flight need explicit authorization too. Return
    to the hold on failure. Do not enable scheduled enrichment or Release 2 as
    part of this release.

## Recovery

Keep the hold and forward-fix schema/backfill/publication failures after retaining
diagnostics and admitting the cause. Do not drop `0008`, revoke badges, erase
unrelated rows, remove CAS guards or restore automatically. A code rollback does
not roll back D1. Whole-database restore requires a separately approved hold,
preservation of post-release writes and reconciliation under the audit runbook.
Deploy-skill rollback actions still require their own authorization.
