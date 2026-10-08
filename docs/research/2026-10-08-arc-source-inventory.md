# Arc source inventory

Status: W1–W5 local implementation, recorded 2026-10-08; final integrated acceptance is tracked in the handoff. The acquisition tables retain the exact fetched source hashes. Adaptations use the existing Kuuki controls and local SVG composition; the adoption map below identifies their actual callers.

Plan: [2026-10-08-arc-integration.md](../plans/2026-10-08-arc-integration.md). Base revision 4b4fe54e1df31c486fb2de8b47970e82bc824ded.

## Upstream and licence

| Item | Value |
|---|---|
| Fetched (UTC) | 2026-10-08T09:50:43Z |
| Catalog | https://uiarc.dev/llms.txt — "129 of 240 items are free" |
| Registry index | https://uiarc.dev/r/registry.json — 132 items, every `meta.tier` = `free` (Pro items are not in this index) |
| Item source | https://uiarc.dev/r/{name}.json (shadcn registry-item JSON with inline `files[].content`) |
| Component markdown | `meta.markdown` of each item; blocks at https://uiarc.dev/components/blocks/{name}/markdown |
| Licence page | https://uiarc.dev/license (HTML, "Last updated September 26, 2026"; banner says the text is a **draft not yet reviewed by a lawyer**) |
| Public repo | https://github.com/kuratlielia/arc-library — raw `LICENSE` fetched from `main` |
| Free-tier licence | MIT, Copyright (c) 2026 Elia Kuratli. Full text in `apps/next/src/client/ui/ARC-LICENSE.txt` |
| Pro | Not fetched or reconstructed. The licence forbids redistributing Pro source; no `@uiarc-pro` access used |

Evidence of tier: all 70 fetched items carry `meta.tier` (or foundation entries) `free` and returned HTTP 200 without credentials; the script asserted this per item. The MIT text on the licence page and in the GitHub `LICENSE` is identical in wording. Risk to carry: the page's "draft" banner means the licence may change; the MIT grant applies to what was fetched on this date and the notice must stay with copied source.

Hashes (SHA256) of catalog files, staged as retrieved:

| File | SHA256 |
|---|---|
| catalog/llms.txt | `cf66acdf19f44225776d2ae11908eb9f433fcb9f1ae040e0bd0fdf3604a3f7b1` |
| catalog/registry.json | `26c8c56a77088cc4d8949432785c48bd3b614a398e0faf80d7a8e2f4d4038cc5` |
| catalog/license (HTML) | `bc046b425387455e1275c48e6b0f77374a94e6c95b223d3ce5cb81e72252f521` |
| catalog/github-LICENSE.txt | `1b73a3fbab233cb995e6e9b6a63d302f91975c74c1629919c8e9820902820dde` |

## Staging layout (temporary, not committed)

`/tmp/kuuki-arc-source/` — `catalog/` (index, licence, headers), `registry/<item>.json` (exact registry bytes), `src/<item>/<registry path>` (files extracted from `content`, byte-identical), `markdown/<item>.md` (+ `block-*.md`), `SHA256SUMS-{registry-json,files,markdown}`, `external-imports.json`, `fetched-items.json`. /tmp is volatile: re-fetch from the URLs above and compare against the hashes in this doc before adapting. Local adaptations are identified below and in source headers; their behavior changes from upstream are recorded here against these hashes.

## Dependencies

Registry items declare only these npm packages (no versions pinned by Arc): `motion`, `lucide-react`, `@radix-ui/react-{accordion,checkbox,dialog,dropdown-menu,popover,select,switch,tabs,tooltip}`. Source also imports `react`, `react-dom`, and (one block) `next`; every non-relative import maps to those. All relative imports resolve inside the fetched set via each file's `target` (`@components/arc/lib/{motion-tokens,arc-provider,use-today,use-copy-feedback,media}`, `motion-tokens.ts`).

| Package | Installed in apps/next | Needed by (fetched) | Version note (npm 2026-10-08) |
|---|---|---|---|
| `motion` | absent after W5 | upstream components (`motion/react`) | 14.0.0 was admitted during the pilot, then removed after caller proof. Local SVG/CSS updates and existing motion primitives require no Motion import; do not install an unused runtime. |
| `lucide-react` | ^0.563.0 | combobox, action-button, split-button, button-group, … | already present |
| `@radix-ui/react-dialog` | 1.1.15 | dialog, drawer, bottom-sheet | present; npm latest 1.2.0 — do not bump just for Arc |
| `@radix-ui/react-dropdown-menu` | 2.1.16 | dropdown/context/split/button-group/user-menu | present; latest 2.1.25 |
| `@radix-ui/react-popover` | 1.1.15 | popover, date pickers | present; latest 1.2.0 |
| `@radix-ui/react-{select,checkbox,switch,tabs,tooltip,accordion}` | absent | select, checkbox/signup-form, switch, tabs, tooltip/floating-button-group, accordion | W1 decides per actual caller; latest select 2.3.8, checkbox 1.3.12, switch 1.3.8, tabs 1.1.22, tooltip 1.3.0, accordion 1.2.21. Plan prefers keeping existing CSS/React/Radix for equivalent simple controls (Switch/Segmented/Disclosure), so several may stay uninstalled |
| `@tanstack/charts` | removed from root/app and lock | — (not an Arc dep) | All production/test consumers, including the PNG share-card SVG, have local equivalents. `@tanstack/react-query` remains the separate existing data transport. |

No Arc item requires Tailwind, shadcn config or a font package. The registry's foundation uses Geist/Inter variable font names (`--font-geist`, `--font-inter`) — do not add; keep Commissioner/JetBrains Mono. `use client` appears on all 68 TSX files; components are CSS-module based (`*.module.css`). Arc's `ArcProvider` (`lib/arc-provider.tsx`, pulled by avatar) is a new runtime provider: adopt only if avatar is genuinely adopted, otherwise strip.

## Foundation (reference only — never imported globally)

`arc-foundation` (`registry/foundation.css`, 187 lines, SHA in table below) and `arc-motion-tokens` were fetched **only** to map variables. Plan decision 3 applies: do not import `foundation.css`. Mapping to accepted Kuuki tokens: `--foreground`→text, `--text-secondary`/`--text-muted`→text-muted, `--surface-muted`→surface-inset, `--radius-control/panel/surface`→radius-sm/md/lg, `--border/--border-subtle/--border-strong`→hairline vs control-border by role, `--success/--warning/--danger`→status text vs fill by role, `--focus-ring: transparent` upstream (focus suppressed — **do not copy**; Kuuki keeps visible focus rings), fonts and eased/spring tokens → existing motion policy. Upstream `motion-tokens.ts` is not imported. Existing Kuuki motion tokens and reduced-motion rules remain the authority.

## Actual adoption map

The import file source now uses `client/import/file-dropzone.tsx` and its CSS module, adapted from `https://uiarc.dev/r/file-dropzone.json` fetched on 2026-10-08. Registry SHA256: `f15cc4b530b5f270fb4dc25f9c0b5de67f650cecb8deb9863c4e6d9205dce186`; upstream TSX: `f160c1e56d39307af6bb0b9ad56a36ea3acef46b7b006218d2b26b1ce1ae0a24`; upstream CSS: `0d1cc9a41e724b04727f3392e29ef588c0211db4745bc87b784da999b03a2ef4`. It retains the sheet-stack target, compact selection row, thumbnail/removal, drag-depth handling and clipboard lifecycle. The single-document source owns validation and submission; per-file upload, batch management and `motion/react` are omitted. Kuuki tokens and reduced-motion CSS replace the upstream motion dependency; paste accepts images across the active file source screen and ignores editable fields. The existing MIT notice applies.

The existing shared kit was adapted in place. Arc style/composition is applied to Button/Field/Segmented/Switch/Disclosure, Calendar/Combobox/search, Menu/Dialog/Sheet, Journal rows/pagination/floating actions, Import dropzone/textarea/progress/results, Passport metrics/timeline/search, Settings groups/deletion steps, auth/onboarding choices, shell SplitAdd/UserMenu/navigation, profile share fallback/badges and leaderboard tabs/progress. Existing authorities remain responsible for form submission, focus, timers, transport, pagination and validated writes.

| Required addition | Local source / meaningful caller | Patch from upstream |
|---|---|---|
| Date range picker | `ui/date-range-picker.tsx`; Journal, Overview filters, Rhythm | Existing typed calendars; paired draft/Apply; validated exact-day API/URL/preferences; old YYYY-MM preferences readable |
| Inline edit | `ui/inline-edit.tsx`; Journal aircraft cell | Enter/Escape, existing validated aircraft PATCH, current owner/receipt admission, no blur save |
| Context menu | `ui/context-menu.tsx`; Journal row actions | Existing Radix Menu and same Open/Edit/Delete callbacks; visible and keyboard entry |
| Confirm morph | `ui/confirm-morph.tsx`; single-flight Journal delete | Existing deferred DeleteUndo is the sole timer; Cancel/Escape focus preserved |
| Sparkline | `charts/arc-sparkline.tsx`; Hero flight/km metrics | Upstream monotone SVG geometry; aligned actual monthly buckets; immediate totals, localized description and caption |
| Line | `charts/arc-line.tsx`; Rhythm cumulative km/flights | Real UTC date spacing, step-after path, exact weighted sums, baseline and private-ID actions only in raw mode |
| Brush | `charts/arc-brush.tsx`; Rhythm exact period | Controlled epoch draft, one completion commit, native 44px range handles, UTC day conversion, owner/filter remount |
| Donut | `charts/arc-donut.tsx`; Rankings airline shares | All airline identities, no automatic Other grouping; exact totals and visible filter legend/table |
| Waffle | `charts/arc-waffle.tsx`; Manufacturers | Existing units/apportionment and baseline positions; explicit maker/flight identity, group isolation and metric actions |
| Activity heatmap | `charts/arc-activity-heatmap.tsx`; Rhythm daily calendar | Actual logged-day weighted aggregates, UTC/leap/locale calendar, exact-day selection; legacy monthly detail unavailable |
| Slope | `charts/arc-slope.tsx`; Rankings previous-period comparison | Equal-length previousPeriod and same facets; top-five labelled view, full union table; missing distinct from valid zero |
| Ridgeline | `charts/arc-ridgeline.tsx`; Fleet family distributions | Precomputed 128 log-domain samples and optional precomputed summary props; no upstream KDE; existing sparse/weight behavior and sampled-minute actions |
| Treemap | `charts/arc-treemap.tsx`; GlobeCard country-evidence disclosure | Upstream squarify geometry; logged-only weighted deduplicated/suppressed country evidence; region drill separate from filtering |

Local SVG equivalents also retain the monthly heat grid, multi-year reversed-rank bump/dashes/visibility, radial hour Clock, signed Crossings, d3 SVG globe and replay range. Share-card bars remain a DOM-free server SVG fixture. MapLibre and the existing vendored flight animation stay installed. Direct `d3-geo`/`d3-shape` remain for actual callers; unused `d3-scale` and its types were removed.

Removal audit: application/shared/function/script production and test imports, root/app declarations and the lockfile contain no `@tanstack/charts`. The unchanged historical `.scratch/overview-redesign/prototype/charts/{charts.tsx,package.json}` still describe the old prototype; that directory is outside `pnpm-workspace.yaml` and cannot drive app installation.

Intentional exclusions: paid Arc/map source, foundation CSS/provider/fonts, AnimatedCounter, OTP/AvatarGroup transitive block dependencies, competing overlay or toast state, and preset-only TimePicker. Native minute-precision time, row checkboxes, selects and range controls retain their keyboard/form contracts. Signature Facehash, kana/brand/Horizon, static activation, map and replay remain existing implementations. Deferred extension backlog is unchanged.

Import source-date/operator/registration and operated-versus-scheduled classification are absent from this bound execution baseline's DTO. Presentation preserves its existing authority; the missing domain contract is recorded in `.scratch/arc-import-enrichment-baseline-gap.md` and the handoff. No dirty-root enrichment changes were copied.

## Component ledger

One row per candidate named in the plan's disposition table. "Tree" = transitive `registryDependencies` (Arc items) beyond `arc-motion-tokens`, which every item needs. Hash is SHA256 of the exact `registry/<item>.json` bytes; per-file hashes are in the appendix.

| Item | Plan disposition | Wave | Tree (Arc items) | Registry JSON SHA256 | Adaptation decision / required patch |
|---|---|---|---|---|---|
| `button` | Adapt/compose | W1 | — | `a87bfc7182d4372c…` | Existing Button keeps loading/disabled-reason/text-feedback props; drop upstream motion tap bounce if routine |
| `action-button` | Adapt/compose | W1 | — | `10dd212b94358431…` | Shell/toolbar actions only |
| `button-group` | Adapt/compose | W1 | — | `07ad897449c6ddb3…` | Forms and review actions |
| `input` | Adapt/compose | W1 | — | `6cf1b1f78bbfb29f…` | Presentation into existing Field; keep ref forwarding, RHF, reserved error row |
| `textarea` | Adapt/compose | W1/W3 | — | `606f8ce2bf88ed45…` | Only if repeated callers (import paste) justify it |
| `password-field` | Adapt/compose | W1/W4 | — | `5990c94b69cc09c4…` | Reveal semantics + autocomplete preserved |
| `select` | Adapt/compose | W1 | — | `7c70286e13eb3932…` | Radix Select; only for real filter/choice callers |
| `checkbox` | Adapt/compose | W1 | — | `5aa9d53a1edfcc25…` | Row selection, privacy choices |
| `radio-group` | Adapt/compose | W1 | — | `94902e2298947678…` | One tab stop, arrows/Home/End, 44px targets |
| `radio-cards` | Adapt/compose | W1/W4 | — | `a210886a62780797…` | Onboarding source choice |
| `switch` | Adapt | W1 | — | `bc3b514941718cf6…` | Existing SwitchRow |
| `segmented-control` | Adapt | W1 | — | `02ca9d645e6eed2b…` | Keep radiogroup semantics |
| `dropdown-menu` | Adapt/compose | W1/W2 | — | `7c15289aff1979cf…` | Existing Menu (Radix 2.1.16 retained) |
| `popover` | Adapt/compose | W1/W2 | — | `5bfaa4af94c78364…` | Calendar popover; popover.tsx exists |
| `tooltip` | Adapt/compose | W1/W2 | — | `7348cccf3b922ae4…` | Only for real explanatory content; no hover-only essentials |
| `dialog` | Adapt | W2 | — | `1f47479abe25fd2f…` | Existing Dialog/DestructiveConfirm; keep Radix focus/dismissal |
| `drawer` | Adapt | W2 | — | `42ec423a96b7913a…` | Existing Sheet (visualViewport insets, handle-only drag) |
| `bottom-sheet` | Adapt | W2 | — | `3bec01c6f348635c…` | Same Sheet; do not add a second sheet stack |
| `combobox` | Adapt | W2 | — | `a0632ef5ca8cd3a3…` | Focus-leave close fix; keep code-first ranking, aliases, 50 cap, recents |
| `calendar` | Adapt | W2 | — | `32e08f588540031c…` | Keep typed locale-aware input, ISO, week starts |
| `date-picker` | Reference | W2 | calendar | `aaff3c9e6cce6e44…` | Button-first; informs Calendar popover only (plan Sources) |
| `time-picker` | Adapt only with parity | W2 | — | `1ead4f69820e5c33…` | Else keep native time controls; record exclusion |
| `search-field` | Adapt/compose | W2/W3 | — | `406c01f957792ddd…` | JournalFilters; AddCountrySheet |
| `filter-toolbar` | Adapt/compose | W2 | — | `e5fbafcbf0464c07…` | Journal toolbar around query normalization |
| `chip-group` | Adapt/compose | W2 | — | `edd2ae7c66a82164…` | Journal filter chips |
| `date-range-picker` | Adapt + contract extension | W2 | — | `96e983e9e5bafade…` | Day-level from/to YYYY-MM-DD; needs API/URL/prefs contract |
| `inline-edit` | Adapt + write authority | W2 | — | `3fa0955c8be35b39…` | Aircraft-type cell; Enter saves, Escape cancels, blur no save |
| `context-menu` | Adapt + existing handlers | W2 | — | `fc7f3e15a6c91318…` | Open/Edit/Delete same handlers; keyboard entry |
| `confirm-morph` | Adapt + deferred-delete/Undo | W2 | — | `abcddca90d61ae39…` | Single-flight delete only; no competing countdown |
| `sortable-data-table` | Adapt/compose | W2 | — | `23e37213b102763f…` | Presentation only; remove internal row sorting (server sort authoritative) |
| `pagination` | Adapt/compose | W2 | — | `2c3c5163a20c952d…` | URL pagination |
| `floating-button-group` | Adapt | W2 | tooltip | `db0c5625dcfd66ea…` | Existing FloatingActionBar |
| `accordion` | Adapt | W1 | — | `a069f821b73e05ec…` | Existing Disclosure |
| `file-dropzone` | Adapt/compose | W3 | — | `f15cc4b530b5f270…` | SourceStep; keep existing validation |
| `stepper` | Compose | W3/W4 | — | `ec68ecaf041ad57c…` | Import stages, deletion steps |
| `copy-button` | Adapt/compose | W3/W4 | — | `d5f6a7bfb47d9f06…` | Keep fallback + FeedbackText |
| `alert` | Adapt/compose | W1/W2 | — | `aaa26038ee991694…` | Errors/notices |
| `toast` | Adapt/compose | W1/W2 | — | `31f89b19361286b8…` | Presentation only; keep owner scope, priority, timer pauses |
| `announcement-bar` | Adapt/compose | W1/W2 | — | `27c34dbf9e5a9560…` | ShellNotices |
| `progress` | Compose | W1 | — | `6f97a08c910a78cb…` | Truthful progress only |
| `skeleton` | Compose | W1 | — | `c4eb5550975c2609…` | In-place data surfaces; LoadingScreen stays |
| `empty-state` | Compose | W1 | — | `0b841ed91e404f48…` | Existing empty states |
| `badge` | Compose | W1 | — | `1471ceb1ae9b67aa…` | Status/achievement/review |
| `card` | Compose | W1 | — | `012b791bdd91d2e7…` | Surfaces |
| `split-button` | Adapt/compose | W4 | — | `b977ffd132d934e0…` | SplitAdd |
| `user-menu` | Adapt/compose | W4 | — | `ef016a7de2c4cbda…` | AvatarMenu; keep Facehash, sign-out |
| `avatar` | Adapt/compose | W4 | — | `8d128c779fa302d8…` | ProfileAvatar; preserve Facehash |
| `tabs` | Reference/adapt styles | W4 | — | `76407a8e59ff51cb…` | Navigation links; keep route semantics (do not adopt Radix Tabs for routes) |
| `metric-card` | Adapt/compose | W3/W5 | animated-counter | `e068e8a22452ccee…` | REMOVE AnimatedCounter (imports ../animated-counter); immediate totals |
| `bar-chart` | Adapt/render | W5 | — | `28131c8e2ed71b16…` | Where bar view remains |
| `sparkline` | Adapt/render | W5 | — | `bd311156bd460d88…` | Summary trend beside immediate numeric headline |
| `line-chart` | Adapt/render | W5 | — | `a72f88f0719d76ff…` | curve is smooth|linear only: add step-after for cumulative odometer |
| `brush-chart` | Adapt/render | W5 | — | `bd4884ac47b95dcf…` | Epoch-ms range; onRangeChange fires during drag/resize/step: use controlled draft + explicit commit; minSpan default 7 days: allow one day |
| `donut-chart` | Adapt/render | W5 | — | `711eb5c73940fdbc…` | groupBelow=.04/maxSegments=6 auto-"Other": disable/patch for stable identities |
| `waffle-chart` | Adapt/render | W5 | — | `d3eec42f27514a94…` | onActiveChange only (focus/pin): add explicit category/mark callbacks |
| `activity-heatmap` | Adapt/render + daily data | W5 | — | `dbba257f5b337cb9…` | days[] one per day, UTC date keys, onSelectDate(YYYY-MM-DD); needs real daily aggregates |
| `slope-chart` | Adapt/render | W5 | — | `c49f5ca0109c20a3…` | Two-period comparison; not a replacement for multi-year bump |
| `ridgeline` | Adapt/render | W5 | — | `4a6446a475871a0d…` | values[] raw observations; KDE always recomputed (silverman): add precomputed density/statistics input |
| `treemap` | Adapt/render | W5 | — | `7d19bc3849b8e033…` | Region->country; explicit completed-flight country-evidence leaves |
| `timeline` | Compose only where dated | W3 | — | `706b338d7cfc7d00…` | CountrySheet dated evidence only |
| `page-header` | Block: compose parts | W3-W5 | animated-counter, avatar-group, avatar, badge, button, progress | `170467b836a46c03…` | Not installed as page; pulls avatar/avatar-group/badge/button/progress/animated-counter |
| `empty-states` | Block: compose parts | W3-W5 | button | `04c7a7179263d4c5…` | Parts only (empty-states-art.ts) |
| `file-upload` | Block: compose parts | W3 | — | `286439cde4189e3b…` | SourceStep reference |
| `sign-in` | Block: reference | W4 | avatar, button, input, otp-input | `8558de0821f2cd7b…` | Form parts only; pulls otp-input + lib/media; preserve one-form flow |
| `signup-form` | Block: reference | W4 | button, checkbox, input, password-field | `d28a9b36b04716ec…` | Form parts only |

Hash prefix is shown for width; full 64-char values are in `SHA256SUMS-registry-json` and the appendix.

### Fetched but only as dependencies (not adopted on their own)

- `animated-counter` — pulled by `metric-card`, `page-header`.
- `avatar-group` — pulled by `page-header`.
- `otp-input` — pulled by `sign-in`.

`animated-counter` must not ship via `metric-card` (plan decision 5: no count-up). `otp-input` is pulled only by the `sign-in` block, which is a form-part reference; do not add an OTP flow to the auth card.

### Excluded or deferred catalog alternatives (not fetched)

Recorded per plan: `expanding-search`, `morph-select` (use Search field/Select), `hover-card`, `avatar-group` (no hover-only/multi-person flow; fetched only as a dependency of `page-header`), `color-picker` (five named accents), `number-field` (Input with validation), `usage-meter`, `gauge` (truthful Progress/text). Backlog, uninstalled: `multi-select`, `password-strength`, `swipe-actions`, `command-palette` (block), `streamgraph`, `notification-center` (block). Other free items present in the registry but unmapped (theme switchers, tag-input, slider, signature-pad, rich-text-editor, chat/comment, etc.) have no Kuuki destination and were not fetched. No Pro item (sunburst, data-grid, dock, …) was fetched.

## Chart and special-interaction facts verified in fetched source

| Item | Verified fact (file in staging) | Required Kuuki adaptation (W5 unless noted) |
|---|---|---|
| line-chart | `curve?: "smooth"\|"linear"`; dense monotone-cubic sampling; absent values default to 0 (`item.values[key] ?? 0`) | Add step-after geometry for cumulative odometer; missing ≠ zero; ghost baseline; explicit mark-action callbacks |
| brush-chart | `range`/`defaultRange`/`onRangeChange` are `[start,end]` epoch ms; `commit()` calls `onRangeChange` on drag, resize, step and reset; `minSpan` default 7 days | UTC-day conversion (`YYYY-MM-DD`↔epoch at 00:00Z); controlled draft while dragging, commit on pointer-up/keyboard completion only; `minSpan` = 1 day |
| donut-chart | `groupBelow=.04`, `maxSegments=6`, `otherLabel="Other"`: small parts auto-fold into one segment when ≥2 qualify | No donut grouping: set grouping off/patch so identities and exact totals stay filterable |
| waffle-chart | 10×10, `activeKey`/`onActiveChange` (focus/pin only) | Add category/mark callbacks, maker colours, flights/hours/km modes |
| activity-heatmap | `days[]` oldest-first, one per day, missing days count as zero; `onSelectDate(YYYY-MM-DD)`; `toUtc` date parsing | Needs real daily aggregates; missing/unknown ≠ zero; selection applies exact-day range |
| slope-chart | `SlopeItem` two axes, `onActiveChange`, `highlightKey` | Two-period comparison only |
| ridgeline | `series[].values: number[]` raw observations; KDE (`silverman` bandwidth) always recomputed in `density()` | Precomputed sampled-density + summary-stat input; parity with existing log-density before cutover |
| treemap | `TreemapNode` hierarchy with drill + breadcrumb | Leaves = completed-flight country-evidence counts; drill and filter are distinct actions |
| metric-card | Imports `AnimatedCounter` with `animateOnView` | Replace with static immediate value |
| sortable-data-table | Sorts its own rows (`sortable`, `onSortChange`) | Presentation only; server sort remains authority |
| combobox, date-picker | Per plan; not re-derived here | Per plan W2 |

Claims in this table come from reading the staged source on the fetch date; local toast, combobox focus-leave and time-picker preservation are verified through existing callers and wave tests recorded in the implementation handoff.

## Appendix: per-file SHA256 (staged registry `files[].content`, UTF-8)

```
4d24d519b511812da9dd2b5e2c7d696c0f849ac9ea391480927acf5cfaa3a977  src/accordion/registry/components/accordion/accordion.tsx
8a4fc9578571f3d7d2fe16998f7977f12671fcabcfc8d50a462c7bf9abd65243  src/accordion/registry/components/accordion/accordion.module.css
2196f6935ad5b54e086720cada8b8808166c14efc089d8eda8164d2df3254cad  src/action-button/registry/components/action-button/action-button.tsx
b91e626431bf99ebccdf12263881bd3061a8faa8d45a5b8d0da361cc9a90b4fa  src/action-button/registry/components/action-button/action-button.module.css
47b16d2211727d8f1a4b4791e777f4f8d3791d55a68aad9625377e63e8db0933  src/activity-heatmap/registry/components/activity-heatmap/activity-heatmap.tsx
b509d20ff7f152093a2f5c6b87d4391b2a80d9ad63dd1cf5846cb8d5def240a4  src/activity-heatmap/registry/components/activity-heatmap/activity-heatmap.module.css
ddcd481e2ebc6a1cbf6f053d6de1817d5dfd40b347e0bea561cc9fda2ea54950  src/alert/registry/components/alert/alert.tsx
938cddc734989a721d38e92ed62c40df3a911cc3c6af6d9da313daaaf57965a6  src/alert/registry/components/alert/alert.module.css
2542f8bcd8a413c7a846d440d917a3c11a77f4e016014dfdd242c4549df01750  src/animated-counter/registry/components/animated-counter/animated-counter.tsx
33b7d7f0081f4fd3907a4fafcff64444581845a58cb7b0b7844c394a2e254adf  src/animated-counter/registry/components/animated-counter/animated-counter.module.css
2183f6cc9b41c83d3078b521c3be57ccb6583f9fdf939751ad3d6d7ca716ae10  src/announcement-bar/registry/components/announcement-bar/announcement-bar.tsx
d181f87bcab4aefb55f14cca268fba1c237b07bf81fb969b43f4019b7902b50c  src/announcement-bar/registry/components/announcement-bar/announcement-bar.module.css
8949392c308d9f6b617c9f4dba909fb7bd61a762c17b0d1fc9f0832b7b960014  src/arc-foundation/registry/foundation.css
13af43b57ed38e5b72cfc06ff0ccc39b0593721f04840e73532893593cc61491  src/arc-motion-tokens/registry/motion-tokens.ts
bec65d2e1b180dd3c574edc60cf84e0fa336e7ff8640eba0c70bcf0ae765fb8a  src/arc-motion-tokens/lib/motion-tokens.ts
94c22aa1f558a72d3dae928b35516fe182c296636cc8c24ea9fee194718e166c  src/avatar/registry/components/avatar/avatar.tsx
7a24bd77c83d3c14ac2c90905dc7d64eea7b60e8bf6eddd2e5d30dd6c96bd816  src/avatar/registry/components/avatar/avatar.module.css
bcc7358163968a9508d81586134bf8d921d75783033182f81ca9015985815884  src/avatar/lib/arc-provider.tsx
937f6581c5fc0f3f4e52c357ac6c59cb1a4bcba7221ddebf32d944219fcec62a  src/avatar-group/registry/components/avatar-group/avatar-group.tsx
390515d480d1d441670087be4394db6bae9423e4cb1dcc269c83c25505c8c4fb  src/avatar-group/registry/components/avatar-group/avatar-group.module.css
3c55d03480156cd7636e171ce8649ddc9616db7484dea50063d8b589810c4aad  src/badge/registry/components/badge/badge.tsx
3306e97600585992b6dbc19db1d55961cbfacd24f5942d80ac3078d6887b3644  src/badge/registry/components/badge/badge.module.css
aa0073235e1678494b3e6b0846b695fbb869f35e3e40f16d98a6dc459445814b  src/bar-chart/registry/components/bar-chart/bar-chart.tsx
cfa61a42289d9a6f54e1cdee9563ae9378f8b6475b70c5d4fb56ebb52182b2ce  src/bar-chart/registry/components/bar-chart/bar-chart.module.css
c31e59f706c6da72acf78737c842fc58bf1e42d75002b89103914308d689d3f3  src/bottom-sheet/registry/components/bottom-sheet/bottom-sheet.tsx
7e7f5d9d09757b8c76afacd694bed8151fe48c9afe9e7a85a157361902275624  src/bottom-sheet/registry/components/bottom-sheet/bottom-sheet.module.css
d37c0f866336bd4aee61e3523edd60be4bfe23894116124758e61f964dc0758b  src/brush-chart/registry/components/brush-chart/brush-chart.tsx
de7ee8510ef381ef28a527642b918c89109a4e41d2b6ed768f5b25c3a39073fe  src/brush-chart/registry/components/brush-chart/brush-chart.module.css
6a56d78cb75a6fd5f5cfdd03be8b02bf96f0bc96790d3c81abeee10e089fecec  src/button/registry/components/button/button.tsx
77323140c3f9fbad7b08dddba0db7260aa233c34c39a9d24cfa646fea287e140  src/button/registry/components/button/button.module.css
843ccf5fdec648e2045cf617286a2dca275282e2c605e1317fcd61984909396b  src/button-group/registry/components/button-group/button-group.tsx
660ea137acde2f4fbde2f6678e8ac52ae4b6f9abad0f094af2f42de33cea74e9  src/button-group/registry/components/button-group/button-group.module.css
cf09873e5d895e46129159e62f7e494f448cfd247aaddd6c9a54de45a5d6c108  src/calendar/registry/components/calendar/calendar.tsx
069a833b34cb103040013346c07ad453d235da1096ea011d2c50bd148029a3af  src/calendar/lib/use-today.ts
2e019a6ca658f124c7ea0303aac46aa615a4e6bb3bc485c57d3b85acb0d26adc  src/calendar/registry/components/calendar/calendar.module.css
1e82f064e152aefefb9b34e89e019cca31919ce9ddcd84b480a88775fd4ad638  src/card/registry/components/card/card.tsx
fc16b59deb8d1d3887f06e17eea063a5d6c6a2903999841f47e2dc80c30e8a9f  src/card/registry/components/card/card.module.css
4759251a0b2a83320cb4078e840f61481a23be0b38b9aa7c077c2e85e6dde00d  src/checkbox/registry/components/checkbox/checkbox.tsx
6cc8ae35edbd99dac2ea3768a6db0932429ecb06febab06e048a4b94974251b6  src/checkbox/registry/components/checkbox/checkbox.module.css
18bd79ee819c6546b6f538bc1df5b2645e07093cb8eeb3637939087cd81b7bfd  src/chip-group/registry/components/chip-group/chip-group.tsx
cc8c6c63756b0dee42c97c55ede87074996628f237bc31ef32e3d64f8f72b928  src/chip-group/registry/components/chip-group/chip-group.module.css
12ae9a73956f4d4854259396fd377aa63321db18198e8816db5b1791ff9a56b7  src/combobox/registry/components/combobox/combobox.tsx
d6515c41a6d61e713100ae5f2723d50a6afa2622629d685728dcf13d85a8f896  src/combobox/registry/components/combobox/combobox.module.css
151698eb1a316e38985d748f8e23b4e04d948a19a66212ef26de0b09fab2b563  src/confirm-morph/registry/components/confirm-morph/confirm-morph.tsx
0117c11659e56d60b99e0e69fe042327a759d93d2b4db13164a6c1dcf93101fa  src/confirm-morph/registry/components/confirm-morph/confirm-morph.module.css
84301492fadf8cfb3dfa1682381932c4b986404b2adc2ef4e868de1582eb367e  src/context-menu/registry/components/context-menu/context-menu.tsx
bde4e0d0430b1f6ae812515d9a2964fcb39944f61fc3c7a9a58852cd38fa4238  src/context-menu/registry/components/context-menu/context-menu.module.css
a6faac2922a48cc05ec72650ed63aee9b3871446df683cb7de6790f9bb19744a  src/copy-button/registry/components/copy-button/copy-button.tsx
090ea463f90ebe80e5fbe9abaa22b8c5ed1daec2068e7bcd18baab09e39dc08e  src/copy-button/registry/components/copy-button/copy-button.module.css
88d0ae55bb3e241f529912a4802bbf014e4ba437025acc90ab13e012702273c5  src/copy-button/lib/use-copy-feedback.ts
996d6b6703f7478c9ce286a3bbcd49a10aac0cb489b0d8915dfd89dad9c4efb8  src/date-picker/registry/components/date-picker/date-picker.tsx
fc3907dc484832ef441b367dd16135bf081ec77894ea1ae7c9c59508a2abe95a  src/date-picker/registry/components/date-picker/date-picker.module.css
ca4172b1125a3ac22ff06e17b599a6dbbe496247a75f7be46fa340de20d54a2f  src/date-range-picker/registry/components/date-range-picker/date-range-picker.tsx
069a833b34cb103040013346c07ad453d235da1096ea011d2c50bd148029a3af  src/date-range-picker/lib/use-today.ts
e83b9b26c0bc702dcfe613fe39b3a8cc75e44a5a354f5bca579bd36979e20597  src/date-range-picker/registry/components/date-range-picker/date-range-picker.module.css
eb84a7eb2ac864dc07f2825eab252eac78e9c6b889d0e9f00bf6b2b799975ade  src/dialog/registry/components/dialog/dialog.tsx
b43cd10ab34fad31445686c5681e5938c2245c10c465a2b2e3774d802a81e603  src/dialog/registry/components/dialog/dialog.module.css
82e5d96b8f69bd2ea5153af9f09427c5bee54513f3de52c0d5cf9377d98a9bf8  src/donut-chart/registry/components/donut-chart/donut-chart.tsx
4adac4950f4168cfee46177440c1e8d311bb4a764cd18afc37beafbe243a6f09  src/donut-chart/registry/components/donut-chart/donut-chart.module.css
eca310cb947c8da843f1128a77a2683c4e031519081da8c08d7ee405e5bbd87a  src/drawer/registry/components/drawer/drawer.tsx
92378d24196077625b36f742474740977ef181e496abdc5b6eb6230b15ec2eea  src/drawer/registry/components/drawer/drawer.module.css
93bcd4952628899159bfe984c43d3d23d91aa2eddbaec2ee8bea864e67406981  src/dropdown-menu/registry/components/dropdown-menu/dropdown-menu.tsx
4a1a34dbbb4f327cd9843ae8df2b9ce55c3cac979cc2d5d164bd960d5bdc02ab  src/dropdown-menu/registry/components/dropdown-menu/dropdown-menu.module.css
e99e39c02b03e77738e8e8a69d12f24b6e9d5b3b66f12f1425cec32700fa69ef  src/empty-state/registry/components/empty-state/empty-state.tsx
e65e4c4b6e3bd31b8925cb6a5d58e8c4826ffca6efb100f786c70428f98afc1a  src/empty-state/registry/components/empty-state/empty-state.module.css
5c24e909420b3874ca455d0f6364939de5f1700b17cfad3a1ae2f72a665a902c  src/empty-states/registry/blocks/empty-states/empty-states.tsx
ff517745774f84eb030993650f9f60fe93b8f31fec581ec822974d7694d0775a  src/empty-states/registry/blocks/empty-states/empty-states.module.css
86c5c3d7630416831fd884f58e657f15ae36c9e8ccac21cdae06e1f1d79a7e2b  src/empty-states/registry/blocks/empty-states/empty-states-art.ts
f160c1e56d39307af6bb0b9ad56a36ea3acef46b7b006218d2b26b1ce1ae0a24  src/file-dropzone/registry/components/file-dropzone/file-dropzone.tsx
0d1cc9a41e724b04727f3392e29ef588c0211db4745bc87b784da999b03a2ef4  src/file-dropzone/registry/components/file-dropzone/file-dropzone.module.css
f8614ef57455fe15f571367177edd911f11394de68b7a42ba0511f4a1918f1fd  src/file-upload/registry/components/file-upload/file-upload.tsx
3a4ef30a0872ce36c9d0ed5cc792cdeb96349594d1a43b8f67fdd456f4c57153  src/file-upload/registry/components/file-upload/file-upload.module.css
90fbd7b5dfca993bb6992cda514d7c17df406fcf63ecf2c04712a20c538ed1db  src/filter-toolbar/registry/components/filter-toolbar/filter-toolbar.tsx
b24254c41e9113d0765773381a17c7eca246ed533bcb0c6e711d25e34746b250  src/filter-toolbar/registry/components/filter-toolbar/filter-toolbar.module.css
2de3b52da32ed257e749b07971f7c3888dae127f7c1bafcbfdd7488a7b453d11  src/floating-button-group/registry/components/floating-button-group/floating-button-group.tsx
a79a1fa8cb57d963f66d61678c2ba76becd41bb169e7ded0b3054f125a4f9f6e  src/floating-button-group/registry/components/floating-button-group/floating-button-group.module.css
7040d60275c468ae819f9de96a4cf6e41d9c639fdeefe866953466afd15addb4  src/inline-edit/registry/components/inline-edit/inline-edit.tsx
c689027c6c24a43a7cc1de2edf99812c613b0a85ae008e08fdc76caf6d1083d9  src/inline-edit/registry/components/inline-edit/inline-edit.module.css
16a4e761b51482e9c066f284a38171085e71ae390e4b26f9f0c18dd8af21c8f2  src/input/registry/components/input/input.tsx
ef6716aa7b9f45898859735f416ac932517b94e66bed6b3d23d7aed180529bdf  src/input/registry/components/input/input.module.css
1276d1375167311ce564214905abbc484070a66b2bff0ca0ce567391f8ef19da  src/line-chart/registry/components/line-chart/line-chart.tsx
0a761cc358588f948f4a4689ccfc9f57f73b3f043f07599e0233e025f30a919f  src/line-chart/registry/components/line-chart/line-chart.module.css
ac550e49b6e9f680f32a694dd27cb42597795465d4709f2418230fbbde865906  src/metric-card/registry/components/metric-card/metric-card.tsx
733ad2b10292f583f11a7b4e21c09b0d9334bfff15c8abb52baab965dc851235  src/metric-card/registry/components/metric-card/metric-card.module.css
9b7c948a73d93c2d31f1c031b70ba62c969689fe4625d1762d1e4418c39f30bf  src/otp-input/registry/components/otp-input/otp-input.tsx
4bcfd659a2d6597f558ae2d02214c1dabfcbc795fca8a664b1abda369a872640  src/otp-input/registry/components/otp-input/otp-input.module.css
715ba538c005c38686d69d3ea7d02bf0dd05d912973cd81a456273733969d4da  src/page-header/registry/blocks/page-header/page-header.tsx
fe117fc7b586814614f2386135c84da505fc6309592a544aaa7ac655fbf882de  src/page-header/registry/blocks/page-header/page-header.module.css
c687e93ea563bd39d470dda1ba8b9ef9ad0b8132fc1593eb8361f3641d955a7e  src/pagination/registry/components/pagination/pagination.tsx
9db319c0314c341b429210f8842f00d193eaa356c706ca1be2ebda32fcbea15c  src/pagination/registry/components/pagination/pagination.module.css
2064f0f2d6ab79aa34c82f67e6e68464ae062435cb69ede3314bd199ae84f35a  src/password-field/registry/components/password-field/password-field.tsx
75a61ff590b700812e5f62af47f7dc268b807e109ad570d4d990e7d62ed5204f  src/password-field/registry/components/password-field/password-field.module.css
c564d1974bc55e805cb92e37ab0d5dbf48b46429353981985f50adab2c93ff4c  src/popover/registry/components/popover/popover.tsx
6b92cdac211568a53a81b1d84bcbd0728cec93f741e64074f7e9f91f673702f6  src/popover/registry/components/popover/popover.module.css
53f96b8e42315c9c261338bd96f74d74f6db22b5de935ae3ec02e20cfb64ae1e  src/progress/registry/components/progress/progress.tsx
f0e527c419a7ebd3f9dd7faf49244fe87ea47e5153fed9f8e50fd83fd61d11a7  src/progress/registry/components/progress/progress.module.css
82084be52a5d5f9def1d517f3bcdbf8c26f046afc25b93d5dd8ff32543f8a8d4  src/radio-cards/registry/components/radio-cards/radio-cards.tsx
5f6e5cd90a57fd7c31f301d6c1a9172b3386b2e4afdd0526573c4736836eca7a  src/radio-cards/registry/components/radio-cards/radio-cards.module.css
b64932d460b1366d5bd057af9bb372003380da8afb3ec306754fafa025d8a3eb  src/radio-group/registry/components/radio-group/radio-group.tsx
b5a7ececee88f400799ee00c1a710a278a776a5930f76388f8f0fe99c7602929  src/radio-group/registry/components/radio-group/radio-group.module.css
82048bc381bc1755030fad27b0a4c0a97a0fe87913f507d27aaf75cb75c226ae  src/ridgeline/registry/components/ridgeline/ridgeline.tsx
5f05deb648fea914e894ee3c3025c987c19bef4d0b1eeeb30c0ce63210edefa9  src/ridgeline/registry/components/ridgeline/ridgeline.module.css
d93a8d0778c83d33793bf3fe7e5b206a5d0c6e50948b83f39777b89899392d93  src/search-field/registry/components/search-field/search-field.tsx
3b74ebb74a675ab8a0202d9234b8865fdd0d26033f056aa6e3de9bc9bffacce2  src/search-field/registry/components/search-field/search-field.module.css
9e1a4bc135246c86ed2d8875a3a1266490aa38a3d7800759db630e700188e840  src/segmented-control/registry/components/segmented-control/segmented-control.tsx
029f038c7f03762cf386554f5e59768a95e6f5c8eb8b459bf3ef56cef35d1788  src/segmented-control/registry/components/segmented-control/segmented-control.module.css
673dc0c887a255c87bfbabd1835606d87cfbf59ed6fd4909a28038f00f673eaa  src/select/registry/components/select/select.tsx
f700250cfa39db22e974f417d6d776e70b037e031500ca85c3c94e0c558a2b04  src/select/registry/components/select/select.module.css
c711c3f51ee7c82cea44aaa8bd842700283b96d90b21f6c5d177d9c2e17b1274  src/sign-in/registry/blocks/sign-in/sign-in.tsx
30efd256b8d7bba067d188e4668e3a078fb5030e028f19acd89049d1f28646c3  src/sign-in/registry/blocks/sign-in/sign-in.module.css
765732e3b5112fcff330137ab9a8c63c641d5662f1dddba5cc8abf2bb02ffdb0  src/sign-in/lib/media.ts
85931dc6b748a80714751087cee06070a3a11ac99fc006ab3a22a24bc9875272  src/signup-form/registry/blocks/signup-form/signup-form.tsx
d4f07da3bbb2d4b6f1a7b2af6a4a5af33652eabc06c855646346ac82d9b910ab  src/signup-form/registry/blocks/signup-form/signup-form.module.css
73b97715698fa54f6f0eaeefb6a8d795977297dd998439d1e595361e5da6d3b5  src/skeleton/registry/components/skeleton/skeleton.tsx
ba4b3fa1d7f9df341c4c3a5e302d43178015f15030715ddb3ced2116cecf0588  src/skeleton/registry/components/skeleton/skeleton.module.css
84f25522305d5120df73b0455e95720b7588d4d29afe95c6f46caa969e3d7ae1  src/slope-chart/registry/components/slope-chart/slope-chart.tsx
de9db30d2c637664a937b99cb31d6451b45b3567783cd919598ac8003f69914f  src/slope-chart/registry/components/slope-chart/slope-chart.module.css
90350cd5d18abdd5fced97289482604fb48f2dfcf61ce82168697d7cef51e085  src/sortable-data-table/registry/components/sortable-data-table/sortable-data-table.tsx
279624f7b4d1c0a1e765d5ae307b52eb5df80860e27704ead7b682579d1204b1  src/sortable-data-table/registry/components/sortable-data-table/sortable-data-table.module.css
b61f2b54bac7774d7af8d3a0b0939584487d72c0f2d20131cc2f14e915b05859  src/sparkline/registry/components/sparkline/sparkline.tsx
0b7995379fb5a7955d48ff95871e06494a6092ca028c0c5d43aade2f364d844b  src/sparkline/registry/components/sparkline/sparkline.module.css
fb9de18f553984b678694d5d69d788faee9c8bedb4ce149d4674783ef9261b12  src/split-button/registry/components/split-button/split-button.tsx
d558b41e31264911bd154004d0bb0c230d2768f9899a4b8ab77186127458d7c9  src/split-button/registry/components/split-button/split-button.module.css
7b4034915b0902b16e6dd2e54dfae4ce40fd9b2d4fd09e736f9e196d97fc6c17  src/stepper/registry/components/stepper/stepper.tsx
3762deb9d9cda692a33c81510c811cae11aebadcd82ce58d4ea3b84b3ed5c569  src/stepper/registry/components/stepper/stepper.module.css
6ab95cb9c0aaa80599cdc0605abf959a20f5030fe4ecdf57f6894274a9c5d73b  src/switch/registry/components/switch/switch.tsx
3793e7ee1a4c2db46fce615c3fd76212c3c78ea005e23ae07c24b53453c1b6f7  src/switch/registry/components/switch/switch.module.css
3b0aaf6f0c41ce486e697ee3c9c86ce874fb2a22b1dab433226027de7858af0a  src/tabs/registry/components/tabs/tabs.tsx
573e4a572e884b5f184efe731f2955341bb56f7ff640d2d01e3a409456ce4469  src/tabs/registry/components/tabs/tabs.module.css
1ed43b87e45b04180f1c6b8b3b7543e071bed3a6fcb2033e98015c77a8b7135a  src/textarea/registry/components/textarea/textarea.tsx
57a9294f6f7eea903296334bf1203982b41736aa1082a83af4dc2e8bbc6a144c  src/textarea/registry/components/textarea/textarea.module.css
0acb7e628b37a1e9eff3039ce93aab24e14cb71cec4ba25ea3c684c4d9448ccf  src/time-picker/registry/components/time-picker/time-picker.tsx
571d5dd081caa1bb5903278489aa4c4daba9e7077a58f33b12ad0f08d1826812  src/time-picker/registry/components/time-picker/time-picker.module.css
71d91894d8337d7b163bb8b011fdc8d47039ae53e90b9e03afc01d845f76870c  src/timeline/registry/components/timeline/timeline.tsx
34712f6b90d29cbc326f1115ee2588d330d729f63d661d7c2c80432b3585115c  src/timeline/registry/components/timeline/timeline.module.css
cc68a59e0db6f1f1a0c1b8ec6aaa7638c08be7e13367b370f8d3f44accddba7f  src/toast/registry/components/toast/toast.tsx
7c971d71804b5d4b10c876a08d8a5b3caa0ef19aa7d94d0ccfdb9e291d02fa1c  src/toast/registry/components/toast/toast.module.css
25ad5ea2b707da617e055f0c2fd9bcf8776775ad658e67f3e9176f3030855f9b  src/tooltip/registry/components/tooltip/tooltip.tsx
a6126eda83bbbc1164018ad9df811f437098167077ca493ec5c06538e7f901f4  src/tooltip/registry/components/tooltip/tooltip.module.css
80615b9948ab7e5e066c4d666b983dfb02da8f2a630e682eeab24485dc81751e  src/treemap/registry/components/treemap/treemap.tsx
5c619a046f32a6186a39b928f13140730a1931c25006026704ad3e0ce4ac25a1  src/treemap/registry/components/treemap/treemap.module.css
ea41adfd5ef81396d4044a8d9d06759cd4628adcb7cd4e74c6cc6dfb98313c8f  src/user-menu/registry/components/user-menu/user-menu.tsx
765627540a3767d9bffc86b1cb3be2154975e41d9a561fef9cabe6dd74d0027a  src/user-menu/registry/components/user-menu/user-menu.module.css
f1538515ae585da3d69e87421841593fa1297d98f73d826104b4771949f021b0  src/waffle-chart/registry/components/waffle-chart/waffle-chart.tsx
55213a52b0b2b1a1080d65f095753c24015b6a9c713080d4736ddbf48a6a9f82  src/waffle-chart/registry/components/waffle-chart/waffle-chart.module.css
```

## Appendix: registry item JSON SHA256 (exact bytes)

```
a069f821b73e05ec4f3f799b9f8f0ab2bb3b26dc247f4310fda368260b9ccc93  registry/accordion.json
10dd212b94358431af8d806abdba2cf77857bf5fa02b437616411366017111e2  registry/action-button.json
dbba257f5b337cb9ec7081e0cc6240b93ccb1e1438c09552f1c450df5435f499  registry/activity-heatmap.json
aaa26038ee9916947d2db8ea6efb0f4e0ed5470358529395ff6420acb28dfc37  registry/alert.json
01046ee4db66aa33671f460ee76bbae54db7b0059a9ccde4b77da4548ac5453a  registry/animated-counter.json
27c34dbf9e5a9560363012f4708f70ab363297fe4b04f10db905e25115e5d1f1  registry/announcement-bar.json
164a06f61891430ffb4e442083d0c4031df9cbe9f657016cc45fdae612e96d9a  registry/arc-foundation.json
986546df7241f61082af1179bd6b73389bad8e3b7b98e259b07e12748b5382e2  registry/arc-motion-tokens.json
8d128c779fa302d8ed8997b3380d651da4f7e8000ff2f65929c7d25c7f573d7d  registry/avatar.json
dfe07db8b14ad654894c1d206f9bbd0a2d4af4e959fe865f91e6cc5c3e62c746  registry/avatar-group.json
1471ceb1ae9b67aa02746be4306ff6c816a5003875aef899bf2933a5d729e4fc  registry/badge.json
28131c8e2ed71b1607dfde4263c1b83d3a93d2bd539a595eac218cc8c0224639  registry/bar-chart.json
3bec01c6f348635cab9bd33510fb3bb1f6c9d97cce1861c5ebb0a8956746a719  registry/bottom-sheet.json
bd4884ac47b95dcfc69e9c61285443ee6d0e369469a99d49f57f9dd04a84bcc2  registry/brush-chart.json
a87bfc7182d4372c7806f8fa53b51c5ae7c5636b2628d599f887ed0d912f074d  registry/button.json
07ad897449c6ddb383a214785d9c20588d37c795a22376b27992b1f5614196b2  registry/button-group.json
32e08f588540031c60321dfd5c96049ab85bd0e46227d9be809a392f15b15a58  registry/calendar.json
012b791bdd91d2e730a9220671d0e8d262fce33246c148bd7531c260cef16642  registry/card.json
5aa9d53a1edfcc2513be339b976282296684d2ffa8622eca7abe1b0428ccce13  registry/checkbox.json
edd2ae7c66a82164133ec226dfc7e19f83310fcec7f43a331cea2b2942c1b063  registry/chip-group.json
a0632ef5ca8cd3a3a528319c2a02ee881bc3b95e896af76e72d78e7a7da81569  registry/combobox.json
abcddca90d61ae390ca2f993f6070121be1cf364db8588b4fd6a287366784c44  registry/confirm-morph.json
fc7f3e15a6c91318ebb13c8a60603ad037a51b4f338ecdbe3db3b7f8797bd4d6  registry/context-menu.json
d5f6a7bfb47d9f069d5d0dcf06c03b77c24caaee34eaf8e0b02326d6eab1bd87  registry/copy-button.json
aaff3c9e6cce6e4451cf4eb4c30a303c8f22ab2f786fcba7fb5b290d435b0fb0  registry/date-picker.json
96e983e9e5bafade5601392e9569a7a6c56be0904a784bb36db15c306b279ed8  registry/date-range-picker.json
1f47479abe25fd2f8c684b1b69ad69f9669c72dc3480d71c4bb22cb3b2196b50  registry/dialog.json
711eb5c73940fdbca0c033f775b959f31d4f6d61d70ca8488c9d3fbf3a4ddb7e  registry/donut-chart.json
42ec423a96b7913afea44c785f79f02174f0eeb05f56cd590550bbffc75138cc  registry/drawer.json
7c15289aff1979cf74bd02c2bb229ca1903048882fe9c0dd828f4293a67cdc44  registry/dropdown-menu.json
0b841ed91e404f487048cba566b8e56fe100a54753dc6811dc355d048c04354b  registry/empty-state.json
04c7a7179263d4c5f16b276e497efd138365e017e5bd9e0332e03f6248a077bb  registry/empty-states.json
f15cc4b530b5f270fb4dc25f9c0b5de67f650cecb8deb9863c4e6d9205dce186  registry/file-dropzone.json
286439cde4189e3ba8a295e46309593f13af5581a014390e85a0134276c920a8  registry/file-upload.json
e5fbafcbf0464c0730d9633c808f2eeb0465b19350769c144597bb4512596424  registry/filter-toolbar.json
db0c5625dcfd66ea942a462ccf6dffdaf76a2816c3c6ef21701ae46df15d5d0d  registry/floating-button-group.json
3fa0955c8be35b39fbbe84fdfb4f860efafe28432009d3941ca46631f658f708  registry/inline-edit.json
6cf1b1f78bbfb29f12ddd12025b14a4872b16382a0e8903c29a0d9c538c0c5d0  registry/input.json
a72f88f0719d76ff8980be72ad1ccc7e90f75b560a0599372cc229e28c09e686  registry/line-chart.json
e068e8a22452cceecfab21acd8eccf7347bedee1a02ac736e2744702078deb87  registry/metric-card.json
607095b85bc09b4ddd8a8d171f5bd12b2acc2bfab34f6173b88d93e2d65f05b1  registry/otp-input.json
170467b836a46c03692029f787384172b2f646d2070b6b3b612f3cef08c9d732  registry/page-header.json
2c3c5163a20c952d4751a1212ac33827d4ee72accc95a88c6dcfd1bfe15090b0  registry/pagination.json
5990c94b69cc09c4c58eeeb8a3b36571e87bf8ca9b83d0ed2c0a354754160bb0  registry/password-field.json
5bfaa4af94c78364799d8d5fbb66ba9c095d641531286c2510247d4ed9e18e20  registry/popover.json
6f97a08c910a78cb199bb849ded90b0ac1685133da53e5de4a1864d7ed62ad49  registry/progress.json
a210886a627807974990c5ccc14d60d82306a158c1f5f4c78eae9ce25c4e3dd0  registry/radio-cards.json
94902e2298947678e0cc7bdd6b01b2b137ee96e2c46d6112af0492a27981f05f  registry/radio-group.json
4a6446a475871a0d409cfab0a1fd07e32a6daceb3cca9a66306e52dbfd2d4554  registry/ridgeline.json
406c01f957792dddc9333b76c8ef402d60e3d73f989a66d52fc246e0e45128aa  registry/search-field.json
02ca9d645e6eed2b6561cc0359398eae05ff6e203841b31e69d63c5e68e89d08  registry/segmented-control.json
7c70286e13eb3932a25a6014f5b2da0585ce3ca98271d8c5f029de13dfff1321  registry/select.json
8558de0821f2cd7bd0cf27ea209bd9aff732d73947e2c86553b1f5deec8377d1  registry/sign-in.json
d28a9b36b04716ec1b0b50f987d6b6d5ceb01a53b43b475ab66943740e5da50d  registry/signup-form.json
c4eb5550975c26093ca05bfcdc2945f684d16119cdef1da53463cabd3fae7567  registry/skeleton.json
c49f5ca0109c20a3cf6b285da1432d4c9a098b65d625236b9f8d758e01ae5b2d  registry/slope-chart.json
23e37213b102763fc327cd5c8148ef56d8fec059e00747cd28fa3c5379eb45d7  registry/sortable-data-table.json
bd311156bd460d88fbdb0bc4fef999ae06bb3393a8030113367e79d4342f1f1d  registry/sparkline.json
b977ffd132d934e0f7c5810c30ab09f3780c86244a128dee8943d6ada6b92cd7  registry/split-button.json
ec68ecaf041ad57cd7e8da2ebf614ded3026f8dc506e41e28fc9f7509967b921  registry/stepper.json
bc3b514941718cf6d057a1fb179ffd21eefeb71e7547043177879fe7828fd7c8  registry/switch.json
76407a8e59ff51cb9f08efdf80aa60eda4bfa3292fba2dde6df5677ac4a0e468  registry/tabs.json
606f8ce2bf88ed45f9fce19bb86825ef35aa336592ae538c11ca72da380c587f  registry/textarea.json
1ead4f69820e5c33f1276407e7f8800e860a969f87fab7cabfb66420eaedfe77  registry/time-picker.json
706b338d7cfc7d00643f751c6637a256cccc9bf0c900cd6b619b0b9dea92bd36  registry/timeline.json
31f89b19361286b80cb2292ad8ee72349f0b9d3b702d90aa47ff7c527aa1a757  registry/toast.json
7348cccf3b922ae40885e72e58a1b5bc42a2af27a69b4c033db483f217887bc0  registry/tooltip.json
7d19bc3849b8e03389ee9c5a34c4f5ba922cb01c2b2e15533f4e052016018cc9  registry/treemap.json
ef016a7de2c4cbdaffcace76f4c3fae57305fe0eaffd96ad73ee551973990073  registry/user-menu.json
d3eec42f27514a94bed06a454244bd7c3e652f73ed4178dad3cc87035d33a9fc  registry/waffle-chart.json
```

## Appendix: markdown SHA256

```
92277bacdaf08a18ad0a973daeed429830665c49eefff50708bc677a042717b4  markdown/accordion.md  https://uiarc.dev/components/accordion/markdown
ba77aebb5c8e9c7d377d2c99c671540228293f47620a6b4495ea119b8bf7df40  markdown/action-button.md  https://uiarc.dev/components/action-button/markdown
989c6b726b6084346da4411c8a72745d5da98588d6f1ea4d8fcff86ebec29905  markdown/activity-heatmap.md  https://uiarc.dev/components/activity-heatmap/markdown
f29d86382a9f678294fa87c7e87821c0284473db7aaca006d3f5bea47af2405b  markdown/alert.md  https://uiarc.dev/components/alert/markdown
1aa9a265272e315ee2553feb0453857465c2066b5c6d1827991faa2c852b285a  markdown/animated-counter.md  https://uiarc.dev/components/animated-counter/markdown
f9c1b2592df44659fb445764943730c641f03ba96aa644d84ffaf7556812de26  markdown/announcement-bar.md  https://uiarc.dev/components/announcement-bar/markdown
c5afd0a196a16bfeab4c9dbf989dcf2d0ecd4880c5f35e083fbdd343e7246da5  markdown/avatar.md  https://uiarc.dev/components/avatar/markdown
f9caed428abec679fa7838bdc1e77bb5a38940381ea06b2e13f82701c491261a  markdown/avatar-group.md  https://uiarc.dev/components/avatar-group/markdown
60e955352ac743f6d54c457d7bb0335912ba3dcc980a0e4c70ac32be6ae2db60  markdown/badge.md  https://uiarc.dev/components/badge/markdown
32ab84d849aa40affe95973ecd31066a072b12d4ea3bf8703d73171174a791e2  markdown/bar-chart.md  https://uiarc.dev/components/bar-chart/markdown
71fb93adc32cb304364b945cb403793863704ff8fe31372f80933c9a4403b7ee  markdown/bottom-sheet.md  https://uiarc.dev/components/bottom-sheet/markdown
0b7de150dd2ca43fea4afc8b538f037a2fde4ec4bf62cbe9e6049c60809ece60  markdown/brush-chart.md  https://uiarc.dev/components/brush-chart/markdown
350711b40f2897d66a8d09fc1d0f0166dde88451166bde02c5398aaa3f55b10e  markdown/button.md  https://uiarc.dev/components/button/markdown
0e8085ab31140d6a9db4b48707643c66c4f064d89c09575f5a4f9ff0034e0d80  markdown/button-group.md  https://uiarc.dev/components/button-group/markdown
3b4c6f930bf859557877c629d11d3b5e27d31992aa8da28d6a2ca5f27176ee4b  markdown/calendar.md  https://uiarc.dev/components/calendar/markdown
842401ab3fdfddd1b28508212af81d7e82ec08db8e5f6069eccedf5422457f94  markdown/card.md  https://uiarc.dev/components/card/markdown
44dcaf8302eb59915b5f423964b4dbaf10844eced653eef3a7b1ce36a7e26aef  markdown/checkbox.md  https://uiarc.dev/components/checkbox/markdown
b67f8c90f704f62e5b4c5f5aa0b03fdc34a6b0d96b319ccb6514d3b143a71b46  markdown/chip-group.md  https://uiarc.dev/components/chip-group/markdown
f33193262490321c1f43aa127135c6237fab225b9fae694582850f02149bd9bc  markdown/combobox.md  https://uiarc.dev/components/combobox/markdown
6d2b963a03021a428426ba4f26d240fe53d352a5056ddc80622954cecb86c29b  markdown/confirm-morph.md  https://uiarc.dev/components/confirm-morph/markdown
5936dacfe7d409cebce7dbe7616bd813d6f74a3bef9c331f23773ab852e350b0  markdown/context-menu.md  https://uiarc.dev/components/context-menu/markdown
5d137ce6616bd942b57c58c85429470220e3fe4b03718d54855eb167df0f82da  markdown/copy-button.md  https://uiarc.dev/components/copy-button/markdown
7edf0cd85ad3e65837ba3da074be413257489fe29cd2cf622db6ea5e04210202  markdown/date-picker.md  https://uiarc.dev/components/date-picker/markdown
2092061b0462090aae2da0e1430471b6cb12667f0be29fd4d88ceca285e98d4f  markdown/date-range-picker.md  https://uiarc.dev/components/date-range-picker/markdown
856d7341cc24c122e74506c80a52f9416f196317209093f37d733af7e533456c  markdown/dialog.md  https://uiarc.dev/components/dialog/markdown
91dc59bf772316060de0eb785fb9fbff688a81bbd5ea201da191c20e90a72599  markdown/donut-chart.md  https://uiarc.dev/components/donut-chart/markdown
8738361a815c96584df730965df4ce26162336cf90b7df5eeb67ea7f29a71094  markdown/drawer.md  https://uiarc.dev/components/drawer/markdown
ae95c892ecd20450cd1974b5e15e23277a0feaf618a99c3047e45b4550573797  markdown/dropdown-menu.md  https://uiarc.dev/components/dropdown-menu/markdown
dc825829df40e45706f3c4103afd6e544a66864682b04b2aa84efd4840a254f8  markdown/empty-state.md  https://uiarc.dev/components/empty-state/markdown
16216145d56f0e587e0e799e4f4bed52652e0c01de1d12619c1f0c4193a248a4  markdown/file-dropzone.md  https://uiarc.dev/components/file-dropzone/markdown
5bfd26fa398efdf77c4cffd466408ef85eacc99cdc4c484dd970cfab187d0243  markdown/filter-toolbar.md  https://uiarc.dev/components/filter-toolbar/markdown
d315882140068304b304969186d2ceb56e8a58cd1f16b62f4e280d985ec1a6a3  markdown/floating-button-group.md  https://uiarc.dev/components/floating-button-group/markdown
8cd12c850d3aa6dd255b65794f58a5c6278b26e5416c0ff8e323e31afdd70025  markdown/inline-edit.md  https://uiarc.dev/components/inline-edit/markdown
a3a2ffc951422c252bda6769f6fce2eeef8550fe093e4dcaf43db385768147f5  markdown/input.md  https://uiarc.dev/components/input/markdown
ae283299139dde795665766aaa68cace3b9b23eacb6483e2ba73d44290e1bf2d  markdown/line-chart.md  https://uiarc.dev/components/line-chart/markdown
93d054ac3a57914891515514925ff90df07b3bc3f45d01ea39887723c40901cc  markdown/metric-card.md  https://uiarc.dev/components/metric-card/markdown
97a6d5109c559e46b6463d0355866638525839f62744db8c44153a14c8187783  markdown/pagination.md  https://uiarc.dev/components/pagination/markdown
ea50427bb787c96f1ed9dd628a3e1d806f1f8f83bb9c761decb7ca859112bdeb  markdown/password-field.md  https://uiarc.dev/components/password-field/markdown
4d421f56128254a55f044a62ffac6fae56f9937770c04350f0b5b31adaeee192  markdown/popover.md  https://uiarc.dev/components/popover/markdown
838652f3f8571a4a1785c0d6f46617127bbac9f199d6dc896b69ab5ad7a1bb01  markdown/progress.md  https://uiarc.dev/components/progress/markdown
17821213e24d231b14087a6824c6e04d6ba5e0054619d05166460178d7656eb9  markdown/radio-cards.md  https://uiarc.dev/components/radio-cards/markdown
260883fc8fc92d0c95676e59fd789bc8bec9b44f2924e10e7b6f7c2974d43769  markdown/radio-group.md  https://uiarc.dev/components/radio-group/markdown
c49a8ae90bc7d9da53744419b664a45eed0ee7ca5101c3542d6d548ff7db3657  markdown/ridgeline.md  https://uiarc.dev/components/ridgeline/markdown
2c5ba83c6dc91383e62b55feaf2f9081ede41315002a0904a64ab909e3af05fb  markdown/search-field.md  https://uiarc.dev/components/search-field/markdown
e7b28c3ba1a846d5a255ad3cd51224aeec295a36e50dfe19472c9c7e954fecf4  markdown/segmented-control.md  https://uiarc.dev/components/segmented-control/markdown
7ab5088a7865c09b2344f00a2563e7fb6bfe85ae5029a94f9ef63202bed24ce5  markdown/select.md  https://uiarc.dev/components/select/markdown
e8fe05fac1b864e2582a78789b3d2918a7d7ea048729a6364fc2a62784c8ff81  markdown/skeleton.md  https://uiarc.dev/components/skeleton/markdown
8582911dcf3b55ce6b4a4d2f294dec597f335d0bdf22f6e7364566bbed9fe989  markdown/slope-chart.md  https://uiarc.dev/components/slope-chart/markdown
aeb6d27209fa3905074a19d43bb3eb539b742cf1aaed0aabd26d20fe0c55fb0a  markdown/sortable-data-table.md  https://uiarc.dev/components/sortable-data-table/markdown
f1fb6ad2ecd33e24dbd7a533d48a72123cffe9ee740406637eeaed27d1b04a3a  markdown/sparkline.md  https://uiarc.dev/components/sparkline/markdown
6d8fab06c80e6669bafce4c50dfb736623c0c25c2540be7e0c3dadb3b333f565  markdown/split-button.md  https://uiarc.dev/components/split-button/markdown
74305ca546848af5f2135c007e8d94355bfd4786ce38747bdd75606ef52ba123  markdown/stepper.md  https://uiarc.dev/components/stepper/markdown
5f86316a824f536bb816987ef741671af855eb80cab7a6f32713578858e068a8  markdown/switch.md  https://uiarc.dev/components/switch/markdown
9eae2a04b794bb3ad2890e05ad471856f257c257c91ac2222233ea6b8b3e3f6e  markdown/tabs.md  https://uiarc.dev/components/tabs/markdown
0f94734142b3dfc23c3fc13bea0a7e751e764e135960b61b70ddd88d3eccce53  markdown/textarea.md  https://uiarc.dev/components/textarea/markdown
a8d2fdbf6a5209f92c61c846b2412206a6713e3bdf6f29d4b2a5e13aa0028534  markdown/time-picker.md  https://uiarc.dev/components/time-picker/markdown
58eee3cef09811d5a302c9c4e9bd5490081d602d86328c7a8665eeae2daac737  markdown/timeline.md  https://uiarc.dev/components/timeline/markdown
128e13add5c15eb52cc75b6c5ab353e289ca5bd8b0612a5732261e6a061ddefe  markdown/toast.md  https://uiarc.dev/components/toast/markdown
8200bb799b177fc7004da5b19f1c58854c5537f428a0ad50b9d224785ec0497e  markdown/tooltip.md  https://uiarc.dev/components/tooltip/markdown
8d2efe67a9d672085f70805342795300a61a5c7feda9c8ec3dba0152d303f069  markdown/treemap.md  https://uiarc.dev/components/treemap/markdown
20c528ebcddd3d77e82176cb60d21dcabaa508a2363ca62053670103cb3569fe  markdown/user-menu.md  https://uiarc.dev/components/user-menu/markdown
db09c77051eb889825fedeb57bf66f81d3590e86ea8724b59c8fe0fee35146a5  markdown/waffle-chart.md  https://uiarc.dev/components/waffle-chart/markdown
```
