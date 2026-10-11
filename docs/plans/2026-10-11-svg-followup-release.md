# SVG follow-up and Overview release — 11 October 2026

Status: released to production.

Released code: `05f5312dd4880ff45765a24fa839e6d800a5487b`. Includes the SVG review corrections `7ecccba7`, Overview performance `1cd15598`, narrator integration `47340fc7`, and Cloudflare verification migration `05f5312d`. A clean isolated clone supplied the build; the shared root's six unrelated uncommitted edits were excluded and remain unchanged.

## Deployment identity

| Worker             | Version                                | Traffic |
| ------------------ | -------------------------------------- | ------- |
| `kuuki-next`       | `8e32b74b-6edd-432f-bd1a-242bcb775219` | 100%    |
| `kuuki-activation` | `eb7cc355-14ea-4b92-b60e-2a2c95bd9d50` | 100%    |

Both versions were read back with tag `05f5312d`. Previous versions retained for rollback: app `c1a10f84-cec2-4161-bce3-174b3a661e84`, activation `06fd86a6-1f82-4284-b9df-200176661eb4`. Code rollback leaves D1 unchanged.

## Admission and checks

Cloudflare Workers Build `183a082d-2346-46f7-a9f4-1ecf52b01400` matched the exact candidate SHA and completed with `status: stopped`, `build_outcome: success`. Its logs confirmed `pnpm --workspace-root verify:cloudflare` completed before the preview version upload. The pipeline passed 123 Next unit files / 1,091 tests, 64 API test files / 701 tests, lint, format, typechecks, generated inventory and script regressions, preview isolation, import dry-run builds, OpenNext build and compiled Worker smoke. Cloudflare verification remains separate from manual production deployment.

The clean local candidate passed a fresh build (Node 24.18.0, 250 assets / 12,659,199 bytes / 75 API routes), formatting, lint, workspace and Worker types, all 1,091 Next unit tests, Worker smoke and all 40 navigation tests in 1.8 minutes. The follow-up author's focused real-component Chromium checks verified reset-password spacing, RU card stability, equal 114px figure boxes and map label clearance. Application source was unchanged by the final CI migration, so the same unit/navigation evidence applies.

The read-only production migration ledger contained all ten files, including `0008_flight_metrics.sql`, `0009_schedule_time_provenance.sql` and `0010_onboarding_state.sql`. No D1 writes occurred. Import Worker source, bindings and key were unchanged; the [prior release's import gates](2026-10-11-onboarding-svg-release.md) remain applicable. No import Worker redeployment or synthetic production accounts were needed.

## Production verification

- Canonical root returned HTTP 200 with HTML.
- Anonymous `/api/auth/get-session` returned HTTP 200 with `null`.
- Activation `/activate` returned HTTP 200 with HTML.
- Both fresh auth/figure CSS assets matched the clean candidate's SHA-256 bytes; the root HTML referenced the new auth CSS.
- Deployment status confirmed both new versions at 100% with tag `05f5312d`.

The earlier [GitHub Actions attempt](https://github.com/indi256s/kuuki/actions/runs/38152095552) never started because of an account billing/spending-limit block. The user approved local verification as a substitute, but the merged Cloudflare migration subsequently supplied successful exact-SHA native build evidence; the release satisfied the updated normal gate.

Private release logs and hashes: `~/.local/state/kuuki/releases/2026-10-11-svg-followup/` (directory `0700`, evidence files `0600`). No Worker tails remain. [Real iOS touch remains unverified](../../.scratch/svg-polish/issues/09-ios-touch-verification.md); the accepted ambient-motion tradeoff remains unchanged.
