# Thermos remediation handoff

Owner: this thread, shared `main` at `/Users/indi256/Documents/kuuki/kuuki`.
Base: `096badbb7b38a8a208425b8c0bafd35e60ae9019`.
Scope: all three findings and four maintainability items in the [Thermos audit](../../.scratch/thermos-2026-10-16-096badbb/review.md), plus its generated-CSS whitespace issue and observed motion test synchronization failure.

Source implementation, independent review and local verification are complete. No check waivers requested. The initial remediation performed no commit, staging changes, push, publication, deployment or remote data writes. The subsequent user instruction “and then deploy” authorizes preparing and publishing this owned release through deploy-kuuki; unrelated journal/docs changes remain excluded. Deployment evidence will be recorded in `.scratch/thermos-2026-10-16-096badbb/release.md`.

## Accepted changes

- Leaderboard pagination rejects obsolete success, failure and finalization after switching away and back; lane reuse remains intact.
- Ground vehicle selection shares the canonical complete-journey distance and per-journey rounding rule. API metadata preserves actual normalized ICAO; the client alone chooses artwork fallback.
- OpenFlights import rejects malformed or unreadable existing catalogs before either output is written; only missing files initialize empty catalogs. Manual/legacy fields retain existing merge behavior.
- Both lane generators and Concorde verify the existing anatomy lock before importing or writing. Setup and the pinned commit are documented in [lane generation](../../scripts/leaderboard-lanes/README.md).
- Shared `OwnFlight` matches the API projection; write inputs use admitted fields, receipt ownership is separate, and obsolete write-side metric estimation and synthetic owner fields are removed. Legacy admitted metrics remain replayable under original receipt keys.
- The motion test waits for observer registration after each mount. Generated CSS formatting is fixed at its installer.

## Candidate and ownership

Isolated candidate: `/tmp/kuuki-thermos-remediation-20261016/repo`, built from the base plus task-owned changes. Unrelated journal/docs work is preserved in the shared checkout and excluded from these integrated checks; `DESIGN.md` includes only the owned Race lanes paragraph in the candidate.

Source identity SHA-256: `15497e873b80d906c9be45c5773ed7112fc390f14f7299bfc5d7f7e330ade2ec`. All 30 implementation/test file hashes match the shared checkout. Markdown formatting and final evidence notes were updated after the freeze; implementation remained unchanged.

Owned paths are the capture/account/import callers, auth motion test, leaderboard client/tests/generated CSS, API flight mapper/validation and leaderboard service/tests, shared flight types/validation/ground distance, client flight transport, importer/test/Vitest include, anatomy verifier/Concorde/lane tooling and documentation, and this plan/handoff. Exact inventory and hashes: `/tmp/kuuki-thermos-remediation-20261016/owned-files.json`; complete reviewed patch: `owned.diff` beside it. The original 19 dirty journal/docs files and other local scratch artifacts belong to other work; only the documented Race lanes paragraph in `DESIGN.md` was edited here.

## Verification

- `pnpm test`: 77 API/shared/data files, **980 tests passed**; 209 Next files, **1,837 tests passed**.
- API, maintenance, import, scripts and client TypeScript checks: passed. Next lint: passed with existing warnings.
- Package builds and `pnpm next:build`: passed; 83 API routes and 1,189 assets.
- Next route generation/TypeScript and composed Worker typecheck: passed.
- `pnpm test:next:navigation`: **55 passed** (2.2 minutes), exit 0.
- Scoped format and whitespace checks: passed. Source hashes match the tested candidate.
- Independent review read the complete 1,725-line owned patch, requirements and focused evidence: approved with no severity findings. [Review report](../../.scratch/thermos-2026-10-16-096badbb/remediation-independent-review.md).

Focused regressions demonstrated pre-fix failures, then passed: obsolete leaderboard success/error responses; incomplete ground journey; malformed/read-error catalog preservation. Existing flight capture/import/export tests passed (101 tests). Pin verification rejected all nine altered inputs for both generators (18 checks) and missing inputs without replacing outputs; valid generation and the existing Concorde check passed. Installed art/mapping hashes are unchanged apart from the CSS newline fix.

## Input inventory and evidence

- Source: current task-owned working files listed in the manifest, not yet committed. Preserve their contents when resuming in this checkout; another checkout needs these exact files/patch.
- Reproducible: frozen lockfile install, commands above, real CLI importer tests in `scripts/import-openflights.test.ts`, and anatomy setup/pin in the generator READMEs. No private inputs required.
- Checkout-local: `.scratch/thermos-2026-10-16-096badbb/` contains the original audit, three worker reports, flight-contract focused logs and independent review. Integrated logs and candidate manifest are in `/tmp/kuuki-thermos-remediation-20261016/`; leaderboard regression logs are `/tmp/kuuki-leaderboard-w1a-*.log`; importer/pin evidence is `/tmp/kuuki-tooling-tests-IaK08c/`. These logs are local evidence, not required production inputs.

No further implementation or local verification remains for this scope. Release preparation is now authorized; use the shared-checkout procedure to commit only these owned changes and the native Cloudflare exact-SHA gate before production. Local implementation does not establish production release acceptance. Importer output replacement remains sequential rather than crash-atomic; crash recovery was outside the malformed/read-error finding. No landing or recovery is pending.
