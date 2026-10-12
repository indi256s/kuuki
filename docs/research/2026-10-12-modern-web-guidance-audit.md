# Modern web guidance audit — 12 October 2026

The initial read-only audit found three actionable source findings, four performance follow-ups, and three reproducible existing control-test failures. All seven findings were subsequently addressed; implementation and verification evidence is recorded below. The findings do not establish production Core Web Vitals or visual/accessibility acceptance.

## Scope and evidence

Audited the current working tree at HEAD `a531c0f990a48b137556ea84206e9839fe100abd`, including existing uncommitted changes. Source findings refer to that tree, not the clean commit or a deployed release. Installed application versions: Next 16.3.8, React 19.3.0, MapLibre 6.14.0, PDF.js 6.4.299 and zxing-wasm 3.1.5.

Research ran first in three independent GPT-6.1 Sol agents with medium reasoning: CSS/layout/compatibility; interaction/accessibility/browser lifecycle; performance/framework/loading. The primary agent checked candidate paths, consulted primary sources, withdrew unsupported candidates and ran existing checks. Project coding and design contracts remained authoritative.

The `modern-web-guidance` CLI was searched with action-oriented queries using skill version `2026_09_04-7de96777`, then relevant guides were retrieved and read:

- Layout: `css-layout`, `responsive-design`, `defer-rendering-heavy-content`, `css`.
- Interaction: `accessibility`, `forms`, `ime-safe-enter-submit`, `platform-controls-dismiss-dialog`.
- Performance: `performance`, `improve-next-page-load-performance`, `optimize-script-priority`, `optimize-preload-priority`.

Guide suggestions were checked against installed framework/dependency source and primary documentation where support or behavior mattered. A guide's recommendation to use a newer API was not itself treated as evidence of a defect. No explicit project browser-version policy was found; compatibility findings therefore state the affected conditions rather than assuming every current browser is affected.

## Actionable source findings

### 1. P2 — IME confirmation can toggle an Overview filter

[filter-panel.tsx:147](../../apps/next/src/client/overview/filters/filter-panel.tsx#L147) interprets Arrow keys and Enter as filter commands without checking composition. Enter used to confirm an IME candidate can toggle the highlighted filter before the user deliberately selects it. This applies to composing events generally, not only older Safari.

Smallest repair: use the existing `nativeEvent.isComposing || nativeEvent.keyCode === 229` early return from [combobox.tsx:129](../../apps/next/src/client/ui/combobox.tsx#L129). Preserve ordinary selection and add one focused composing-Enter regression at the filter boundary.

Confidence: high for the code path; no real IME/browser reproduction. [UI Events composition requirements](https://www.w3.org/TR/uievents/#events-composition-key-events) and [WebKit's event-order issue](https://bugs.webkit.org/show_bug.cgi?id=165004) explain why custom keyboard commands need composition handling.

### 2. P2 — Inline edits can save when older Safari confirms IME text

[inline-edit.tsx:212](../../apps/next/src/client/ui/inline-edit.tsx#L212) and [flight-detail.tsx:493](../../apps/next/src/client/journal/flight-detail.tsx#L493) use `isComposing` in capture and bubble handlers, but omit the `keyCode === 229` fallback already present in Combobox. On Safari versions affected by the historical event-order bug, confirming Enter arrives with `isComposing=false`. A child Combobox returning early does not stop the parent bubble handler from saving.

Smallest repair: add the existing fallback in both capture and bubble paths in both owners. Check a composing event with `isComposing=false`, `keyCode=229`, and ordinary deliberate Enter. Modifier submission shortcuts are not implicated by this finding.

Confidence: high for affected older Safari versions; the supported-version floor is unspecified. [WebKit issue 165004](https://bugs.webkit.org/show_bug.cgi?id=165004) records the behavior and its April 2026 main-branch fix. This is not a claim that all current Safari versions still have the platform bug.

### 3. P2 — Journal offscreen estimates overcount padding

[ledger.css:135](../../apps/next/src/client/journal/ledger.css#L135) reserves `auto 72px` intrinsic size while the row adds 24px vertical padding. The estimate describes the inner size, so an unseen desktop row reserves 96px while a normal rendered row is 72px. The connector's `auto 32px` plus 8px padding similarly reserves 40px for a normal 28px single-line row. Mobile cards inherit the desktop estimate despite different padding and three content rows.

The result is an inaccurate initial scroll extent that changes as unseen rows render. Browser scroll anchoring may compensate for some visible movement; the audit has not measured jump-to-row or scrollbar displacement.

Smallest repair: use `contain-intrinsic-block-size: auto 48px` for normal desktop flight rows and `auto 20px` for single-line connectors. Measure representative mobile cards before choosing their separate estimate. Retain `auto` so rendered dimensions are remembered; do not add a virtualizer.

Confidence: high for the box accounting, unmeasured for runtime severity. [CSSWG's intrinsic-size definition](https://drafts.csswg.org/css-sizing-4/#intrinsic-size-override) specifies inner sizes and remembered inner dimensions. The linked document is an editor's draft.

## Performance follow-ups requiring measurement

### 4. Barcode decoding executes synchronously on the main thread

[barcode-reader.ts:170](../../apps/next/src/client/import/barcode-reader.ts#L170) awaits `readBarcodes`, but the installed decoder performs a synchronous grayscale loop and synchronous WASM decode after module readiness (`zxing-wasm/dist/es/share.js:609–637`). The image retry permits a 3,000px longest side, up to nine million pixels. A Promise does not move that CPU work off-thread.

Execution ownership is confirmed; the duration and user-visible freeze on representative phones are unmeasured. Profile a difficult image first. If it blocks interaction, move the existing decode into a dedicated Worker, transfer pixel buffers and terminate obsolete work. Preserve local-only handling, file validation and allowlisted output. [Long-task guidance](https://web.dev/articles/optimize-long-tasks), [decoder source](https://github.com/Sec-ant/zxing-wasm).

### 5. Mobile tiles eagerly depend on full Overview chapters

[registry.ts:7](../../apps/next/src/client/overview/sections/registry.ts#L7) statically imports all full Section components alongside tiles. Both the initial Overview page and mobile chapter sheet use this registry. [lazy-chart.tsx:21](../../apps/next/src/client/overview/charts/lazy-chart.tsx#L21) delays mounting, not static dependency loading.

The eager import graph is confirmed; transferred bytes and startup cost need a fresh production chunk analysis. If material, keep tiles and metadata eager and lazy-load full sections using the existing localized loading treatment. Verify adjacent chapter swipe/preloading before claiming savings. Installed Next 16.3.8's `dist/docs/01-app/02-guides/lazy-loading.md` supports this pattern; the [public Next guide](https://nextjs.org/docs/app/guides/lazy-loading) provides the same general guidance but currently displays a newer release.

### 6. Globe filters reconstruct invariant route geometry

[maplibre-globe.tsx:117](../../apps/next/src/client/overview/globe/maplibre-globe.tsx#L117) regenerates all-time route and upcoming-flight great-circle coordinates in a memo dependent on the filtered globe. [maplibre-globe.tsx:394](../../apps/next/src/client/overview/globe/maplibre-globe.tsx#L394) then replaces full route, airport and microstate GeoJSON. Endpoints generally remain unchanged when selected/bucket properties change. Fullscreen also mounts a second globe surface.

Repeated work is confirmed; high-cardinality filter latency is unmeasured. First separate geometry memoization by all-time routes/endpoints from filtered properties. Profile before adopting feature-state updates or larger restructuring. [MapLibre large-data guidance](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/).

### 7. Aborted PDF reads keep rendering until the next check

[quick-add-source.tsx:119](../../apps/next/src/client/import/quick-add-source.tsx#L119) aborts replaced selections and rejects stale results correctly. However, [barcode-reader.ts:105](../../apps/next/src/client/import/barcode-reader.ts#L105) does not connect that signal to the PDF loading task or current render task. Aborts are checked between pages and after rasterization; destruction runs in `finally` after the current await finishes. Replacing a file can therefore overlap old PDF work with the new read.

Cancellation placement is confirmed; resource impact is unmeasured. Connect abort to supported loading-task destruction and render-task cancellation, clean up listeners, and retain stale-result checks. This is a resource-lifecycle issue, not evidence of stale data being saved. [PDF.js loading-task API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html).

## Verification

- `pnpm --filter @kuuki/next lint`: passed.
- `pnpm --filter @kuuki/next typecheck`: passed.
- `pnpm --filter @kuuki/next test`: 1,321 passed, 3 failed across 148 files.
- Isolated Dialog, Popover and Sheet rerun: 28 passed, the same 3 failed.

Reproduced failures: `dialog.test.tsx:90` loses the closing dialog before animation completion; `popover.test.tsx:106` restores trigger focus instead of keeping outside focus; `sheet.test.tsx:146` does not close on the second outside press after menu dismissal. These exact failures were already recorded in the [control-lifecycle issue](../../.scratch/motion-reference/issues/01-control-lifecycle-verification-failures.md) and [motion audit](2026-10-12-motion-reference-audit.md). They are not new regressions introduced by this read-only audit. Their browser/product causes remain unestablished.

Focused dependency triage suggests two test artifacts: the Dialog test freezes `animationName` in the style object cached by Radix Presence 1.1.11, and the Sheet test's second gesture sends only pointer-down while Dialog 1.2.0/DismissableLayer 1.1.20 defer outside dismissal to click. The Popover failure occurs only in the fixture variant whose changing ref callback focuses its input on attachment; fixture-induced focus is plausible but unresolved. Repair or instrument those fixtures before changing production controls. This does not dismiss the separate capture browser focus failure already recorded in the existing issue.

Local logs: `/tmp/kuuki-modern-web-lint.log`, `/tmp/kuuki-modern-web-typecheck.log`, `/tmp/kuuki-modern-web-tests.log`, `/tmp/kuuki-modern-web-controls.log`. Logs and raw retrieved guidance are temporary evidence, not committed artifacts.

## Coverage and exclusions

Inventory and focused inspection covered CSS/global shell, Journal rows and loading, shared dialogs/sheets/popovers/combobox/forms, auth and welcome controls, Overview desktop/mobile charts and globe, Passport/Profile/Leaderboard layout, navigation/loading boundaries, browser identity/lifecycle helpers, API transport, bootstrap, fonts and document decoding. This was not a line-by-line review of every frontend file.

Useful existing behavior was retained: Radix-based modal focus handling, Sheet keyboard alternatives, reduced-motion branches, API feature detection, transport cancellation/deadlines, full primary-route prefetch, deferred Journal editor and Passport renderer, native Passport view history, and scoped map asset caching. Unsupported scroll-driven enhancements degrade to simpler behavior; unsupported `content-visibility` renders all rows. No verified need for native dialog/popover migration, polyfills, Speculation Rules, blanket preloads or new dependencies was found.

The proposed gross Journal overflow at intermediate width was withdrawn after correcting the minimum-track arithmetic. Narrow route/firsts collisions need measurement before becoming a finding. The [7–8 October performance audit](2026-10-07-performance-audit.md) remains historical evidence: its timings and bundle sizes do not measure today's Overview or React version.

During the initial read-only audit, no build, browser automation, screenshots, zoom/device matrix, screen-reader evaluation, field CWV collection or new regression tests were performed. No source fix, commit, PR, deployment or remote mutation was made in that phase. Suggested order at that point: resolve the existing control verification failures; repair the two IME boundaries and Journal estimates; then profile the four performance follow-ups before choosing larger changes.

## Remediation follow-up — 12 October 2026

Three GPT-6.1 Sol agents with medium reasoning implemented the interaction, Overview/layout and decoder changes. A separate Sol 6.1 medium agent reviewed every scoped changed/new file and found no blockers. Unrelated working-tree edits were preserved; no dependencies were added.

| Finding               | Implemented behavior                                                                                                                                                           | Evidence                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — Filter IME        | Composition and Safari key-code 229 return before Arrow/Enter filter commands.                                                                                                 | Both event variants retain selection until deliberate Enter.                                                                                                                         |
| 2 — Inline edit IME   | Both capture and bubble handlers in InlineEdit and FlightDetail share the existing composition guard.                                                                          | Ordinary Enter still saves; candidate confirmation does not.                                                                                                                         |
| 3 — Journal estimates | Block-only remembered inner estimates: flights 48px desktop / 124px mobile; connectors 20px. Selection positioning specificity also repaired.                                  | Synthetic rows measured at 1440px: 72px with the repaired selection selector; at 390px: 158px including 32px padding and 2px border.                                                 |
| 4 — Decoder ownership | Dedicated module worker performs WASM decoding and BCBP projection; only allowlisted fields return. Pixel buffers transfer; workers terminate on completion, failure or abort. | Real PNG and PDF barcode imports pass in the compiled browser fixture; abort and late-result unit checks pass.                                                                       |
| 5 — Chapter imports   | Tiles/metadata remain eager; full sections use static-path `next/dynamic` imports and a localized skeleton. SSR remains enabled.                                               | Mobile initial page has six eligible tiles and no chapter slides. Opening Rankings requests two additional JS chunks; paging to Routes updates heading/navigation and loads content. |
| 6 — Geometry          | All-time route/ghost geometry memo is separate from filtered selection/bucket properties.                                                                                      | Filters preserve geometry-call count; changed airport coordinates rebuild it.                                                                                                        |
| 7 — PDF abort         | Abort destroys the loading task and cancels the active render; cleanup releases canvas/page resources and listeners.                                                           | Loading/render cancellation regressions pass; actual PDF decoding also passes.                                                                                                       |

Calibration corrected an additional related selector conflict: the shared clickable-control `:is(...)` selector had higher specificity than the checkbox's absolute-position rule, putting the checkbox into the desktop grid and producing 90–94px rows. Giving the positioning rule the row ancestor restores its intended placement and 72px rows. The mobile estimate was checked against the synthetic multi-line route/airline cards; variable content can still grow, and `auto` remembers rendered dimensions.

The three carried control unit failures were repaired in fixtures: a live animation-name getter for Radix Presence's cached style object; a stable focus ref; a complete outside click after menu dismissal. No production control change was needed. The separate capture Escape/focus browser case passes in the current tree; this follow-up does not attribute its earlier failure to those fixture repairs.

Regression sensitivity was checked by temporarily restoring original IME/geometry source under the new tests: five failures appeared, including geometry recomputation (six calls instead of two). Fixed source was restored before the combined verification.

Combined checks: 1,335 unit tests across 151 files passed; lint, typecheck and production OpenNext build passed. All 44 navigation/browser tests passed on the compiled fixture, including capture focus, PNG/PDF local decoding, map interaction and account isolation. After the final selector repair, a fresh production build and all 44 navigation tests passed again. Scoped formatting and diff-whitespace checks also passed. Local logs are `/tmp/kuuki-modern-web-fixes-{tests,lint,types,build,navigation}.log` and final build/navigation rerun logs. The original audit evidence above remains historical.

No deployment, remote mutation, real-device IME test or field Core Web Vitals collection was performed. No numeric startup/interaction speed improvement is claimed. WASM initializes per attempt in a short-lived worker; browser cache reuse avoids repeat downloads, but representative-phone latency and memory remain unmeasured.
