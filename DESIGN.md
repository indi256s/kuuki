# Kuuki Design System 2.0

Kuuki is a personal flight journal with a restrained editorial character. Typography, whitespace, and the details of stamps and tickets carry the design. This document is the single authoritative design reference for the Next experience and supersedes conflicting color, font, glass, grain, and motion guidance elsewhere. The [Redesign 2.0 UX brief](docs/plans/2026-10-04-redesign-2.0-ux-ui.md) explains the experience decisions. The Vite app remains a compatibility surface during migration.

## Color and surfaces

Use semantic CSS variables from `apps/next/src/app/styles.css`; do not place palette literals in components. Light uses paper (`#fbfaf8`) and charcoal text (`#302d2a`); dark uses ink (`#292827`) and warm white text (`#f1efeb`). Terracotta is the accent in both themes. Text colors are separate from fills. Muted text must meet 4.5:1 contrast, control borders and focus must meet 3:1; do not fade text with opacity. Hairlines are for structure, control borders for inputs and controls. In-flow cards use one subtle boundary and no shadow. Floating surfaces use a solid background and elevation. No glass, backdrop blur, glow, gradient buttons, or decorative grain.

The default accent is terracotta. Map fills use a sequential accent ramp and a titled legend with fixed buckets 1, 2–3, 4–9, 10+. Flag colors may inform stamp ink, never map fill. Claims must have a text and shape cue. Curated accent alternatives require independently checked light/dark foreground pairs; unknown legacy values map to terracotta and never overwrite status colors.

## Type and layout

Self-hosted Onest is the Cyrillic-capable UI and display face; JetBrains Mono is for ticket codes, flight numbers, times, table dates, and handles. OFL licenses ship beside font assets. Changing and aligned numbers use tabular figures. Body is 15/24, small 13/20, caption 12/16, H3 17/24, H2 22/28, H1 30/36, display 44/48. Wrap headings with balance and body with pretty wrapping. Use locale-aware EN/RU dates, numbers, and real plural forms. Russian copy addresses the user as «вы».

The shared header and page container align at 1200px. Gutters are 24px desktop and 16px mobile. Spacing uses a 4px base; section gaps are 48px desktop and 32px mobile. Cards fit content instead of matching heights. Radii: 6px small internal chips, 10px controls, 14px cards/popovers, 20px dialogs and sheets. An inner radius must account for container padding.

## Interaction and states

Navigation stays available while private data streams in. Every data surface distinguishes loading, empty, partial, error, and ready states. Never present an unavailable read as a confirmed empty journal. Links and controls have visible 2px offset focus rings and 44px touch targets. Press feedback is 120ms scale to 0.96 except static rows and cards; hover styles apply only to fine pointers. Reduced-motion users get static state changes. Disabled actions explain why in visible text. Use Lucide icons with text labels; color alone does not signal active state. Capture, authentication, privacy, and destructive copy is calm and direct.

System theme is the default for new users. Preserve an explicit light/dark choice, map supported legacy settings, and keep EN/RU and theme consistent with the first usable page. Client persistence uses same-origin cookies; private app data and authorization are never cached in shared shells.

## Decisions

Frozen by the Redesign 2.0 plan ([implementation plan](docs/plans/2026-10-04-redesign-2.0-implementation.md), D1–D12). Lifecycle and import details live in the ADR under `docs/adr/`.

| ID | Decision |
|---|---|
| D1 | Guests see the landing page at `/`; auth uses `/signin` and `/signup`. |
| D2 | Six named accents: Terracotta (default), Ai, Matcha, Kincha, Sakura, Sumi. Store the name, never an arbitrary color. |
| D3 | System theme by default; an explicit saved preference is preserved. |
| D4 | Light neutrals are barely warm; dark uses charcoal. |
| D5 | Typeface chosen by RU/EN specimen; Onest confirmed (see Typeface decision). |
| D6 | Russian copy uses «вы» everywhere. |
| D7 | Journey UI and navigation are removed; a bookmarked `/journey` redirects to `/overview`. |
| D8 | Overview has a period control only; Journal owns all detailed filters. |
| D9 | `/fly/:username` is preserved; previews and share URLs use the configured origin. |
| D10 | Existing rank titles become localized achievement names; no new badge rules. |
| D11 | Awaiting flights auto-confirm seven days after they become date-eligible, with automatic provenance and no celebration; the rule is explained in queue helper text. |
| D12 | A confirmed connection excludes country evidence for the connection endpoint but keeps airport evidence. «Выходил в город» includes the country. |
| Geography | The existing 246-entry country/territory catalog and its six-region collection model, including Antarctica. Label totals "countries and territories"; no 195 denominator. |
| Leaderboard | Five-flight eligibility threshold kept. The airport-count category is labelled **Airports / Аэропорты** (`cities` stays an API alias); no unique-city ranking. |

## Token roles

Names are fixed; values live only in `apps/next/src/app/styles.css` (`:root`, `:root[data-theme=dark]`, `:root[data-accent=*]`). Literal colors appear only in those blocks (plus stamp-ink input data). Accent never overrides status or rank tokens.

| Token | Role and contrast rule |
|---|---|
| `--background`, `--surface`, `--surface-inset` | Page, card/sheet, and well/table-header fills; one step apart. |
| `--text`, `--text-muted` | Body/headings and secondary text; muted ≥4.5:1 on background and surface. Never fade with opacity. |
| `--hairline` | Structural dividers and card edges only. |
| `--control-border` | Input, checkbox and select borders; ≥3:1 on the surface. |
| `--accent`, `--accent-foreground`, `--accent-text` | Fill; text/icon on the fill (≥4.5:1); links and active nav on surfaces (≥4.5:1). |
| `--focus` | 2px ring with 2px offset, solid, ≥3:1 against neighbors. |
| `--success-text`, `--warning-text`, `--info-text`, `--danger-text` | Text grade; ≥4.5:1 on background and surface. |
| `--success-fill`, `--warning-fill`, `--info-fill`, `--danger-fill` | Fill grade for backgrounds and icons; never used for text. |
| `--rank-gold`, `--rank-silver`, `--rank-bronze` | Text grade, ≥4.5:1 on surface; always paired with the rank number. |
| `--radius-xs` (6px), `--radius-sm` (10), `--radius-md` (14), `--radius-lg` (20), `--radius-full` (9999px) | Chips; controls; cards/popovers; dialogs/sheets; pills and avatars. |
| `--space-1` (4px), `--space-2` (8), `--space-3` (12), `--space-4` (16), `--space-5` (20), `--space-6` (24), `--space-8` (32), `--space-12` (48) | 4pt spacing scale. |
| `--surface-floating` | Level 2 fill: equals `--surface` in light, one step lighter in dark. |
| `--shadow-floating`, `--shadow-modal`, `--ring-floating` | Level 2/3 shadows; dark theme uses the ring instead of a shadow. |
| `--scrim` | Modal backdrop (black 40% light, 60% dark). |
| `--outline-media` | 1px outline on images and avatars (black 10% light, white 10% dark). |
| `--font-sans`, `--font-mono` | Onest stack; JetBrains Mono stack for ticket data only. |
| `--map-land`, `--map-border`, `--map-route` | Map base layers; follow theme. |
| `--map-bucket-1`, `--map-bucket-2`, `--map-bucket-3`, `--map-bucket-4` | Sequential ramp from the current accent over `--map-land`, bucket 1 lightest; thresholds 1, 2–3, 4–9, 10+ from one shared function; follows `data-accent` and theme. |
| `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--ease-icon`, `--dur-press`, `--dur-fast`, `--dur-base`, `--dur-sheet`, `--dur-moment` | Motion tokens, see Motion. |

## Typeface decision

Onest is confirmed (frozen earlier by the architecture session; the specimen is confirming evidence, not a re-opened choice). The specimen in [`docs/design/font-specimen.html`](docs/design/font-specimen.html) compares Onest, Golos Text and Manrope on real RU/EN navigation, field, airport-route, numeral and plural strings (screenshot: `docs/design/font-specimen.png`). In the specimen, Onest renders the Cyrillic strings, tabular numerals (0123456789, 141 255 км) and IATA codes beside city names cleanly, without fallback glyphs or clipping of «Авиакомпании». Golos Text and Manrope load from Google Fonts for the specimen only and are never shipped.

## Surfaces and elevation

One material at a time.

| Level | Light | Dark | Used by |
|---|---|---|---|
| 0 Page | `--background` | `--background` | Page |
| 1 In-flow | `--surface` + 1px `--hairline`, no shadow | `--surface`, no border; 1px inner top highlight (white 4–6%) | Cards, tables, list groups |
| 2 Floating | `--surface-floating`, `--shadow-floating`, no border | `--surface-floating` + `--ring-floating` | Popovers, menus, toasts, sticky bars |
| 3 Modal | Level 2 with `--shadow-modal`; `--scrim` | Level 2; `--scrim` | Dialogs, sheets |

Images and avatars use `--outline-media`. No glow, backdrop blur, or gradient buttons; primary is one flat accent fill.

## Motion

Tokens: `--ease-out` cubic-bezier(.23,1,.32,1) for enter/exit and press; `--ease-in-out` cubic-bezier(.77,0,.175,1) for on-screen movement (height, segmented thumb); `--ease-drawer` cubic-bezier(.32,.72,0,1) for sheets; `--ease-icon` cubic-bezier(.2,0,0,1) for icon crossfades. Durations: `--dur-press` 120ms, `--dur-fast` 150ms, `--dur-base` 200ms, `--dur-sheet` 300ms, `--dur-moment` 450ms (rare delight only).

Rules: ease-in is banned; exits use ease-out and run about 20% faster than enters; never `transition: all`; animate transform, opacity and sparingly filter; height disclosure uses grid rows 0fr→1fr; no bounce on routine UI; content present on first render does not animate in; no count-up from zero.

| Never animates | Animates |
|---|---|
| Route and tab changes (focus moves to H1), keyboard actions, filter/sort/period changes (optional 150ms opacity on chart values), ambient loops, WindLoader, glow pulses; the one exception is the auth brand panel: one slow path, at most 3 planes, paused when the tab is hidden, static under reduced motion | Press (scale 0.96, 120ms; static rows and cards excluded), hover color 150ms on fine pointers only, segmented thumb 200ms, tooltip/popover/menu 150ms opacity + scale 0.96–0.97→1 from trigger, dialog 200ms (exit 150ms), sheet 300ms `--ease-drawer` with finger-follow, velocity above about 0.11 px/ms dismissing and rubber-band past bounds, disclosure 300ms, toast 300ms in / 200ms out, icon swap by scale, opacity and blur 200ms, skeleton to content 150ms |

More rules (the UX brief §8 is the full table):
- Popover/menu exit 120ms; after the first tooltip, adjacent tooltips open instantly with no animation.
- Multi-step dialog: height 250ms `--ease-in-out` plus 150ms content crossfade.
- Import found-row: translateY 6px→0, 200ms, 40ms stagger, never blocks interaction.
- Onboarding reveal and import done: summary chunks staggered about 100ms (title, numbers, stamps, actions).
- First achievement: one-time 600ms badge tilt-in, no loops.
- Sheet drag-release spring bounce capped at 0.1–0.2; no bounce elsewhere.
- Stamp press includes a 1-frame ink darkening; max 8 animated, the rest appear instantly.

Delight moments (stamp press, arrival confirm, import done, first achievement) use `--dur-moment`: stamp from scale 1.06, opacity 0, blur 2px settling to 1; stagger 80ms, at most 8 animated, the rest instant. Auto-confirmed and bulk beyond 8 appear instantly.

Reduced motion means gentler, not none: remove translate and scale, keep opacity and color at 150ms; loaders become static text; delight moments become a 200ms fade; sheets fade (drag still works); no ambient loops.

## Iconography

Lucide only, one SVG per icon, `currentColor`. Stroke 1.5 beside regular text, 2 beside semibold text (nav labels, buttons). Outline is the default; the active item is heavier, uses the accent, and has label weight 600, so active state never relies on color alone. No decorative icon discs. Icons accompany text labels.

**Logo mark.** One stable mark: the kanji 空 (from 空気, *kuuki*) on a filled `--accent` tile with `--accent-foreground` glyph, set in the system Japanese stack `--font-kana` (no webfont). It replaces the brief's suggested く, which reads as a back chevron in every Japanese face; the mark is never a back button. The vertical くうき word stays for the auth brand panel and the profile watermark.

## Primitives

Shared controls live in `apps/next/src/client/ui/` and build in hit areas (44px touch, 40px minimum dense desktop), press feedback, hover gating and focus rings:

Button, Field, Dialog, Sheet (with handle drag), Menu, SegmentedControl, SwitchRow, SwatchPicker, Disclosure, Toast, FloatingActionBar, DestructiveConfirm.

Signature components live in `apps/next/src/client/signature/`: `Ticket` and `Stamp`. Keep only Ticket/map code that has an actual consumer. Stamp ink is normalized in OKLCH per theme (≥3:1 on the surface; neutral ink for black and near-white flags).

## Copy and trust

Capture, auth, privacy, settings, errors, validation and destructive flows are calm and direct, with no humor. Wit is allowed only as a secondary line in non-critical empty states, achievements and insights, never replacing the instruction. Russian copy uses «вы»; no «ты» forms. Every string is written in RU and EN together with real plural forms, and checked at 320px and 200% text size.

"Nothing is stamped without you" is a precise rule, not an absolute promise: the one documented exception (D11) is that an awaiting flight is confirmed automatically seven days after it becomes date-eligible. Say so wherever the promise appears, for example in queue helper text. Never write "never" or "always" about stamping.
