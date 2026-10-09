# Legacy cleanup handoff

Snapshot: 2026-10-06. Owner: `chore/legacy-cleanup` in
`/Users/indi256/Documents/kuuki/kuuki`; base `65107ee`. Locate the owning checkout
with `git worktree list` before continuing.

Scope and decisions: [plan](2026-10-06-legacy-cleanup.md) and
[audit dispositions](../audits/2026-10-06-legacy-code-audit.md). Local cleanup only;
no deploy, public API retirement, database writes or worktree deletion.

Accepted implementation: accent precedence regression fix; obsolete local-draft
flow and confirmed CSS/Vite orphans removed; seven shared libraries moved to
private `@kuuki/client`; explicit flight/claim client rows; dead helpers/config
pruned; coupled constants reused; historical docs and retirement gates clarified.
Privacy sweep, rollback/PWA, exposed APIs and historical data/tools remain.
Independent full-diff review found no actionable regressions. The first build
found a deletion-induced CSS brace error; it was fixed and all changed CSS now
parse. Next matcher declaration resolution uses the app's installed Vitest. The initial
Next unit run failed because DOM matchers were not registered on its expect;
explicit registration in setup fixed the focused reproduction and full suite.
The exact underlying dependency-resolution mechanism was not established.

Preservation: all 279 ignored redesign ledger files remain in their original
checkout. Additional local archive:
`.scratch/legacy-cleanup/redesign-ledgers.tar.gz`, SHA-256
`59dda1c75733baaeeac8782af2380c91be9d94ab2982163d1f90c6a7ee236256`.
This private evidence is not published; no worktree was removed.

Final checks: all passed against the accepted implementation.

| Check           | Evidence                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API units       | 45 files, 515 tests; `/tmp/kuuki-legacy-tests.log`                                                                                                          |
| Next units      | 101 files, 1,060 tests; `/tmp/kuuki-legacy-next-units.log`                                                                                                  |
| Vite units      | 12 files, 65 tests; `/tmp/kuuki-legacy-web-units.log`                                                                                                       |
| Full navigation | 102 tests; `/tmp/kuuki-legacy-navigation.log`                                                                                                               |
| Types and lint  | workspace, API, scripts, maintenance, import, Worker and final Next; `/tmp/kuuki-legacy-*-types.log`, `*-lint.log`                                          |
| Builds          | Next including embedded Vite, standalone Vite and maintenance dry-run; `*-build.log`                                                                        |
| Runtime         | composed and boundary smoke; local compiled Next→Pages rollback/session/receipt/mutations/cron rehearsal; `*-smoke.log`, `*-boundary.log`, `*-rollback.log` |
| Other checks    | preview tests/config, map geometry, local artifact admission, 106 documentation links, CSS parsing and diff whitespace                                      |

The initial chained `pnpm test` accepted API and failed Next setup; after fixing
that setup, both frontend legs were rerun successfully. No API behavior changed
after its accepted result. Independent full-diff and narrow setup review found
no actionable findings. All source edits are local to this branch.

Update, 2026-10-06: cleanup commit `f3e2b1c` was merged and pushed to `main`.
GitHub CI/CD run `37434105774` and React Doctor run `37434105847` passed;
deployment jobs were skipped by the existing release guards. The user then
authorized the controlled staging/production release and legacy data transfer.
Continue from the [Next release handoff](2026-10-06-next-release-handoff.md),
which records the owning checkout, accepted hosted progress and remaining gates.
The Vite rollback surface remains until a separately accepted retirement decision.
