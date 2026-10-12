# Arc checklist scope: boarding-pass UI scouting

Read-only component selection on 2026-10-12. No repairs or new React composition.
Kuuki DESIGN.md and installed APIs override conflicting generic Arc defaults.
Pass means evidence within this selection scope, not observed rendering.
Unverified criteria require inspection/testing of the eventual composed feature.
Automated UI sweeps/lint, browser/device execution and Pro acquisition are outside this task.
Documentation formatting and local link checks are separate from UI acceptance.


## Type and copy
- **unverified**: Sentence case everywhere; no all caps, no uppercase transforms No new composed UI was implemented or rendered against this criterion.
- **unverified**: No eyebrow or overline text above any heading No new composed UI was implemented or rendered against this criterion.
- **unverified**: No em dashes; headings have no trailing period No new composed UI was implemented or rendered against this criterion.
- **unverified**: Only weights 400 and 500; sizes from --text-* tokens Kuuki DESIGN.md typography supersedes this generic rule; final token use is unverified.
- **unverified**: Buttons are verb plus object (a bare verb only where the object is named right beside it); errors say how to fix; claims are true No new composed UI was implemented or rendered against this criterion.
- **unverified**: Changing or aligned numbers use tabular-nums No new composed UI was implemented or rendered against this criterion.

## 

## Color and surfaces
- **unverified**: Only semantic tokens; no raw hex, ramp values, or Tailwind colors No new composed UI was implemented or rendered against this criterion.
- **unverified**: Accent only on active, selected, progress, or the emphasized data No new composed UI was implemented or rendered against this criterion.
- **unverified**: Status colors only for real status, always with a label No new composed UI was implemented or rendered against this criterion.
- **unverified**: Gradients only for documented metallic treatments or marketing backdrops; no glows or colored shadows in components No new composed UI was implemented or rendered against this criterion.
- **unverified**: Third-party logos in their real brand colors No new composed UI was implemented or rendered against this criterion.
- **unverified**: Shadows only on floating layers; cards rest on a 1px border No new composed UI was implemented or rendered against this criterion.
- **unverified**: No icons in rounded tiles; no nested decorative cards No new composed UI was implemented or rendered against this criterion.

## 

## Layout
- **unverified**: One page container; blocks fill their column with no double gutter No new composed UI was implemented or rendered against this criterion.
- **unverified**: Heading, cards, and table share the same left edge No new composed UI was implemented or rendered against this criterion.
- **unverified**: Sibling cards align (same top and height) with a real gap or shared dividers No new composed UI was implemented or rendered against this criterion.
- **unverified**: Nested radii are concentric (inner = outer - padding) No new composed UI was implemented or rendered against this criterion.
- **unverified**: Spacing on the 4px grid: 16px inside a group, 24px between regions, 32 to 48px between sections of a long form; page padding 24 to 32px; marketing sections 64 to 120px No new composed UI was implemented or rendered against this criterion.
- **unverified**: Wide tables scroll inside their card No new composed UI was implemented or rendered against this criterion.

## 

## Components
- **pass**: Every region uses an existing Arc item where one fits (components.md) The proposed composition reuses the installed kit; this is selection evidence only.
- **pass**: The choice matches "when to use" (tabs vs segmented control, dialog vs drawer vs sheet, switch vs checkbox) Each candidate is mapped to a specific capture/review job in the research note.
- **pass**: Only documented props; no restyled internals Recommendations identify installed props; no internals were restyled.
- **unverified**: One primary button per surface (a `button` without `variant` renders primary) Recommendation uses equal secondary capture choices and one explicit review/save primary; render unverified.
- **pass**: No Pro source reconstructed Only current public/free documentation and existing local adaptations were considered.

## 

## States
- **unverified**: Loading (skeleton in final layout), empty (one next step), error (inline, with retry), success (in place), disabled (explained) No new composed UI was implemented or rendered against this criterion.
- **unverified**: Long names and values wrap or truncate with the full value reachable No new composed UI was implemented or rendered against this criterion.

## 

## Motion
- **unverified**: Tokens from components/arc/lib/motion-tokens; no hand-tuned durations without reason No new composed UI was implemented or rendered against this criterion.
- **unverified**: Spatial motion uses transform and opacity; size changes use a spring when informative, and brief color/blur transitions follow motion.md No new composed UI was implemented or rendered against this criterion.
- **unverified**: State indicators land without overshoot; bounce only for playful moments No new composed UI was implemented or rendered against this criterion.
- **unverified**: One continuous movement per interaction; exits faster than entrances No new composed UI was implemented or rendered against this criterion.
- **unverified**: A reduced motion branch for every animation No new composed UI was implemented or rendered against this criterion.

## 

## React correctness
- **unverified**: First render is server-safe: no window, localStorage, Date.now, Math.random, or locale-dependent output QuestionDeck defaults today during render. Pass a stable day; composed SSR behavior is unverified.
- **unverified**: Animated identity stays stable during updates; deliberate entry/exit and shared-layout transitions remain supported No new composed UI was implemented or rendered against this criterion.
- **unverified**: Changing values reserve their width; nothing jumps No new composed UI was implemented or rendered against this criterion.

## 

## Accessibility
- **unverified**: No focus rings on pointer focus and no hand-made rings; keyboard focus shows Arc's shared `:focus-visible` ring (tune with `--focus-outline` tokens) No new composed UI was implemented or rendered against this criterion.
- **unverified**: Real buttons, links, labels, headings in order, landmarks No new composed UI was implemented or rendered against this criterion.
- **unverified**: Icon-only controls have specific names No new composed UI was implemented or rendered against this criterion.
- **unverified**: Modal overlays trap focus; other overlays preserve their documented keyboard flow, dismissal and focus return No new composed UI was implemented or rendered against this criterion.
- **unverified**: State never shown by color alone; async status announced No new composed UI was implemented or rendered against this criterion.

## 

## Responsive
- **unverified**: No sideways page scroll at 390, 768, 1024, 1440; distinguish rendered evidence from CSS-only inspection of widths, min-width: 0 and wrapping No new composed UI was implemented or rendered against this criterion.
- **unverified**: Touch targets at least 44px; hover content reachable by tap or focus No new composed UI was implemented or rendered against this criterion.
- **unverified**: Both themes and two accents (neutral and one hue) read correctly No new composed UI was implemented or rendered against this criterion.
