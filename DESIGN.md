# Kuuki Design System 2.0

Kuuki is a personal flight journal with a restrained editorial character. Typography, whitespace, and the details of stamps and tickets carry the design. This document is the single authoritative design reference for the Next experience and supersedes conflicting color, font, glass, grain, and motion guidance elsewhere. The [Redesign 2.0 UX brief](docs/plans/2026-10-04-redesign-2.0-ux-ui.md) explains the experience decisions.

**Status labels.** Everything below describes what is built on `main` after PR #42 unless marked. **Planned (Wn/Tnn)** is documented intent not yet built; Wn/Tnn is the wave and task in the [implementation plan](docs/plans/2026-10-04-redesign-2.0-implementation.md). **Superseded** is older guidance that Redesign 2.0 replaced; the line says by what. **Planned (auth redesign)** is approved design from the Paper file [Kuuki — Auth redesign](https://app.paper.design/file/01M48F4SHK61AZS2FH5P5JPRY7) and its spec, [`.scratch/auth-one-form/spec.md`](.scratch/auth-one-form/spec.md). It is not built yet. **Proposed** is design work in that file that has not been approved. Where the brief and the code disagree, the code is recorded here and the brief's intent is noted.

## Color and surfaces

Use semantic CSS variables from [`apps/next/src/app/styles.css`](apps/next/src/app/styles.css); do not place palette literals in components. Light uses paper (`#fbfaf8`) and charcoal text (`#302d2a`); dark uses ink (`#292827`) and warm white text (`#f1efeb`). Terracotta is the accent in both themes. Text colors are separate from fills. Muted text must meet 4.5:1 contrast, control borders and focus must meet 3:1; do not fade text with opacity. `apps/next/src/app/tokens.test.ts` parses `styles.css` and checks these pairs. Hairlines are for structure, control borders for inputs and controls. In-flow cards use one subtle boundary and no shadow. Floating surfaces use a solid background and elevation. No glass, backdrop blur, glow, gradient buttons, or decorative grain.

Map fills use a sequential accent ramp and a titled legend with fixed buckets 1, 2–3, 4–9, 10+. Flag colors may inform stamp ink, never map fill. Claims must have a text and shape cue. Unknown legacy accent values map to terracotta and never overwrite status colors. Accents are set on `<html data-accent>` and stored by name; the picker is `SwatchPicker`.

| Accent | Light fill / text | Dark fill / text | Foreground (light / dark) |
|---|---|---|---|
| Terracotta (default) | `#a94e35` / `#97412a` | `#e6a184` / `#efae91` | `#fffaf6` / `#292827` |
| Ai | `#3f5c81` | `#a9c1df` | `#fff` / `#292827` |
| Matcha | `#4d6743` | `#b2cf9a` | `#fff` / `#292827` |
| Kincha | `#795c1e` | `#e6c57d` | `#fff` / `#292827` |
| Sakura | `#8c4c65` | `#e7aac1` | `#fff` / `#292827` |
| Sumi | `#4a4641` | `#d0cbc5` | `#fff` / `#292827` |

For non-terracotta accents `--accent-text` equals `--accent` and `--focus` follows the fill. Kincha and Sakura use white foreground in light and dark foreground in dark, matching the canonical token contrast checks and the aligned brief. `--swatch-<name>` mirrors each fill for the picker dots. The picker is built in Settings and the dev gallery.

**Planned (auth redesign): five accents.** Kincha and sumi are removed. A stored `kincha` or `sumi` in the `kuuki_accent` cookie becomes `terracotta` the first time it is read, in both `bootstrap.js` and the appearance client. The bootstrap map of legacy localStorage color names changes so that nothing resolves to a removed accent: yellow becomes terracotta, and teal and cyan become asagi. Asagi is new. The board aims for matched lightness, vividness at brand level, and hues at least 20° from the nearest status color. Values come from board "4.2 Spec — accent proposal":

| Accent | Light fill / text | Dark fill / text | Foreground (light / dark) | Distance from status hue |
|---|---|---|---|---|
| Terracotta (default) | `#a94e35` / `#97412a` | `#e6a184` / `#efae91` | `#fffaf6` / `#292827` | unchanged |
| Ai | `#4e5ea2` | `#acbbef` | `#fff` / `#292827` | 22° from info |
| Matcha | `#59702a` | `#b7ce92` | `#fff` / `#292827` | 25° from success |
| Asagi (new, 浅葱) | `#0c747d` | `#85cfd8` | `#fff` / `#292827` | 45° from info |
| Sakura | `#964969` | `#e8a9c0` | `#fff` / `#292827` | 30° from danger |

The board gives one value per accent for fill and text. As now, `--accent-text` equals `--accent` for every accent except terracotta. `tokens.test.ts` must still pass the 4.5:1 and 3:1 pairs with these values; the boards do not prove contrast.

## Type and layout

Self-hosted Onest ([`apps/next/public/fonts`](apps/next/public/fonts), variable 100–900) is the Cyrillic-capable UI and display face; JetBrains Mono is for ticket codes, flight numbers, times, table dates, and handles. OFL licenses ship beside the font files. Changing and aligned numbers use tabular figures. Headings wrap with `balance`, paragraphs with `pretty`. Use locale-aware EN/RU dates, numbers, and real plural forms (one/few/many/other in Russian). Russian copy addresses the user as «вы».

| Style | Built value | Where |
|---|---|---|
| Display | No single token. Landing H1 `clamp(44px, 7vw, 80px)` / 1.05, −0.035em; hero stat `clamp(64px, 12vw, 120px)` / 1; figure strip `clamp(28px, 4vw, 48px)` | `styles.css`, `reads.css` |
| H1 | 30/36, 600, −0.02em | global `h1` |
| H2 | 22/28 (panel titles 600) | global `h2`, `.ui-panel-title` |
| H3 | 17 (line height inherits 24) | `.read-panel h3`, ticket prompt 17/24 600 |
| Body | 15/24, 400, antialiased | `body` |
| Small | 13/20 | hints, errors, switch descriptions, ticket meta |
| Caption / eyebrow | 12/16; eyebrow 600, uppercase, +0.06em, `--text-muted` | `.eyebrow`, tab labels, menu labels |

The brief's Display 44/48 is the landing floor, not a fixed size. Global `h2` sets size, line height and weight 600.

The shared header and page container align at `--content-width` 1200px. Gutter `--page-gutter` is 24px, 16px at 700px and below (the one shell breakpoint). Spacing uses a 4px base; read sections gap 48px desktop and 32px mobile. Cards fit content instead of matching heights. Radii: 6px small internal chips, 10px controls, 14px cards/popovers/menus, 20px dialogs, sheets and the auth card. An inner radius must account for container padding (menu 14px minus 4px padding gives 10px items).

## Interaction and states

Navigation stays available while private data streams in. Every data surface distinguishes loading, empty, partial, error, and ready states; route `loading.tsx` files render the [loading screen](#loading-screen). Never present an unavailable read as a confirmed empty journal. Links and controls have visible 2px offset focus rings (`--focus`) and 44px touch targets. Press feedback is 120ms scale to 0.96 except static rows and cards; hover styles apply only to fine pointers. Disabled actions explain why in visible text, not a `title`. Use Lucide icons with text labels; color alone does not signal active state. Capture, authentication, privacy, and destructive copy is calm and direct.

After a route change focus moves to `main h1` (`RouteFocus`); only the pathname or a mode key (`/onboarding?step`, `/passport?view`) triggers it, never filters or search text.

System theme is the default for new users. Preserve an explicit light/dark choice, map supported legacy settings, and keep EN/RU and theme consistent with the first usable page (`public/bootstrap.js` sets theme, locale and accent before paint). Client persistence uses same-origin cookies; private app data and authorization are never cached in shared shells.

## Decisions

Frozen by the Redesign 2.0 plan (D1–D12). Lifecycle and import details live in the ADR under `docs/adr/`.

| ID | Decision |
|---|---|
| D1 | Guests see the landing page at `/`; auth uses `/signin` and `/signup`. **Planned (auth redesign):** `/`, `/signin` and `/signup` all render the one-form [auth card](#auth-card), and members are still redirected. The landing hero, sample flight cards and FAQ are removed. |
| D2 | Six named accents: Terracotta (default), Ai, Matcha, Kincha, Sakura, Sumi. Store the name, never an arbitrary color. **Planned (auth redesign):** five accents, Terracotta (default), Ai, Matcha, Asagi and Sakura; kincha and sumi map to terracotta. |
| D3 | System theme by default; an explicit saved preference is preserved. |
| D4 | Light neutrals are barely warm; dark uses charcoal. |
| D5 | Typeface chosen by RU/EN specimen; Onest confirmed (see Typeface decision). |
| D6 | Russian copy uses «вы» everywhere. |
| D7 | Journey UI and navigation are removed; a bookmarked `/journey` redirects to `/overview` (built). |
| D8 | Overview has a period control only; Journal owns all detailed filters. |
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
| `--hairline` | `#dedad5` | `#554f4a` | Structural dividers and card edges only. |
| `--control-border` | `#837b74` | `#958b82` | Input, checkbox, select and switch borders; ≥3:1 on the surface. |
| `--accent` / `--accent-text` / `--accent-foreground` / `--focus` | see accent table | | Fill; links and active nav ≥4.5:1; text on the fill ≥4.5:1; 2px ring, 2px offset, ≥3:1. |
| `--accent-hover` | `color-mix(in oklch, accent 82%, text)` | same | Primary hover fill; derived. |
| `--success-text` / `--success-fill` | `#146d34` / `#2a904b` | `#76c788` / `#4eb068` | Text grade ≥4.5:1; fill grade for backgrounds and icons, never text. |
| `--warning-text` / `--warning-fill` | `#824c00` / `#ae6700` | `#e1a263` / `#cf8634` | Same rule. |
| `--info-text` / `--info-fill` | `#175d9b` / `#2b7ec9` | `#73b6fa` / `#4c9deb` | Same rule; `--info-fill` also highlights search matches. |
| `--danger-text` / `--danger-fill` | `#a43535` / `#c74b47` | `#ffaaa5` / `#ea6a64` | Same rule; danger buttons are outlined in `--danger-text`. |
| `--rank-gold` / `-silver` / `-bronze` | `#775800` / `#595e64` / `#8a4b24` | `#d5b36a` / `#b2b8bf` / `#eca57d` | Text grade ≥4.5:1; always paired with the rank number. |
| `--surface-floating` | `--surface` | `#3c3a37` | Level 2 and 3 fill. |
| `--shadow-floating` / `--shadow-modal` | two-layer black 8% / 10–12% | none | Dark theme drops the shadow. |
| `--ring-floating` | none | `0 0 0 1px` white 8% | Dark replacement for the shadow. |
| `--scrim` / `--outline-media` | black 40% / black 10% | black 60% / white 10% | Modal backdrop; 1px outline on images and avatars. |
| `--map-land` / `--map-border` / `--map-route` | `--surface-inset` / `--hairline` / `--accent` | same | Map base layers; follow theme. |
| `--map-bucket-1…4` | `color-mix(in oklch, accent 24 / 43 / 65 / 90%, map-land)` | same | Sequential ramp, bucket 1 lightest; thresholds 1, 2–3, 4–9, 10+ from one shared function. |

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
| `--font-sans` / `--font-mono` | Onest, system-ui / JetBrains Mono, ui-monospace | Text; ticket data only. |
| `--font-kana` | Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, Yu Gothic, then `--font-sans` | The 空 tile and the くうき watermarks; system stack, no webfont. |

Runtime variables set by the shell and primitives, not for authoring: `--tabbar-offset`, `--toast-bottom-offset`, `--action-bar-bottom` (mobile, derived from the tab bar and safe area; zeroed while the keyboard is open), `--sheet-drag`, `--sheet-kb`, `--n` (segmented option count).

**Z-index scale** (literals in the CSS, lowest to highest): tab bar 30 (`--z-tabbar`), floating action bar 40, overlay 50, dialog and sheet 51, combobox and calendar popovers 55, menu 60, toast 70, skip link 100. Overlays therefore sit above the tab bar, and menus above the dialog that hosts them. Legacy `.capture-confirm` (90) remains on an unmigrated surface and is superseded by DestructiveConfirm. The unused `.read-sheet` rules were removed.

Motion tokens: see Motion.

## Typeface decision

Onest is confirmed (frozen earlier by the architecture session; the specimen is confirming evidence, not a re-opened choice). The specimen in [`docs/design/font-specimen.html`](docs/design/font-specimen.html) compares Onest, Golos Text and Manrope on real RU/EN navigation, field, airport-route, numeral and plural strings (screenshot: `docs/design/font-specimen.png`). In the specimen, Onest renders the Cyrillic strings, tabular numerals (0123456789, 141 255 км) and IATA codes beside city names cleanly, without fallback glyphs or clipping of «Авиакомпании». Golos Text and Manrope load from Google Fonts for the specimen only and are never shipped.

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

Tokens: `--ease-out` cubic-bezier(.23,1,.32,1) for enter/exit and press; `--ease-in-out` cubic-bezier(.77,0,.175,1) for on-screen movement (height, segmented thumb); `--ease-drawer` cubic-bezier(.32,.72,0,1) for sheets; `--ease-icon` cubic-bezier(.2,0,0,1) for icon crossfades (defined, no consumer yet). Durations: `--dur-press` 120ms, `--dur-fast` 150ms, `--dur-base` 200ms, `--dur-sheet` 300ms, `--dur-moment` 450ms (rare delight only).

Rules: ease-in is banned; exits use ease-out and run about 20% faster than enters; never `transition: all`; animate transform, opacity and sparingly filter; height disclosure uses grid rows 0fr→1fr; no bounce on routine UI; content present on first render does not animate in; no count-up from zero.

| Never animates | Built animation |
|---|---|
| Route and tab changes (focus moves to H1), except the three [route transitions](#route-transitions) below; keyboard actions, filter/sort/period changes, ambient loops (the planned auth plane field is the one exception), WindLoader, glow pulses | Press scale 0.96 120ms (`data-static` excluded); hover color 150ms on fine pointers; segmented thumb 200ms `--ease-in-out`; menu 150ms in (scale .97) and 120ms out; dialog 200ms in (scale .96) and 150ms out, scrim 200/150; sheet 300ms `--ease-drawer` with handle drag; disclosure 300ms rows plus 150ms opacity; toast 300ms in, 200ms out; switch 200ms; tab bar slide off for the keyboard 200ms; stamp press 450ms; the three route transitions |

### Route transitions

Only three route changes animate, through `@ssgoi/react` 7.4.0 in `apps/next/src/client/route-transitions.tsx`. Every other navigation keeps its page boundary and swaps instantly: tabs, header nav, `?view=`, filters and sheets (flight detail, `/add`). The springs are critically damped, so nothing bounces, and the times below count until ssgoi ends the spring. Focus still moves to the incoming H1, and the outgoing page is inert and `aria-hidden` until it settles.

- **Import done → Passport, `hero`, about 0.38s.** The done-step stamps (`data-hero-exit-key`) travel to their Passport stamps (`data-hero-enter-key`) without replaying the press. It runs forward only and for at most 8 stamps; with more, Passport opens without it. A Passport stamp that will not be fully on screen has no partner and appears in place. On a phone the Passport cover keeps the stamps below the fold, so there they all appear in place. If Passport has not finished loading when the member opens it, it shows its loading screen and opens without the hero.
- **Leaderboard → `/fly/[username]`, `drill`, about 0.28s.** The default parallax, reversed by Back, with no hero. Forward redoes it. A link from a profile to the leaderboard, Back onto a profile and Forward over that link stay instant. Back is read from the Navigation API; in a browser without it, Back and Forward never drill.
- **Sign in ↔ sign up ↔ forgot password, `axis` x, about 0.28s.** Only the form panel swaps, as a fade-through: the incoming form starts once the outgoing one is 75% gone. The card and the brand panel stay put. **Planned (auth redesign):** this transition goes away along with the separate pages. The create step slides in place inside one card (see [Auth card](#auth-card)), and recovery states reuse the card with its top pinned. Under reduced motion the create step swaps without sliding.

Additional motion contracts:
- **Planned (W5/T25):** icon swap by scale, opacity and blur 200ms with `--ease-icon`; tooltip 150ms with instant adjacent tooltips (no tooltip component exists); skeleton to content 150ms. Today loading is the static [loading screen](#loading-screen).
- **Built (T14):** newly found import rows enter over 200ms with 40ms stagger; Done summary chunks stagger 100ms. Reduced motion uses a 150ms fade with no delay.
- **Planned (W3/T13):** arrival confirm: stamp press onto the ticket stub, then card collapse 250ms `--ease-in-out`.
- **Built (T21):** three-step deletion uses a 250ms height transition where intrinsic-size interpolation is supported and a 150ms content fade; reduced motion keeps steps static.
- **Built (T19/T23):** first-achievement notification enters once over 600ms (150ms fade under reduced motion). Onboarding Reveal caps newly published stamps at eight with 80ms stagger; reduced motion removes the delay.
- **Planned (auth redesign), replacing W5/T22's "at most 3 planes":** the auth brand panel's plane field. It is the one ambient loop allowed. The field has 30 planes on desktop (12 small, 10 medium and 8 large, with sizes shuffled across x) and 14 in the mobile brand band. Each plane moves along (+400, −800) with transform only. Each is rotated −18.4° (atan2(−800, 400) + 45°), so its nose points along the path. The field pauses when it is off screen (IntersectionObserver) or the tab is hidden. Planes stay clear of the wordmark, and the くうき watermark sits behind them. Under reduced motion the planes freeze in the frame the boards draw. Today the brand panel is static.
- **Planned (auth redesign):** the rotating tagline is picked once per page load and shown only on the form and create steps. Under reduced motion it swaps text without sliding.
- **Planned (auth redesign):** the Horizon theme toggle moves its sun 50% of the viewBox over 500ms with `cubic-bezier(0,0,0.15,1)`; see [Auth card](#auth-card).
- Sheet drag-release spring bounce (0.1–0.2 at most) is optional and not built; release settles with `--ease-drawer`.

Delight moments use `--dur-moment`. The built `Stamp` press starts from scale 1.06, opacity 0, blur 2px, with a one-frame brightness darkening, and plays once per immutable ID (module `Set` plus `sessionStorage`) so remounts and refetches never replay it. Onboarding applies the 80ms stagger and cap of eight to newly published country acknowledgments. Reveal shows at most eight stamps and links to Passport for the complete collection; refetches and historical evidence do not replay the first-save moment.

Reduced motion means gentler, not none. Built in `ui.css`: no scale or translate, color and opacity at 150ms linear; dialog and menu fade; sheet and toast fade (drag still works); thumb, disclosure and chevron static; stamp press becomes a 200ms fade; the tab bar does not slide; the three route transitions swap instantly, like every other route change.

## Iconography

Lucide only, one SVG per icon, `currentColor`. Stroke 1.5 beside regular text, 2 beside semibold text (nav labels, buttons). Every icon built so far sits beside semibold labels or is a control, so all use stroke 2 (tab bar 22px; add actions, close buttons 20px; split Add, disclosure, toast 18px; the swatch check 2.5). No decorative icon discs. Icons accompany text labels.

Active state never relies on color alone: accent text, label weight 600, and a 2px accent bar (underline on desktop nav, top edge on the tab bar) plus `aria-current="page"`. **Superseded:** the brief's filled or heavier active icon; the bar replaced it.

**Logo mark.** One stable mark: the kanji 空 (from 空気, *kuuki*) on a filled `--accent` tile with an `--accent-foreground` glyph, set in `--font-kana` (no webfont). The tile is 32px with radius `--radius-sm` and a 600 18px glyph. The loading screen scales it to 48px with a 24px glyph. It replaces the brief's suggested く, which reads as a back chevron in every Japanese face, so the mark is never a back button. The wordmark is the tile plus a lowercase "kuuki" (19px, 600) and links home. The vertical くうき word stays on the auth brand panel; the editorial profile includes its watermark. The brief's glyph crossfade for the boot screen is not built.

**Planned (auth redesign): text wordmark.** A wordmark with no tile replaces the 空 tile: "Ku" in `--accent-text` and "uki" in `--text`, so it follows the accent and the theme. It uses Onest 700 at −0.04em, with font size equal to line height: 36px on the desktop auth brand panel and 28px in the mobile auth header. It is one element with `aria-label="Kuuki"`; the two spans are visual only. The spec replaces the tile on auth surfaces. The accent-picker boards also draw it in the app header at 22px (Proposed). Nothing decides yet what replaces the 空 tile on the loading screen. Board "1.1" sets the brand-panel wordmark at −0.05em; the build notes and the spec say −0.04em, and the spec wins.

## Shell and navigation

One breakpoint at 700px switches between desktop and mobile. The header and tab bar sit outside the single `<main id="main" class="page-shell">`; a skip link precedes them. `BrandShell` (guests) shows the wordmark, sign-in and sign-up links, and the language/theme controls; `MemberShell` adds navigation.

**Desktop (above 700px).** Header 56px, solid `--background`, hairline bottom border, content aligned to 1200px. Left: wordmark, then Overview, Journal, Passport, Leaderboard (Обзор, Журнал, Паспорт, Рейтинг). Links are 44px high, radius `--radius-sm`, hover `--surface-inset`; active is `--accent-text`, 600, with a 2px accent underline inset 12px. Right: queue slot, split Add, avatar menu.
- **Split Add.** Accent fill, `--control-h-sm` tall, radius `--radius-sm`. The main half is a link to `/add` (manual entry); the chevron half opens a Menu with Upload a boarding pass or PDF, Paste text, Enter manually. One shared list (`ADD_ACTIONS`) feeds this menu and the mobile sheet. The brief names two items; the built menu has three.
- **Avatar menu.** A 40px circle button using the shared profile photo or reactive blob fallback, ringed by `--outline-media`. Menu: My profile (with Public or Hidden status), Public profile checkbox (turning it off also leaves leaderboards), Settings, Theme radios (Light, Dark, System), Language radios (EN, RU), Sign out. Accent selection is in Settings.

**Mobile (700px and below).** Header 48px with the current page title and queue slot; the split Add and avatar menu are hidden. A fixed bottom tab bar replaces the nav (`<nav aria-label="Tabs">`):
- **Layout.** `--tabbar-h` 56px plus the safe-area inset, `--background`, hairline top border, five equal columns: Overview, Journal, Add, Passport, Me (Я). Leaderboard is reached from Me and the desktop nav; Settings leaves the tab bar.
- **Tabs.** Icon 22px stroke 2 above a 12/16 label (11px at 360px and below), `--text-muted`; press fills `--surface-inset`. Active is `--accent-text`, 600, with a 2px accent bar on the top edge.
- **Add** is a button, not a link: it opens a bottom Sheet titled "Add a flight" holding the three `AddActions` as 52px (`--action-row-h`) rows with 20px icons. The sheet closes on any route change.
- **Me** is active on `/me` and the viewer's own `/fly/<username>`, never another member's.
- **Keyboard.** When the visual viewport is more than 120px shorter than the layout (and not pinch-zoomed) `html[data-keyboard=true]` slides the bar off-screen while it stays in the DOM and focus order, and resets the offsets below. With `resizes-content` viewports the flag may not fire; the bar then rides above the keyboard.
- **Clearance.** `--tabbar-offset` (bar plus safe area) pads the page bottom (+24px); toasts lift by `--toast-bottom-offset`; the floating action bar sits at tab bar plus 16px.

**Queue badge.** `QueueSummarySlot` reads the owner-scoped `AwaitingProvider` and links to `/journal?queue=awaiting`. Its localized accessible name separates flights awaiting confirmation from retained import rows needing review. A zero count is hidden; an initial transport failure says Queue unavailable rather than zero. The header and Add menu/sheet share this authority. Mobile headers display the current page title.

### Loading screen

`LoadingScreen` is the route loading state for Overview, Journal, Passport and Import: the 48px logo mark, a localized status line («Загрузка…» / "Loading…") in `--text-muted`, 48px vertical padding, `role="status"`. One stable mark, no spinner, no motion, so reduced motion needs no variant. The older `.loading` and `.placeholder` blocks in `styles.css` remain on unmigrated pages.

### Auth card

**Planned (auth redesign).** One card with one form: Email, Password and Continue, with no sign-in/sign-up switch. The server decides the outcome. A matching account signs in. A wrong password shows the error state (board "1.4"). An email with no journal turns the card into the create step (board "1.2") in place and keeps both fields. Flows, endpoints, copy and focus rules are in the [spec](.scratch/auth-one-form/spec.md). This section records the visual contract. Read exact values from the boards through the Paper MCP, and map them to tokens.

- **Card, desktop.** 1040×620, radius `--radius-lg`, centered on `--background`. Light: `--surface` with a 1px `--hairline`. Dark: `--surface` with the 1px inner top highlight (white 5%). The brand panel on the left is 420px wide with 40px padding. Its fill is `--surface-inset` in light and `#2f2d2b` in dark. The form panel has 48px top and 64px side padding, and its form column is 360px wide.
- **Brand panel.** The wordmark sits top left. Behind it, the vertical くうき watermark is set at 164px, weight 700, in the accent fill at 13% opacity. It is decorative and hidden from assistive tech. On top is the [plane field](#motion).
- **Form column.** The heading is H1 (30/36, 600, −0.02em, balanced), followed by a 15/24 `--text-muted` subtitle 6px below. Groups are 28px apart and fields 16px apart. Labels are 13/20 at weight 500, which differs from the built Field label's 600; settle this before building. Inputs are 44px tall with radius `--radius-sm`, 14px inline padding and a `--control-border` border; their dark fill is also `#2f2d2b`. The primary button is full width and 44px tall. "Can't sign in?" is a 13/20 500 `--accent-text` link at the end of the Password label row. Under the form, the tagline is 13/20, +0.01em, centered and `--text-muted`.
- **Error state.** The input border turns `--danger-text`, and the focus ring stays outside it (2px surface gap, then 2px `--focus`). Below the input sits a 16px Lucide alert icon and 13/20 text, both in `--danger-text`. An outlined secondary button, "Email me a link to get back in", with a mail icon, follows before Continue. Every error has an icon and text.
- **Utility controls.** These sit top right, each 44×44: language (globe and code), the Horizon theme toggle, the accent trigger (a 14px `--accent` dot) and help. Icons are 16px in `--text-muted`.
- **Horizon theme toggle.** Built from the Horizon paths of [toggles.dev](https://toggles.dev) (`@theme-toggles/react`, MIT) as a small Kuuki component with an attribution comment, not the package component. The icon is 16px in a 32×32 viewBox, both paths filled with `--text-muted`. In light the sun is fully up. In dark the sun moves down 50% to sit half below the horizon. The whole icon shifts up 4.5px in dark and 0.5px in light for optical centering. Both moves take 500ms with `cubic-bezier(0,0,0.15,1)` and are instant under reduced motion. The toggle shows the theme in effect and switches to the opposite theme on click. Until then, the preference stays `system`. `aria-pressed` is true in dark, and the label is always "Dark theme" / «Тёмная тема». Settings and the avatar menu keep their current theme controls.
- **Hit areas.** The reveal button is 40×40 inside the field. Text links grow to about 44px tall through padding and an equal negative margin. "Can't sign in?" grows up and sideways only, never over the password input.
- **Mobile (≤700px).** A brand band sits on top: dark `--background`, 364px tall on board "3.2", holding a 52px header with the 28px wordmark and the utility controls, a horizontal くうき watermark at 104px and 14 planes. The form is in a bottom sheet: `--surface`, top corners `--radius-lg`, padding 28px top, 20px sides and 46px bottom. Its heading is 28/34, and inputs and the primary button are 48px tall with 16px text, so iOS does not zoom on focus. In light the sheet has a `--hairline` top edge; in dark, the white 6% inner highlight.
- **Getting back in.** The Request, Check your inbox, Set password and Link expired states (boards "2.1" to "2.4") reuse the card with its top pinned. They have no tagline. Mobile shows them in the same sheet.

The dark brand-panel and input fill `#2f2d2b` sits between `--background` and `--surface` and has no token. Add a role-named token in `styles.css` instead of a literal.

### Accent picker

**Proposed, not approved.** The redesign of the accent picker runs separately from the auth spec in the same Paper file (boards "5.1" and "5.5"–"5.7"). Direction A, "Wordmark tiles": each choice is a radio tile showing "Ku" in the accent's text color over a strip of its four passport-map shades. In Settings the tiles are 28px "Ku" at radius `--radius-md`. The selected tile has a 2px `--text` border and a check. One caption below names the selected accent with a one-line note, such as "Asagi 浅葱 — The blue-green of young leek." In the desktop header, a 44×44 accent trigger with a 14px dot sits beside Horizon. It opens a level 2 popover, 304px wide, aligned to the end with an 8px offset, holding a theme row and 20px mini tiles. Opening the popover focuses the selected tile. Changes apply at once, the caption is `aria-live=polite`, and under reduced motion the popover fades in 150ms with no scale. Color tokens never transition. The mobile sign-in board ("5.7") instead uses 24px swatch dots in 44px radios. Choose one pattern before building.

## Primitives

Shared controls live in [`apps/next/src/client/ui/`](apps/next/src/client/ui/) with styles in `ui.css` (tokens only, no literal colors) and `flight-controls.css`. They build in hit areas, press feedback, hover gating and focus rings. The dev-only [gallery](apps/next/src/app/dev/gallery/gallery.tsx) at `/dev/gallery` (`?theme=dark&locale=ru`) exercises each in both themes and locales and returns 404 in production.

| Primitive | Behavior |
|---|---|
| Button | Variants primary (flat accent), secondary, ghost, danger (outlined `--danger-text`). 44px min height, padding 10/18, radius `--radius-sm`, 600. `dense`: 32px visual, hit area to 40px (44px coarse); keep neighbors 8px apart (12px coarse). `loading`: static `loadingLabel` text, no spinner, width kept, `aria-busy`. `disabledReason`: uses `aria-disabled`, so the button stays focusable, and shows 13/20 helper text beneath. `static`: no press scale. |
| Field | Label 600, optional marker, 13/20 hint, 44px input with `--control-border`, `aria-invalid` turns the border `--danger-text`. The error line reserves 20px so errors never shift layout. |
| Dialog | Level 3, width `min(520px, 100vw − 32px)`, max height `min(100dvh − 48px, 680px)`, radius `--radius-lg`. Pinned header (22/28 title, 44px close) and footer (hairline top); the body scrolls. Focus lands on the title or `initialFocusRef` and returns to the trigger. `dismissible=false` blocks Escape, outside click and the close button while an action is pending. **Add dialog:** desktop manual add uses `.flight-add-dialog`, `min(560px, 100vw − 32px)`. |
| Sheet | Radix dialog. `side="bottom"` on mobile, `"right"` (width `min(460px, 100vw)`) on desktop; radius `--radius-lg` on exposed corners. The handle is the only drag surface (bottom: 40×4 grip in a 28px strip; right: 20×64 tab on the left edge), so body scroll and text selection stay native. Release dismisses past 35% of the sheet size or faster than 0.11 px/ms (measured over about 100ms); dragging against the open direction rubber-bands to 80px. A visible close button is the keyboard alternative. **Keyboard inset:** the bottom sheet follows `visualViewport` (skipped while pinch-zoomed), setting `--sheet-kb` as its bottom offset and max height; past 80px it drops the footer's safe-area padding. Focus lands on the title or `initialFocusRef`. **Full-height variant** `.flight-full-sheet`: height `100dvh − --sheet-kb`, radius 0, used by mobile add, flight detail and combobox search. |
| Menu | Radix dropdown, level 2, radius `--radius-md`, min 200px, max `min(320px, 100vw − 16px)`, items radius `--radius-sm` at 40px (44px coarse). Check and radio items, uppercase 12px labels, separators, `danger` variant. Collision-aware with 8px padding; origin follows the trigger. |
| SegmentedControl | Radio-group semantics: one tab stop, arrows move and select, Home/End jump. Equal cells (min 104px) wrap into rows at 320px; 3px padding, container `--radius-md`, thumb `--radius-sm` sliding 200ms. 44px cells. |
| SwitchRow | 44×26 switch with a 44px hit area, label, description, a consequence line in `--text`, and a disabled reason. Disabled stays visible. |
| SwatchPicker | Radiogroup of the six accents (five once the auth redesign lands; it follows the list), 44px pills with 28px dots and localized names; arrows move and select; writes the name through `setAccent`. |
| Disclosure | Trigger 44px, chevron rotates 200ms; rows 0fr→1fr over 300ms. Collapsed content is `inert` and hidden. Used for optional flight details. |
| Toast | Level 2, radius `--radius-md`, width `min(420px, 100%)`, bottom-centered; bottom-right at 24px from 700px up. Kinds info, success, error: Lucide icon with a screen-reader label and a 4px fill-grade left border on success and error. Errors announce assertively, others politely. Auto-dismiss 5s, errors 8s, 0 persists; pauses on hover, focus and hidden tab. Message states the outcome. `ShellNotices` mounts one owner-scoped `ToastProvider` in the member shell, so notices survive client navigation; `ToastSlot` places a caller-owned notice (the Journal's pending-delete Undo) in the same region. |
| FloatingActionBar | Level 2 sticky bar, radius `--radius-md`, region with a polite pluralized count. Sticks above the safe area and the tab bar (`--action-bar-bottom`) without pushing content. Journal uses it for selected-row deletion and clear-selection actions. |
| DestructiveConfirm | Dialog composition. Title names the object, body states the consequence, confirm is verb plus object. Cancel has initial focus; pending shows static text and blocks dismissal; a rejected action stays open with an `alert` message; an optional typed phrase disables confirm with a visible reason. Manual flight deletion, Journal bulk deletion and Passport country evidence removal share this composition. |

### Calendar

A typeable date field, not a picker-only control. The input is text with `inputMode="numeric"`; placeholder and hint are `MM/DD/YYYY` (en) and `ДД.ММ.ГГГГ` (ru), and ISO `YYYY-MM-DD` is accepted in both. Typed `.` or `/` separated values map month-first in en and day-first in ru; a valid date is redisplayed in the locale's short format, anything else stays as typed so the field can show an error. A "Calendar" button opens a 42-cell month grid (week starts Sunday in en, Monday in ru; outside-month days muted; selected day `aria-pressed`, accent fill). Keyboard: arrows move ±1 day and ±7 days across months, roving tabindex, Escape closes and returns focus to the input, choosing a day closes. Popover is level 2, min 280px; day names and buttons are localized.

### Combobox

Used for airports, airlines and aircraft. Matches code, label, detail and verified search aliases; an exact code match ranks first; with an empty query per-account recents come first; at most 50 rows. A polite status announces the count with real plural forms. Options are 44px with `<mark>` highlights (`--info-fill`) and mono codes. Arrows move, Enter chooses, Escape closes.
- **Honest fallback labelling.** In Russian, aircraft and airline rows without a localized name show their English reference name with «Название на английском». English does not label its normal reference names as a translation fallback. Verified airport aliases remain searchable. Owner-scoped recents use local storage across tabs, with an in-memory fallback when storage is unavailable.
- **Desktop.** A level 2 popover under the input, max height 360px.
- **Mobile (≤700px).** A full-height search Sheet (`.flight-full-sheet`) with the search input pinned at the top (sticky) and focused on open; results scroll beneath. Close is labelled «Закрыть поиск». On close, focus returns to the origin field without reopening the list.

## Signature components

`Ticket` and `Stamp` live in `apps/next/src/client/signature/`. Ticket: level 1, radius `--radius-md`, route in mono 34/40 with a dashed perforation (stub beside the main block from 700px up), status pill, states upcoming, today, awaiting (accent border and 4px start rule) and logged. Lifecycle actions stay outside the decorative SVG, and essential labels are HTML at least 12px. Stamp: round for air, rectangular for land and sea, dashed ring for claims, an empty slot for pending, and rings by visits (1; 2–9; 10 or more); ink is normalized in OKLCH per theme (≥3:1 on the surface; neutral ink for black and near-white flags). Keep only Ticket and map code that has an actual consumer.

## Copy and trust

Capture, auth, privacy, settings, errors, validation and destructive flows are calm and direct, with no humor. Wit is allowed only as a secondary line in non-critical empty states, achievements and insights, never replacing the instruction. Russian copy uses «вы»; no «ты» forms. Every string is written in RU and EN together with real plural forms (inline `{en, ru}` pairs or `locale-en` / `locale-ru` spans, plurals through the shared formatter), and checked at 320px and 200% text size.

"Nothing is stamped without you" is a precise rule, not an absolute promise: the one documented exception (D11) is that an awaiting flight is confirmed automatically seven days after it becomes date-eligible. Say so wherever the promise appears, for example in queue helper text. Never write "never" or "always" about stamping.

## Superseded

| Superseded | Replaced by |
|---|---|
| Glass, blur, grain, gradient buttons, glow | Solid levels 0–3 and flat accent fill. |
| Journey UI and navigation | Removed (D7); `/journey` redirects to `/overview`. |
| く logo mark | 空 tile (see Logo mark). The auth redesign plans to replace the tile with a text wordmark. |
| Filled or heavier active-tab icon | Accent text, 600 label and a 2px accent bar. |
| Legacy `.button`, `.field`, and `.capture-confirm` | `Button`, `Field`, and `DestructiveConfirm`. Still used by unmigrated routes; new work uses the ui kit. Unused `.dialog-*`, `.period-switch`, and `.read-sheet` rules were removed. |

## Integrated journeys and evidence

Profile, leaderboard, Settings and entry/onboarding use their scoped modules alongside these primitives. The guest landing labels sample Ticket/Stamp/profile data; authenticated Capture reuses the normal manual/import save authorities. Reveal reads canonical saved Tickets, preserves fulfilled reads during batch continuation and only presses new published countries. Future-only saves show booked Tickets.

Settings guards owned links, browser history and document exits while edits are unsaved. Activation remains a restricted static completion asset composed by the Worker; password recovery is separate. Their transport and hosting authorities are linked in the [release runbook](docs/runbooks/2026-10-04-next-release-candidate.md). The [handoff](docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md) records current functional acceptance, carried dependencies and the explicitly deferred visual/atlas and release evidence. No visual or numeric audit acceptance is implied by these source contracts.
