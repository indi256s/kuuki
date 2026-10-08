Plan contract: wave-plan/v1
# Arc Integration Implementation Plan

Goal: Integrate the suitable free Arc components across Kuuki, add the explicitly requested range/edit/context/confirmation interactions and nine chart types, and migrate Overview chart rendering from TanStack to Arc while preserving its data and interaction contracts.
Architecture: Adapt selected Arc source and CSS into the existing shared UI. Migrate the implemented Release 3 Overview from TanStack definitions to local Arc SVG/DOM chart components; retain and adapt Kuuki's chart host, table fallback, lazy mounting, data engine and owner-qualified state. Extend date-range and derived-series contracts only where the new features need them. Keep existing write authorities and Radix behavior.
Success: All existing screens in the coverage map use the accepted shared controls; keyboard, EN/RU, themes, responsive layouts, URL state, owner isolation, and write recovery still work. Every candidate in the preceding user-facing component list has a recorded adoption, adaptation, or exclusion decision; this is not an installation plan for the entire Arc catalog.
Out of scope: Remaining extension-backlog features; Pro source; beUI integration; unrelated backend/schema changes; deployment; a permanent second chart engine; changing Ticket, Stamp, Facehash, map behavior/catalog, the auth brand panel, or Horizon. Scoped API/filter/aggregate changes needed for arbitrary dates and the requested charts are included; no D1 schema migration is planned.
Constraints: Follow DESIGN.md, CODING_STANDARDS.md, both applicable AGENTS.md files, and docs/agents/issue-tracker.md. Preserve unrelated work. Primary is GPT-6.1 Sol (codex/gpt-6.1-sol); implementation/debugging workers use GPT-6.1 Sol medium and Claude Sonnet 5.5 medium, both meaningfully. Independent reviewers use either model at high effort; no Opus. User routing supersedes historical plan routing. Only one active writer owns a shared path. Independent review covers broad UI and shared-contract changes.
Planning basis: Initial audit/inventory and plan request, followed by the explicit 13-component scope addition and request to inspect feat/overview-release-3-ui. Inspected main plus that branch at 8b5e5c3, its dirty worktree, chart source/history/handoff, current filter contracts and public Arc registry source on 2026-10-08. Screen mappings and chart adaptations are planning decisions, not already verified replacements.
Execution profile: primary=codex/gpt-6.1-sol high; workers=codex/gpt-6.1-sol medium + claudeAgent/claude-sonnet-5-5 medium; reviewers=independent Sol/Sonnet high; capability catalog verified 2026-10-08. Sonnet uses app-owned delegate_task; taskIds retained in execution handoff.
Authority evidence: The original planning-only request is historical. On 2026-10-08 the user explicitly authorized this implementation thread and all five waves, all 13 additions, local verification/fixes, independent reviews and documentation. The bound worktree starts from local Release 3 revision 4b4fe54e1df31c486fb2de8b47970e82bc824ded, not the older planning snapshot. No deployment, merge, publication or remote D1 writes are authorized.
Status: All five waves and all 13 additions accepted for the bound execution baseline. Final evidence is in `2026-10-08-arc-integration-handoff.md`; the user explicitly skipped additional visual browser verification. Exact handoff copied before modification; SHA256 8703b5460f7e713d10999b1a08df5cdfff97298621ed8f0287beb6c204cd113f. Current user test policy supersedes historical handoff: existing checks first, one new test only per otherwise uncovered failure mode; no costly visual audit.

## Integration decisions

1. **Keep one shared UI kit.** Existing callers continue importing `Button`, `Field`, `Calendar`, `Combobox`, `Dialog`, `Sheet`, `Menu`, `SegmentedControl`, `SwitchRow`, `Disclosure`, and `ToastProvider` from their current paths. Adapt Arc in those implementations; avoid maintaining a parallel raw Arc kit and an additional generic wrapper layer.
2. **Keep Kuuki's accepted design.** Commissioner, JetBrains Mono, named accents, status colors, radii, focus rings and touch targets follow the accepted execution baseline's DESIGN.md and dated Overview decisions. The inspected Release 3 branch already implements Shu/Paper and seven sections; preserve those accepted choices when migrating it, rather than reinstating main's older Overview. Arc's default typography and palette do not override either baseline.
3. **Do not import Arc foundation.css globally.** Its reset, token names, fonts, radii, and focus rules overlap the app. Rewrite copied CSS variables to Kuuki tokens: foreground → text; secondary text → text-muted; muted surface → surface-inset; control/card/modal radii → radius-sm/md/lg. Resolve border and status variables by role: hairline versus control-border, status text versus fill. Any genuinely missing token belongs only in styles.css.
4. **Preserve stronger local behavior.** Airport matching, typed dates, mobile keyboard handling, pending-write guards, privacy, undo, and toast timing stay with Kuuki. Source adaptation is acceptable; upstream behavior is not the acceptance standard.
5. **Keep motion bounded.** No routine bounce, count-up or delayed totals. Preserve SSGoI, Torph and Release 3's accepted chart-motion/reduced-motion contracts. The requested Arc chart source imports Motion, so plan one compatible pinned motion dependency and shared local policy for its actual consumers. Disable upstream draw-in/default transitions that conflict with Kuuki; measure production chunks against Release 3 using the same method.
6. **Copy only used free source.** Recheck the live tier, fetch the public registry item, record its source hash, retain the MIT notice, and adapt it locally. No bulk registry install, automatic updates, Pro reconstruction, new fonts, or new shadcn configuration merely to acquire source.
7. **Migrate chart rendering to Arc.** Arc's nine requested chart items render SVG/DOM and depend on Motion, not TanStack. Use their source as the new chart foundation, keeping Kuuki's pure calculations, normalized identities, comparison baselines, accessible tables and action contracts. TanStack may remain temporarily during staged replacement, but the final removal gate includes every production/test import, the SVG globe and replay transport. Non-equivalent charts require explicit local Arc/SVG adaptations; no claim of a drop-in full replacement.
8. **Blocks are composition references.** Page header, Empty states, File upload, Sign in, and Signup form contribute useful parts to current screens. Do not install duplicate complete pages or replace the one-form auth flow.

## Planning evidence and implementation baseline

- Current app: Next 16.3.8 / React 19.2.4. Radix Dialog 1.1.15, Dropdown Menu 2.1.16, Lucide, SSGoI, Torph, and TanStack Charts are declared in `apps/next/package.json`; Motion is not.
- Existing primitives already encode requirements that raw Arc cannot replace wholesale: Button loading/disabled-reason and text-feedback props; Field ref forwarding and reserved error row; Combobox code/detail/alias matching and mobile Sheet; Calendar locale-aware typed input; SegmentedControl radiogroup semantics; Sheet visualViewport insets; Toast owner scope, priority, and timer pauses.
- Audited Arc source uses Motion/CSS modules. Its Combobox requires a focus-leave close fix and does not provide Kuuki's full search behavior. Date picker is button-first rather than Kuuki's typed field. Sortable data table sorts its own rows; it must not replace server sorting across pages. Metric card includes animated-counter behavior that must be removed for immediate totals. Toast's defaults do not match local timer/announcement requirements.
- Release 3 is implemented on feat/overview-release-3-ui at inspected tip 8b5e5c3. TanStack Charts 1.0.0 entered both manifests in 65d07f1 (2026-10-07); the chart kit with touch pinning, table view and lazy mount entered in 3ad8588 (2026-10-07). The branch has real chart consumers, filter/prefs state and globe/replay code, not only a proposal. Its handoff reports CI evidence, not fresh verification by this thread. The owning worktree also has uncommitted chart-adjacent context, open-flight and popover fixes: preserve and coordinate with their owner.
- The planning snapshot above is historical. Implementation uses the clean app-bound descendant at `4b4fe54e1df31c486fb2de8b47970e82bc824ded`. Unrelated root import/enrichment/design changes were neither copied nor modified. This branch's aircraft suggestion DTO lacks operated/scheduled, source-date, operator and registration fields; existing evidence, selection and update authority are preserved. The absent prerequisite is recorded in `.scratch/arc-import-enrichment-baseline-gap.md`. No other branch's deployment authorization applies.
- Existing ranges differ: Journal exposes year but no from/to filter; Release 3 Overview supports inclusive YYYY-MM month ranges in its shared engine/preferences. A day-level Date range picker is a contract extension, not merely swapping a component. Aggregate mode can contain monthly weighted rows, so an Activity heatmap must obtain real daily aggregates rather than invent daily counts.
- Arc source differences matter: Brush range changes fire during dragging and use epoch milliseconds; Donut defaults group small categories into Other; Ridgeline computes KDE from raw observations; Line supports smooth/linear curves, not the current cumulative step curve. Preserve or explicitly adapt these semantics in W2/W5.

## Component disposition and coverage

**Adapt** means incorporate Arc styling/source while retaining local behavior. **Compose** means apply a component to an existing screen. **Reference** means reuse the design idea without importing a competing implementation. Entries naming new files below are proposals, not existing interfaces.

| Arc candidates | Disposition | Current destination | Owner |
|---|---|---|---|
| Button, Action button, Button group | Adapt/compose | Existing Button; shell actions; forms and review actions | W1; consumers W2–W4 |
| Input, Textarea, Password field | Adapt/compose | Existing Field; proposed textarea/password-field only if repeated callers justify them | W1; consumers W3/W4 |
| Select, Checkbox, Radio group, Radio cards | Adapt/compose | Proposed shared select/checkbox/radio controls; filters, row selection, onboarding choice | W1; consumers W2–W4 |
| Switch, Segmented control | Adapt | Existing SwitchRow/SegmentedControl; settings, years, passport, import | W1 |
| Dropdown menu, Popover, Tooltip | Adapt/compose | Existing Menu; calendar popover; proposed tooltip only for real explanatory content | W1/W2 |
| Dialog, Drawer, Bottom sheet | Adapt | Existing Dialog/Sheet and DestructiveConfirm composition | W2 |
| Combobox, Calendar | Adapt | Existing code-based search and typed-date primitives | W2 |
| Time picker | Adapt only after local-time/keyboard parity | Existing departure/arrival inputs; keep native controls if parity fails | W2 |
| Search field, Filter toolbar, Chip group | Adapt/compose | JournalFilters; AddCountrySheet search | W2/W3 |
| Date range picker | Adapt + scoped contract extension | Journal arbitrary-period filter and Overview period controls | W2; charts W5 |
| Inline edit, Context menu, Confirm morph | Adapt + existing write-authority composition | Journal aircraft-type cell, flight action menu, reversible single-flight deletion | W2 |
| Sortable data table, Pagination | Adapt/compose | Existing Journal ledger, mobile rows, server sort and URL pagination | W2 |
| Floating button group | Adapt | Existing FloatingActionBar, not a second floating tray | W2 |
| Accordion | Adapt | Existing Disclosure; flight optional fields, chains, import help, achievements | W1; consumers W2–W4 |
| File dropzone | Adapt/compose | SourceStep; existing file validation and submission | W3 |
| Stepper | Compose | Existing import stages and account deletion steps | W3/W4 |
| Copy button | Adapt/compose | Import prompt and ShareProfile; retain fallback and FeedbackText | W3/W4 |
| Alert, Toast, Announcement bar | Adapt/compose | Existing errors, ToastProvider/ToastSlot, ShellNotices | W1/W2; consumers all |
| Progress, Skeleton, Empty state | Compose | Existing truthful progress and data placeholders; keep route LoadingScreen | W1; consumers all |
| Badge, Card | Compose | Existing status, achievement, review, summary, and list surfaces | W1; consumers all |
| Split button, User menu, Avatar | Adapt/compose | SplitAdd, AvatarMenu, ProfileAvatar; preserve Facehash | W4 |
| Tabs | Reference/adapt styles | Navigation links and leaderboard category links; keep route semantics | W4 |
| Metric card | Adapt/compose | OverviewFigures, PassportCover, profile statistics, DoneStep; no animated counter | W3/W5 |
| Bar chart | Adapt/render | Where an existing bar view still remains; preserve values and drill-down actions | W5 |
| Sparkline, Line chart, Brush chart | Adapt/render | Summary trend, cumulative flights/km, controlled period selection | W5 |
| Donut chart, Waffle chart | Adapt/render | Airline/region shares; Manufacturers part-to-whole distribution | W5 |
| Activity heatmap | Adapt/render + daily data | Days with completed flights; keep current monthly Rhythm as a separate view | W5 |
| Slope chart, Ridgeline, Treemap | Adapt/render | Two-period comparison; Fleet distributions; region/country hierarchy | W5 |
| Timeline | Compose only where it improves existing records | CountrySheet's dated visit/evidence list; no invented activity log | W3 |
| Page header, Empty states, File upload blocks | Compose useful parts | Existing read-page headers, empty states, SourceStep | W3–W5 |
| Sign in, Signup form blocks | Reference useful form parts | Current auth-card; preserve its brand panel and one-form states | W4 |

### Screen coverage

| Existing surface | Integration scope | State/behavior that must remain |
|---|---|---|
| Shell and mobile navigation | Split Add, user menu, route indicators, avatar, Add Sheet, notices | All five mobile destinations, current route, sign-out, keyboard clearance, owner-scoped notices |
| /, /signin, /signup, activation/recovery request and reset screens | Inputs, password reveal, actions, errors, theme/language controls | Existing email/password stages, auth aliases, tokens, request throttling, Horizon and brand panel |
| /onboarding | Name/username, source choice, first manual/import flow, result actions | Availability checks, shared save authorities, canonical first Ticket, published Stamp reveal |
| /overview | Accepted Release 3 controls/layout plus Arc chart migration, trends/distributions/comparison/hierarchy and arbitrary range | Owner-qualified payload/prefs, engine values, aggregates, immediate figures, chart actions/tables, lazy mount, Next strip, globe/replay |
| /journal | Search, date ranges, filters/chips, ledger/mobile rows, inline aircraft edit, Context menu, single-item Confirm morph, pagination, overlays/Undo | Full-dataset server sort/selection, staged mobile Apply, URL/back-forward, owner-qualified writes, hidden pending deletes, recovery/focus |
| /add and /journal/[id]/edit | Search fields, typed date, time controls, optional fields, save/cancel/delete | Exact codes, recents, local-time semantics, duplicate warning, offline/pending/uncertain/retry states |
| /import | File/text, progress, questions, review selection/edits, manual rows, failure and done | File limits, draft persistence, confidence, partial success, idempotency, aircraft-review evidence and selection |
| /passport and /passport/manage | View/sort controls, progress, country search/sheets, visit fields, deletion, aircraft bulk edit | Catalog and regions, Stamp identity, map renderer, URL state, evidence consequences, batch outcomes |
| /fly/[username] and /leaderboard | Avatar, copy, statistics, achievements, category links, eligibility, row presentation | Public-data boundary, rankings, five-flight requirement, own-row pinning and route transition |
| /settings | Profile, API key, privacy, appearance, export, savebar, guards, deletion steps | Dirty-state guards, explicit save, CSV limits, dependent privacy choices, identity cleanup, password confirmation |
| Route loaders, 404/error, account-deleted/password-updated | Existing status composition and recovery actions | Loading is not empty; no fictitious success; current recovery routes |
| Isolated activation completion asset | No direct React component migration | Preserve current static HTML and Worker activation authority; do not enlarge this plan into runtime work |

## Execution map

Five waves express shared-component dependencies and the larger workflow risks. Acceptance is serial. No parallel app writers are needed by default.

| Wave | Outcome | Depends on | Writes (active owner) | Reads / validates | Parallel-safe with | Material risk → primary proof | Acceptance owner |
|---|---|---|---|---|---|---|---|
| W1 | Theme/source policy and common controls | — | app styles/tokens; ui common controls; package/lock changes; source inventory/license | DESIGN, all shared callers, existing primitive tests | Read-only review | Global styling/API regression → token tests and shared-control tests | Primary |
| W2 | Search/overlays plus arbitrary ranges and Journal interactions | W1 | ui advanced controls; capture/reads; URL helpers; shared range/prefs/filter contracts; flightQuery and affected API/client/tests | Data catalogs, list/ids queries, write authorities, Release 3 filters | Read-only review | Boundary dates, lost writes, focus/Undo → API/shared/unit and capture/read journeys | Primary |
| W3 | Import and Passport use accepted controls | W2 | client/import, client/passport, reads/passport, capture/passport-manage; import/passport route CSS/tests | Draft/save state, current enrichment edits, accepted shared kit | Read-only review | Partial saves/evidence mistakes → import/passport tests and journeys | Primary |
| W4 | Shell, account, auth and public screens | W2, W3 for reused onboarding flows | nav/avatar-menu/split-add/add-actions; account/auth-card/public/profile/leaderboard; route-local presentation CSS/tests | Identity/appearance/privacy contracts; accepted controls | Read-only review | Identity/privacy/dirty-state regression → account/auth/settings/shell journeys | Primary |
| W5 | Arc chart migration, derived series, TanStack removal and acceptance | W3, W4 | Release 3 client/overview/charts/sections/globe; relevant shared engine/series and owner-scoped aggregate service/tests; final docs | Accepted Release 3 data/actions, chart source, scoped patch | Final lint/unit lanes only where safe | Semantic/interaction loss → engine parity, chart-host tests, globe/replay and full UI gates | Primary |

Shared ownership transfers:
- `apps/next/src/client/ui/ui.css`, `flight-controls.css`, and shared primitive tests: W1 → W2 after W1 is accepted and inactive.
- Common primitives remain frozen during W3/W4/W5. Any required shared fix returns ownership to the completed foundation lane, is accepted there, and invalidates affected downstream evidence before consumers resume.
- `styles.css`, `tokens.test.ts`, `apps/next/package.json`, `pnpm-lock.yaml`, and source/license inventory changes always belong to the foundation lane. Never mutate them concurrently with consumer work.
- `apps/next/tests/` files are assigned by scenario to the active wave. W5 owns final suite adjustments after earlier test writers stop.
- Preserve in-progress import/enrichment work; no Arc worker owns functions/api/enrich or enrichment scripts. Shared range/DTO/engine contracts now have explicit owners: W2 for date filtering, W5 for chart-series additions, with serial transfer after W2 is accepted and inactive.
- Proposed local Arc chart source under client/overview/charts/arc belongs to W5. Package/lock/source-inventory updates, including final TanStack removal, return to the foundation owner after W5's last-import proof; no concurrent manifest writer.

## W1: Establish the Arc-derived common kit

Objective: Low-risk controls render consistently in Kuuki themes without changing their public contracts.

Owned writes:
- Existing `apps/next/src/client/ui/{button,field,segmented-control,switch-row,disclosure}.tsx`, `ui.css`, associated tests.
- New controls only where repeated current callers need them: select, checkbox/radio, textarea/password field, and simple badge/alert/card/empty/progress/skeleton compositions. Names and APIs are decided from actual callers, not a pre-generated kit.
- `apps/next/src/app/styles.css`, `tokens.test.ts`, app package/lock files if needed.
- Proposed `docs/research/2026-10-08-arc-source-inventory.md` and an Arc MIT notice beside copied UI source.

Implementation:
- [x] Record base revision, unrelated dirty files and active owners. Build the scoped caller inventory with rg before editing each shared export.
- [x] Recheck free tier and registry dependency trees; retain source hashes and license text. Record adopted behavior, local patches, dependencies, and each excluded candidate.
- [x] Map Arc CSS to Kuuki's tokens; avoid global resets and unconditional focus suppression.
- [x] Adapt Button/Field presentation while preserving ref forwarding, DOM input attributes, RHF compatibility, loading labels, disabled reasons, error layout, and FeedbackText behavior.
- [x] Adapt small-choice controls with current radio semantics, one tab stop, arrow/Home/End keys, localized names, 44px targets and narrow-screen wrapping.
- [x] Introduce only used simple components. Keep LoadingScreen as the route-level pending state; skeletons are for in-place data surfaces.
- [x] Audit the nine requested chart registry items and new controls, retaining source hashes and tier/license metadata. Evaluate the Motion dependency required by upstream source; final local SVG adaptations use CSS/React/Radix, so the unused pilot dependency is removed. Keep renderer dependencies out of unrelated root/page bundles.
- [x] Check client boundaries: no conversion of entire layouts/pages into client components, browser APIs only in safe effects, no hydration-only default values.

Dependencies: Accepted execution-baseline DESIGN and shared interfaces. W1 creates foundations only; W2/W5 own the explicitly requested product/API/series extensions.

Focused proof:
- Existing Button, Disclosure, SegmentedControl, SwatchPicker and token tests; add a small regression only for a newly retained behavior or changed contract.
- EN/RU long labels, dark/light token pairs, initial and keyboard feedback, visible disabled reasons.
- Compare production chunks using existing build output or a fresh relevant build if dependency changes require it; record which routes load Motion rather than inventing a size claim.

Accept when: Current callers still compile; accepted controls keep existing semantics and states; Arc attribution and adaptation decisions are persistent; no unused component/source tree is installed.

## W2: Integrate advanced controls, Capture and Journal

Objective: Forms and the full Journal adopt the shared kit with their current state and recovery behavior.

Owned writes: Existing advanced ui controls and proposed date-range/inline-edit/context-menu/confirm-morph components; capture and Journal consumers/CSS/tests; apps/next/src/lib/url-state.ts; packages/shared/src/overview range/filter/prefs contracts and applicable exported DTOs; functions/api/_lib/flightQuery.ts, existing list/ids handlers and tests only as needed for range admission; affected client query helpers. Keep existing API routes/methods and write handlers unless an inspected caller proves a bounded admission change is needed.

Implementation:
- [x] Keep Radix focus, dismissal and collision behavior for existing overlays; apply Arc presentation in place.
- [x] Keep the full-height mobile search Sheet, handle-only drag, visualViewport insets, focus restoration, pending dismissal lock, and current portal stacking.
- [x] Patch Arc-inspired Combobox interactions to close when focus leaves the whole widget. Preserve code-first ranking, aliases/details, 50-result cap, owner recents, highlight, count speech and keyboard selection.
- [x] Keep Calendar's locale-aware typed input, ISO acceptance, invalid raw text, week starts and cross-month keyboard movement; reuse Arc's calendar composition without picker-only replacement.
- [x] Evaluate Time picker against actual departure/arrival semantics and keyboard entry. Adopt only with parity; otherwise retain and restyle current native time controls and record the disposition.
- [x] Compose Journal Search field, filter toolbar and chips around query normalization. Preserve staged mobile drafts, Apply, clear/reset, pagination, Back/Forward, and pending-navigation behavior.
- [x] Date range picker: add inclusive from/to YYYY-MM-DD filters to Journal URL/API. A valid range takes precedence over year and removes it from canonical state; choosing a year clears the range. Reject partial, reversed or impossible API ranges with a validation error; invalid bookmarks normalize to an unfiltered period. Use bound date comparisons and the same owner-scoped buildFlightWhere for list and ids/counts, so pagination and select-all agree. UI errors retain the draft until fixed; clearing filters removes both bounds.
- [x] Overview ranges: evolve accepted period/filter/prefs admission to exact inclusive calendar days, preserving legacy YYYY-MM ranges by expanding to first/last day. Year selections keep their existing contract. Date picker, period controls and Brush use one conversion/normalization path; never shift date-only values through the browser timezone. Update previous-period calculations to an adjacent equal-length inclusive range and preserve filters. No destructive preference migration or database-schema change.
- [x] Inline edit: start with the missing/existing aircraft-type cell in Journal, using the existing validated owner-qualified flight-update authority and searchable aircraft codes. Enter saves, Escape cancels, blur does not silently save; no optimistic success before acknowledgement. Preserve errors/draft on rejection, distinguish unknown write outcomes, prevent duplicate submission, reconcile the canonical row and restore focus. Full flight form remains available; do not create generic arbitrary-column writes.
- [x] Context menu: expose existing Open/Edit and eligible single-flight Delete actions using the same handlers as visible controls. Add keyboard context-menu entry and keep mobile/keyboard alternatives; scope each action to its flight ID and current online/pending state. Opening it must not activate the row or change selection.
- [x] Confirm morph: compose reversible single-flight Journal deletion with the current deferred-delete/Undo authority. Show explicit object + consequence, keyboard-operable confirm/cancel, pending/error/Undo states and stable focus. Never create a competing countdown or imply server deletion before acknowledgement. Bulk deletion, account deletion and country-evidence removal keep their full dialogs.
- [x] Adapt the existing ledger to Arc table presentation, keeping URL/server sort as authority. Do not install upstream internal row sorting; keep chain grouping, mobile rows, accessible open/edit actions, and full-result selection.
- [x] Restyle existing FloatingActionBar and DestructiveConfirm; retain Undo timing, pending-row hiding, failure/retry and focus after removal.
- [x] Apply Arc Toast presentation to current provider/slot, preserving owner reset, assertive errors, polite success, persistent Undo and pause on hover/focus/hidden tab.
- [x] Remove obsolete selectors only after inspecting all consumers, including link elements that reuse `.ui-button` classes.

Dependencies: Accepted W1 contracts.

Focused proof:
- Unit paths: `src/client/ui/`, `src/client/capture/flight-form.test.tsx`, `src/client/reads/journal.test.tsx`, `src/client/reads/delete-undo.test.tsx`, `src/lib/url-state.test.ts`.
- Fresh local build, then focused Playwright `capture.test.ts` and `read-journeys.test.ts`.
- Search exact IATA/ICAO/alias and Tab away; type RU/EN/ISO date; mobile keyboard open/close; arbitrary ranges across leap day/year/timezones, legacy month prefs and equal-length comparison; range list/ids/count parity and owner isolation; sort/select across pages; inline-save rejection/lost response; Context menu keyboard/row isolation; single Confirm morph Undo/failure; focus remains meaningful.
- If DOM presentation changes invalidate geometry assertions, rewrite them to assert required user-visible alignment/order rather than removing the coverage.

Accept when: Capture/Journal use accepted controls; the four requested interactions are implemented with admitted range contracts and existing write authorities; full-dataset filtering/order/selection, URL/history and recovery pass; independent shared/API-contract review has no unresolved blocking finding.

## W3: Integrate Import and Passport

Objective: Existing import and passport workflows use the shared controls throughout, including raw legacy controls in aircraft management.

Owned writes: `apps/next/src/client/import/`, `client/passport/`, `client/reads/passport.tsx`, `client/capture/passport-manage.tsx`, related CSS/unit tests and `tests/import.test.ts` / `passport.test.ts`. Coordinate with the owner of pre-existing aircraft review edits before touching overlapping files.

Implementation:
- [x] SourceStep: segmented file/text choice, File dropzone and Textarea, existing size/type validation, Accordion help and Copy button fallback.
- [x] ProgressStep: stages through Stepper and honest Progress; keep found counts and announcements on actual data.
- [x] Review: checkbox selection, shared field editors, confidence/status badges, grouped questions, manual rows, confirm/cancel and current focus order.
- [x] Preserve drafts, partial failure, failed-row retry, unconfirmed saves, frozen/busy actions and idempotent confirmation. Do not replace state machines with Arc demos.
- [x] Aircraft suggestions: preserve the current branch's evidence/confidence, review selection and batch outcomes. Structured source-date/registration/operator and operated/scheduled fields are absent from the authorized baseline; document that prerequisite without inventing classification or copying dirty-root work.
- [x] DoneStep: adapt static metric composition and real results; preserve newly published Stamp identity and route-transition hooks.
- [x] Passport: adopt controls for view/sort/layers, static summary/progress, country search and responsive panels; keep Stamp grid and map.
- [x] CountrySheet: shared visit fields, method selection, dated evidence presentation, errors and deletion consequence dialogs. Use Timeline only for already dated records; retain an ordinary list otherwise.
- [x] Passport/manage: replace raw controls using Checkbox + searchable aircraft choice + Button; retain selection cap, per-row results, uncertainty and retry.

Dependencies: Accepted W2 search, overlays, and toast behavior.

Focused proof:
- Unit selections: `src/client/import`, `src/client/passport`, `src/client/reads/passport.test.tsx`, `src/client/capture/passport-manage.test.tsx`.
- Fresh relevant local build and focused import/passport browser journeys.
- File and pasted text; review and reload; one failed row among successful rows; stale/uncertain save; existing suggestion selection (structured scheduled proposals are absent from this baseline); country visit deletion consequences; mobile country-panel focus and keyboard clearance.

Accept when: Source/progress/review/failure/done and passport add/detail/manage states all use the kit; current import/enrichment semantics are preserved; partial saves and evidence deletion remain correctly represented.

## W4: Integrate Shell, Settings, Auth and public screens

Objective: Every existing entry/account/social screen uses the same accepted controls.

Owned writes: Existing shell/nav/avatar-menu/split-add/add-actions and notices; `client/account`, `auth-card`, `public`, `profile`, `leaderboard`; affected route presentation CSS and their unit/browser tests. Do not alter route handlers, bootstrap persistence, or static activation assets.

Implementation:
- [x] SplitAdd/User menu/Avatar compositions; preserve Facehash, route links, five mobile destinations, privacy actions and sign-out.
- [x] Apply Tabs styling to links without changing routing/prefetch/current-page semantics.
- [x] Settings: profile fields, password-like key field, saved privacy controls, immediate appearance controls, named accent radios, export rows and sticky savebar.
- [x] Preserve SettingsGuard across owned links, history and document exits. Keep three-step account deletion, optional CSV download, password confirmation, no pending dismissal, and distinct failure/uncertain outcomes.
- [x] Auth/recovery: integrate shared field/password/button/alert presentation into the current one-form card. Keep autocomplete, reveal semantics, token authorities, email retry logic, Horizon toggle, wordmark and plane field.
- [x] Onboarding: name availability, existing source choice and shared Capture/Import controls; no new setup steps.
- [x] Profile/leaderboard: consistent avatar/status/achievement presentation, Copy button fallback, category link styles, static metrics, own-row behavior, eligibility progress and private/empty/error states.
- [x] Reuse Page header and form-block ideas inside current composition; avoid creating duplicate auth or profile pages.

Dependencies: W2 accepted kit; W3 completed before checking onboarding import/reveal.

Focused proof:
- Unit selections: account, auth-card, public, profile, leaderboard, nav/avatar-menu/add-actions/appearance/shell-notices.
- Relevant browser files: auth-entry, auth-recovery, reset-password, onboarding, account, settings, shell, theme-toggle, text-feedback.
- Check public/private transitions, pending sign-out, owner switch clearing data/notices, dirty-state navigation, partial CSV export, password-confirmed deletion, username availability and Keyboard/Clipboard fallback.
- Layout spot checks at 320/390px mobile and 1440px desktop; longest RU labels, theme/system persistence and five accents. Existing tests are primary evidence; no new screenshot atlas or repeated visual audit is required.

Accept when: Entry, shell, settings, onboarding, profile and leaderboard use the kit; privacy and identity boundaries pass; independent broad UI review finds no unresolved blocking regression.

## W5: Migrate Release 3 charts to Arc and complete integration

Objective: Integrate all nine requested chart types with useful, defined placements; preserve the implemented Overview contract; retire TanStack after all consumers have equivalents.

Owned writes: Release 3 client/overview/charts, sections, hero/tile trend placements, store and globe/replay consumers and tests; packages/shared/src/overview series/filter extensions and rendering-test relocation; owner-qualified Overview payload/aggregate service/DTO tests only where day-level data requires them. Update affected docs including the existing Overview UI plan/handoff and DESIGN after implementation. Foundation owner performs package/lock/source-inventory changes. Preserve unrelated work.

Implementation:
- [x] Recheck Release 3 tip and dirty owners, read its adjacent handoff, and start from an accepted descendant. Treat 8b5e5c3 as inspected evidence, not a permanently fixed implementation base.
- [x] Prove one Arc Line + Brush and one interactive Waffle integration against the current chart host before mass conversion: SSR/hydration, data identity, table, touch actions, keyboard selection, range commit and theme/motion. Resolve structural API gaps in local copied source; do not silently drop capabilities.
- [x] Migrate each requested chart using the placement and data contract below. Retain computeOverview's domain authority; renderer adapters only format/project already derived values. Preserve current ghost/baseline, weighted aggregates, missing/approximate signals and thresholds.
- [x] Rework the existing KuukiChart host from TanStack-specific definition/ChartPoint types to an Arc composition boundary with stable domain IDs and application callbacks. Reuse TableView, LazyChart and palette contracts; do not add a general multi-engine framework. Preserve desktop/keyboard actions, first-touch pinned action tooltip, dismissal, hidden-series semantics, owner generation guards, 44px actions and below-fold reserved height.
- [x] Extend dated series at the engine/service boundary when necessary: actual daily counts for Activity heatmap, cumulative flights/km, comparison values and hierarchy. Aggregate mode receives bounded owner-scoped daily summaries, not fabricated days from monthly weighted rows or recovered per-flight IDs. Preserve >5,000-row compact-mode rules and payload admission; stale/unknown/missing data stays distinct from zero.
- [x] Replace current TanStack-only non-equivalents explicitly: local SVG rank-over-time path/marks with reversed rank axis and series dashes; current radial Clock geometry and hours/actions; signed Crossings bars with labels; SVG globe using the already installed d3-geo projection/path with existing catalog; replay handle as an accessible controlled range transport. Keep MapLibre, projection/flight identity, fallback behavior and replay timing unchanged. Do not install paid Arc map components or replace these views with semantically different Donut/Slope charts.
- [x] Update chart/SSR/DOM-free rendering tests to exercise Arc/local SVG output; preserve pure engine fixtures/goldens and interaction assertions. Search production, shared tests, scripts and prototypes for TanStack usage. Remove production and test imports, then remove both root/app dependency declarations and unused direct/transitive helpers only after caller proof. Archived prototypes are documented separately and must not drive app installation.
- [x] Record a same-method Release 3 vs migrated production-bundle comparison and initial-render/lazy/hydration evidence. Arc source does not guarantee a smaller bundle; report measurements and retained Motion/MapLibre chunks accurately.
- [x] Audit all routes and raw form controls against the coverage map. Classify remaining controls explicitly: accepted shared control, intentional native equivalent, signature UI, static activation boundary, or extension backlog.
- [x] Remove orphaned CSS/imports and unused copied dependencies only after caller search. Keep supported public APIs and necessary per-screen layouts.
- [x] Update DESIGN.md's primitive/adoption descriptions to match the shipped result, without changing unrelated aircraft, motion, or proposed design decisions.
- [x] Run the final gates against the same scoped patch; record commands, results, review disposition, baseline failures, and adopted/excluded components.

Dependencies: Accepted W2 exact-range contracts and W3/W4; accepted Release 3 chart/data baseline; no active overlapping shared/UI writers.

Focused proof: Engine golden/property tests and new series/range tests; chart host/touch/keyboard/table/lazy tests; local SSR/hydration, all requested chart placements, comparison/aggregation fidelity, SVG globe and replay tests; production import/dependency removal and bundle comparison; then final gates.

Accept when: All nine requested charts and W2's four interactions have meaningful integrated placements and evidence; current Release 3 chart/map/replay functions and values survive; no TanStack production/test consumer remains; manifests no longer require it; no permanent parallel renderer or unreviewed contract change remains. A missed equivalent blocks full-removal acceptance rather than being silently marked complete.

### Requested chart placements and compatibility gates

| Requested chart | Planned placement / data question | Required adaptation or proof |
|---|---|---|
| Sparkline | Flight-count/distance trend beside the existing hero/summary metric or section tile, using the same selected period | Immediate numeric headline; localized point labels; aligned buckets; compact summary accessible without tooltip |
| Line chart | Rhythm cumulative flights/km, preserving the current odometer's step meaning | Sorted real dates and weighted totals; add step-after geometry to copied source where needed; ghost baseline; explicit mark-action callbacks, not crosshair movement as a filter |
| Brush chart | Rhythm time-window strip linked to the same period as Date range picker | UTC-stable epoch/day conversion; controlled draft while dragging, explicit commit on pointer/keyboard completion; no prefs/API write for every pointermove; minSpan supports one-day range |
| Donut chart | Compact airline or region share view from existing rankings/country evidence | Stable identities and exact totals; configure/patch automatic Other grouping; zero/missing distinction; visible legend/table and actual filter actions |
| Waffle chart | Current Manufacturers share/count view | Preserve flights/hours/km modes, printed unit/rounding, maker colors and aggregate weighting; retain per-flight action only where actual IDs exist; add explicit category/mark callbacks |
| Activity heatmap | Rhythm daily calendar alongside the current month-by-year metric view | Real day counts; YYYY-MM-DD keys; leap days/week/locale; availability of daily summaries in aggregate mode; selecting a day applies the exact-day range |
| Slope chart | Rankings/comparison view for selected versus previous period | Existing equal-length comparison rules; exact counts/shares and missing baseline; never substitute two endpoints for the current multi-year bump chart |
| Ridgeline | Current Fleet duration distributions by family/type | Extend copied Arc source to accept precomputed sampled densities and summary statistics: upstream accepts raw values and always recomputes KDE. Feed the existing log-density output; prove parity for ticks, bandwidth, sparse samples and weighting before cutover; never reconstruct distributions from rounded aggregates |
| Treemap | Region → country share view in the existing Overview geography/collection context | Leaves use explicit completed-flight country-evidence counts, not region totals or unique countries mixed with flights; transit suppression and unknown exclusions respected; hierarchy drill and filter are distinct actions |

All placements use accepted bento/section layouts and existing controls; alternative views are integrated into the relevant section rather than creating another dashboard. Exact UI placement is resolved against the accepted branch before implementation. Chart interaction extensions to local copied Arc source are part of W5, not assumptions about upstream props.

### TanStack removal inventory (inspected Release 3)

| Current consumer | Migration path |
|---|---|
| charts/kuuki-chart.tsx, table-view.tsx, lazy-chart.tsx | Replace renderer-specific scene API; preserve shared interaction, accessible table and lazy host behavior |
| sections/manufacturers/section.tsx | Arc Waffle with maker/flight identity and metric modes |
| sections/fleet/section.tsx + helpers.ts | Extend local Arc Ridgeline for precomputed densities/statistics; preserve existing log-density/weighting contract |
| sections/rhythm/section.tsx | Arc Line + Brush; daily Activity heatmap added; month-grid view remains a local Arc-styled DOM/SVG projection |
| sections/rankings/section.tsx | Preserve multi-year bump through local Arc/SVG adaptation; add distinct Slope comparison view |
| sections/clock/section.tsx; sections/crossings/section.tsx | Preserve radial hour dial and signed shift bars through local SVG adaptations |
| globe/svg-globe.tsx | Direct SVG with existing d3-geo; retain SSR, projection/catalog/routes and MapLibre crossfade |
| globe/replay-transport.tsx | Accessible controlled range/scrubber, preserving chronological playback and committed state |
| Overview SSR tests; packages/shared/src/overview/charts.test.ts | Move rendering assertions to Arc/local SVG proof; keep engine/DOM-free calculations covered |
| Root/app manifests and pnpm-lock.yaml | Remove TanStack only after the consumer search passes; retain caller-proven d3-geo/shape; remove unused d3-scale and its types |

## Extension backlog: possible components, not required migration work

The 13 explicitly added components are now required scope in W2/W5. Only the remaining candidates below are deferred; keep them uninstalled until their behavior is requested.

| Candidates | Why deferred / prerequisite |
|---|---|
| Multi-select | Existing filters are single-valued; needs URL and API semantics for sets |
| Password strength | Needs an agreed estimator aligned with actual password requirements |
| Swipe actions | Not requested in the scope expansion; visible/Context-menu actions already cover this migration |
| Command palette | New global commands/search and keyboard discoverability |
| Streamgraph | Not requested; a separate stacked-composition question would need defined series semantics |
| Notification center | Needs durable notification storage, ownership and read-state behavior |

Other free catalog alternatives are intentionally not migration targets:

| Candidates | Disposition and reason |
|---|---|
| Expanding search, Morph select | Use Search field and Select instead: current fields need persistent labels and predictable keyboard interaction, not another variant of the same control |
| Hover card, Avatar group | No existing hover-only detail flow or multi-person grouping; essential information stays visible and usable on touch |
| Color picker | Arbitrary colors conflict with the five named accent choices; retain SwatchPicker/radio semantics |
| Number field | Current year entry remains Input with validation; bounded increment/decrement behavior is not an existing requirement |
| Usage meter, Gauge | Keep existing truthful Progress/text for passport, eligibility and export allowance; no additional quota or dial visualization is required |

## Final evidence gate

Identity: All final lanes validate the same immutable scoped patch. Use clean scoped commits in an isolated checkout where practical; otherwise record base SHA, the retained scoped diff, hashes/content of relevant untracked files, and the unrelated baseline. A branch name or status list alone is insufficient. Record Node/pnpm versions, installed lockfile, local fixture configuration and test environment separately.

Commands below define implementation acceptance; actual final results are recorded in the execution handoff. Run from the workspace root. Build/browser fixtures are serial because they share build output and port 8800. Capture focused evidence during waves; run each final broad gate once for the final relevant state, repeating only after a relevant edit/failure.

| Lane | Proves | Command or scenario | Success signal | Parallel-safe |
|---|---|---|---|---|
| Source/review | Scope, provenance, complete chart-removal inventory, all dispositions and contract safety | Scoped production/test import audit plus independent UI/API/shared-engine review | All 13 additions covered; no TanStack runtime/test import/declaration or unresolved blocking finding | Read-only |
| Lint | Project conventions and source hygiene | `pnpm --filter @kuuki/next lint` | Exit 0 | With unit tests only |
| Unit | Shared/screen behavior, all requested interactions/charts, tokens, SSR and recovery | `pnpm --filter @kuuki/next test` | Exit 0; existing behavioral assertions retained | With lint |
| API/shared tests | Range list/ids/count parity, owner isolation, aggregate daily series, engine golden/property invariants | `pnpm test:api` (configuration includes packages/shared/data tests) | Exit 0; invalid-range, legacy-prefs, dates/weights and tenancy cases pass | With lint/unit |
| API types | Scoped filter/series admission and exported contract consistency | `pnpm typecheck:api` | Exit 0 | With lint/unit |
| Production build | OpenNext and actual deployed-app compilation | `pnpm next:build` | Exit 0, current build artifacts | No; wait for source writers |
| Types | Component/caller contracts using current generated output | `pnpm --filter @kuuki/next typecheck` after build | Exit 0 | No build overlap |
| Full UI journeys | Cross-screen effects of shared-control changes | `pnpm test:next:navigation` after current build | Entire suite passes, not just files named above | No build/fixture/browser overlap |
| Focused layout/function | EN/RU, light/dark/System, accent, keyboard/reduced motion and portal geometry | Existing synthetic local fixture; 320/390/1440px, 200% zoom; longest labels, focused overlay/search/date/undo/privacy/partial-save scenarios | No overflow, hidden focus, blocked primary action or incorrect state; retain trace/result and relevant viewport/state notes | Serial browser lane |

The focused browser lane uses existing repository tests first. Add a new test only for a failure mode existing checks cannot catch, one per failure mode; adjust existing assertions when their contract changes. Carry forward Release 3's skipped visual audit and batched broad checks: run the full suites at integrated acceptance, with focused checks after each changed contract. If a one-off check remains necessary, use the current session's preferred available T3 preview tools and the existing local fixture. Record scenario, locale/theme, fixture/state, viewport, success signal and evidence artifact. A costly screenshot recapture or comprehensive visual audit needs its own explicit request.

Runtime/boundary checks remain conditional on dispatch/auth/static-asset changes: reassess those changes before adding worker typecheck/smoke/boundary gates. Range filtering and owner-qualified series admission are planned API changes and require API/shared checks above even if dispatch is unchanged. Do not infer remote D1 writes or deployment from those local checks.

Final acceptance (primary, serial):
- [x] All five waves accepted and coverage/disposition ledger complete.
- [x] Scoped range/series admission is validated and backward-compatible; existing routes/write authorities, schema, owner isolation and domain calculations are preserved.
- [x] Date range picker, Inline edit, Context menu and Confirm morph pass their exact behavioral contracts.
- [x] All nine requested charts are integrated; TanStack consumers/declarations removed after equivalent globe/replay/special-chart behavior passes.
- [x] No regression in search/dates, URLs, mobile overlays, selection/Undo, partial writes, privacy, identity cleanup or settings guards.
- [x] Final frozen patch validated by broad lint, Next + API/shared tests and affected-contract reruns, API/Next typechecks, production build and the full navigation suite.
- [x] Existing material layout/accessibility journeys pass; additional visual browser verification is skipped at the user’s explicit request.
- [x] Independent review findings resolved or explicitly classified; no broad "looks fine" substitutes for evidence.
- [x] Documentation and source/license inventory describe what was actually adopted.
- [x] No push/deploy/remote writes inferred from local acceptance.

## Rollback

Keep waves as coherent scoped commits or retained patches. Revert only Arc-owned source/style/dependency changes if a wave fails; preserve unrelated import/design work and data. No database rollback is planned because no D1 schema migration is included. Date-range preferences may be newly written as day ranges: before retiring legacy range support, prove the previous release can still admit them or retain a compatibility serializer. A source-only rollback must not leave preferences unreadable. Remove a new dependency only after checking remaining imports; rerun the smallest gate affected by the reversal.

## Sources

Project: [DESIGN.md](../../DESIGN.md), [CODING_STANDARDS.md](../../CODING_STANDARDS.md), [GLOSSARY.md](../../GLOSSARY.md), [issue tracker / plans](../agents/issue-tracker.md), [app dependencies](../../apps/next/package.json), [root scripts](../../package.json), [Overview UI plan](2026-10-07-overview-release-3-ui.md), [Journal design audit](../../.scratch/journal-redesign/interface-audit.md). Branch facts were inspected with git log/show on feat/overview-release-3-ui at 8b5e5c3 and its owning worktree/handoff; commits 65d07f1 and 3ad8588 establish when the dependency and host entered.

Arc: [official free/Pro catalog](https://uiarc.dev/llms.txt), [registry index](https://uiarc.dev/r/registry.json), [MIT license](https://uiarc.dev/license), [Combobox](https://uiarc.dev/components/combobox), [Calendar](https://uiarc.dev/components/calendar), [Date picker](https://uiarc.dev/components/date-picker), [Sortable data table](https://uiarc.dev/components/sortable-data-table), [Toast](https://uiarc.dev/components/toast), [Metric card](https://uiarc.dev/components/metric-card).

Requested additions: [Date range picker](https://uiarc.dev/components/date-range-picker), [Inline edit](https://uiarc.dev/components/inline-edit), [Context menu](https://uiarc.dev/components/context-menu), [Confirm morph](https://uiarc.dev/components/confirm-morph), [Sparkline](https://uiarc.dev/components/sparkline), [Line chart](https://uiarc.dev/components/line-chart), [Donut chart](https://uiarc.dev/components/donut-chart), [Waffle chart](https://uiarc.dev/components/waffle-chart), [Activity heatmap](https://uiarc.dev/components/activity-heatmap), [Brush chart](https://uiarc.dev/components/brush-chart), [Slope chart](https://uiarc.dev/components/slope-chart), [Ridgeline](https://uiarc.dev/components/ridgeline), [Treemap](https://uiarc.dev/components/treemap). Public source and dependencies were checked through the corresponding https://uiarc.dev/r/{name}.json items; the execution inventory must retain fresh hashes.
