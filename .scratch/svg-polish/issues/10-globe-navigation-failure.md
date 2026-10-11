# Globe navigation verification failure

Status: resolved

The 2026-10-11 full navigation run passed 38 of 39 tests. `apps/next/tests/map.test.ts:4` exhausted its 30-second budget while reading fullscreen WebGL layer bounds. A focused retry passed the sizing checks but failed at line 46: after `WEBGL_lose_context.loseContext()`, the fullscreen surface did not expose the expected unavailable status within ten seconds.

Reproduce after `pnpm next:build` with `KUUKI_NEXT_PORT=8896 pnpm --filter @kuuki/next exec playwright test --config tests/playwright.config.ts map.test.ts --grep 'overview globe keeps its canvas'`.

Investigate context-loss handling versus browser-fixture behavior, then rerun the complete navigation suite in the combined release candidate. This SVG polish commit does not change globe runtime code. Logs and trace from this checkout are under `/tmp/svg-resume-checks/` and `apps/next/test-results/map-the-overview-globe-kee-0de02--in-the-card-and-fullscreen/`.

## Answer

The existing globe readiness watchdog waits twelve seconds before publishing the unavailable state. The test's ten-second assertion deadline could not cover it, and its thirty-second overall budget also covered atlas loading, two viewport sizes and fullscreen creation. The combined candidate gives this existing test sixty seconds overall and fifteen seconds for the unavailable state; globe runtime is unchanged.

The complete combined navigation suite passed all forty tests, including fullscreen sizing and forced WebGL context loss. Evidence: `/tmp/kuuki-onboarding-release-20261011/combined-navigation.log`. Released code: `f93f96bc51f44fc4286913d7797ff0ceb6cd6e17`.
