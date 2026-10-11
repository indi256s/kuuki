# Final SVG polish fixes

Status: resolved

All eleven final-review fixes and the podium refinements landed before the Sonnet agent's rate-limit failure. The resumed parent checked their source and regenerated isolated renders from current builders, CSS and the real AuthCard.

- Password-field spacing survives the form/create swap. Mutation-frame measurements in Russian at 390px and 1280px show identical input and heading positions before and immediately after the step changes; the subsequent layout morph retains input spacing.
- Short-phone planes use `top: max(-56px, 100% - 302px)`. The 390×640 render retains the whole watermark and a populated plane field.
- Lit map dashes are wider and glowing; bow is 14, and the destination label sits above the fold.
- Fleet rods stand at the tail. Podium steps are 16/12/9px, numerals 8px, and the full tile uses the shared 148px figure width.
- Tape tag plate uses the shared paint mixed toward text. Computed contrast is 6.67–7.23:1 in light and 6.74–9.35:1 in dark across shu, sakura, ai, matcha and asagi.
- Dawn fades the old Horizon layer over 150ms. Browser animation inspection confirms that fade alongside the 500ms theme sweep.
- Russian headings reserve two lines at widths where the welcome heading wraps; first-frame measurements cover desktop and phone.
- Half-tile figures share a 114px bottom-aligned figure area, including 2px top padding around the tallest 112px figure.
- The single-reading clock header takes the shared 60ms-delay/200ms hover pose; reduced motion preserves lighting with no snooze movement.
- DESIGN.md describes 31 mobile planes and the completed motion contracts.

## Verification

2026-10-11: typecheck, lint (one existing capture/flight-form warning), scoped formatting, 95 unit-test files / 762 tests and the OpenNext production build passed. Fresh isolated Chromium checks used agent-browser; screenshots and logs are under `/tmp/svg-resume-checks/`. Existing batch simulations establish zero plane overlaps over one hour; layout arrays and lap grouping are unchanged by the final fixes.

Sol high completed the final scoped code review with no blockers. The earlier Opus high visual review passed with small fixes. The fresh follow-up was initially rate-limited, then resumed and identified four remaining defects; their corrections and focused verification are recorded in issue 11.

The original navigation suite completed with 38 passes and one failure in `tests/map.test.ts:4`, the fullscreen globe canvas check: its 30-second test budget expired while reading the fullscreen WebGL layer bounds. A focused retry reached fullscreen but failed at line 46: forcing WebGL context loss did not produce the expected `Globe unavailable.` status within ten seconds. The combined release owner resolved the fixture's insufficient timeout budgets in issue 10; globe runtime was unchanged. After the resumed Opus corrections, a fresh build and all 40 navigation tests passed. This thread performed no deployment.
