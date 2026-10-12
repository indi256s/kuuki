# Motion reference audit for Kuuki cards and SVG models

Audited 2026-10-12: [TakayuStudio Motion Reference](https://motion-reference.takayustudio.jp/).

Use this as a reference shortlist for future work. [DESIGN.md](../../DESIGN.md) remains authoritative; the recommendations below do not approve new animation behavior or change its motion contract.

## Verdict

The site is useful for comparing how motion feels: acceleration, weight, connected parts, settling and timing. Borrow these relationships rather than its complete demo styling or numerical presets. Kuuki's physical isometric objects suit restrained mechanical movement; bouncing cards, perpetual floating, liquid deformation and elaborate entrances would weaken that character.

The highest-value improvement is a believable cause and response inside each model: a mechanism moves, its dependent parts react, then the object rests. Keep the card, labels and data stable.

## What was audited

The live English catalog contained 583 entries across 44 categories. Inspected the catalog and controls, read 21 selected detail views across principles, springs, timing, SVG/path and loops, and inspected the public catalog, renderer, merge and export source. Visually sampled Fade + Slide, critical damping, follow-through and SVG stroke drawing with the detail player, pause/scrubbing and onion skin. This was a focused suitability audit, not visual acceptance of all 583 entries.

Useful authoring tools include quarter-speed playback, frame stepping, onion skin, direct links, a baseline/tuned comparison, motion recipes and code tabs. Onion skin is particularly useful for spotting abrupt speed changes. Inspect at slow speed, but judge the result at normal speed and its intended display size.

Two source distinctions matter:

- **Action time versus demonstration loop.** Fade + Slide's action is 600ms, while its player timeline is 2400ms. The [merge source](https://motion-reference.takayustudio.jp/data/atlas-merge.js) stores these separately as `motionDuration` and `duration`. Do not use the entire demonstration duration for a UI response.
- **Exact demonstration versus templates.** For atlas entries, `seek(t)` and standalone HTML reproduce the canvas demonstration. CSS/WAAPI/GSAP/React tabs are simplified templates; the [atlas snippet generator](https://motion-reference.takayustudio.jp/assets/atlas-bundle.js) substitutes generic transforms and a main curve, rather than reconstructing every part. The CSS example can reference an undefined `@keyframes motion`. The React canvas example schedules a repeating RAF: it is not Kuuki's declarative SVG integration. Review any exported code before adoption.

The displayed curve is explicitly a schematic of the outer timeline, not measured object velocity. Labels such as “Light”, spring names such as “Apple modal”, overshoot percentages and reading-time formulas are the site's advice, not performance measurements or platform specifications. The [catalog source](https://motion-reference.takayustudio.jp/data/motions.js) even supplies default implementation/cost descriptions. Treat these as browsing metadata.

## Reference shortlist

Each link opens the individual example. “Use” below is a Kuuki recommendation, not a claim that the feature is already implemented.

| Reference                                                                           | What to learn                                  | Use in Kuuki                                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Staging](https://motion-reference.takayustudio.jp/#motion=staging)                 | Direct attention to one action                 | One live mechanism per model; retain a readable silhouette                                   |
| [Cause and effect](https://motion-reference.takayustudio.jp/#motion=cause)          | Make the reaction follow its trigger           | Tape extends from the housing; a marker reacts to a route selection                          |
| [Timing and weight](https://motion-reference.takayustudio.jp/#motion=timing-weight) | The same distance can imply different mass     | A light needle can respond more sharply than a panel; do not slow the entire card            |
| [Anticipation](https://motion-reference.takayustudio.jp/#motion=anticipation)       | A small preparation can clarify a large action | Optional mechanical wind-up for a deliberate illustration action; avoid adding input latency |
| [Follow-through](https://motion-reference.takayustudio.jp/#motion=follow)           | Connected parts settle in a meaningful order   | A trailing cord or loose tag can settle after its parent; rigid attached parts move together |
| [Secondary action](https://motion-reference.takayustudio.jp/#motion=secondary)      | Supporting movement stays subordinate          | Shadow or small loose component reacts less than the main mechanism                          |
| [Arcs](https://motion-reference.takayustudio.jp/#motion=arcs)                       | Trajectory matters as much as easing           | Hinged parts rotate around their actual hinge; lifted objects follow plausible paths         |
| [Critical damping](https://motion-reference.takayustudio.jp/#motion=s-critical)     | Reach a target without ringing                 | Useful comparison for precise mechanisms; existing ease-out remains the default              |
| [Heavy spring](https://motion-reference.takayustudio.jp/#motion=s-heavy)            | Inertia changes the response                   | Study for a substantial moving component, rather than copying a slow spring onto every card  |
| [Retargeted springs](https://motion-reference.takayustudio.jp/#motion=s-track)      | A moving target should not reset the response  | Relevant only if a future model follows continuous input                                     |
| [Overshoot budget](https://motion-reference.takayustudio.jp/#motion=s-budget)       | Rebound changes the meaning of a response      | Start at zero; consider a tiny rebound only for a mechanically plausible stop                |
| [Snap and hold](https://motion-reference.takayustudio.jp/#motion=t-snaphold)        | Quick action followed by a stable pose         | Tape retraction or a detent; let the final state remain visible                              |
| [Overlap](https://motion-reference.takayustudio.jp/#motion=t-overlap)               | Sequencing can imply order without a long wait | Route segments or windows; keep the existing bounded stagger                                 |
| [Faster exit](https://motion-reference.takayustudio.jp/#motion=t-exit)              | Reset should take less attention than arrival  | Matches Kuuki's 200ms engagement and 150ms return                                            |
| [SVG stroke](https://motion-reference.takayustudio.jp/#motion=svg-stroke-draw)      | Reveal a path in drawing order                 | A short decorative route, not an entrance that hides the whole model                         |
| [SVG segment trim](https://motion-reference.takayustudio.jp/#motion=svg-trim-path)  | Move a short window along a fixed path         | A single directional route cue tied to an action                                             |
| [SVG motion path](https://motion-reference.takayustudio.jp/#motion=svg-motion-path) | Coordinate trajectory and orientation          | An optional moving marker; keep labels upright and the route stationary                      |
| [Seamless loop](https://motion-reference.takayustudio.jp/#motion=lp-seamless)       | Position and motion must join at the seam      | Only for an explicitly approved ambient/replay surface, not ordinary Overview figures        |

## Existing Kuuki contract to preserve

[DESIGN.md's illustration and motion sections](../../DESIGN.md#illustration) define physical isometric objects, decorative SVGs, HTML facts and one accent live part. Overview figures rest without load animation or ambient loops. Cards and controls remain flat; illustration glow does not authorize UI glow.

The [shared figure CSS](../../apps/next/src/client/overview/iso/iso.css) already supplies the interaction family:

| Trigger            | Existing behavior                                                             |
| ------------------ | ----------------------------------------------------------------------------- |
| Fine-pointer hover | Wait 60ms, then engage over 200ms with `--ease-out`                           |
| Pointer leave      | Return over 150ms, with no delay or exit stagger                              |
| Ordered parts      | Entry stagger spans 160ms total; it is not 160ms per part                     |
| Keyboard focus     | Same pose immediately, without a transition                                   |
| Touch press        | 120ms engagement, no delay/stagger; release pose when reorder dragging starts |
| Reduced motion     | Static lighting changes remain; movement is removed                           |

[Global tokens](../../apps/next/src/app/styles.css) already define `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--dur-press`, `--dur-fast` and `--dur-base`. Do not replace these with a differently named upstream curve just because the reference recommends it.

Reuse [named scene parts](../../apps/next/src/client/overview/iso/scene.ts) and [IsoFigure](../../apps/next/src/client/overview/iso/iso-figure.tsx), which exposes `data-part`, clipping and namespaced SVG definitions. Existing [fleet](../../apps/next/src/client/overview/iso/fleet.css), [map](../../apps/next/src/client/overview/iso/map.css), [tape](../../apps/next/src/client/overview/iso/tape.css) and [clock](../../apps/next/src/client/overview/iso/clock.css) styles demonstrate lifts, linked shadows, folds, route sequencing and mechanical return. Native CSS fits discrete resting/engaged poses. Motion is already installed for other interaction work; this audit gives no reason to add GSAP, an SVG animation package or a general timeline abstraction.

## How to apply this to the next models

1. Name the mechanism and its resting/engaged poses. Choose one main moving part and only necessary dependent parts. A rigid aircraft should not squash like a ball.
2. Establish the physical pivot and local coordinate system before tuning easing. SVG non-root elements normally use an origin of `0 0`; `transform-box: fill-box` makes an origin relative to the object's bounds, while `view-box` uses its viewport. A hinge may need an explicit coordinate rather than `center`. [MDN SVG origins](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/transform-origin), [transform-box](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transform-box).
3. Start with Kuuki's existing timing and zero overshoot. Tune travel at actual tile size. For an initial experiment, a few rendered pixels or a small rotation is enough; those are proposed starting points, not new tokens. Keep the card shell and text stationary.
4. Sequence only when it communicates construction or direction. Normalize ordered-part position across the existing 160ms window. Shadows respond to the object's height; rigid mounts respond with their parent. Avoid making every component arrive separately.
5. Make repeated hover/leave reverse from the current pose. Do not queue a fresh intro or restart from zero on every event. A future continuous-input spring should retain position/velocity when retargeted; it is unnecessary for the current two-pose CSS figures.
6. Use stroke animation sparingly. A normalized `pathLength="1"` with dash offset can reveal a decorative route; multiple subpaths require deliberate ordering. Morphing needs compatible path topology and is a poor fit for preserving a measured airframe. Keep static facts readable throughout.
7. Preserve keyboard, touch and reduced-motion behavior. Any future scripted animation must also handle preference changes, visibility and disposal. [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

For a new card, record: **trigger → main part/axis → related part → timing → return → reduced-motion pose**. A short per-card note is sufficient; no new motion framework is needed.

## Effects to leave in the reference

Do not adopt endless floating/breathing on Overview figures, noise wobble or line boil, elastic aircraft deformation, magnetic card movement, perspective tilt on every card, gooey SVG filters, whole-card glow, kinetic facts/count-up entrances, or page wipes. They either contradict the current contract, misrepresent the physical object or compete with reading the flight data.

The site's primary/secondary/ambient example is useful for hierarchy, but its always-moving background conflicts with ordinary Overview figures. Keep the hierarchy and omit the ambient layer. Reading-hold formulas are unsuitable as automatic dismissal rules for EN/RU product messages; retain the actual product's persistence and dismissal behavior.

## Performance and accessibility limits

Prefer transforms and opacity for part movement, but do not assume a filtered SVG is compositor-only. Path, dash, mask and blur changes can repaint; assess the actual model and number of visible cards. [MDN animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance). The site's cost badges are not a substitute for profiling Kuuki.

**Original audit finding (before the implementation below).** One existing claim needed correction before copying an ambient pattern: DESIGN.md called Concorde's pause while the form has focus an accepted WCAG 2.2.2 answer. At audit time the [Concorde field](../../apps/next/src/client/auth-card/concorde/concorde-field.tsx) gated the turn on form focus, visibility and reduced motion. W3C explicitly says a pause that occupies focus and resumes when focus leaves is insufficient. For an applicable long-running automatic motion, provide a persistent pause/stop/hide mechanism or choose a finite/static presentation. Reduced motion is a separate preference. The original research recorded the conflict without changing Concorde or asserting a complete conformance evaluation. [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

## Checks for later implementation

Use existing lint/type/build checks first. Then check the particular model at its actual desktop and phone size: rapid enter/leave, pointer moving across adjacent cards, keyboard focus, touch press/reorder cancellation, reduced motion, theme/accents and clipping at the largest movement. Profile multiple visible animated models before expanding any paint-heavy technique. Acceptance means the interaction stays responsive, facts remain stable/readable, and the model reaches the correct final pose after interruption.

**Original research checks.** No Kuuki animation behavior changed during the reference review. No app build, device/frame-budget profiling or full reference-site accessibility audit was performed. Public snippets were inspected as examples; source-copy licensing was not established. Prefer independently implementing the selected principle in the existing local system.

## Implementation follow-up (2026-10-12)

Source inspection confirmed one actionable gap: Concorde turns indefinitely alongside the auth form without an explicit pause choice. A localized 44px pause toggle now lives in the existing utility controls, outside the hidden decorative field. It retains its pressed state after blur, visibility changes and auth-card remounts, and saves the choice in `kuuki-auth-motion-paused` across visits on the same origin. A separate activation host retains its own choice. Blocked storage retains the choice for the current page. Temporary form-focus, visibility and off-screen gates remain; the rotation still uses 12°/s and the existing 0.7s exponential speed ramp. User pause settles at the current heading, and resume continues from it. Keyboard and touch activate the native button; its icon swaps instantly. Reduced motion keeps the original static presentation independently of the toggle.

The isolated activation plane field also runs indefinitely. It now exposes the same persistent pause choice, stopping its CSS timeline at the current frame. Its existing visibility and reduced-motion rules remain; source inspection found no form-focus gate there. DESIGN.md corrects both that claim and the earlier WCAG acceptance claim against [W3C's focus-only pause guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html). This is a correction of the identified gap, not an app-wide accessibility certification.

The reference shortlist remains future guidance. No new cards, springs, path effects, ambient Overview loops or dependencies were added. Shared SVG timings, pivots, stable facts/card shells and input-specific Overview poses are unchanged. This follows the reference's [staging principle](https://motion-reference.takayustudio.jp/#motion=staging): retain the illustrative turn while giving readers control over its ongoing movement. No reference implementation code was copied.

Implementation verification: lint, targeted formatting, Next and Worker typechecks, the final `pnpm next:build`, composed-Worker smoke and `git diff --check` passed. The scoped auth/activation/recovery tests passed 22/22, including storage-write failure and pause persistence. Both new regression scenarios failed against their original implementations for the expected absence of an accessible pause mechanism. Independent source review found an activation icon-feedback omission; the final control now swaps between the installed Keyline Play/Pause geometry.

The full Next unit run had 1119 passes and three failures in dialog/popover/sheet lifecycle behavior; those failures reproduced in an isolated control-test run. The full navigation suite completed on port 8894 with 39 passes and one capture delete-dialog focus-return failure. Initial navigation starts hit a transient generated-handler resolution error and then the shared port 8800 conflict; the alternate-port run reached the complete suite. These failures lie outside the modified auth pause paths, and their causes have not been established. They are recorded for follow-up in [the control-lifecycle verification issue](../../.scratch/motion-reference/issues/01-control-lifecycle-verification-failures.md), preserving concurrent edits. No extra visual acceptance, device frame-budget profiling or complete WCAG audit was performed. No deployment, remote data write or publication was performed.
