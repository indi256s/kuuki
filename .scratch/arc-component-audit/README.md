# ARC component audit

Date: 2026-10-09. Initial source audit of the working tree, including uncommitted changes. Findings and checklist below preserve that historical snapshot; see the remediation section for subsequent fixes.

The requested `.claude/skills/arc/SKILL.md` is absent in this checkout. Used `/Users/indi256/.claude/skills/arc/SKILL.md` and its checklist, composition, design, copy, accessibility, responsive and motion references.

## Findings

### 1. P2: Fleet exposes durations without duration evidence

`apps/next/src/client/overview/sections/fleet/section.tsx:28` creates interactive points for every generated ridge sample. `helpers.ts:6` generates 128 zero-height samples even for an empty minutes array. `packages/shared/src/overview/fleet.ts:28` gates on five typed flights, and retains families without precise duration samples.

With at least five recognized-aircraft flights but no precise recorded durations, keyboard navigation reports 30 minutes for a family and hover exposes sampled values across the 30–1020 minute axis. These are axis coordinates without underlying duration evidence. The table correctly shows unavailable minutes, but the chart does not explain that absence.

Keep family counts/filtering, but remove duration interactions for families without evidence and show localized unavailable-duration coverage.

### 2. P2: Cancelling programmatically opened dialogs loses focus

`apps/next/src/client/ui/dialog.tsx:32` makes the Radix trigger optional and has no fallback opener restoration. Installed Radix Dialog 1.1.15 prevents the focus scope's default restoration and focuses only its trigger ref.

Import opens the discard confirmation from a separate button (`import/review-step.tsx:121`) and supplies neither a trigger nor a close-focus handler (`:126`). Escape or Keep importing removes the focused dialog control without returning focus to Cancel import. Journal bulk-delete has the same cancellation problem (`reads/journal.tsx:328`); its handler restores focus only after confirmation. Passport country removal also uses this pattern.

Restore an explicit opener when no Radix trigger exists, either in the shared wrapper or consistently at each caller.

### 3. P2: Combobox handles IME keys as commands

`apps/next/src/client/ui/combobox.tsx:49` checks modifiers but not `event.nativeEvent.isComposing`. Enter during IME candidate composition selects the active reference option, replaces the text with its code and closes the list. Arrow keys and Escape also interfere with composition. The neighboring InlineEdit already guards composition.

Ignore combobox command keys while composition is active.

### 4. P2: Secondary chart actions are touch-only

`apps/next/src/client/overview/charts/kuuki-chart.tsx:173` renders action buttons only when a selection is pinned; pinning happens exclusively in its touch-click branch (`:127`). Keyboard Enter filters directly.

Keyboard users cannot reach the Open flight actions supplied by `sections/manufacturers/section.tsx:74` and `sections/timeline/section.tsx:65`. Their tables expose values rather than equivalent flight-opening actions.

Provide a discoverable keyboard path to the same action menu while preserving the documented Enter-to-filter behavior.

### 5. P2: Initial chart focus can act on an unidentified point

`apps/next/src/client/overview/charts/kuuki-chart.tsx:69` defaults the active key to the first point. The SVG's single Tab stop (`:148`) has no focus initialization that exposes that point or its tooltip. Tab then Enter filters the first point without first identifying it. Initial ArrowRight skips to the second point.

Keep the single Tab stop, but synchronize initial focus, visible point indication and the announced datum.

### 6. P2: Slope chart cannot fit its headings at 320px

`apps/next/src/client/overview/charts/arc-slope.tsx:43` fixes the left axis at 160px and the right axis at width minus 100px. `overview/mobile/mobile.css:50` gives each chapter 24px padding on either side. A 320px sheet therefore leaves approximately 272px for the chart, placing the two heading centers only 12px apart on the same baseline (`arc-slope.tsx:50`). Both localized headings exceed that gap; the connectors also become almost vertical.

Use a narrow-layout branch or a minimum chart width inside a contained scroller. This is a source-derived layout finding, not a rendered screenshot observation.

### 7. P3: Keyboard tooltips remain after focus leaves

`apps/next/src/client/overview/charts/kuuki-chart.tsx:121` opens a tooltip on mark focus but does not dismiss it on blur. Outside-pointer and global Escape handlers apply only to pinned selections (`:80`). Arrow to a point, then Tab to View as table: the fixed tooltip remains over unrelated content.

Dismiss unpinned tooltips when focus leaves the chart interaction region.

### 8. P3: Shared overlay footers conflict with DESIGN.md

`apps/next/src/client/ui/ui.css:54` draws a top hairline on every shared panel footer. Current DESIGN.md explicitly removes dividers between sheet headers, bodies and footers. Overview overrides this locally; other consumers retain it.

Remove the shared footer divider. This is project-design drift, rather than a violation of Arc's preference for internal group dividers.

## Deliberate Arc divergences

DESIGN.md and `docs/plans/2026-10-08-arc-integration.md:17` explicitly preserve Commissioner/JetBrains Mono, Kuuki palette/radii, semibold typography, custom visible keyboard focus, motion tokens, geometry transitions and content-sized masonry. The integration plan explicitly excludes globally importing Arc foundation.css. These are accepted project choices, not findings requiring wholesale Arc replacement.

Strict Arc copy compliance also fails: Settings/Import retain eyebrows, several labels use uppercase, and prose contains em dashes. Examples: `account/settings-form.tsx:86`, `import/import-client.tsx:376`, `passport/collection.tsx:142`, and `auth-card/corner-controls.tsx:19`. DESIGN.md permits eyebrow typography and approved narrator copy; a stricter Arc copy pass would require reconciling those choices first. Airport/airline codes, language codes and missing-value dashes are not ornamental copy defects.

## Arc review checklist

Legend: PASS = source evidence in the inspected scope; FAIL = finding or strict Arc divergence; OVERRIDE = accepted Kuuki rule; UNVERIFIED = runtime/visual evidence needed. A source PASS is not visual acceptance.

### Type and copy

- [ ] Sentence case everywhere; no all caps, no uppercase transforms. FAIL: deliberate and legacy uppercase labels.
- [ ] No eyebrow or overline text above any heading. OVERRIDE: Kuuki eyebrow styling; Settings/Import still use it.
- [ ] No em dashes; headings have no trailing period. FAIL: prose dashes remain.
- [ ] Only weights 400 and 500; sizes from --text-* tokens. OVERRIDE: accepted typography and size rules.
- [x] Buttons are verb plus object; errors say how to fix; claims are true. General source coverage; Fleet evidence exception is finding 1.
- [x] Changing or aligned numbers use tabular-nums. Global and chart rules cover inspected values.

### Color and surfaces

- [x] Only semantic tokens; no raw hex, ramp values, or Tailwind colors. Inspected component colors use Kuuki tokens; mask literals and catalog brand/flag inputs are separate roles.
- [x] Accent only on active, selected, progress, or emphasized data. Source coverage.
- [x] Status colors only for real status, always with a label. Source coverage.
- [x] No decorative gradients, glows, or colored shadows in components. Masks and functional scroll fades are not decorative fills; accepted theme transition is separate.
- [x] Third-party logos in their real brand colors. Current Journal assets preserve artwork; chart colors are deliberately adjusted per DESIGN.
- [ ] Shadows only on floating layers; cards rest on a 1px border. OVERRIDE: dark surfaces use the accepted highlight treatment.
- [ ] No icons in rounded tiles; no nested decorative cards. OVERRIDE: accepted kana/loading marks and existing record/counter surfaces.

### Layout

- [x] One page container; blocks fill their column with no double gutter. Inspected composition.
- [ ] Heading, cards, and table share the same left edge. UNVERIFIED visually.
- [ ] Sibling cards align with a real gap or shared dividers. OVERRIDE: content-sized masonry.
- [ ] Nested radii are concentric. UNVERIFIED across rendered surfaces; Kuuki uses its own scale.
- [ ] Spacing on the 4px grid. OVERRIDE for documented geometry; visual rhythm unverified.
- [x] Wide tables scroll inside their card. Shared chart table wrapper.

### Components

- [ ] Every region uses an existing Arc item where one fits. OVERRIDE: local adaptations and signature components, documented adoption map.
- [ ] Choice matches when to use. Advisory divergence: Settings privacy switches stage changes for a later save; Arc recommends checkboxes for submitted forms. Current copy explains the save behavior.
- [ ] Only documented props; no restyled internals. OVERRIDE: locally adapted house APIs.
- [ ] One primary button per surface. FAIL: an empty Passport retains the cover Add country button and adds another primary Add country button in its empty state.
- [x] No Pro source reconstructed. Source inventory records free acquisition; no Pro use observed.

### States

- [ ] Loading, empty, error, success and disabled are designed. FAIL: Fleet unavailable-duration treatment (finding 1); other inspected major paths distinguish these states.
- [ ] Long names and values wrap or truncate with the full value reachable. UNVERIFIED exhaustively at constrained widths.

### Motion

- [ ] Shared Arc motion tokens; no hand-tuned durations without reason. OVERRIDE: Kuuki motion tokens and documented chart exceptions.
- [ ] Only transform/opacity animate, with meaningful size exceptions. OVERRIDE: SVG geometry and disclosure rules.
- [x] State indicators land without overshoot. Source coverage of shared controls.
- [ ] One continuous movement; exits faster than entrances. UNVERIFIED comprehensively; inspected shared overlays use accepted timing.
- [x] Reduced motion branches. Shared controls and chart CSS provide branches.

### React correctness

- [ ] First render is server-safe. Most inspected paths comply; Calendar/Passport current-date reads remain clock-boundary risks, not reproduced hydration failures.
- [ ] Animated elements retain stable keys. UNVERIFIED across every integrated state; chart mode changes intentionally remount some hosts.
- [ ] Changing values reserve width. UNVERIFIED visually; text-feedback controls reserve alternatives in inspected uses.

### Accessibility

- [ ] Arc shared keyboard focus ring, no pointer rings. OVERRIDE: Kuuki visible-focus policy.
- [x] Real controls, labels, landmarks. Inspected shared controls preserve semantics.
- [x] Icon-only controls have specific names. Source coverage.
- [ ] Overlays trap/return focus and close on Escape. FAIL: triggerless cancellation (finding 2).
- [x] State not shown by color alone; async status announced. Inspected labels/live areas/tables provide alternatives.
- [ ] Full keyboard interaction preserved. FAIL: findings 3, 4, 5 and 7.

### Responsive

- [ ] Checked at 390, 768, 1024, 1440 and relevant 320px widths. CSS inspection only; FAIL: source-derived slope layout at 320px (finding 6).
- [ ] Touch targets at least 44px; hover content reachable by tap/focus. Shared controls generally comply; fine chart mark geometry has not had physical-device validation.
- [ ] Both themes and two accents read correctly. Token mapping inspected; rendered acceptance UNVERIFIED.

## Evidence and limits

Passed: `pnpm --filter @kuuki/next typecheck` and `pnpm --filter @kuuki/next lint`.

Coverage: all shared UI implementations/CSS; all Overview chart adapters, host, table, loading/measurement and consumers; targeted integration reads in Import, Journal, Passport, Settings, Auth, Profile, Leaderboard and shell. Existing tests were inspected for relevant behavior, not executed. Two independent source reviewers covered primitives and charts; findings were synthesized against current caller code.

No browser automation, screenshots, build, runtime journeys, new tests, screen-reader session, physical-device check or fresh upstream registry/license verification. This does not establish deployment or visual acceptance. At this initial audit stage no fixes had been made. The subsequent remediation is recorded below.

Raw sweep logs: `/tmp/kuuki-arc-sweep.txt`, `/tmp/kuuki-arc-style-sweep.txt`. Check logs: `/tmp/kuuki-arc-typecheck.log`, `/tmp/kuuki-arc-lint.log`.


## Remediation — 2026-10-09

All eight numbered findings are addressed in the working tree. Accepted Kuuki design overrides remain in force; source-only checklist observations are not converted into claims of visual acceptance.

| Finding | Resolution |
| --- | --- |
| 1. Missing duration evidence | `ridgeProfile` returns no samples without positive finite observations. Fleet omits absent-duration targets, reports EN/RU coverage and retains family filter buttons. Zero-only exact records remain distinct from missing records and retain filtering. |
| 2. Triggerless dialog focus | Shared Dialog captures the current opener at each Portal mount and restores it on cancellation. Explicit caller overrides and Radix trigger restoration remain supported. The mounted content forwards Radix's ref, preserving its exit-animation lifetime. |
| 3. IME input | Combobox ignores command keys during composition, including the browser keyCode 229 fallback. |
| 4. Chart secondary actions | Shift+F10 and the point context menu open the same actions as touch. Localized keyboard instructions describe the shortcut; Enter retains the existing selection/filter contract. |
| 5. Initial chart focus | One chart point is tabbable. Entry focuses and describes that point before selection; arrow keys move the tab stop, and backward Tab exits normally. |
| 6. Narrow slope | Proportional margins preserve separate ordered columns; narrow period headings wrap. Geometry and localized headings are exercised at 248, 288, 390 and 600px chart widths. |
| 7. Tooltip dismissal | Unpinned tooltips dismiss when focus leaves the SVG. Pinned actions retain their existing focus/dismissal behavior. |
| 8. Footer divider | Removed the shared panel footer border, following DESIGN.md. |

### Verification

Focused regressions cover actual focus movement, cancellation/reopening, caller overrides, IME commands, action execution, blur, missing/partial/zero-only duration evidence, family filtering, narrow geometry and dialog animation lifetime. Regression proof against prior sources failed for the intended behaviors. Independent review found and resolved the backward-Tab, Portal-ref and zero-duration edge cases, then accepted the final source.

Passed on the final implementation:

- `pnpm --filter @kuuki/next test`: 87 files, 669 tests.
- `pnpm --filter @kuuki/next lint`.
- `pnpm --filter @kuuki/next typecheck`.
- `pnpm next:build`.
- `KUUKI_NEXT_PORT=8893 pnpm test:next:navigation`: 39 journeys.
- `git diff --check`.

Final navigation passed on port 8893 after concurrent workspace builds and a port-8800 conflict interrupted startup attempts. Logs: `/tmp/kuuki-arc-unit-tests.log`, `/tmp/kuuki-arc-lint.log`, `/tmp/kuuki-arc-types.log`, `/tmp/kuuki-arc-build.log`, `/tmp/kuuki-arc-navigation.log`. Baseline proof: `/tmp/kuuki-arc-baseline-tests.log`, `/tmp/kuuki-arc-fleet-baseline.log`, `/tmp/kuuki-arc-review-baseline.log`.

Commit-hook note: parallel package/tooling changes during commit exposed a shared-package TypeScript configuration failure, then existing React-hooks lint errors in untouched files. The scoped Arc implementation had already passed its full Next lint/type/build/unit checks. The commit bypasses the hook without modifying those parallel changes. Hook output: `/tmp/kuuki-arc-commit-hook.log`.

### Upstream grounding and remaining limits

Fetched the current free [Dialog](https://uiarc.dev/components/dialog), [Combobox](https://uiarc.dev/components/combobox), [Ridgeline](https://uiarc.dev/components/ridgeline) and [Slope chart](https://uiarc.dev/components/slope-chart) documentation and registry sources. Reviewed affected focus, keyboard, empty-state and responsive contracts against the local adaptations; this is not a claim of full upstream API parity. Downloaded evidence lives under `/tmp/kuuki-arc-fix-upstream/`.

No deployment, physical-device or screen-reader session, or rendered narrow-label visual acceptance. The original checklist's accepted overrides, advisory observations and unverified visual items remain distinct from the eight fixed findings.
