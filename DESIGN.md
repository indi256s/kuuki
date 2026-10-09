# Kuuki Design System 2.0

Kuuki is a personal flight journal with a restrained editorial character. Typography, whitespace, and the details of stamps and tickets carry the design. This document is the single authoritative design reference for the Next experience and supersedes conflicting color, font, glass, grain, and motion guidance elsewhere. The [Redesign 2.0 UX brief](docs/plans/2026-10-04-redesign-2.0-ux-ui.md) explains the experience decisions.

**Status labels.** Unmarked claims describe the current source implementation, not deployment or visual acceptance. The [Overview Release 3 section](#overview-redesign) records the implemented production route and its components. Earlier implementation includes the Redesign 2.0 work from PR #42; its branch, checkout and local verification are recorded in the [auth handoff](docs/plans/2026-10-06-auth-one-form-handoff.md). **Planned (Wn/Tnn)** is documented intent not yet built; Wn/Tnn is the wave and task in the [implementation plan](docs/plans/2026-10-04-redesign-2.0-implementation.md). **Superseded** is older guidance that Redesign 2.0 replaced; the line says by what. **Built (auth redesign)** follows the Paper file [Kuuki — Auth redesign](https://app.paper.design/file/01M48F4SHK61AZS2FH5P5JPRY7) and its spec, [`.scratch/auth-one-form/spec.md`](.scratch/auth-one-form/spec.md). **Proposed** is design work in that file that has not been approved. Where the brief and the code disagree, the code is recorded here and the brief's intent is noted.

## Color and surfaces

Use semantic CSS variables from [`apps/next/src/app/styles.css`](apps/next/src/app/styles.css); do not place palette literals in components. Light uses paper (`#fbfaf8`) and charcoal text (`#302d2a`); dark uses ink (`#292827`) and warm white text (`#f1efeb`). Shu 朱 (vermilion) is the default accent in both themes. Text colors are separate from fills. Muted text must meet 4.5:1 contrast, control borders and focus must meet 3:1; do not fade text with opacity. `apps/next/src/app/tokens.test.ts` parses `styles.css` and checks these pairs. Hairlines may outline cards; control borders outline inputs and controls. Internal content and page chrome have no divider hairlines: none between rows or figures, under headers, around Next, above the narrator or Hidden sections, on the tab bar, or between sheet headers, bodies and footers. Full card/control outlines, the 2px active-tab and drag indicators, and sheet pager segments remain. The globe’s 1px limb is an explicit exception. In-flow cards use one subtle boundary and no shadow. Floating surfaces use a solid background and elevation. No glass, backdrop blur, glow, gradient buttons, or decorative grain.

Map fills use a sequential accent ramp and a titled legend with fixed buckets 1, 2–3, 4–9, 10+. Flag colors may inform stamp ink, never map fill. Claims must have a text and shape cue. Unknown legacy accent values map to shu and never overwrite status colors. Accents are set on `<html data-accent>` and stored by name; the picker is `SwatchPicker`.

Five accents are built. Shu replaced Terracotta as the default on 2026-10-07. Bootstrap and the appearance client map stored `terracotta`, `kincha`, `sumi` and yellow to `shu`; bootstrap maps legacy teal and cyan to `asagi`. Values below match `styles.css`:

| Accent | Light fill / text | Dark fill / text | Foreground (light / dark) | Distance from status hue |
|---|---|---|---|---|
| Shu 朱 (default) | `#c23417` | `#ea846f` | `#fff` / `#292827` | 21° from danger |
| Ai | `#4e5ea2` | `#acbbef` | `#fff` / `#292827` | 22° from info |
| Matcha | `#59702a` | `#b7ce92` | `#fff` / `#292827` | 25° from success |
| Asagi (浅葱) | `#0c747d` | `#85cfd8` | `#fff` / `#292827` | 45° from info |
| Sakura | `#964969` | `#e8a9c0` | `#fff` / `#292827` | 17° from danger |

The source uses one value per accent for fill and text, and `--accent-text` equals `--accent` for every accent, including shu. Measured shu pairs: light 5.30:1 on the background, 5.53:1 on the surface, 4.86:1 on the inset, white on the fill 5.53:1; dark 5.63:1 on the background, 4.81:1 on the surface, ink on the fill 5.63:1. Dark shu on the dark inset is 4.12:1, so accent text never sits on the dark inset. In OKLCH the warm end is crowded: shu 33°, danger 12°, Sakura 355°, about 20° apart each, so there is no room for another warm accent unless danger moves. `tokens.test.ts` checks the 4.5:1 and 3:1 pairs with these values; the boards do not prove contrast.

## Type and layout

Self-hosted Commissioner WOFF2 ([`apps/next/public/fonts`](apps/next/public/fonts), weights 400/500/600/700) is the Cyrillic-capable UI and display face; JetBrains Mono is for ticket codes, flight numbers, times, table dates, and handles. OFL licenses ship beside the font files. Changing and aligned numbers use tabular figures. Headings wrap with `balance`, paragraphs with `pretty`. Use locale-aware EN/RU dates, numbers, and real plural forms (one/few/many/other in Russian). Russian copy addresses the user as «вы».

| Style | Built value | Where |
|---|---|---|
| Display | No single token. Overview flight count 80/80, −0.04em; other figures 32/36, −0.03em; mobile figures 40/44 | `client/overview/hero/hero.css` |
| H1 | 30/36, 600, −0.02em | global `h1` |
| H2 | 22/28 (panel titles 600) | global `h2`, `.ui-panel-title` |
| H3 | 17 (line height inherits 24) | `.read-panel h3`, ticket prompt 17/24 600 |
| Body | 15/24, 400, antialiased | `body` |
| Small | 13/20 | hints, errors, switch descriptions, ticket meta |
| Caption / eyebrow | 12/16; eyebrow 600, uppercase, +0.06em, `--text-muted` | `.eyebrow`, tab labels, menu labels |

The former landing Display 44/48 guidance is superseded by the auth card heading. Global `h2` sets size, line height and weight 600.

The shared header and page container align at `--content-width` 1200px. Gutter `--page-gutter` is 24px, 16px at 700px and below (the one shell breakpoint). Spacing uses a 4px base; read sections gap 48px desktop and 32px mobile. Cards fit content instead of matching heights. Radii: 6px small internal chips, 10px controls, 14px cards/popovers/menus, 20px dialogs, sheets and the auth card. An inner radius must account for container padding (menu 14px minus 4px padding gives 10px items).

## Interaction and states

Navigation stays available while private data streams in. Every data surface distinguishes loading, empty, partial, error, and ready states; route `loading.tsx` files render the [loading screen](#loading-screen). Never present an unavailable read as a confirmed empty journal. Links and controls have visible 2px offset focus rings (`--focus`) and 44px touch targets. Press feedback is 120ms scale to 0.96 except static rows and cards; hover styles apply only to fine pointers. Disabled actions explain why in visible text, not a `title`. Use Lucide icons with text labels; color alone does not signal active state. Capture, authentication, privacy, and destructive copy is calm and direct.

After a route change focus moves to `main h1` (`RouteFocus`); only the pathname or a mode key (`/onboarding?step`, `/passport?view`) triggers it, never filters or search text.

System theme is the default for new users. Preserve an explicit light/dark choice, map supported legacy settings, and keep EN/RU and theme consistent with the first usable page (`public/bootstrap.js` sets theme, locale and accent before paint). Client persistence uses same-origin cookies; private app data and authorization are never cached in shared shells.

## Decisions

D1–D12 originate in the Redesign 2.0 plan; Overview Release 3 supersedes D8. Lifecycle and import details live in the ADR under `docs/adr/`.

| ID | Decision |
|---|---|
| D1 | `/`, `/signin` and `/signup` render the one-form [auth card](#auth-card); members continue through the Overview/onboarding gate. The landing hero, sample flight cards and FAQ are removed. |
| D2 | Five named accents: Shu 朱 (default since 2026-10-07, replacing Terracotta), Ai, Matcha, Asagi and Sakura. Store the name, never an arbitrary color; terracotta, kincha and sumi map to shu. |
| D3 | System theme by default; an explicit saved preference is preserved. |
| D4 | Light neutrals are barely warm; dark uses charcoal. |
| D5 | Commissioner selected by user request, superseding the earlier RU/EN specimen (see Typeface decision). |
| D6 | Russian copy uses «вы» everywhere. |
| D7 | Journey UI and navigation are removed; a bookmarked `/journey` redirects to `/overview` (built). |
| D8 | **Superseded** by the [Overview Release 3 contract](#overview-redesign): faceted filters scope the completed-flight Overview, with Next independent. Journal keeps its own filters. |
| D9 | `/fly/:username` is preserved; previews and share URLs use the configured origin. |
| D10 | Existing rank titles become localized achievement names; no new badge rules. |
| D11 | Awaiting flights auto-confirm seven days after they become date-eligible, with automatic provenance and no celebration; the rule is explained in queue helper text. |
| D12 | A confirmed connection excludes country evidence for the connection endpoint but keeps airport evidence. «Выходил в город» includes the country. |
| Geography | The existing 246-entry country/territory catalog and its six-region collection model, including Antarctica. Label totals "countries and territories"; no 195 denominator. |
| Leaderboard | Five-flight eligibility threshold kept. The airport-count category is labelled **Airports / Аэропорты** (`cities` stays an API alias); no unique-city ranking. |

## Token roles

Names are fixed; values live only in `styles.css` (`:root`, `:root[data-theme=dark]`, `:root[data-accent=*]`). Literal colors appear only in those blocks (plus stamp-ink input data). Accent never overrides status or rank tokens.

| Token | Light | Dark | Role and contrast rule |
|---|---|---|---|
| `--background` / `--surface` / `--surface-inset` | `#fbfaf8` / `#fff` / `#f2f0ed` | `#292827` / `#353331` / `#403d3a` | Page; card and sheet; well and table header. One step apart. |
| `--text` / `--text-muted` | `#302d2a` / `#66605b` | `#f1efeb` / `#c4beb7` | Body and headings; secondary text ≥4.5:1 on background and surface. Never fade with opacity. |
| `--hairline` | `#dedad5` | `#554f4a` | Card outlines and the explicit globe-limb exception; never internal content or page-chrome dividers. |
| `--control-border` | `#837b74` | `#958b82` | Input, checkbox, select and switch borders; ≥3:1 on the surface. |
| `--accent` / `--accent-text` / `--accent-foreground` / `--focus` | see accent table | | Fill; links and active nav ≥4.5:1; text on the fill ≥4.5:1; 2px ring, 2px offset, ≥3:1. |
| `--accent-hover` | `color-mix(in oklch, accent 82%, text)` | same | Primary hover fill; derived. |
| `--success-text` / `--success-fill` | `#146d34` / `#2a904b` | `#76c788` / `#4eb068` | Text grade ≥4.5:1; fill grade for backgrounds and icons, never text. |
| `--warning-text` / `--warning-fill` | `#824c00` / `#ae6700` | `#e1a263` / `#cf8634` | Same rule. |
| `--info-text` / `--info-fill` | `#175d9b` / `#2b7ec9` | `#73b6fa` / `#4c9deb` | Same rule; search matches use `--info-text` on `--surface-inset` (≥4.5:1). |
| `--danger-text` / `--danger-fill` | `#a02442` / `#ca3056` | `#f0a7af` / `#f25776` | Same rule; danger buttons are outlined in `--danger-text`. Built crimson separates errors from the shu accent. Text 7.12:1 light, 7.60:1 dark on the background. |
| `--rank-gold` / `-silver` / `-bronze` | `#775800` / `#595e64` / `#8a4b24` | `#d5b36a` / `#b2b8bf` / `#eca57d` | Text grade ≥4.5:1; always paired with the rank number. |
| `--surface-floating` | `--surface` | `#3c3a37` | Level 2 and 3 fill. |
| `--shadow-floating` / `--shadow-modal` | two-layer black 8% / 10–12% | none | Dark theme drops the shadow. |
| `--ring-floating` | none | `0 0 0 1px` white 8% | Dark replacement for the shadow. |
| `--scrim` / `--outline-media` | black 40% / black 10% | black 60% / white 10% | Modal backdrop; 1px outline on images and avatars. |
| `--map-land` / `--map-border` / `--map-route` | `--surface-inset` / `--hairline` / `--accent` | same | Map base layers; follow theme. Static previews select generated light/dark outline assets from the same tokens. |
| `--map-bucket-1…4` | `color-mix(in oklab, accent 24 / 43 / 65 / 90%, map-land)` | same | Sequential ramp, bucket 1 lightest; thresholds 1, 2–3, 4–9, 10+ from one shared function. Mix in oklab: in oklch the hue drifts toward the land color, so shu buckets would turn orange. Shu light `#ecc6bb` / `#e5a494` / `#da7d68` / `#c94c33`; dark `#674e47` / `#865c51` / `#ac6b5d` / `#d87d6a`. |
| `--mark-1…4` / `--mark-ghost` | `--accent` / `#da6a53` / `#b28555` / `#66605b` / `#978c7f` | `--accent` / `#c85f49` / `#a17749` / `#c4beb7` / `#897e70` | Built chart palette; `--hairline` is never a data color. Mark-1 follows the chosen accent; mark-2…4 and ghost keep these fixed values. `--ts-chart-1…5` maps to these five tokens; maker charts use their category palette. |
| `--heat-0…4` | `--surface-inset` / `#e6c8c1` / `#e4735c` / `#c23417` / `#892410` | same | Built Rhythm ramp. Heat-3 is exactly `#c23417` in both themes, independent of accent selection. |
| `--cat-maker-airbus` / `-boeing` / `-embraer` / `-atr` | `#0f6390` / `#16a384` / `#8c6d08` / `#9a52cf` | `#0685b6` / `#04ac7b` / `#a4770f` / `#a36ffa` | Fixed maker slots, with text labels and tables. Every mark uses the same filled rounded square (20% radius). |
| `--cat-maker-other` / `-unknown` | `#c2bab0` / `#ece9e5` | `#c9c1b7` / `#47433f` | Other is recognized aircraft outside the named slots; Unknown is absent or unrecognized aircraft. |
| `--brand-l-min` / `--brand-l-max` | `.4` / `.6` | `.7` / `.86` | Airline marks in Rankings (shares donut, legend, comparison slope, airline bump series) use the airline's `primaryColor` from `@kuuki/data/airlines` with OKLCH lightness clamped to these bounds and chroma capped at .19, so each mark holds 3:1 on the surface (`lib/airline.ts`). Missing colors (`null` in the catalog) fall back to `--mark-ghost`; legitimate airline values such as JetBlue’s `#003876` are preserved. Airports and routes keep `--mark-*`. |
| `--airline-logo-surface` | `#fff` | `#fff` | Default surface for the shared airline mark. Journal overrides the mark to transparent, without a tile or border; its flight number and accessible airline name carry identity independently. |
| `--cat-alliance-star` / `-oneworld` / `-skyteam` | `#6b5a2e` / `#6a3f55` / `#3e5266` | `#cdb98a` / `#d3a6bc` / `#a9bbd0` | Separate dated-alliance palette: ★ Star, ○ Oneworld, △ SkyTeam. Never combine with maker categories. |
| `--accent-tint` / `--accent-on-tint` | accent 10% over surface in srgb / `#b02f14` | same tint formula / `--accent-text` 80% over `--text` (≥4.5:1 for every accent) | Tinted labels such as Next; foreground text is distinct from fill. |
| `--globe-rim` | accent 14% over transparent in srgb | accent 22% over transparent in srgb | Flat, static 8px rim; no glow or animated gradient. |

The exact heat ramp (including dark steps 3–4), map buckets 1–3, and Other/Unknown swatches have consciously accepted sub-3:1 pairs. Visible text-ink counts or labels, tooltip values, tables and non-color cues carry meaning. This is not blanket 3:1 acceptance; see [palette contrast acceptance](.scratch/overview-redesign/issues/01-palette-contrast.md). Shu is not a maker or alliance category color.

Regenerate static outlines with `python3 scripts/map-build-geometry.py --rebuild apps/next/public/maps/countries-110m-2.0.2.geojson`. The outline URLs are immutable: palette changes also require a new asset version in the preview and cache inventory.

Radius and spacing: `--radius-xs` 6px, `--radius-sm` 10, `--radius-md` 14, `--radius-lg` 20, `--radius-full` 9999px; `--space-1` 4px, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-6` 24, `-8` 32, `-12` 48.

Shell and control tokens (all in `:root`):

| Token | Value | Use |
|---|---|---|
| `--content-width` | 1200px | Header and page container width. |
| `--page-gutter` | 24px; 16px ≤700px | Horizontal page padding. |
| `--header-h` | 56px; 48px ≤700px | Header minimum height. |
| `--tabbar-h` | 56px | Mobile tab bar height, excluding the safe area. |
| `--control-h-sm` | 40px | Dense desktop controls: split Add, avatar button. |
| `--action-row-h` | 52px | Add-action rows in the mobile sheet. |
| `--badge-size` | 24px | Queue count pill. |
| `--z-tabbar` | 30 | Tab bar; the only tokenized z-index. |
| `--font-sans` / `--font-mono` | Commissioner, system-ui / JetBrains Mono, ui-monospace | Text; ticket data only. |
| `--font-kana` | Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, Yu Gothic, then `--font-sans` | The member くうき tile, loading 空 tile and くうき watermarks; system stack, no webfont. |

Runtime variables set by the shell and primitives, not for authoring: `--tabbar-offset`, `--toast-bottom-offset`, `--action-bar-bottom` (mobile, derived from the tab bar and safe area; zeroed while the keyboard is open), `--sheet-drag`, `--sheet-kb`, `--n` (segmented option count).

**Z-index scale** (literals in the CSS, lowest to highest): tab bar 30 (`--z-tabbar`), floating action bar 40, overlay 50, dialog and sheet 51, combobox and calendar popovers 55, menu 60, toast 70, skip link 100. Overlays therefore sit above the tab bar, and menus above the dialog that hosts them. Legacy `.capture-confirm` (90) remains on an unmigrated surface and is superseded by DestructiveConfirm. The unused `.read-sheet` rules were removed.

Motion tokens: see Motion.

## Typeface decision

Commissioner replaces Onest at the user's request. The UI and display face is self-hosted as WOFF2 with real upright 400/500/600/700 faces and Latin/Cyrillic coverage. The official static faces include the `tnum` feature that the variable release lacks. Tabular figures are enabled on the body and inherited by data values and form controls; JetBrains Mono remains the ticket-data face. The OFL license ships beside the font. The earlier [`font specimen`](docs/design/font-specimen.html) and screenshot record the previous Onest selection.

## Surfaces and elevation

One material at a time.

| Level | Light | Dark | Used by |
|---|---|---|---|
| 0 Page | `--background` | `--background` | Page |
| 1 In-flow | `--surface` + 1px `--hairline`, no shadow | `--surface`, no border; 1px inner top highlight (white 4–6%) | Cards, tables, list groups |
| 2 Floating | `--surface-floating`, `--shadow-floating`, no border | `--surface-floating` + `--ring-floating` | Popovers, menus, toasts, action bar |
| 3 Modal | Level 2 with `--shadow-modal`; `--scrim` | Level 2; `--scrim` | Dialogs, sheets |

Levels 2 and 3 are built on every ui-kit primitive. In dark, Ticket, read panels and capture/auth cards use a transparent border and a 1px inner top highlight through `--surface-highlight`. Light keeps its hairline. These are source contracts; visual proof remains deferred. Images and avatars use `--outline-media`. Primary is one flat accent fill.

## Motion

Generated Facehash avatars blink at the library's per-avatar intervals and retain their subtle hover rotation. Uploaded photos stay static. Reduced motion disables blinking and rotation.

The Plus, LayoutGrid and Stamp icons adapt [pqoqubbw/icons](https://github.com/pqoqubbw/icons) locally in `client/ui/animated-icons.tsx`, with its MIT notice alongside. Plus is shared by Add, import manual rows and Overview filters; LayoutGrid and Stamp appear in the mobile tab bar. Their CSS motions run once on fine-pointer hover, stay static on touch and with reduced motion, and preserve existing sizes and text labels. Other icons remain in `lucide-react`.

Tokens: `--ease-out` cubic-bezier(.23,1,.32,1) for enter/exit and press; `--ease-in-out` cubic-bezier(.77,0,.175,1) for on-screen movement (height, segmented thumb); `--ease-drawer` cubic-bezier(.32,.72,0,1) for sheets; `--ease-icon` cubic-bezier(.2,0,0,1) for icon crossfades (defined, no consumer yet). `--ease-horizon` cubic-bezier(0,0,.15,1) for the Horizon sun and the theme sweep it leads. Durations: `--dur-press` 120ms, `--dur-fast` 150ms, `--dur-base` 200ms, `--dur-sheet` 300ms, `--dur-moment` 450ms (rare delight only), `--dur-horizon` 500ms (Horizon sun and theme sweep).

Built [Overview motion](#overview-redesign): replay shares one clock; the camera reframes over 600ms (its source uses an easing function); in-view local Arc SVG geometry updates use 1,100ms, while Manufacturers reflows over 300ms. Reduced motion snaps charts and camera and shows static mid-arc planes. Figures, chips and text swap instantly.

**Built (Overview reorder, desktop):** a dragged card lifts as a floating ghost (scale 1.02, `--shadow-floating`, 150ms) that follows the pointer 1:1 with no easing, while the original stays in the grid as a sunken empty slot. Siblings preview the new order through CSS `order` and slide with FLIP over 280ms `--ease-in-out`; a drop settles into the slot over 200ms `--ease-out`, and Escape returns the card over 180ms `--ease-out`. Reduced motion drops the lift scale and snaps the slides and settle.

Rules: ease-in is banned; exits use ease-out and run about 20% faster than enters; never `transition: all`; animate transform, opacity and sparingly filter; height disclosure uses grid rows 0fr→1fr; no bounce on routine UI; content present on first render does not animate in; no count-up from zero.

| Never animates | Built animation |
|---|---|
| Route and tab changes (focus moves to H1), except the two [route transitions](#route-transitions) below; ordinary keyboard actions and filter/sort text changes, WindLoader, glow pulses; Overview chart/camera exceptions are described above | Press scale 0.96 120ms (`data-static` excluded); hover color 150ms on fine pointers; segmented thumb 200ms `--ease-in-out`; menu 150ms in (scale .97) and 120ms out; dialog 200ms in (scale .96) and 150ms out, scrim 200/150; sheet 300ms `--ease-drawer` with handle drag; disclosure 300ms rows plus 150ms opacity; toast 300ms in, 200ms out; switch 200ms; tab bar slide off for the keyboard 200ms; stamp press 450ms; the two route transitions |

### Scoped text feedback

Torph 0.1.3 morphs only copy confirmations (profile link and import prompt), import found counts and stage status badges, the pending labels for manual flight save, profile Settings save and accepting aircraft suggestions. Use `--dur-base` 200ms and `--ease-out`, or `--dur-fast` 150ms for stage badges, with scale off. Numeric matching is enabled only for actual found-count updates; render the current localized plural string immediately. Found-count bursts faster than one duration switch to static text until one quiet duration passes, without throttling values or speech. Short labels may wrap at constrained widths. First render stays static; no fabricated count-up and no delay before completing a request or leaving a screen.

Keyboard-triggered copy and save feedback swaps instantly, including Enter, Space, implicit form submission and the manual-save shortcut. Pointer-triggered feedback may morph; subsequent asynchronous import progress may morph independently of the input that started the import. Selection-count changes stay instant. Under reduced motion these scoped text labels swap immediately, overriding the generic fade rule below. Kuuki wrappers retain accessible names and live regions; the existing import spoken-count throttle is unchanged. Reserve button width for both localized labels.

### Route transitions

Only two route changes animate, through `@ssgoi/react` 7.4.0 in `apps/next/src/client/route-transitions.tsx`. Every other navigation keeps its page boundary and swaps instantly: tabs, header nav, `?view=`, filters and sheets (flight detail, `/add`). The springs are critically damped, so nothing bounces, and the times below count until ssgoi ends the spring. Focus still moves to the incoming H1, and the outgoing page is inert and `aria-hidden` until it settles.

- **Import done → Passport, `hero`, about 0.38s.** The done-step stamps (`data-hero-exit-key`) travel to their Passport stamps (`data-hero-enter-key`) without replaying the press. It runs forward only and for at most 8 stamps; with more, Passport opens without it. A Passport stamp that will not be fully on screen has no partner and appears in place. On a phone the Passport cover keeps the stamps below the fold, so there they all appear in place. If Passport has not finished loading when the member opens it, it shows its loading screen and opens without the hero.
- **Leaderboard → `/fly/[username]`, `drill`, about 0.28s.** The default parallax, reversed by Back, with no hero. Forward redoes it. A link from a profile to the leaderboard, Back onto a profile and Forward over that link stay instant. Back is read from the Navigation API; in a browser without it, Back and Forward never drill.
Auth aliases swap instantly. The create step slides in place inside one card; under reduced motion it swaps without sliding. Recovery states reuse the card, keeping its wordmark and corner controls in place across states.

Additional motion contracts:
- **Planned (W5/T25):** icon swap by scale, opacity and blur 200ms with `--ease-icon`; tooltip 150ms with instant adjacent tooltips (no tooltip component exists); skeleton to content 150ms. Today loading is the static [loading screen](#loading-screen).
- **Built (Overview chapter sheet, mobile):** the sheet has one fixed height for every chapter, so the header, pager and footer never move. Chapters are slides in a horizontal scroll-snap track (`scroll-snap-stop: always`), so the browser owns the swipe: the neighbouring chapter travels with the finger, release momentum, the edge bounce and the horizontal/vertical axis lock are the platform's, and a hard flick moves one chapter. Each chapter scrolls vertically on its own and starts at its top when you come back to it. Only the open chapter and its neighbours render content. Sideways overscroll is off so an over-swipe does not become Chrome's back gesture; iOS Safari's edge-swipe back stays the system's. The options button keeps its corner beside Close and acts on the open chapter. Previous and Next sit in fixed corners of the footer, each label on one line ending in an ellipsis when the neighbour's name is too long for its half; the unavailable one stays in place, dimmed, and they scroll the track like a swipe. Below a 270px heading the "3 of 7" position is kept for screen readers only, since the pager shows it. The pager is one accent bar over the slots: with scroll-driven animations it is tied to the track's scroll position and follows the finger, otherwise it moves to the pending chapter over 300ms `--ease-drawer`. The title with its position and the Previous/Next labels are tied to the track's scroll position too, so they keep the chapter's pace under a finger, momentum or Previous/Next: each line fades and slides up to 24px with the outgoing chapter, switches at the half-way point, and arrives from the other side with the incoming one. When a release would land on another chapter (Scroll Snap Events), Android gives one 8ms vibration tick. The chapter becomes the open one when the track settles. Keyboard changes swap the text in place. While a filter is on, a status line under the pager names it ("Filtered · Boeing 737") with a 44px Show all button, so a filter set inside a chapter stays visible there. Reduced motion: the swipe still follows the finger, text swaps in place, and Previous/Next jump to the chapter and fade it in over 150ms linear.
- **Built (T14):** newly found import rows enter over 200ms with 40ms stagger; Done summary chunks stagger 100ms. Reduced motion uses a 150ms fade with no delay.
- **Planned (W3/T13):** arrival confirm: stamp press onto the ticket stub, then card collapse 250ms `--ease-in-out`.
- **Built (T21):** three-step deletion uses a 250ms height transition where intrinsic-size interpolation is supported and a 150ms content fade; reduced motion keeps steps static.
- **Built (T19/T23):** first-achievement notification enters once over 600ms (150ms fade under reduced motion). Onboarding Reveal caps newly published stamps at eight with 80ms stagger; reduced motion removes the delay.
- **Built (auth redesign), replacing W5/T22's "at most 3 planes":** the auth brand panel's plane field. It is one of the permitted ambient loops, alongside the member kana crossfade and Overview replay. The field has 30 planes on desktop (12 small, 10 medium and 8 large, with sizes shuffled across x) and 14 in the mobile brand band. Each plane moves along (+400, −800) with transform only. Each is rotated −18.4° (atan2(−800, 400) + 45°), so its nose points along the path. The field pauses when it is off screen (IntersectionObserver) or the tab is hidden. Planes stay clear of the wordmark, and the くうき watermark sits behind them. Under reduced motion the planes freeze in the frame the boards draw. The isolated activation page uses the same paused-motion contract.
- **Built (auth redesign):** the rotating tagline is picked once per page load and shown only on the form and create steps. Under reduced motion it swaps text without sliding.
- **Built (auth redesign):** the Horizon theme toggle moves its sun 50% of the viewBox over 500ms with `cubic-bezier(0,0,0.15,1)`; see [Auth card](#auth-card).
- **Built:** a theme change (any control, or the device flipping under `system`) sweeps the new theme over the old one, which stays still: dusk brings night down from the top, so the bottom changes last, and dawn raises day from the bottom up. It is a View Transition on the root whose new layer moves a feathered mask band about a third of the viewport tall, never a hard line. It runs with the Horizon sun at `--dur-horizon` 500ms and `--ease-horizon` `cubic-bezier(0,0,.15,1)`, and `html[data-theme-switching=dusk|dawn]` sets the direction. The browser bar (`meta theme-color`) changes when the sweep reaches the top of the viewport: at the start of dusk, at the end of dawn. Under reduced motion the sweep becomes a 150ms linear fade and the bar changes with it. While the switch runs, component transitions are off so no control tweens its colors behind the page; the Horizon sun keeps its move. The old page is a still snapshot, so the auth plane field gets its own layer: its old copy is dropped and the live one keeps flying in the new colors instead of freezing until the sweep reaches it. Without the API, or during a route transition, the theme and bar swap at once. A second toggle skips the first sweep; only the latest switch clears the attribute and settles the bar.
- Sheet drag-release spring bounce (0.1–0.2 at most) is optional and not built; release settles with `--ease-drawer`.

Overview delight moments are quiet text and marks, not animation: equator-lap ticks and a next-landmark line on Over time; an "On this day" line in the hero when an earlier year has a logged flight on today's date (local day, owner's unfiltered flights, absent otherwise); and an unlock meter in gated sections, one dot per flight still counted toward the threshold, a thin bar past 12. Delight moments use `--dur-moment`. The built `Stamp` press starts from scale 1.06, opacity 0, blur 2px, with a one-frame brightness darkening, and plays once per immutable ID (module `Set` plus `sessionStorage`) so remounts and refetches never replay it. Onboarding applies the 80ms stagger and cap of eight to newly published country acknowledgments. Reveal shows at most eight stamps and links to Passport for the complete collection; refetches and historical evidence do not replay the first-save moment.

Reduced motion means gentler, not none. Auth and activation pending spinners stay static; their status text remains visible. Built in `ui.css`: no scale or translate, color and opacity at 150ms linear; dialog and menu fade; sheet and toast fade (drag still works); thumb, disclosure and chevron static; stamp press becomes a 200ms fade; the tab bar does not slide; the two route transitions swap instantly, like every other route change.

## Iconography

Lucide only, one SVG per icon, `currentColor`. Stroke 1.5 beside regular text, 2 beside semibold text (nav labels, buttons). Every icon built so far sits beside semibold labels or is a control, so all use stroke 2 (tab bar 22px; add actions, close buttons 20px; split Add, disclosure, toast 18px; the swatch check 2.5). No decorative icon discs. Icons accompany text labels.

Active state never relies on color alone: accent text, label weight 600, and a 2px accent bar (underline on desktop nav, top edge on the tab bar) plus `aria-current="page"`. **Superseded:** the brief's filled or heavier active icon; the bar replaced it.

**Logo mark.** The built member/navbar mark is a 32px tile with an 8px radius, `--accent-tint` fill and 700 18/18 kana. The design contract uses `--accent-on-tint` for the glyph; the source uses that foreground. It crossfades く → う → き on a 7.5s loop; reduced motion shows the first く. The wordmark contract is lowercase “kuuki”, Commissioner 18/24 600, with an 8px gap, and links home. The static loading mark is distinct: 空 on a filled accent tile, 48px with a 24px glyph. The vertical くうき watermark remains on auth and editorial profile surfaces. These are source contracts, not visual audit claims.

**Built (auth redesign): text wordmark.** On auth surfaces, a wordmark with no tile replaces the 空 tile: "Ku" in `--accent-text` and "uki" in `--text`, so it follows the accent and the theme. It uses Commissioner 700 at −0.04em, with font size equal to line height: 36px on the desktop auth brand panel and 28px in the mobile auth header. It is one element with `aria-label="Kuuki"`; the two spans are visual only. The spec replaces the tile on auth surfaces. The accent-picker boards also draw it in the app header at 22px (Proposed). Member headers use the kana tile; loading screens retain the static 空 tile. Board "1.1" sets the brand-panel wordmark at −0.05em; the build notes and the spec say −0.04em, and the spec wins.

## Shell and navigation

One breakpoint at 700px switches between desktop and mobile. The header and tab bar sit outside the single `<main id="main" class="page-shell">`; a skip link precedes them. `BrandShell` (guests) shows the wordmark, sign-in and sign-up links, and the language/theme controls; `MemberShell` adds navigation.

**Desktop (above 700px).** Header minimum height 56px, solid `--background`, no divider hairline, content aligned to 1200px, or the 2560px shell on Overview. Spacing tightens fluidly and controls wrap when localized queue text needs another row; logical spacing supports wrapping without a fixed-height clipping rule. Left: wordmark, then Overview, Journal, Passport, Leaderboard (Обзор, Журнал, Паспорт, Рейтинг). Links are 44px high, radius `--radius-sm`, hover `--surface-inset`; active is `--accent-text`, 600, with a 2px accent underline inset 12px. Right: queue slot, split Add, avatar menu.
- **Split Add.** Accent fill, `--control-h-sm` tall, radius `--radius-sm`. The main half is a link to `/add` (manual entry); the chevron half opens a Menu with Upload a boarding pass or PDF, Paste text, Enter manually. One shared list (`ADD_ACTIONS`) feeds this menu and the mobile sheet. The brief names two items; the built menu has three.
- **Avatar menu.** A 40px circle button using the shared profile photo or reactive blob fallback, ringed by `--outline-media`. Menu: My profile (with Public or Hidden status), Public profile checkbox (turning it off also leaves leaderboards), Settings, Theme radios (Light, Dark, System), Language radios (EN, RU), Sign out. Accent selection is in Settings.

**Mobile (700px and below).** Header minimum height 48px with the current page title and queue slot; the split Add and avatar menu are hidden. A fixed bottom tab bar replaces the nav (`<nav aria-label="Tabs">`):
- **Layout.** `--tabbar-h` 56px plus the safe-area inset, `--background`, no top divider hairline, five equal columns: Overview, Journal, Add, Passport, Me (Я). Leaderboard is reached from Me and the desktop nav; Settings leaves the tab bar.
- **Tabs.** Icon 22px stroke 2 above a 12/16 label (11px at 360px and below), `--text-muted`; press fills `--surface-inset`. Active is `--accent-text`, 600, with a 2px accent bar on the top edge.
- **Add** is a button, not a link: it opens a bottom Sheet titled "Add a flight" holding the three `AddActions` as 52px (`--action-row-h`) rows with 20px icons. The sheet closes on any route change.
- **Me** is active on `/me` and the viewer's own `/fly/<username>`, never another member's.
- **Keyboard.** When the visual viewport is more than 120px shorter than the layout (and not pinch-zoomed) `html[data-keyboard=true]` slides the bar off-screen while it stays in the DOM and focus order, and resets the offsets below. With `resizes-content` viewports the flag may not fire; the bar then rides above the keyboard.
- **Clearance.** Fixed settings actions use the greater of `--tabbar-offset` and the safe-area inset, plus 12px, so the inset is counted once. `--tabbar-offset` (bar plus safe area) pads the page bottom (+24px); toasts lift by `--toast-bottom-offset`; the floating action bar sits at tab bar plus 16px.

**Queue badge.** `QueueSummarySlot` reads the owner-scoped `AwaitingProvider` and links to `/journal?queue=awaiting`. Its localized accessible name separates flights awaiting confirmation from retained import rows needing review. A zero count is hidden; an initial transport failure says Queue unavailable rather than zero. The header and Add menu/sheet share this authority. Mobile headers display the current page title.

### Loading screen

`LoadingScreen` is the route loading state for Overview, Passport and Import: the 48px logo mark, a localized status line («Загрузка…» / "Loading…") in `--text-muted`, 48px vertical padding, `role="status"`. Journal uses the final-layout ledger skeleton described below. One stable mark, no spinner, no motion, so reduced motion needs no variant. The older `.loading` and `.placeholder` blocks in `styles.css` remain on unmigrated pages.

### Auth card

**Built (auth redesign).** One card with one form: Email, Password and Continue, with no sign-in/sign-up switch. The server decides the outcome. A matching account signs in. A wrong password shows the error state (board "1.4"). An email with no journal turns the card into the create step (board "1.2") in place and keeps both fields. Flows, endpoints, copy and focus rules are in the [spec](.scratch/auth-one-form/spec.md). This section records the visual contract. The implementation maps the exact Paper values to tokens.

- **Card, desktop.** 1040×620, radius `--radius-lg`, centered on `--background`. Light: `--surface` with a 1px `--hairline`. Dark: `--surface` with the 1px inner top highlight (white 5%). The brand panel on the left is 420px wide with 40px padding. Its fill is `--surface-inset` in light and `#2f2d2b` in dark. The form panel has 96px top, 48px bottom and up to 64px side padding, and its form column is 360px wide.
- **Brand panel.** The wordmark sits top left. Behind it, the vertical くうき watermark is set at 164px, weight 700, in the accent fill at 10% opacity in light and 13% in dark. It is decorative and hidden from assistive tech. On top is the [plane field](#motion).
- **Form column.** The heading is H1 (30/36, 600, −0.02em, balanced), followed by a 15/24 `--text-muted` subtitle 6px below. Groups are 28px apart and fields 16px apart. Auth CardField labels are 13/20 at weight 500; the general Field label remains 600. Inputs are 44px tall with radius `--radius-sm`, 14px inline padding and a `--control-border` border; their dark fill is also `#2f2d2b`. The primary button is full width and 44px tall. "Can't sign in?" is a 13/20 500 `--accent-text` link at the end of the Password label row. Under the form, the tagline is 13/20, +0.01em, centered and `--text-muted`.
- **Error state.** The input border turns `--danger-text`, and the focus ring stays outside it (2px surface gap, then 2px `--focus`). Below the input sits a 16px Lucide alert icon and 13/20 text, both in `--danger-text`. An outlined secondary button, "Email me a link to get back in", with a mail icon, follows before Continue. Every error has an icon and text.
- **Utility controls.** These sit top right, each 44×44: language (globe and code), the Horizon theme toggle and help. Icons are 16px in `--text-muted`.
- **Horizon theme toggle.** Built from the Horizon paths of [toggles.dev](https://toggles.dev) (`@theme-toggles/react`, MIT) as a small Kuuki component with an attribution comment, not the package component. The icon is 16px in a 32×32 viewBox, both paths filled with `--text-muted`. In light the sun is fully up. In dark the sun moves down 50% to sit half below the horizon. The whole icon shifts up 4.5px in dark and 0.5px in light for optical centering. Both moves take `--dur-horizon` 500ms with `--ease-horizon` `cubic-bezier(0,0,0.15,1)` and are instant under reduced motion. The toggle shows the theme in effect and switches to the opposite theme on click. Until then, the preference stays `system`. `aria-pressed` is true in dark, and the label is always "Dark theme" / «Тёмная тема». Settings and the avatar menu keep their current theme controls.
- **Hit areas.** The reveal button is 40×40 inside the field. Text links grow to about 44px tall through padding and an equal negative margin. "Can't sign in?" grows up and sideways only, never over the password input.
- **Mobile (≤700px).** A brand band sits on top: dark `--background`, up to 302px tall after removing the board's device status bar, shrinking toward 160px on short viewports, holding a 52px header with the 28px wordmark and the utility controls, a horizontal くうき watermark at 104px and 14 planes. The form is in a bottom sheet: `--surface`, top corners `--radius-lg`, padding 28px top, 20px sides and 46px bottom. Its heading is 28/34, and inputs and the primary button are 48px tall with 16px text, so iOS does not zoom on focus. In light the sheet has a `--hairline` top edge; in dark, the white 6% inner highlight.
- **Getting back in.** The Request, Check your inbox, Set password and Link expired states (boards "2.1" to "2.4") reuse the card with its wordmark and corner controls in place across states. They have no tagline. Mobile shows them in the same sheet.

Dark brand-panel and input fills use the role tokens `--auth-brand-surface` and `--auth-input-surface` (`#2f2d2b`). The Next-owned isolated activation page retains system fonts under its restrictive CSP and has native help that locks background scrolling; it returns to the card after saving without signing in automatically.

### Accent picker

**Proposed, not approved.** The redesign of the accent picker runs separately from the auth spec in the same Paper file (boards "5.1" and "5.5"–"5.7"). Direction A, "Wordmark tiles": each choice is a radio tile showing "Ku" in the accent's text color over a strip of its four passport-map shades. In Settings the tiles are 28px "Ku" at radius `--radius-md`. The selected tile has a 2px `--text` border and a check. One caption below names the selected accent with a one-line note, such as "Asagi 浅葱 — The blue-green of young leek." In the desktop header, a 44×44 accent trigger with a 14px dot sits beside Horizon. It opens a level 2 popover, 304px wide, aligned to the end with an 8px offset, holding a theme row and 20px mini tiles. Opening the popover focuses the selected tile. Changes apply at once, the caption is `aria-live=polite`, and under reduced motion the popover fades in 150ms with no scale. Color tokens never transition. The mobile sign-in board ("5.7") instead uses 24px swatch dots in 44px radios. Choose one pattern before building.

## Primitives

Shared controls live in [`apps/next/src/client/ui/`](apps/next/src/client/ui/) with styles in `ui.css` (tokens only, no literal colors) and `flight-controls.css`. They build in hit areas, press feedback, hover gating and focus rings. The dev-only [gallery](apps/next/src/app/dev/gallery/gallery.tsx) at `/dev/gallery` (`?theme=dark&locale=ru`) exercises each in both themes and locales and returns 404 in production.

| Primitive | Behavior |
|---|---|
| Button | Variants primary (flat accent), secondary, ghost, danger (outlined `--danger-text`). 44px min height, padding 10/18, radius `--radius-sm`, 600. `dense`: 32px visual, hit area to 40px (44px coarse); keep neighbors 8px apart (12px coarse). `loading`: static `loadingLabel` text by default, no spinner, width kept, `aria-busy`; the scoped `morphText` opt-in keeps a persistent text-only label. `disabledReason`: uses `aria-disabled`, so the button stays focusable, and shows 13/20 helper text beneath. `static`: no press scale. |
| Field | Label 600, optional marker, 13/20 hint, 44px input with `--control-border`, `aria-invalid` turns the border `--danger-text`. The error line reserves 20px so errors never shift layout. |
| Dialog | Level 3, width `min(520px, 100vw − 32px)`, max height `min(100dvh − 48px, 680px)`, radius `--radius-lg`. Pinned header (22/28 title, 44px close) and footer (hairline top); the body scrolls. Focus lands on the title or `initialFocusRef` and returns to the trigger. `dismissible=false` blocks Escape, outside click and the close button while an action is pending. **Add dialog:** desktop manual add uses `.flight-add-dialog`, `min(560px, 100vw − 32px)`. |
| Sheet | Radix dialog. `side="bottom"` on mobile, `"right"` (width `min(460px, 100vw)`) on desktop; radius `--radius-lg` on exposed corners. The handle is the only drag surface (bottom: 40×4 grip in a 28px strip; right: 20×64 tab on the left edge), so body scroll and text selection stay native. Release dismisses past 35% of the sheet size or faster than 0.11 px/ms (measured over about 100ms); dragging against the open direction rubber-bands to 80px. A visible close button is the keyboard alternative. **Keyboard inset:** the bottom sheet follows `visualViewport` (skipped while pinch-zoomed), setting `--sheet-kb` as its bottom offset and max height; past 80px it drops the footer's safe-area padding. Focus lands on the title or `initialFocusRef`. **Full-height variant** `.flight-full-sheet`: height `100dvh − --sheet-kb`, radius 0, used by mobile add, flight detail and combobox search. |
| Menu | Radix dropdown, level 2, radius `--radius-md`, min 200px, max `min(320px, 100vw − 16px)`, items radius `--radius-sm` at 40px (44px coarse). Check and radio items, uppercase 12px labels, separators, `danger` variant. Collision-aware with 8px padding; origin follows the trigger. |
| SegmentedControl | Radio-group semantics: one tab stop, arrows move and select, Home/End jump. Equal cells (min 104px) wrap into rows at 320px; 3px padding, container `--radius-md`, thumb `--radius-sm` sliding 200ms. 44px cells. |
| SwitchRow | 44×26 switch with a 44px hit area, label, description, a consequence line in `--text`, and a disabled reason. Disabled stays visible. |
| SwatchPicker | Radiogroup of the five accents, 44px pills with 28px dots and localized names; arrows move and select; writes the name through `setAccent`. |
| Disclosure | Trigger 44px, chevron rotates 200ms; rows 0fr→1fr over 300ms. Collapsed content is `inert` and hidden. Used for optional flight details. |
| Toast | Level 2, radius `--radius-md`, width `min(420px, 100%)`, bottom-centered; bottom-right at 24px from 700px up. Kinds info, success, error: Lucide icon with a screen-reader label and a 4px fill-grade left border on success and error. Errors announce assertively, others politely. Auto-dismiss 5s, errors 8s, 0 persists; pauses on hover, focus and hidden tab. Message states the outcome. `ShellNotices` mounts one owner-scoped `ToastProvider` in the member shell, so notices survive client navigation; `ToastSlot` places a caller-owned notice (the Journal's pending-delete Undo) in the same region. |
| FloatingActionBar | Level 2 sticky bar, radius `--radius-md`, region with a polite pluralized count. Sticks above the safe area and the tab bar (`--action-bar-bottom`) without pushing content. Journal uses it for selected-row deletion and clear-selection actions. |
| DestructiveConfirm | Dialog composition. Title names the object, body states the consequence, confirm is verb plus object. Cancel has initial focus; pending shows static text and blocks dismissal; a rejected action stays open with an `alert` message; an optional typed phrase disables confirm with a visible reason. Manual flight deletion, Journal bulk deletion and Passport country evidence removal share this composition. |

### Calendar

A typeable date field, not a picker-only control. The input is text with `inputMode="numeric"`; placeholder and hint are `MM/DD/YYYY` (en) and `ДД.ММ.ГГГГ` (ru), and ISO `YYYY-MM-DD` is accepted in both. Typed `.` or `/` separated values map month-first in en and day-first in ru; a valid date is redisplayed in the locale's short format, anything else stays as typed so the field can show an error. A "Calendar" button opens a 42-cell month grid (week starts Sunday in en, Monday in ru; outside-month days muted; selected day `aria-pressed`, accent fill). Keyboard: arrows move ±1 day and ±7 days across months, roving tabindex, Escape closes and returns focus to the input, choosing a day closes. Popover is level 2, min 280px; day names and buttons are localized.

### Combobox

Used for airports, airlines and aircraft. Matches code, label, detail and verified search aliases; an exact code match ranks first; with an empty query per-account recents come first; at most 50 rows. A polite status announces the count with real plural forms. Options are 44px with `<mark>` highlights (`--info-text` on `--surface-inset`, ≥4.5:1) and mono codes. Arrows move, Enter chooses, Escape closes.
- **Honest fallback labelling.** In Russian, aircraft and airline rows without a localized name show their English reference name with «Название на английском». English does not label its normal reference names as a translation fallback. Verified airport aliases remain searchable. Owner-scoped recents use local storage across tabs, with an in-memory fallback when storage is unavailable.
- **Desktop.** A level 2 popover under the input, max height 360px.
- **Mobile (≤700px).** A full-height search Sheet (`.flight-full-sheet`) with the search input pinned at the top (sticky) and focused on open; results scroll beneath. Close is labelled «Закрыть поиск». On close, focus returns to the origin field without reopening the list.

## Signature components

`Ticket` and `Stamp` live in `apps/next/src/client/signature/`. Ticket: level 1, radius `--radius-md`, route in mono 34/40 with a dashed perforation (stub beside the main block from 700px up), status pill, states upcoming, today, awaiting (accent border and 4px start rule) and logged. Lifecycle actions stay outside the decorative SVG, and essential labels are HTML at least 12px. Stamp: round for air, rectangular for land and sea, dashed ring for claims, an empty slot for pending, and rings by visits (1; 2–9; 10 or more); ink is normalized in OKLCH per theme (≥3:1 on the surface; neutral ink for black and near-white flags). Keep only Ticket and map code that has an actual consumer.

## Journal airline identity

**Built.** Each ledger flight number has a 48×24 airline mark. At 700px and below the mark, alliance and number occupy a full-width line below route/date/distance; the aircraft editor follows on its own line. Matched logos are pre-sized local PNG assets under `public/airlines`, referenced by `logoUrl` in the catalog; they preserve source colors and proportions and use the light logo plate in both themes. Missing or failed images show the theme-adjusted airline color, or `--mark-ghost` when the color is unknown. The flight number remains text, the open button names the airline, and the existing dated alliance mark remains independent. The shared catalog lookup and color adjustment live in `lib/airline.ts`. Sources are recorded in [the logo ledger](docs/research/2026-10-09-airline-logo-sources.csv).

## Overview redesign

**Built.** [Overview Release 3](docs/plans/2026-10-07-overview-release-3-ui.md) replaces the older Overview design. The eight sections, FilterBar and OverviewGlobe are built; final page assembly is complete. The production `/overview` route uses the new page, route skeleton and error boundary. Retired summary and missing-aircraft endpoints are removed; the older summary service remains only for the offline parity script. The new route contract uses owner-scoped data and preferences, keeps unavailable distinct from empty, and accepts a valid legacy bookmark year as an initial server seed only. The URL is not a live filter authority. Pending country derivation is labelled, with the all-time country figure identified as the last published total; focus and lifecycle revalidation use the same data store. An account with archived, claim or ground geography keeps its real country total even with no canonical flights. This section records source decisions, not deployment or visual verification. The dev fixture route is guarded to return 404 in production.

**Page and scope.** Next shows global upcoming flights independently of completed-flight filters. The globe and hero follow, then eight reorderable sections. Hero values are flights, kilometres, time in the air, countries and territories, and airports on desktop; mobile omits airports and shows four values. Estimated duration carries ≈ and an estimated-count caption. Comparable time periods show signed deltas against the previous equal-length period, preserving other facets; non-contiguous years have no fabricated comparison. With other facets and no period, figures show their share of the all-time baseline.

**One filter authority.** The account store owns filters, layout and replay pause, with one 800ms preference saver. Values within a facet are ORed and facets are ANDed over canonical logged/awaiting rows, using weights in aggregate mode. Facets are period, country, airport, airline, alliance at flight date, undirected route, aircraft, family, maker, body type, haul, domestic/international, departure band, departure hour, arrival hour and region. Years select whole years; month ranges include both endpoints. Country/region filters respect suppressed transit evidence; airport filters retain both endpoints. Unknown facet values remain removable and may yield zero results.

The globe’s top-left FilterBar measures actual wrapped controls into two rows, reserves the opposite corner and sends overflow to a +N control. A chip represents one facet, shows up to two values plus +N, and supports editing and removal. The searchable picker uses Popover on desktop and Sheet on mobile. The heading names the current scope. Chart actions and picker controls update the same store.

**Globe.** MapLibre is the only globe renderer. First paint reserves its viewport with a localized loading message; there is no SVG preview or fallback. WebGL2 admission loads MapLibre after mounting. Import, atlas, map or context errors show an unavailable message, with routes, airports and countries still available as a table. The camera fits the sphere to the viewport and refits on resize. The rim is a flat static 8px accent tint, with an explicit 1px hairline limb exception; it is neither glow nor an animated gradient. Country codes are promoted to feature IDs so scoped visit colors and ghost context remain attached to their countries.

Card corners hold filters, Fullscreen, replay transport and legend. The card and Fullscreen share one replay clock, with at most 12 planes; excess launches add arcs only, and admitted planes retain four-second tails. The scrubber spans calendar months, including gaps; playback skips idle intervals to the next launch once all active planes have finished, including at the loop boundary. Aggregates replay monthly without private flight IDs. The globe has no day/night shadow. Route geometry stays fixed during replay; launches update route opacity without rebuilding GeoJSON, and the country disclosure does not rerender on clock ticks. The scrubber labels years at about 44px each: on a narrow scrubber the first and last years stay and those between thin out evenly, so labels never overlap. Replay pauses offscreen, in a hidden tab and on identity retirement. Reduced motion never plays and uses static mid-arc plane glyphs. Camera changes take 600ms; reduced motion cuts instantly.

On a phone (≤700px) the globe card is a grid, not an overlay: Filter and Fullscreen on top, the globe as a square of up to 520px under them (300px on phones up to 480px wide, so the totals stay near the top), and the play controls and legend below, so no control sits over the sphere. Fullscreen keeps the overlay layout. The phone hero shows the totals first, then one shared trend note ("By month in the selected period") and the two sparklines under it, instead of a period caption on each.

The greeting reads "Hi, <name>" with the display name, falling back to the username; with neither it reads "Welcome back" (С возвращением), never a bare "Hi".

From a 2176px viewport (where the band reaches about 2080px; a media query, so the server's first paint is final), the country disclosure under the card gives way to a third card after the figures: Visits per country, the map's countries by visits with their legend bucket swatches, where a row toggles that country's filter (`aria-pressed`) and edge fades from scroll-state queries show that a long list scrolls. The row also grows to max(720px, min(42vw, 100svh − 260px)) so the globe fills more of its card. The figures card then fills that height with data: monthly sparklines as full-width rows under their figures and a year strip that takes the remaining height, with counts above its bars.

Fine-pointer wheel zoom is disabled on the card and enabled in Fullscreen. Coarse-pointer surfaces use `pan-y`; after a 10px axis decision, horizontal dragging spins longitude opposite the drag while vertical movement remains page scrolling. Two-finger gestures go to MapLibre. Corner controls preserve vertical page scrolling. These are source interaction contracts; no physical-device verification is implied.

**Bento and sheets.** Default order is Rankings, Records, Manufacturers, Fleet, Clock, Rhythm, Over time, Crossings. Overview shares a single gutter with the header and has a fluid shell capped at 2560px, while other routes retain their existing shell. When the section container is at least 1280px wide, sections flow through a two-lane masonry: each card spans the 4px rows its height needs, plus the 16px gap, and lands in the lane that frees up first. DOM order is the saved order, with no dense packing and no per-section widths. Below 1280px, including tablet (701–1023px), cards stack in one lane. Gated sections are compact: smaller padding and header gap. Charts draw in real CSS pixels and align left; count-driven charts keep their natural width, and controls keep capped widths instead of stretching across the card. Mobile (≤700px) uses whole-card tiles; Manufacturers stays full width. A tile's accessible name is its title and its visible preview ("14,535 km · Longest · DOH → AKL") is its description. On phones the hero hides the desktop review link, so the "3 to review" count in the Flights caption links to the review queue itself, with a 44px hit area. A tile opens the shared Sheet with an H2, previous/next controls and pager segments. Headers/tiles reorder through a 400ms coarse-pointer hold; 8px movement before activation cancels it, while a fine pointer activates at 4px. In two lanes a drop also reads the pointer's lane. Escape, pointer cancellation and identity changes stop dragging. Menu Move up/Move down/Hide is the keyboard alternative; Hidden sections can be restored. No divider hairlines separate these surfaces.

| Section | Built anatomy |
|---|---|
| Rankings | Actual airline/airport/route leaders, always shown. Two closed disclosures hold the analyses: "Rank by year and head to head" (the rank-by-year bump with matching dash cues, and Head to head comparative counts: Airbus/Boeing, shorter/long-haul and day/night) and "Airline shares" (with the previous-period comparison when one applies); excluded evidence stays explicit. |
| Records | A record cabinet with real distance/duration witnesses, route/date and provenance, northernmost airport, earliest departure and busiest year; route sketches support the evidence. |
| Manufacturers | Six fixed maker slots and a rounded-square waffle, with Flights/Distance/Time controls, visible counts and Unknown coverage/review cues. |
| Fleet | Narrow/wide body split plus family duration ridgelines using KDE in log-duration space; sparse observations keep their distinct treatment. Hover reads every sample; the arrow keys step one family at a time, stopping at its median ("typically N min"). Families without exact durations have no duration targets; unavailable/partial coverage retains family filter buttons. |
| Clock | Polar local-hour clock with Departures/Arrivals control, night band and explicit untimed coverage. |
| Rhythm | "When I fly": busiest month and longest gap, year/month heat grid with a Flights/Distance/Time control, plus actual completed-flight daily activity. Heat numbers use a per-bucket text token (`--heat-N-text`) for 4.5:1 on each fill. Legacy monthly summaries explicitly lack daily detail. |
| Over time | Cumulative flights/km step line with the Arc Brush as the page's period control and an exact-range readout. Equator-lap ticks and a next-landmark line (Moon, Moon and back) make the distance concrete. Legacy monthly summaries retain MonthRange controls and explicitly lack daily detail. |
| Crossings | Four counter tiles (clock shift, "UTC offsets": hourly endpoint offsets reached, equator and Arctic Circle) plus a year-shift ledger; offsets are not zones actually overflown. |

**Chart and data contract.** KuukiChart owns the locally adapted Arc SVG section charts and their tooltip/actions/table path. The host retains stable domain keys, native SVG keyboard selection and modal-scoped pinned touch actions. Rankings adds exact airline Donut shares and a distinct previous-period Slope alongside its multi-year bump; GlobeCard adds a region/country evidence Treemap; Hero adds immediate flight/km trend Sparklines. Micro-visuals and segmented bars use HTML/SVG; interactive segments are native buttons. Click or keyboard selection adds the applicable filter; each chart's description tells screen readers that arrow keys move between points and Enter filters. Keyboard entry focuses and describes the first available point; unpinned tooltips close when focus leaves the chart. Shift+F10 or a point’s context menu opens its actions, as described to screen readers. The first touch tap pins a tooltip with explicit Add filter/Open flight actions instead of filtering immediately. Visible values, legends, dashes and table rows provide alternatives to color. Section chart data has a View as table path; record evidence also has a table. Hero Sparklines expose localized month/value descriptions alongside immediate totals. Aggregate mode (more than 5,000 rows) carries null private IDs, hides Open flight, and uses a waffle unit of at least five, stated in its legend. Public summaries omit private flight IDs.

Threshold and coverage gates say how much evidence is present and what is needed, with applicable corrective actions. Missing reads never become fake data or confirmed zero. Charts below the fold mount behind fixed-height skeletons with a 200px observation margin. In-view charts use 1,100ms native SVG geometry transitions (Manufacturers reflows over 300ms); offscreen charts and reduced motion snap. Figures and chips remain instant. Captions are 15/24 Commissioner 600, normal case; mono is for routes/codes/times/ticks, and numbers are tabular. Dense controls are 32px visually with 44px coarse-pointer hit areas; browser-native controls and menus retain keyboard access.

**Range contract.** The local Arc Brush uses controlled UTC epoch drafts and native 44px keyboard/touch handles. Completion commits one exact day range; dragging does not write preferences. The brush is the page's period control, a dual-thumb overlay range whose thumbs sit on the selection edges. Typed dates live in the filter panel's Custom range, with Apply/Clear. Owner/filter changes discard an active draft. Legacy YYYY-MM preferences expand to inclusive whole months. Daily Activity never reconstructs day counts from legacy monthly rows.

**States.** First run retains a still globe and Import/Add CTA with a narrator, without figures or sections. Filtered zero keeps chips and ghost context, shows em-dashes in figures, and replaces sections with one narrator/action line (Remove last filter and Clear all). Unavailable remains a separate failure state with retry, not an empty journal.

**Narrator is a product pillar.** One deterministic, dry, data-backed EN/RU line at most per ready section foot or below-threshold placeholder, plus the dedicated first-run/zero/globe slots. It is Commissioner 15/24 400, `--text-muted`, max 60ch, without hairline, icon or quotes. Triggers respect coverage and thresholds; the same owner, scope and slot choose a stable variant. It never replaces facts, coverage or an instruction; an absence line (no date-line crossing) is only a fallback when nothing positive applies; tile captions stay factual. Russian uses «вы». The native Russian owner revision and narrator copy are approved; no visual audit is implied. Public narration must use summary evidence without exposing private IDs; the public presentation remains outside this release’s visual scope.

## Journal redesign

**Built (Journal redesign, source only):** the owner’s whole journal is loaded once; local filters and selection have their own store, and the URL mirrors the view. Default contents are logged and awaiting flights. Next up and the review pill ignore filters. Did not fly removes a flight through the shared six-second deferred delete with Undo; it is not a stored lifecycle state.

The approved [Journal spec](.scratch/journal-redesign/spec.md) takes precedence over older Journal styling and records these scoped exceptions:

- Only weights 400 and 500 inside Journal content, including titles and sheet headings. Size, spacing and mono route codes carry hierarchy. No eyebrow or lead paragraph, uppercase labels, airline tiles or row divider lines.
- Summary figures use the adapted Arc SlotText, extending the narrow text-feedback scope above. Facet and sort changes crossfade the result set over 150ms, using opacity only; search responds without a fade. Reduced motion swaps immediately. No row layout animation.
- A detail sheet docks as a 460px non-modal pane at 1280px and above, leaving the ledger interactive and hiding its Duration and Distance columns. Below that it reuses Sheet as a modal overlay; mobile uses the full-height flight sheet. Inline fields save independently and confirm in place, with Undo as secondary feedback.
- Firsts use a small Shu glyph with a named tooltip; the sheet spells out each first and its pending-confirmation status. Server computation uses the same country-evidence rules as Passport and ignores Journal filters.
- Journal loading uses a static skeleton in the final header, toolbar and ledger layout rather than LoadingScreen. Empty, no matches, offline, failed refresh and pending publication remain distinct states; failed refresh preserves loaded rows.
- Selection uses hover/focus checkboxes on desktop and a menu on mobile. The floating action bar supports all matching flights, export, protected aircraft filling, confirmation and deferred deletion without DestructiveConfirm. Manual flight and Passport deletion retain their existing mechanics.

Rows remain real DOM with `content-visibility: auto`. The server renders the first 60 rows; the remainder mount in transitions in batches of 150 under the measured performance fallback in the spec. This is progressive mounting, with no virtualizer or offline persistence.

## Copy and trust

Capture, auth, privacy, settings, errors, validation and destructive flows are calm and direct, with no humor. Wit is allowed only as a secondary line in non-critical empty states, achievements and insights, never replacing the instruction. The built Overview narrator is the approved exception: it appears in ready section feet, threshold placeholders and dedicated empty/filter/globe slots, and never replaces an instruction. Russian copy uses «вы»; no «ты» forms. Every string is written in RU and EN together with real plural forms (inline `{en, ru}` pairs or `locale-en` / `locale-ru` spans, plurals through the shared formatter), and must be checked at 320px and 200% text size; this is a design requirement, not a claim of visual verification for Overview Release 3.

"Nothing is stamped without you" is a precise rule, not an absolute promise: the one documented exception (D11) is that an awaiting flight is confirmed automatically seven days after it becomes date-eligible. Say so wherever the promise appears, for example in queue helper text. Never write "never" or "always" about stamping.

## Superseded

| Superseded | Replaced by |
|---|---|
| Glass, blur, grain, gradient buttons, glow | Solid levels 0–3 and flat accent fill. |
| Terracotta default accent (`#a94e35` / `#e6a184`) and red danger (`#a43535`) | Built Shu 朱 and crimson danger. |
| Journey UI and navigation | Removed (D7); `/journey` redirects to `/overview`. |
| Earlier single 空 navbar tile | Member くうき crossfade tile; loading retains static 空 and auth retains its text wordmark (see Logo mark). |
| Filled or heavier active-tab icon | Accent text, 600 label and a 2px accent bar. |
| Legacy `.button`, `.field`, and `.capture-confirm` | `Button`, `Field`, and `DestructiveConfirm`. Still used by unmigrated routes; new work uses the ui kit. Unused `.dialog-*`, `.period-switch`, and `.read-sheet` rules were removed. |

## Integrated journeys and evidence

Import's file source uses a selection-only adaptation of [Arc FileDropzone](https://uiarc.dev/components/file-dropzone), with a thumbnail, file size and labelled removal action. Members can choose, drop or paste one PDF/PNG/JPEG document up to 10 MB; clipboard ingestion accepts images through Cmd/Ctrl+V while the file source is active, and ignores text fields and pending recognition. Removal returns focus to the picker; previews remain local and their object URLs are revoked on replacement or unmount. Selection alone never submits a document.

Import aircraft review distinguishes AI claims about operated aircraft from scheduled equipment. Each offered model needs a matching dated flight identity and a source from search metadata; retrieved links are not independent verification. Scheduled proposals start unchecked. Source date, registration and operator are review context; accepting a proposal saves the aircraft type through the existing import flow.

Profile, leaderboard, Settings and entry/onboarding use their scoped modules alongside these primitives. Guests see the one-form auth card; authenticated Capture reuses the normal manual/import save authorities. Reveal reads canonical saved Tickets, preserves fulfilled reads during batch continuation and only presses new published countries. Future-only saves show booked Tickets.

Settings guards owned links, browser history and document exits while edits are unsaved. Next owns the restricted activation completion assets composed by the Worker; activation and reset share the get-back-in request card while retaining separate token authorities. Current transport and hosting guidance is in the [deploy procedure](docs/skills/deploy-kuuki/SKILL.md); the [candidate runbook](docs/runbooks/2026-10-04-next-release-candidate.md) retains historical release evidence. The [handoff](docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md) records current functional acceptance, carried dependencies and the explicitly deferred visual/atlas and release evidence. No visual or numeric audit acceptance is implied by these source contracts.
