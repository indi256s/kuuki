# Onboarding and SVG release — 11 October 2026

Status: released to production; subsequent performance work is separate.

Released code: `f93f96bc51f44fc4286913d7797ff0ceb6cd6e17`, on `main` and `origin/main`. Includes the onboarding merge `53c76a95` and the SVG candidate `ebc40746f87f8abc1c8646564b60147b4e6905e2`, integrated as `22313ee5`. The final commit fixes the preview-admission test fixture to provide an isolated import Worker config.

## Deployment identity

| Worker             | Version                                | Traffic |
| ------------------ | -------------------------------------- | ------- |
| `kuuki-next`       | `c1a10f84-cec2-4161-bce3-174b3a661e84` | 100%    |
| `kuuki-activation` | `06fd86a6-1f82-4284-b9df-200176661eb4` | 100%    |
| `kuuki-import`     | `6abb36b7-e86d-4ed6-89dc-b7f312574fed` | 100%    |

All three versions were read back with tag `f93f96bc` and production D1 `2a8e3895-6a98-4473-8d7b-a43ca0c0026f`. Maintenance is off. The app binds `IMPORT_JOBS` to `kuuki-import`; the import Worker has its provider secret and no public HTTP surface.

Before-cutover rollback targets: app `6c12d3a7-b438-4b70-8c08-a59e29c9c757`, activation `f56f2eb1-97ef-4a0b-b768-b017a190a89e`. Code rollback leaves the additive D1 migration in place; follow the deploy skill's import-job rollback procedure.

## Migration and preservation

Both production Workers were held before migration; the activation completion endpoint rejected writes. All 500 production Pages deployment URLs were fenced by Access, the fallback aliases served maintenance, and the preview bindings were isolated. The Pages Git deployment path remains disabled.

The held backup was independently restored and compared against all 2,291 existing rows in 35 application, sequence and ledger tables. The native D1 export rounded 58 airport coordinate values by at most `1.4210854715202004e-14`; the complete lossless backup supplements those coordinates from the held read-only snapshot using exact binary-ratio SQL expressions. Both exports and the Time Travel bookmark are retained privately.

Schema admission covered 80 application objects and all seven required dimensions, accepting only the historical `user_advanced_stats` column-order variant. Migration `0010_onboarding_state.sql` passed its held rehearsal and production application. Every original column and record was preserved; all 30 existing profiles received `COALESCE(updated_at, created_at)` as `onboarded_at`, and remote foreign-key checks found zero violations.

## Verification

- [Full CI passed for the released SHA](https://github.com/indi256s/kuuki/actions/runs/38145376557), including all three API shards and the runtime job.
- Combined checks passed: formatting, lint, type checks, 121 Next unit files / 1,012 tests, Worker smoke, and all 40 navigation tests. The globe test now allows the existing twelve-second unavailable watchdog; [the navigation issue is resolved](../../.scratch/svg-polish/issues/10-globe-navigation-failure.md).
- Fresh build passed: Node `24.18.0`, pnpm `9.15.9`, 246 assets / 12,651,655 bytes / 75 API routes.
- Preview and production model-path imports finished after their tabs were closed for more than thirty seconds. Real-provider checks passed for text, PDF and image transport using `gemini-3.5-flash-lite`.
- Production browser signup retained the same auth card through `/welcome/name`, then reached flights, review, ready and Overview. One extracted flight saved correctly. Revisiting `/welcome/name` after completion redirected to Overview.
- Production root and activation returned HTML with HTTP 200; anonymous session lookup returned HTTP 200 with `null`.
- Both owned synthetic accounts were deleted through the authenticated account API. Final production totals matched the original 30 profiles and 414 flights.

Private backups and release evidence: `~/.local/state/kuuki/releases/2026-10-11-onboarding-svg/` (directory `0700`, files `0600`). Generated credential copies were removed.

[Real iOS Safari touch behavior remains unverified](../../.scratch/svg-polish/issues/09-ios-touch-verification.md). The documented ambient-motion accessibility tradeoff remains accepted.
