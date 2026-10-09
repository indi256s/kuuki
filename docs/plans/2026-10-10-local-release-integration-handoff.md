# Local release integration

Status: source review and functional checks passed; integrated measurement recorded with the timing limit below.

The integration combines Journal `300e9b3c` and Overview audit `5ca3acec`, including its aircraft-enrichment history. All eleven outstanding branch commits are included. The two older Overview commits already existed on main as equivalent patches. Journal agent branches are integrated or superseded and need no additional merge.

Conflict resolution preserves the new continuous Journal, signed Undo and authoritative reconciliation. Obsolete Journal rows/styles/tests remain deleted; local airline logos now use the new ledger with mono fallback and no tile. Overview keeps the measured layout and chapters plus incoming accessibility, country-card and replay fixes; comparison removal is intentional. DESIGN.md retains both scoped contracts.

The completed animated-icon changes from the original checkout were copied into this integration: navigation, Add, import manual rows and Overview filters use the adapted Plus/LayoutGrid/Stamp components with the MIT notice. The source checkout was left untouched; transient scratch files, screenshots and untracked research were not folded into application changes.

Independent review found a Radix version mismatch: dropdown-menu 2.1.25 used a separate focus-scope stack from the held dialog/popover versions, stealing keyboard focus from menus inside sheets. Holding dropdown-menu at 2.1.16 restores the shared stack. One real Sheet/Menu regression reproduced the failure before the fix and passed afterward; all 16 Sheet/Dialog tests passed. The fresh Sol 6.1 high review reported no remaining findings.

## Verification

- Frozen-lockfile install passed for the combined dependency graph.
- Focused Overview checks: 103 tests across 15 files. Journal ledger: 11 tests, including failed-logo fallback. Animated-icon consumers passed ESLint and Next typecheck.
- Full API suite: 57 files, 649 tests (`/tmp/journal-integration-all-tests.log`); API source and its dependency graph are unchanged by the final Radix hold. Final full client suite: 110 files, 914 tests (`/tmp/journal-integration-final-client.log`).
- Final frozen-lockfile install, workspace typecheck and lint passed (`/tmp/journal-integration-final-{install,types,lint}.log`). API typecheck passed (`/tmp/journal-integration-api-types.log`). Final production Next/OpenNext build passed (`/tmp/journal-integration-final-build.log`): 246 assets, 12,443,021 static bytes and 74 API routes.
- Final Worker typecheck passed (`/tmp/journal-integration-final-worker-types.log`); scripts, maintenance, import and release-operator typechecks passed. Final composed Worker smoke and share-card checks passed on port 8815 (`/tmp/journal-integration-final-smoke.log`).
- Final full browser suite: all 39 journeys passed after the Radix hold, port 8815 (`/tmp/journal-integration-final-navigation.log`).

The final 1,000-flight measurement verified 993 default matching DOM rows and completed every probe without runtime errors. Payload gzip is 41,444 bytes. At 4× CPU throttle, the median interaction proxy is 1.622 seconds, above the 1.5-second target; FCP/LCP medians are 0.508/0.840 seconds. Two unrelated Node processes were consuming roughly 119%/129% CPU and were left untouched, so a quieter-host retest is needed to establish the target. The existing progressive-render fallback remains in place. Details and raw artifacts are linked from Journal spec D3 and issue 18; the earlier passing median is historical. No physical-phone performance claim is made.

No push, PR, deployment or remote D1 write was performed.
