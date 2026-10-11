# Onboarding morph — design values (extracted from Paper)

Source: Paper file `01M48F4SHK61AZS2FH5P5JPRY7` ("Kuuki — Auth redesign"), page `p-1-0`. Values come from get_jsx (inline-styles), not screenshots. All boards are LIGHT theme, Shu accent #C23417. Fonts: Commissioner (UI body/headings), Onest (wordmark, locale label), JetBrains Mono (labels, data, stamps), Noto Sans JP (kana).

Board node ids (for re-reading): 15.1 HF9-0, 15.2 HJE-0, 15.3 HMB-0, 15.4 HOT-0, 15.5 HRU-0, 15.6 HY5-0, 15.7 I0W-0, 15.8 I48-0, 15.9 I6T-0, 15.10 IAO-0. Break boards ids are listed in each section heading.

## 0. Shared across the desktop 15.x boards

- Artboard 1440x900 (15.5 is 1440x1108), bg #FBFAF8 (--background), flex column, centred, `overflow: clip`, `overflow-wrap: anywhere`.
- **Card**: 1040 x 620 (15.5: width 1040, height fit-content, artboard has padding-block 64px), bg #FFFFFF, border 1px #DEDAD5, radius 20px, display flex row, overflow clip.
- **Left panel**: 420px wide, flex-shrink 0, full height, bg #F2F0ED (--surface-inset), padding 40px, flex column.
  - Wordmark top-left: "Ku" #C23417 + "uki" #302D2A, Onest 700, 36px / 36px, letter-spacing -0.04em, baseline-aligned, no gap.
  - Below wordmark: a flex-grow column, `align-items: center`, `justify-content: center`, gap 20px, padding-top 8px, containing the passport object then a caption (15.5 differs: `justify-content` start, padding-top 64px, caption has padding-bottom 40px).
  - Caption: Commissioner 13px / 20px, weight 400, letter-spacing 0.01em, #66605B.
- **Right panel**: flex 1 (flex-basis 0), full height, `position: relative`, column, centred; padding-inline 64px, padding-top 48px (15.1–15.4). Form column inside is `position: relative`, widths: 360px (15.1), 400px (15.2–15.4), 440px (15.5).
- **Top-right toolbar** (all desktop boards): absolute right 28px, top 36px, row. Items each 44px high, radius 10px:
  - Locale: padding-inline 12px, gap 6px, Lucide `Globe` 16px stroke #66605B 1.75, text "EN" Onest 500 13px/20px #66605B.
  - Theme: 44x44, sun glyph (custom 32-viewBox svg) 16px #66605B.
  - Accent: 44x44, 14x14 circle #C23417.
  - Help: 44x44, Lucide `CircleHelp` 16px #66605B (stroke 1.75).
- Heading style (h1): Commissioner 600, 30px / 36px, letter-spacing -0.02em, #302D2A. Gap h1 -> sub 6px.
- Sub copy: Commissioner 400, 15px / 24px, #66605B.
- Primary button: height 44, radius 10, bg #C23417, label Commissioner 600 15px/24px #FFFFFF. Padding-inline 16 (inside prompt tray, full width), 20 (paste), 24 (footer save). Gap icon->label 8px, icon 16px.
- Text link / quiet action: Commissioner 500 14px/20px; accent link #C23417, muted link #66605B.
- Mono data row text: JetBrains Mono 13px/20px.

### Passport states used on the left (see each board)
| Object | Board(s) | Size |
|---|---|---|
| Closed cover | 15.1 | 216 x 300 |
| Open spread | 15.2, 15.3, 15.4 | 330 x 228 |
| Open spread, tall | 15.5 | 330 wide, flex-grow height, max-height 760 |

---

## 15.1 Onboarding — name (desktop)  [HF9-0]

### Left: closed passport cover
- 216 x 300, bg #C23417, radius: TL 10 / BL 10 / TR 14 / BR 14. Padding: top 34, bottom 26, inline 22. Column, `justify-content: space-between`, align centre.
- Box-shadow (3 layers): `inset 6px 0 0 #0000001F` (spine), `0 1px 0 #302D2A14`, `0 18px 32px -18px #302D2A73`.
- Top group (gap 6, centred):
  - "FLIGHT JOURNAL" JetBrains Mono 500, 10px/14px, letter-spacing 0.28em, #F7E9E4.
  - "くうき" Noto Sans JP 13px/16px (weight default 400), letter-spacing 0.4em, #F7E9E4, opacity 0.85.
- Centre emblem: 64x64 SVG (viewBox 64): circle r29 stroke #F7E9E4BF 1.25 no fill; circle r22 stroke #F7E9E473 dasharray "2 3"; plane path `M20 38 L44 26 M39 25.5 L44 26 L41.5 30.5 M27 34.5 L24 29 M33 31.5 L31 40`, stroke #F7E9E4 1.5 round caps/joins.
- Bottom group (gap 4, centred):
  - "HOLDER" JetBrains Mono 9px/12px, letter-spacing 0.24em, #F7E9E4, opacity 0.7.
  - **Name printing**: Commissioner 600, 20px/26px, letter-spacing -0.01em, #FFFFFF, drawn as `Alex Mor` (typed so far) + a caret: 1.5 x 20 white bar, flex gap 2px. Single line in the mock (no ellipsis rule visible here; see 16.x for long names).
- Caption under cover (gap 20): "Your passport, printing as you type." (13px muted).

### Right: form (width 360, column gap 28)
- Heading block (gap 6): h1 "What should we call you?"; sub "It goes on your passport. Your journal stays private until you share it." (15/24 #66605B).
- Field group (gap 6):
  - Label "Your name": Commissioner 500 13px/20px #302D2A.
  - Input: height 44, radius 10, bg #FBFAF8, border 1px #302D2A (focused), padding-inline 14, gap 1px; focus ring box-shadow `0 0 0 2px #FFFFFF, 0 0 0 4px #C23417`. Value "Alex Mor" Commissioner 400 15px/24px #302D2A; caret 1.5 x 18 #302D2A.
  - URL preview row (gap 6, padding-top 2): Lucide `Lock` 14px stroke #66605B 1.75; text `kuuki.marchstudio.uk/fly/alex-mor` JetBrains Mono 12px/18px #66605B.
- Button "Continue": full width, height 44, radius 10, bg #C23417, label white 600 15/24.

---

## 15.2 Onboarding — first flight, agent first (desktop)  [HJE-0]

### Left: open passport spread, empty
- Spread: 330 x 228, bg #FFFFFF, border 1px #DEDAD5, radius 8, shadow `0 18px 32px -20px #302D2A66`. Two pages each `round(50%,1px)` wide with a 6px gutter (#F6F4F1) between.
- Left page: padding 18 block / 16 inline, column, `space-between`:
  - "HOLDER" label JetBrains Mono 9/12, ls 0.24em, #66605B; value "Alex Morgan" Commissioner 600 16px/22px #302D2A (group gap 4).
  - "FLIGHTS" label (same style); value "0" JetBrains Mono 500 22px/28px #302D2A.
  - MRZ line `P<KUU<MORGAN<<ALEX<<<` JetBrains Mono 9px/12px, ls 0.06em, #837B74.
- Right page: padding 16, wrap, gap 12, `justify-content: center`, `align-content: center`. Four empty stamp slots: 56x56 circles, border 1.25px dashed #C9C3BC, no fill.
- Caption: "Stamps land here as flights come in."

### Right: form (width 400, column gap 24)
- h1 "Where have you flown, Alex?"
- Sub: "ChatGPT, Claude or Gemini can read your email and calendar. Give it this prompt and it finds every flight for you."
- **Prompt tray**: bg #F2F0ED, radius 12, overflow clip, column.
  - Prompt window: height 112, padding 16 top / 16 inline / 4 bottom, gap 2, overflow clip. Text JetBrains Mono 12px/18px #302D2A, pre-wrap, verbatim (3 lines):
    1. `Search my email and calendar for every flight I have taken or booked, across all years.`
    2. `Start your reply with the line KUUKI FLIGHTS v2, then one flight per line:`
    3. `YYYY-MM-DD | origin → destination | airline and flight number | departure-arrival`
  - Fade overlay at bottom: absolute, height 48, gradient 180deg from transparent to the tray colour at 90% (`oklab(95.6% .0009 .004)` = #F2F0ED).
  - Tray footer: padding 8; contains primary button full width (see shared): Lucide `Copy` 16px white stroke 1.75, label "Copy prompt".
- Paste hint row (gap 12, align start): key chip + text.
  - Key chip "⌘V": height 24, padding-inline 7, border 1px #DEDAD5, radius 6; JetBrains Mono 12px/16px #302D2A.
  - Text: Commissioner 400 14px/22px #302D2A: "Paste the reply anywhere on this page. A boarding pass, PDF or screenshot works too: just drop it here."
- Bottom row (space-between, padding-top 4):
  - Left link (gap 6): Lucide `PenLine`/pen 16px stroke #C23417 1.75 + "Type a flight in" Commissioner 500 14px/20px #C23417.
  - Right link: "I’ll do this later" (typographic apostrophe U+2019) 500 14px/20px #66605B.

---

## 15.3 Onboarding — back from the assistant, paste (desktop)  [HMB-0]

Left panel: identical to 15.2 (open spread, FLIGHTS 0, 4 dashed empty slots, caption "Stamps land here as flights come in.").

Right (width 400, gap 24):
- h1 "Now paste the reply"
- Sub: "Copy what your assistant wrote and paste it anywhere here. We read it the moment it lands."
- **Paste zone**: height 188, radius 14, bg #FBF4F1, border 1.5px dashed #C23417, column centred, gap 14.
  - Icon: Lucide `ClipboardCheck` 28px, stroke #C23417, stroke-width 1.5.
  - Button "Paste from clipboard": height 44, padding-inline 20, radius 10, bg #C23417, label white 600 15/24 (no icon).
  - Helper "or press ⌘V anywhere · drop a file": Commissioner 13px/20px #66605B.
- Status row (space-between):
  - Left (gap 8): Lucide `Check` 16px stroke #3F6B2A (off-token success green) stroke-width 2; "Prompt copied" 14px/20px #302D2A.
  - Right (gap 20): "Copy again" 500 14/20 #C23417; "I’ll do this later" 500 14/20 #66605B.

---

## 15.4 Onboarding — reading flights, safe to leave (desktop)  [HOT-0]

Left: open spread with progress. FLIGHTS value "23" (JetBrains Mono 500 22/28). Right page stamps (56x56 circles, border 2px solid, rotated, contents column centred):
| Stamp | Colour | Rotation | Opacity | Text |
|---|---|---|---|---|
| 1 | #C23417 | -9deg | 1 | JPN / 2019 |
| 2 | #4E5EA2 | 7deg | 1 | PRT / 2021 |
| 3 | #59702A | -4deg | 0.55 | GEO / 2023 |
| 4 | dashed #C9C3BC 1.25px, empty | 0 | 1 | |
Stamp text: country code JetBrains Mono 600 13px/15px; year JetBrains Mono 400 8px/10px, ls 0.08em, same colour as border. Caption: "A stamp for every new country."

Right (width 400, gap 24):
- h1 "Reading your flights"
- Counter line (baseline, gap 8): "23" JetBrains Mono 500 15/24 #C23417 + "found so far, 6 countries" Commissioner 15/24 #66605B.
- **Live list** (column, gap 2, padding-block 10): rows height 32, gap 14, align centre; columns: date (92px, JetBrains Mono 13/20 #66605B), route (120px, 13/20 weight 500 #302D2A), flight number (flex, 13/20 #66605B). Rows (top to bottom) with fade opacity 1, 1, 0.6, 0.3:
  1. `2023-10-02` `IST → TBS` `TK 378`
  2. `2023-09-28` `LIS → IST` `TK 1760`
  3. `2021-06-14` `LHR → LIS` `TP 1351` (opacity 0.6)
  4. `2019-04-03` `LHR → HND` `JL 42` (opacity 0.3)
- **Safe-to-leave note**: bg #F2F0ED, radius 12, padding 14 block / 16 inline, gap 10, align start. Lucide `Clock` 18px stroke #302D2A 1.75 (margin-top 2). Text 14px/22px #302D2A: "You can close this tab. We keep reading, and your flights wait here for review next time you sign in."
- "Finish later": right-aligned, 500 14/20 #66605B. Gap between note and link 16.

---

## 15.5 Onboarding — review, tall card (desktop)  [HRU-0]  (1440 x 1108)

Artboard padding-block 64. Card height fit-content (content-driven), 1040 wide.

### Left: tall open spread (flex-grow, max-height 760, 330 wide), padding-top of wrapper 64, caption below
- Left page (padding 20 block / 16 inline, column, gap 28): stat groups, each label (JetBrains Mono 9/12, ls 0.24em, #66605B, gap 4) + value:
  - HOLDER / "Alex Morgan" (Commissioner 600 16/22)
  - FLIGHTS / "41" (JetBrains Mono 500 26px/32px)
  - COUNTRIES / "9" (26/32)
  - DISTANCE / "182,410 km" (JetBrains Mono 500 18px/24px)
  - SINCE / "2016" (18/24)
- Gutter 6px #F6F4F1.
- Right page: padding 22 block / 14 inline, wrap, `align-content: start`, column-gap 12, row-gap 14. **Stamps 60x60** (border 2px, rotated; code 13px/15px 600; year 8px/10px **no** letter-spacing):
  JPN 2019 #C23417 -9deg; PRT 2021 #4E5EA2 7deg; GEO 2023 #59702A -3deg; TUR 2023 #0C747D 11deg; DEU 2025 #964969 -6deg; GBR 2016 #302D2A 4deg; USA 2018 #4E5EA2 -12deg; ESP 2017 #C23417 8deg; ITA 2020 #59702A -5deg; then one dashed empty slot 60x60.
- Caption "9 countries. The passport grows with you." (13px muted, in a wrapper with padding-bottom 40).

### Right (width 440, column gap 28; panel column gap 40, padding-top 128; no horizontal padding on panel — footer spans full width)
- h1 "41 flights. Check 3."
- Sub: "Everything else looks right. Fix what’s unsure, or leave it out."
- **Unsure cards** (column gap 10). Each: bg #F7EEDC (--warning tint), radius 12, padding 14 block / 16 inline, column gap 12. Header row (gap 14, align centre): date 92px (mono 13/20; #66605B normally, **#824C00 when the date is the problem**), route 132px (mono 13/20 weight 500 #302D2A), flight (flex 1, mono 13/20 #66605B), issue tag right (`margin-left: auto`): Commissioner 600 12px/16px, ls 0.02em, #824C00.
  1. `2022-03-11` `London → LIS` `TP 1333` tag "Which London?"; chip row (gap 8): airport chips height 32, padding-inline 12, radius 8, bg #FFFFFF, border 1px; text JetBrains Mono 13/20. Selected `LHR`: border #C23417, text #C23417, weight 500. Unselected `LGW` `STN` `LTN`: border #DEDAD5, text #302D2A, weight 400.
  2. `2018-??-??` (date text #824C00) `LHR → JFK` `BA 117` tag "Day missing"; row (gap 8, align centre): date input width 180, height 36, radius 8, bg #FFFFFF, border 1px #837B74 (--control-border), padding-inline 12, space-between; placeholder `2018-__-__` mono 13/20 #66605B; Lucide `Calendar` 14px stroke #66605B 1.75. Then text button "Leave out" (padding-left 8) Commissioner 500 13/20 #66605B.
  3. `2024-12-20` `MUC → ORD` `LH 430` tag "Maybe cancelled"; two buttons (gap 8), height 32, padding-inline 12, radius 8, bg #FFFFFF, border 1px #DEDAD5, label Commissioner 500 13/20 #302D2A: "I flew it", "Leave out".
- **Looks-right group** (column gap 6): header row (gap 8, padding-bottom 4): Lucide `Check` 14px stroke #3F6B2A w2; "Looks right" Commissioner 600 13/20 #302D2A; count "38" mono 13/20 #66605B. Rows: height **34**, padding-inline 16, gap 14; date 92 / route 132 / flight flex; same mono 13/20 styles. Seven rows shown (no dividers):
  `2025-08-30 TBS → MUC LH 2557`, `2025-08-14 MUC → TBS LH 2556`, `2024-05-02 HND → LHR JL 43`, `2024-04-18 LHR → HND JL 42`, `2023-10-02 IST → TBS TK 378`, `2023-09-28 LIS → IST TK 1760`, `2021-06-14 LHR → LIS TP 1351`.
  Then row height 40, padding-inline 16: link "Show all 38" Commissioner 500 14/20 #C23417.
- **Sticky footer**: width 100% of right panel, bg #FFFFFF, shadow `0 -10px 24px -16px #302D2A40`, padding 16 top / 20 bottom / 88 inline, row space-between, gap 16.
  - Left: "2 still unsure" Commissioner 600 14/20 #302D2A; "Saving leaves them out." 13/20 #66605B.
  - Right: primary button, padding-inline 24, label "Save 39 flights".

---

## 15.6 Onboarding — narrator reveal, then dissolve (desktop)  [HY5-0]

Card 1040 x 620 as usual (no padding-block on artboard).

### Left: open spread with the WELCOME entry stamp landing on it
- Spread 330 x 228 (`position: relative`). Left page: HOLDER "Alex Morgan"; FLIGHTS "39" (mono 500 22/28); MRZ line. Right page: four 56x56 stamps (gap 12, centred): JPN 2019 #C23417 -9deg; PRT 2021 #4E5EA2 7deg; GEO 2023 #59702A -4deg; TUR 2023 #0C747D 10deg (year ls 0.08em on first three; TUR year has none).
- **Entry stamp (WELCOME)**: absolute, left 62, top 84, `rotate: -8deg`, transform-origin 0 0 (top-left), bg #FFFFFFB8 (white 72%), border 2.5px solid #C23417, radius 6, padding 8 block / 14 inline, column centred gap 2:
  - "KUUKI · ENTRY" JetBrains Mono 600 10px/12px, ls 0.3em, #C23417
  - "WELCOME" Commissioner 700 22px/26px, ls 0.06em, #C23417
  - "11 OCT 2026" JetBrains Mono 400 10px/12px, ls 0.2em, #C23417 (date format: DD MON YYYY uppercase; it is today's date)
- Caption: "Stamped. The card fades into your journal."

### Right: narrator reveal (width 400, column gap 36)
- Text block (gap 18):
  - Eyebrow: "YOUR JOURNAL IS OPEN" JetBrains Mono 400 12px/16px, ls 0.18em, #C23417
  - Narrator headline: `39 flights since 2016, and London still can’t get rid of you.` Commissioner 600 **34px/42px**, ls -0.025em, #302D2A
  - Stats sub-line: `9 countries, 182,410 km. Two flights left out; add them anytime from your journal.` Commissioner 15/24 #66605B
- Button "Open my journal" + arrow: full width (400), height 44, radius 10, bg #C23417, gap 8, label white 600 15/24, Lucide `ArrowRight` 16px stroke white w2.

---

## Mobile shared frame (15.7–15.10 and all 16/17.14+/18/19 mobile boards)

- Artboard **390 x 844** (some 320 wide), bg #F2F0ED, flex column, overflow clip.
- Status bar mock (9:41, 17px system-ui 600, signal/wifi/battery svg) is a MOCKUP ARTIFACT, not product UI: padding 21 top / 19 bottom / 24 inline.
- **Top zone** (bg #F2F0ED, padding-bottom 16, flex-shrink 0):
  - Header row: height 52, padding-left 19, padding-right 6, space-between. Wordmark Onest 700 **28px/28px**, ls -0.04em (Ku #C23417, uki #302D2A). Toolbar: same four 44px items (EN, theme, accent dot, help), no absolute positioning. (Header row is absent on 15.9 and 15.10: status bar then the strip directly, strip has padding-top 4.)
  - **Passport strip**: row, gap 14, padding-inline 20, padding-top 8 (15.7, 15.8) or 4 (15.9, 15.10); contents:
    - **Mini cover**: 44 x 60, bg #C23417, radius TL 4 / BL 4 / TR 6 / BR 6, inset shadow `3px 0 0 #0000001F`, centred emblem 22x22 SVG (viewBox 64): circle r29 stroke #F7E9E4 2.5; plane path `M20 38 L44 26 M39 25.5 L44 26 L41.5 30.5` stroke #F7E9E4 3 round.
    - Holder block (column gap 2): "HOLDER" JetBrains Mono 9/12 ls 0.24em #66605B; name Commissioner 600 **18px/24px** #302D2A (+ caret 1.5x18 #302D2A when typing).
    - Right block (column, `align-items: end`, flex-grow, margin-left auto, gap 2): label 9/12 ls 0.24em #66605B; value JetBrains Mono 500 18px/24px #302D2A.
- **Sheet** (bottom): bg #FFFFFF, radius top 20/20, shadow `0 -1px 0 #DEDAD5` (hairline on top edge only), flex-grow, column, padding-inline 20.

---

## 15.7 Onboarding — name (mobile)  [I0W-0]

- Strip: holder "Alex Mor" + caret; no right-hand stat block. Header row present.
- Sheet: padding-top 32, padding-bottom 46, gap 24. Inner column gap 28.
  - h1 "What should we call you?" Commissioner 600 **28px/34px**, ls -0.02em
  - Sub "It goes on your passport. Your journal stays private until you share it." 15/24 #66605B
  - Label "Your name" 500 13/20
  - Input: **height 48**, radius 10, bg #FBFAF8, border 1px #302D2A, padding-inline 14, focus ring `0 0 0 2px #FFFFFF, 0 0 0 4px #C23417`; text **16px**/24 (iOS no-zoom size) "Alex Mor"; caret 1.5x18.
  - URL row: Lucide `Lock` 14 + `kuuki.marchstudio.uk/fly/alex-mor` mono 12/18 #66605B
  - Button "Continue": full width, height **48**, radius 10, label 600 **16px**/24.

## 15.8 Onboarding — first flight, agent first (mobile)  [I48-0]

- Strip: header row present; holder "Alex Morgan" (no caret); right block "FLIGHTS" / "0".
- Sheet: padding-top 32, bottom 46, inner gap 22.
  - h1 "Where have you flown, Alex?" (28/34)
  - Sub "ChatGPT, Claude or Gemini can read your email and calendar. Give it this prompt and it finds every flight." (shorter than desktop: ends "finds every flight.")
  - Prompt tray (bg #F2F0ED, radius 12, clip): window height **92**, padding-top 14, padding-inline 14; text mono 12/18 #302D2A, no line breaks, verbatim: `Search my email and calendar for every flight I have taken or booked, across all years. Start your reply with the line KUUKI FLIGHTS v2…` (ends with ellipsis char); fade overlay height 40. Tray footer padding 8, button "Copy prompt" height 48, label 600 16/24, Lucide `Copy` 16 white.
  - **Secondary (outline) button**: full width, height 48, radius 10, border 1px #837B74, bg transparent, gap 8; Lucide `Download` 16px stroke #302D2A 1.75; label "Paste or add a boarding pass" Commissioner **500 16px**/24 #302D2A.
  - Link row (space-between): "Type a flight in" 500 15/22 #C23417; "I’ll do this later" 500 15/22 #66605B; each wrapped with padding-block 11 (44px touch target).
- No ⌘V key hint on mobile.

## 15.9 Onboarding — review, sheet full height (mobile)  [I6T-0]

- Strip: right block "FLIGHTS · COUNTRIES" / "41 · 9" (mono 500 18/24). No header row.
- Sheet: padding-top 24, `position: relative`, inner column gap 20 (sheet gap 24).
  - h1 "41 flights. Check 3." (28/34), gap to sub 4. Sub "Fix what’s unsure, or leave it out." (shorter than desktop).
  - Unsure cards column gap 8; card bg #F7EEDC, radius 12, padding 12 block / 14 inline, gap 10. Card header: route mono 500 **14px/20** #302D2A left; tag Commissioner 600 12/16 #824C00 right (no letter-spacing on mobile). Meta line: `2022-03-11 · TP 1333` mono 12/18 #66605B. Order and content differ from desktop:
    1. `London → LIS`, tag "Which London?", meta `2022-03-11 · TP 1333`; chip row gap 8: 4 equal-width chips (flex-grow) **height 44**, radius 8, bg white, border 1px; `LHR` selected (border #C23417, text #C23417, 500) then `LGW` `STN` `LTN` (border #DEDAD5, text #302D2A); chip text mono 14/20.
    2. `MUC → ORD`, tag "Maybe cancelled", meta `2024-12-20 · LH 430`; two equal buttons "I flew it", "Leave out": height 44, radius 8, border #DEDAD5, white, label Commissioner 500 15/20 #302D2A.
    3. `TBS → IST`, tag "Day missing" (no meta line); date input flex-grow height 44, radius 8, border #DEDAD5, white, padding-inline 12, text `2019-06-__` mono 14/20 **#837B74**; beside it button "Leave out" (padding-inline 16, height 44, same outline style).
  - "Looks right" header: Lucide `Check` 14 #3F6B2A; "Looks right" 600 13/20; "38" mono 13/20 #66605B; padding-bottom 6. Rows height 34, gap 12: date 96px mono 13/20 #66605B, route flex-grow mono 13/20 500 #302D2A, flight mono 13/20 #66605B (no padding-inline; rows align to sheet padding). Three rows drawn: `2025-08-30 TBS → MUC LH 2557`, `2025-08-14 MUC → TBS LH 2556`, `2024-05-02 HND → LHR JL 43` (list continues below the fold, clipped by sticky footer).
  - **Sticky footer** (absolute bottom/left/right 0): bg white, shadow `0 -10px 24px -16px #302D2A4D`, padding 14 top / 34 bottom / 20 inline, gap 12, row. Left (flex-grow): "2 still unsure" 600 14/20 #302D2A; "Saving leaves them out." 13/18 #66605B. Right: button height 48, radius 10, padding-inline 20, label "Save 39" 600 16/24 white (shorter than desktop "Save 39 flights").

## 15.10 Onboarding — narrator reveal (mobile)  [IAO-0]

- Strip: HOLDER "Alex Morgan"; right block "FLIGHTS · COUNTRIES" / "39 · 9".
- Sheet content (padding-top 24 + inner padding-top 24, gap 28):
  - **WELCOME stamp, inline** (not overlaid on a spread): `width: fit-content`, border 2px solid #C23417, radius 6, padding 10 block / 16 inline, `rotate: -6deg`, column centred gap 2, transparent bg. Lines: "KUUKI · ENTRY" mono 10/14 ls **0.14em**; "WELCOME" Commissioner 700 **18px/22px** ls 0.06em; "11 OCT 2026" mono 10/14 ls 0.14em; all #C23417.
  - Text block gap 12:
    - Eyebrow "YOUR JOURNAL IS OPEN": mono **11px/16px**, ls 0.14em, **#66605B** (muted on mobile, accent on desktop)
    - Headline `39 flights since 2016, and London still can’t get rid of you.` Commissioner 600 **28px/34px**, ls -0.02em, #302D2A
    - Sub `9 countries, 182,410 km. Two flights left out; add them anytime from your journal.` 15/24 #66605B
- Bottom pinned (absolute, left/right/bottom 0, padding 14 top / 34 bottom / 20 inline, gap 10): button "Open my journal →" (the arrow is a text glyph here, not an icon), height 48, radius 10, label 600 16/24; below, centred note "Stamped. The sheet fades into your journal." Commissioner 12/16 #837B74.

---

# 16.x Break boards — name step

All 16.x boards reuse the 15.1 (desktop, 16.14–16.18) or 15.7 (mobile, 16.1–16.13) layout and copy; only the differences are listed. Common copy on all: h1 "What should we call you?", sub "It goes on your passport. Your journal stays private until you share it.", label "Your name", button "Continue", caption (desktop) "Your passport, printing as you type.", URL row `kuuki.marchstudio.uk/fly/<slug>`. No EN/RU pair exists here: **only EN is drawn on every 16–19 board** (locale chip reads "EN"); RU exists only on 19.9 / 19.7 (see section 19).

**Overall caveat**: the long/unbreakable-name boards (16.1, 16.3, 16.14, 16.15) show the UNRESOLVED behaviour of the plain layout (text wraps without clamp; overflow is visible). The JSX has no `text-overflow`, `line-clamp` or `max-width` on any name node (`white-space: pre-wrap`, `overflow-wrap: anywhere` on the artboard). They document the problem; the implementation must define the truncation rule (see the "How it renders" notes).

**Slug rules demonstrated**: ASCII name -> lowercase hyphenated (`Alex Mor` -> `alex-mor`); Cyrillic is transliterated (`Александра Константинопольская` -> `aleksandra-konstantinopolskaya`); CJK and Arabic have no usable letters -> random `pilot-xxxx` fallback (`田中美咲` -> `pilot-7k3q`, `محمد الفارسي` -> `pilot-9x2m`); emoji are stripped (`Sam ✈️🔥` -> `sam`); a 40-char single word is kept whole; very long name slug keeps the full hyphenated name (no truncation drawn, 3 to 30 characters rule is in 16.13 copy, so the 16.1/16.14 slug of 100+ chars contradicts the 30-char limit: flag).

## 16.1 Break name — very long name (mobile)  [IDJ-0]
- Name typed: `Alexandra Konstantinopolskaya-Vandenberghe de la Fontaine of the Northern Isles and Beyond` (89 chars).
- Slug shown: `kuuki.marchstudio.uk/fly/alexandra-konstantinopolskaya-vandenberghe-de-la-fontaine-of-the-northern-isles-and-beyond` (mono 12/18, wraps to 3 lines, lock icon vertically centred).
- Strip name (Commissioner 600 18/24 #302D2A): wraps to **3 lines** (`Alexandra Konstantinopolskaya-` / `Vandenberghe de la Fontaine of the` / `Northern Isles and Beyond`), the strip grows taller (HOLDER label sits higher), caret trails the 2nd line, mini cover stays 44x60 vertically centred.
- Input (height 48, 16px text, 24px lh): text wraps to 3 lines and is clipped top and bottom inside the 48px box (visible defect: text overflows the field). The URL row shifts down; the sheet content moves down by ~26px vs 15.7.

## 16.2 Break name — single letter (mobile)  [IFA-0]
- Name `A`, slug `kuuki.marchstudio.uk/fly/a`. Strip HOLDER `A` + caret. Otherwise identical to 15.7. (Shows that a 1-char slug is drawn as valid here, while 16.13 copy says 3 to 30 characters.)

## 16.3 Break name — unbreakable 40 chars (mobile)  [IH1-0]
- Name `Abcdefghijklmnopqrstuvwxyzabcdefghijklmn` (40 chars, no spaces), slug `kuuki.marchstudio.uk/fly/abcdefghijklmnopqrstuvwxyzabcdefghijklmn`.
- Strip: breaks mid-word at `overflow-wrap: anywhere` into 2 lines (`Abcdefghijklmnopqrstuvwxyzabcd` / `efghijklmn`), caret at right edge of line 1 area.
- Input: wraps to 2 lines (`Abcdefghijklmnopqrstuvwxyzabcdefghijkl` / `mn`), caret pinned to right edge of field, text fits roughly within 48px but cramped. Slug wraps in 2 lines.

## 16.4 Break name — Cyrillic (mobile)  [IIS-0]
- Name `Александра Константинопольская`, slug `kuuki.marchstudio.uk/fly/aleksandra-konstantinopolskaya`. Layout as 15.7 (fits one line in strip? name is 30 chars at 18px 600; drawn single line wrapping as the strip allows). No extra copy.

## 16.5 Break name — CJK (mobile)  [IKJ-0]
- Name `田中美咲`, slug `kuuki.marchstudio.uk/fly/pilot-7k3q` (fallback `pilot-` + 4 random base36 chars).

## 16.6 Break name — emoji (mobile)  [IMA-0]
- Name `Sam ✈️🔥`, slug `kuuki.marchstudio.uk/fly/sam` (emoji dropped from slug, kept in the name on the strip).

## 16.7 Break name — RTL Arabic (mobile)  [IO1-0]
- Name `محمد الفارسي`, slug `kuuki.marchstudio.uk/fly/pilot-9x2m`. The mock keeps LTR layout (strip left-aligned, caret to the right of the glyph run); the input text is rendered by the Arabic font in the same LTR box. Page direction is NOT mirrored; only the text runs RTL. Flag: no `dir="auto"` behaviour is explicitly drawn.

## 16.8 Break name — empty, Continue disabled (proposed) (mobile)  [IPS-0]
- Strip holder shows the placeholder `Your name` in **#66605B** (Commissioner 600 18/24) with caret.
- Input empty with placeholder `e.g. Alex Mor` (Commissioner 400 16/24, **#66605B**), caret, focus ring still shown.
- Slug row `kuuki.marchstudio.uk/fly/your-name`.
- **Disabled button**: height 48, radius 10, bg **#DEDAD5** (hairline token), label "Continue" Commissioner 600 16/24 **#66605B**, full width.

## 16.9 Break name — saving (proposed) (mobile)  [IRJ-0]
- Name `Alex Mor`, slug `.../fly/alex-mor`.
- Button: bg #C23417 at **opacity 0.7**, height 48, label **"Saving…"** (ellipsis char U+2026) white 600 16/24. No spinner drawn.

## 16.10 Break name — server error on save (proposed) (mobile)  [ITA-0]
- Name `Alex Mor`. Below the slug row, inline error note (warning style, not danger): bg #F7EEDC (warning tint), radius 10, padding 12, text Commissioner 400 14px/20px **#824C00**, align start; verbatim (straight apostrophe): `We couldn't save your name. Nothing you typed was lost. Try again.` Note width 350 (full sheet content width), text wraps in 326.
- Button label becomes **"Try again"**, still primary (#C23417, white 600 16/24, height 48).

## 16.11 Break name — offline (proposed) (mobile)  [IV1-0]
- Warning note (same style as 16.10): `You're offline. What you typed is kept. Continue unlocks when you reconnect.` (straight apostrophe).
- Button disabled: #DEDAD5 bg, label "Continue" #66605B (same disabled style as 16.8).

## 16.12 Break name — slug collision (proposed) (mobile)  [IWS-0]
- Slug row shows `kuuki.marchstudio.uk/fly/alex-mor-2`.
- Warning note (same style): `alex-mor was taken, so we added -2. Edit the address if you prefer another.`
- Button "Continue" enabled.

## 16.13 Break name — edited slug invalid or taken (proposed) (mobile)  [IYJ-0]
- The slug row becomes an editable field: height 36, radius 8, bg #FBFAF8, border 1px **#A02442** (danger text token as border), padding-inline 12, padding-top 2, gap 6; Lucide `Lock` 14px stroke #66605B; value `kuuki.marchstudio.uk/fly/alex_mor!` mono 12/18 **#302D2A** (value darker than the muted resting #66605B).
- Error text under it (no card): Commissioner 400 13px/18px **#A02442**, verbatim (straight apostrophe): `Use letters, numbers and hyphens, 3 to 30 characters. If it's taken, we say so here.`
- Name input keeps its focus ring. Button "Continue" enabled.

## 16.14 Break name — very long name (desktop)  [J0A-0]
- Same 89-char name as 16.1. **Cover** (216x300): HOLDER name wraps to **6 lines** at Commissioner 600 20/26 white (`Alexandra` / `Konstantinopolsk` / `aya-Vandenberghe` / `de la Fontaine of` / `the Northern Isles` / `and Beyond`), the last line is clipped by the cover bottom padding area (cover has `overflow` default; text runs into the lower padding). Caret sits mid-way (flex row, centre aligned).
- Input (360 wide, 44 high): text wraps to 2 lines, clipped inside 44px. Slug in 3 lines mono 12/18 (breaks at hyphens).
- Defect shown, not solved: no clamp.

## 16.15 Break name — unbreakable 40 chars (desktop)  [J1V-0]
- Name `Abcdefghijklmnopqrstuvwxyzabcdefghijklmn`; cover shows it wrapping mid-word to 2 lines at 20/26; slug `kuuki.marchstudio.uk/fly/abcdefghijklmnopqrstuvwxyzabcdefghijklmn`.

## 16.16 Break name — Cyrillic (desktop)  [J3G-0]
- Name `Александра Константинопольская` (15px in input, 20px/26 on cover), slug `kuuki.marchstudio.uk/fly/aleksandra-konstantinopolskaya`.

## 16.17 Break name — RTL Arabic (desktop)  [J51-0]
- Name `محمد الفارسي`, slug `kuuki.marchstudio.uk/fly/pilot-9x2m`. On the cover the name is centred (cover is centre-aligned) with the caret to the right of the text; in the input, text is left-aligned with caret to its right. Layout otherwise as 15.1.

## 16.18 Break name — empty cover (desktop, proposed)  [J6M-0]
- Cover HOLDER line shows placeholder `Your name` Commissioner 600 20/26 white at **opacity 0.55** + white caret.
- Input placeholder `e.g. Alex Mor` Commissioner 400 15/24 #66605B + caret, focus ring visible.
- Slug `kuuki.marchstudio.uk/fly/your-name`.
- Continue disabled: height 44, radius 10, bg #DEDAD5, label #66605B Commissioner 600 15/24.

---

# 17.x Break boards — first flight

All desktop 17.x boards use the 15.2/15.3/15.4 chrome (card 1040x620, left panel 420, form column 400, gap 24). Only EN is drawn. Apostrophes in 17.x notices are STRAIGHT (`'`), unlike the typographic `’` in 15.x; normalise in the implementation.

## Shared components introduced by 17.x

- **Notice (warning)**: row, `align-items: start`, gap 10, bg #F7EEDC, radius 12, padding 14 block / 16 inline. Icon: Lucide `CircleAlert` 18px, stroke #824C00 1.75 (circle r10 + `M12 8v4M12 16h.01`), margin-top 2. Text Commissioner 400 14px/22px #824C00. Sits directly under the heading block (gap 24). Optional second line inside the text column: mono 12px/18px #824C00 (counter / filename) at gap 6 (17.9) or 2 (17.15); or a white snippet chip (17.3).
- **Info note (neutral, from 15.4)**: bg #F2F0ED, radius 12, padding 14/16, gap 10, Lucide `Clock` 18px #302D2A, text 14/22 #302D2A (used in all "Reading" states).
- **Paste target, shorter variant**: height **150** (vs 188 in 15.3), radius 14, bg #FBF4F1, border 1.5px dashed #C23417, column centred, gap 14. Contents: primary button "Paste from clipboard" (44 high, padding-inline 20, radius 10) + hint "or press ⌘V anywhere · drop a file" (13/20 #66605B). No clipboard icon in this variant.
- **Copied row** (below the target): same as 15.3: `Check` 16px #3F6B2A + "Prompt copied" 14/20 #302D2A on the left; "Copy again" (500 14/20 #C23417) and "I'll do this later" (500 14/20 #66605B) on the right, gap 20. Row is space-between.
- **Skeleton rows** (17.5): rows height 32, gap 14; three bars height 12, radius 6, bg #F2F0ED, widths 92 / 120 / 56; opacity 1, 0.7, 0.4 in order. Column gap 2, padding-block 10.
- **Disabled/secondary pill** (17.10): height 44, radius 10, padding-inline 20, bg #F2F0ED, label 600 15/24 #66605B.
- **Outline button** (17.11): height 44, radius 10, padding-inline 20, border 1px #837B74, label 500 15/24 #302D2A, bg transparent.

## 17.1 Break first flight — clipboard read denied (proposed) (desktop)  [JAN-0]
- Left: open spread, empty (FLIGHTS 0, 4 dashed slots), caption "Stamps land here as flights come in."
- Right: h1 "Now paste the reply"; sub "Copy what your assistant wrote and paste it anywhere here. We read it the moment it lands."
- Notice: `Your browser didn't let us read the clipboard. Press ⌘V on this page instead, or drop a file.`
- Paste target (150 high) shows NO button: a key chip (bg #FFFFFF, border 1px #DEDAD5, radius 8, padding 6 block / 14 inline) with `⌘V` JetBrains Mono 500 18px/24 #302D2A, then hint `paste anywhere on this page · drop a file` (13/20 #66605B).
- Copied row as shared.

## 17.2 Break first flight — clipboard empty or image (proposed) (desktop)  [JCE-0]
- Same layout as 15.3 except notice + 150px target with the primary "Paste from clipboard" button.
- Notice: `Your clipboard has no text on it yet. Copy your assistant's reply, then try again.`
- Hint: `or press ⌘V anywhere · drop a file`.

## 17.3 Break first flight — reply is not flights (proposed) (desktop)  [JE5-0]
- Notice text (14/22 #824C00): `We couldn't find any flights in that text. Your assistant may have answered a different question.`
- Under the text, inside the notice (column gap 8): **snippet chip** bg #FFFFFF, radius 8, padding 8 block / 10 inline, full width; text mono 12px/18px #66605B: `Preheat the oven to 180 °C. Cream the butter and sugar until pale, then fold in the…` (first ~80 chars + `…`, shows what was received; note thin space before °C is a normal space).
- Paste target with "Paste from clipboard" as 17.2. Left caption: "Stamps land here as flights come in."

## 17.4 Break first flight — known format, 0 flights (proposed) (desktop)  [JFW-0]
- Notice text only (no snippet): `Your assistant replied, but the list had no flights in it. It may not have been able to open your email or calendar. Copy the prompt again and try another assistant.`
- Rest as 17.2 ("Paste from clipboard", "Prompt copied", "Copy again", "I'll do this later").

## 17.5 Break first flight — free text via Gemini, reading (proposed) (desktop)  [JL5-0]
- Left: spread FLIGHTS **0**, 4 dashed slots, caption "A stamp for every new country."
- h1 "Reading your flights"; counter line: `0` (mono 500 15/24 #C23417) + `found so far. Free text takes a little longer.` (15/24 #66605B).
- 3 skeleton rows (see shared), then info note "You can close this tab. We keep reading, and your flights wait here for review next time you sign in." + right-aligned "Finish later" (500 14/20 #66605B). Note: counter line differs from 15.4 (no country count at 0).

## 17.6 Break first flight — reading finds 1 flight (desktop)  [JND-0]
- Left: FLIGHTS `1`; right page shows **3 stamps** JPN 2019 / PRT 2021 / GEO 2023 (same as 15.4 shapes, with GEO at 0.55 opacity) plus dashed slot is absent in this frame? (3 stamps listed in text nodes; slot count unchanged) , caption "A stamp for every new country." Flag: stamps listed despite N=1: it is the mock reusing artwork; implement 1 stamp for 1 country.
- Counter line: `1` + `found so far, 1 country` (singular "country").
- Rows: only one real row `2023-10-02 IST → TBS TK 378` (rows 2-4 not populated in this frame).
- Info note + "Finish later" as 15.4.

## 17.7 Break first flight — reading finds 400 flights (desktop)  [JPL-0]
- Left: FLIGHTS `400` (mono 500 22/28; fits at that size). Right page: JPN 2019 (#C23417 -9deg), PRT 2021 (#4E5EA2 7deg), GEO 2023 (#59702A -4deg, 0.55 opacity) and a **overflow chip** replacing the 4th slot: 56x56 circle, border 1px **dashed #DEDAD5**, centred text `+59` mono 12px/16px #66605B. (62 countries - 3 shown = 59.)
- Counter line: `400` + `found so far, 62 countries`.
- Rows (4, fading 1 / 1 / 0.6 / 0.3): 2023-10-02 IST → TBS TK 378; 2023-09-28 LIS → IST TK 1760; 2021-06-14 LHR → LIS TP 1351; 2019-04-03 LHR → HND JL 42.
- Info note + "Finish later" as 15.4.

## 17.8 Break first flight — 600 lines, over the 500 cap (proposed) (desktop)  [JRT-0]
- Left: FLIGHTS `500`; 3 stamps (JPN, PRT, GEO); caption "A stamp for every new country."
- h1 "Reading your flights"; counter: `500` + `read, 38 countries` (note: "read", not "found so far").
- 4 fading rows as 17.7.
- **Cap block** (column gap 16): warning notice `Your reply listed 600 flights. We can read 500 at a time, so we took the first 500. Paste the last 100 after you review these.` Then a row (space-between): primary button "Review 500 flights" (height 44, padding-inline 20, radius 10, label 600 15/24 white) and "Finish later" (500 14/20 #66605B).
- (Replaces the neutral info note + lone "Finish later".)

## 17.9 Break first flight — over 100,000 characters (proposed) (desktop)  [JHN-0]
- Left: FLIGHTS 0, 4 dashed slots, caption "Stamps land here as flights come in."
- h1 "Now paste the reply" + 15.3 sub.
- Notice (text column gap 6): line 1 `That reply is longer than we can read in one go. Paste it in two parts and we'll add both. Nothing was added yet.`; line 2 mono 12px/18px #824C00: `142,300 characters · limit 100,000`.
- Paste target 150px with "Paste from clipboard" button; copied row.

## 17.10 Break first flight — import rate limit (proposed) (desktop)  [JJE-0]
- Notice: `We can only read a few free-text replies at a time, and you've reached that for now. Try again in about 10 minutes. A reply in the Kuuki format still works right away.`
- Paste target (150) with the button replaced by a disabled pill: bg #F2F0ED, label `Try again in 9:42` (600 15/24 #66605B; m:ss countdown), hint `your reply is kept on this page` (13/20 #66605B).
- Bottom row (space-between): left link with pen icon (Lucide `PenLine` 16px #C23417 1.75) + `Type a flight in` (500 14/20 #C23417); right `I'll do this later` (500 14/20 #66605B). The "Prompt copied / Copy again" row is not shown here.

## 17.11 Break first flight — offline before accepted (proposed) (desktop)  [JU1-0]
- Left: FLIGHTS 0, caption "A stamp for every new country." Form column height 223 (short).
- h1 `Waiting for a connection`; counter `0` (accent mono) + `flights yet. You're offline, so we haven't started.` (15/24 #66605B).
- Offline block (gap 16): warning notice `Keep this tab open for now. We'll send your reply as soon as you're back online.`; then row space-between: outline button `Try now` (height 44, padding-inline 20, radius 10, border 1px #837B74, label 500 15/24 #302D2A) and `Finish later` (500 14/20 #66605B).

## 17.12 Break first flight — server error mid-read (proposed) (desktop)  [JW9-0]
- Left: FLIGHTS `23`, 3 stamps (JPN, PRT, GEO), caption "A stamp for every new country."
- h1 "Reading your flights"; counter `23` + `found so far, 6 countries`; 4 fading rows (rows as 15.4: 2023-10-02 IST → TBS TK 378 / 2023-09-28 LIS → IST TK 1760 / 2021-06-14 LHR → LIS TP 1351 / 2019-04-03 LHR → HND JL 42).
- Stopped block (gap 16): warning notice `Reading stopped after 23 flights because something went wrong on our side. Those 23 are saved.`; row space-between: primary button `Read the rest again` (44h, padding-inline 20) on the left; on the right (gap 20) `Review 23 flights` (500 14/20 #C23417) and `Finish later` (500 14/20 #66605B).

## 17.13 Break first flight — back after closing the tab (proposed) (desktop)  [JYH-0]
- Left: FLIGHTS `41`, 3 stamps, caption "A stamp for every new country."
- h1 `Your flights are ready`; counter `41` + `found while you were away, 9 countries`; 4 rows full opacity? (rows as 15.4 fading 1/1/0.6/0.3 — list is the same 4 rows).
- Return block (gap 16, NO notice): full-width primary button `Review 41 flights` (height **48**, radius 10, label 600 16/24 white; note 48 high, not 44), below it a row space-between: `Paste another reply` (500 14/20 #C23417) and `I'll do this later` (500 14/20 #66605B).

## 17.14 Break first flight — mobile, back from assistant, paste denied (proposed)  [K0P-0]
- Mobile frame (390x844) with top zone as 15.8 (strip: HOLDER "Alex Morgan"; FLIGHTS "0"; header row present, strip padding-top 8).
- Sheet (padding-top 32, bottom 46, inner width 350, gap 20): h1 `Now paste the reply` (28/34); sub **mobile copy** `Copy what your assistant wrote, then paste it here.`
- Notice: `Your browser didn't let us read the clipboard. Paste into the box instead.`
- **Long-press paste box**: height **96**, radius 14, bg #FBF4F1, border 1.5px dashed #C23417, centred text `Press and hold here, then tap Paste` Commissioner 15/24 #66605B.
- Outline button: height 48, radius 10, border 1px #837B74, label `Add a boarding pass` 500 16/24 #302D2A.
- Copied row (space-between): `Check` #3F6B2A + "Prompt copied" 14/20; right "Copy again" (500 14/20 #C23417) + "I'll do this later" (500 14/20 #66605B), gap 20.

## 17.15 Break first flight — mobile 320, unsupported file, long name (proposed)  [K2R-0]
- Frame **320 x 844**. Header row as mobile; sheet inner width **280**; gap 20. h1 `Where have you flown, Alex?` (28/34, wraps), sub = 15.8 mobile sub.
- Notice (text column gap 2): `We can't read this kind of file. Boarding passes work as PDF, PNG or JPEG.` then filename line mono 12px/18px #824C00, width 100%, wraps by `overflow-wrap: anywhere`: `Boarding-pass-and-hotel-confirmation-Lisbon-Istanbul-2024-final-v3.docx`.
- Prompt tray (as 15.8: window 92 high, 14px padding, fade 40; "Copy prompt" 48 high w/ Copy icon), outline button `Paste or add a boarding pass` (48 high, 500 16/24), link row `Type a flight in` (#C23417) / `I'll do this later` (#66605B) 500 15/22.

## 17.16 Break first flight — mobile, file too large (proposed)  [K4T-0]
- Same as 17.15 at 390 wide, notice: `That file is bigger than we can read (18 MB). The limit is 10 MB. A screenshot of the pass is usually smaller.` (no filename line). Rest as 15.8.

## 17.17 Break first flight — mobile, reading (proposed, no source frame)  [K6V-0]
- Strip right block: `FLIGHTS` / `38`. Sheet: h1 `Reading your flights` (28/34); counter `38` (mono 500 15/24 #C23417) + `found so far, 7 countries`; 3 rows (mono 13/20; opacity 1 / 1 / ~0.5): `2023-10-02 IST → TBS TK 378`, `2023-09-28 LIS → IST TK 1760`, `2021-06-14 LHR → LIS TP 1351`; info note `You can close this tab. We keep reading, and your flights wait here for review next time you sign in.`; right-aligned `Finish later` (500 14/20 #66605B, here appears semibold).

---

# 18.x Review boards (Break review)

Layout: mobile boards (18.1-18.3, 18.5-18.11) reuse the 15.9 mobile frame (390x844, F2F0ED top zone with header row + passport strip, white sheet with 20px top radius, sticky footer bar). 18.4 reuses the 15.5 desktop card (1040x620, left panel 420 with the passport spread, right panel with review list). Strip right block on mobile is `FLIGHTS · COUNTRIES` / `41 · 9` (mono 500 18/24 #302D2A). Footer: left two-line block (title 600 ~14/20 #302D2A, sub 13/18 #66605B) + primary button "Save N" (#C23417, white 600 15, radius 10, ~48 high).

Shared copy (mobile): h1 `{N} flights. Check {M}.` (28/34 600 ls -0.02em); sub `Fix what’s unsure, or leave it out.`; footer `{K} still unsure` / `Saving leaves them out.` / button `Save {N-unsure}`. Section header `Looks right` (600 14) + count (#66605B). Row: mono 13/20, columns date | route | flight number (right-aligned). Warning cards: bg #F7EEDC radius 12, label right-aligned 600 12 #824C00, route mono 14 #302D2A, meta mono 12 #66605B, chips (mono 14, white, 1px border, radius 8, selected border/text #C23417), buttons `I flew it` / `Leave out` (white, border, radius 8, 44 high), date input placeholder `2019-06-__` (mono).

## 18.1 1 flight, 0 unsure  [J87-0]
Copy: `1 flights. Check 0.` (BUG: needs singular, e.g. `1 flight.`; also "Check 0" should probably be hidden) / `Fix what’s unsure, or leave it out.` / strip `1 · 1` / footer `0 still unsure` `Saving leaves them out.` button `Save 1` / `Looks right` `1` / row `2025-08-30  TBS → MUC  LH 2557`.

## 18.2 all 12 unsure  [KMS-0]
Strip `12 · 4`; h1 `12 flights. Check 12.`; footer `12 still unsure` / `Saving leaves them out.` / button `Save 0` (check whether it should be disabled; board shows it as text only); `Looks right` `0`. 12 warning cards = 4 repeats of the three kinds (Which London? / Maybe cancelled / Day missing); list scrolls inside the sheet.

## 18.3 400 flights, 7-row preview  [KP8-0]
Strip `400 · 9`; h1 `400 flights. Check 3.` (board data: 2 cards shown, footer says `2 still unsure`, `Save 399`); `Looks right` `397`; preview of 7 rows (`2025-08-30 TBS → MUC LH 2557`, `2025-08-14 MUC → TBS LH 2556`, `2024-05-02 HND → LHR JL 43`, repeated) then a text button `Show all 397`. Cards: `London → LIS` `Which London?` `2022-03-11 · TP 1333` chips LHR/LGW/STN/LTN; `MUC → ORD` `Maybe cancelled` `2024-12-20 · LH 430` `I flew it`/`Leave out`; `TBS → IST` `Day missing` input `2019-06-__` + `Leave out`.

## 18.4 400 flights, Show all expanded (desktop)  [LJE-0]
Left panel (420): wordmark `Ku`+`uki`, passport open spread with HOLDER `Alex Morgan`, FLIGHTS `400`, COUNTRIES `9`, DISTANCE `182,410 km`, SINCE `2016`, stamps JPN 2019, PRT 2021, GEO 2023, TUR 2023, DEU 2025, GBR 2016, USA 2018, ESP 2017, ITA 2020; caption `9 countries. The passport grows with you.`; language toggle `EN` top right.
Right: h1 `400 flights. Check 3.`; sub `Everything else looks right. Fix what’s unsure, or leave it out.`; footer `2 still unsure` / `Saving leaves them out.` / button `Save 399 flights`; `Looks right` `397`. Desktop rows have date, route, flight number columns plus issue label: `2022-03-11 London → LIS TP 1333 Which London?` (chips LHR LGW STN LTN), `2018-??-?? LHR → JFK BA 117 Day missing` (input `2018-__-__` + `Leave out`), `2024-12-20 MUC → ORD LH 430 Maybe cancelled` (`I flew it` `Leave out`); expanded list of rows (`2025-08-30 TBS → MUC LH 2557` ...) ending with `Show fewer`.

## 18.5 London with 6 airports  [KRO-0]
Chips: `LHR` `LGW` `STN` `LTN` `LCY` `SEN` in one row at 390 (6 chips, each ~46 wide, gap ~8, no wrapping); LHR selected (border #C23417, text #C23417). Rest as 18.3 with 41 flights: `41 · 9`, `Save 39`, `Looks right` `38`.

## 18.6 long values  [KU4-0]
Card 1: route wraps to two lines `Ho Chi Minh City →` / `Frankfurt am Main` (arrow stays on first line); label wraps `Which Ho Chi` / `Minh City?` (right-aligned, narrower column); meta `2022-03-11 · BA 1234 / AA 6789`; chips LHR/LGW/STN/LTN (copy unchanged, as drawn). Rows: `2025-08-30 SGN → FRA BA 1234 / AA 6789` (flight col wider), `2025-08-14 MUC → TBS —` (em dash for a missing flight number), `2024-05-02 HND → LHR ZZ 4471`.

## 18.7 everything left out (proposed)  [KWK-0]
Strip `3 · 2`; h1 `3 flights. All left out.`; sub `Nothing will be saved. Put one back to keep it.`; 3 rows (bg #F2F0ED radius 12, ~60 high, gap 8): route mono `London → LIS`, `MUC → ORD`, `TBS → IST`, sub-label `Left out` (12 #66605B); trailing text button `Put back` (600 14 #C23417). Footer `Nothing to save` / `Your journal starts empty.` / button `Start empty` (primary).

## 18.8 upcoming flights mixed in  [KZ0-0]
As 18.3 but the Looks right preview rows have future dates: `2027-03-02 TBS → MUC LH 2557`, `2027-01-18 MUC → TBS LH 2556`, `2026-11-24 HND → LHR JL 43` (no special styling visible in the 7-row preview; no "upcoming" tag drawn). `Save 39`, `Looks right` `38`.

## 18.9 save error (proposed)  [L1G-0]
Footer replaced: title `Couldn’t save` / sub `Nothing is lost. Your fixes are kept.` / button `Try again`. Rest as 18.3.

## 18.10 offline (proposed)  [L3W-0]
Footer: `You’re offline` / `Your fixes are kept. Save when you’re back.` / button `Save 39` (drawn in the disabled style).

## 18.11 320px phone  [L6C-0]
Same copy as 18.3 (`Save 39`, `38`). Frame narrower; chips and card layout as 18.3 compressed (no extra copy).

---

# 19.x Reveal boards (Break reveal)

Layout facts. Desktop (19.8-19.10, 1440x900, bg #FBFAF8): card 1040x620 radius 20 border 1px #DEDAD5, left panel 420 (#F2F0ED, padding 40) with wordmark top-left and, centred, the open passport spread (330x228, radius 8, border 1px #DEDAD5, shadow `#302D2A66 0 18px 32px -20px`, left page padding 18/16: HOLDER label, name Commissioner 600 16/22, FLIGHTS label, count mono 500 22/28, MRZ `P<KUU<MORGAN<<ALEX<<<` mono 9 ls 0.06em #837B74; 6px gutter #F6F4F1; right page padding 16, flex-wrap gap 12, stamps 56x56 circle border 2px, rotations -9/7/-4/10deg, code mono 600 13/15, year mono 8/10 ls 0.08em). Entry stamp absolutely placed (left 62, top 84, rotate -8deg, bg #FFFFFFB8, border 2.5px #C23417, radius 6, padding 8/14): `KUUKI · ENTRY` (mono 600 10 ls 0.3em), `WELCOME` (Commissioner 700 22/26 ls 0.06em), `11 OCT 2026` (mono 10 ls 0.2em), all #C23417. Under the spread (gap 20): caption `Stamped. The card fades into your journal.` (13/20 #66605B, ls 0.01em). Right panel: padding-inline 64, padding-top 48, content column 400 wide, gap 36; top-right toolbar (right 28, top 36: EN, theme sun, accent dot #C23417, help circle; 44px items). Content: eyebrow `YOUR JOURNAL IS OPEN` (mono 12/16 ls 0.18em #C23417), narrator line (Commissioner 600 34/42 ls -0.025em #302D2A), stats sub-line (15/24 #66605B), gap 18; button full width 44 high radius 10 #C23417, label `Open my journal` 600 15/24 white + ArrowRight icon 16 (stroke 2).
Mobile (19.1-19.7, 390x844): F2F0ED top zone (status bar mockup, then strip: closed cover 44x60 #C23417 with compass icon 22, HOLDER label mono 9 ls 0.24em + name 600 18/24, right block `FLIGHTS · COUNTRIES` mono 9 + value mono 500 18/24 as `N · C`) padding-bottom 16; white sheet radius-top 20, shadow `0 -1px 0 #DEDAD5`, padding 24/20; inside: entry stamp (rotate -6deg, border 2px #C23417 radius 6 padding 10/16, `KUUKI · ENTRY` mono 10 ls 0.14em / `WELCOME` Commissioner 700 18/22 ls 0.06em / `11 OCT 2026` mono 10 ls 0.14em), gap 28, eyebrow (mono 11/16 ls 0.14em #66605B on mobile), narrator line 28/34 600 ls -0.02em, sub-line 15/24 #66605B; sticky bottom (absolute, padding 14/20/34): button 48 high radius 10 #C23417, label `Open my journal →` 600 16/24 white, then caption `Stamped. The sheet fades into your journal.` (12/16 #837B74, centred). Note: mobile caption says "sheet", desktop says "card"; mobile button uses a text arrow, desktop uses the icon.

## Board index
- 19.1 single flight (mobile) [K99-0]; 19.2 3 flights (mobile) [KAC-0]; 19.3 412 flights/60 countries (mobile) [KBF-0]; 19.4 upcoming only, proposed (mobile) [KCI-0]; 19.5 domestic only, 1 country (mobile) [KDL-0]; 19.6 37 flights left out (mobile) [KEO-0]; 19.7 RU longest line (mobile) [KFR-0]; 19.8 412/60 (desktop) [KGU-0]; 19.9 RU longest line (desktop) [KIM-0]; 19.10 upcoming only, proposed (desktop) [KKE-0].

## Narrator corpus, EN (placeholders as drawn: counts, year, city, km are concrete sample values)
Big history (many flights, multi-country; 19.3, 19.8):
- narrator: `412 flights since 2009, and Frankfurt still can’t get rid of you.` (pattern: `{N} flights since {firstYear}, and {topAirportCity} still can’t get rid of you.`)
- stats: `60 countries, 2,418,300 km. 12 flights left out; add them anytime from your journal.` (left-out clause only when skipped > 0)
- strip `412 · 60`; desktop passport FLIGHTS `412`; stamps JPN 2019, PRT 2021, GEO 2023, TUR 2023.

Small history (19.2, 19.5, 19.6):
- 19.2 (3 flights, 2 countries): narrator `3 flights since 2024. A modest start, and it’s all on record.`; stats `2 countries, 3,404 km.`; strip `3 · 2`.
- 19.5 (14 flights, 1 country): narrator `14 flights since 2022, and Denver still can’t get rid of you.`; stats `1 country, 21,904 km.` (singular "country"); strip `14 · 1`. (Note: uses the big-history pattern with a smaller N.)
- 19.6 (8 flights, 37 left out): narrator `8 flights since 2021. Plenty of room left in the journal.`; stats `4 countries, 12,306 km. 37 flights left out; add them anytime from your journal.`; strip `8 · 4`.

Upcoming only (19.4 mobile, 19.10 desktop; both "proposed"):
- narrator `Nothing flown yet, 1 booked. The journal is ready when you are.`
- stats `1 upcoming flight. Add past ones anytime from your journal.`
- strip `0 · 0` (mobile), FLIGHTS `0` on the desktop spread (no stamps).

Single flight (19.1):
- narrator `One flight, TBS–IST. Every journal starts with one.` (en dash in route)
- stats `2 countries, 1,681 km.`; strip `1 · 2`.

Common EN: eyebrow `YOUR JOURNAL IS OPEN`; button `Open my journal` (desktop, with icon) / `Open my journal →` (mobile); caption desktop `Stamped. The card fades into your journal.` / mobile `Stamped. The sheet fades into your journal.`; stamp `KUUKI · ENTRY` / `WELCOME` / `11 OCT 2026`; labels `HOLDER`, `FLIGHTS`, `FLIGHTS · COUNTRIES`.

## RU (19.7 mobile [KFR-0], 19.9 desktop [KIM-0]) — only the big-history line is drafted
- eyebrow `ВАШ ЖУРНАЛ ОТКРЫТ`
- narrator `412 перелётов с 2009 года, а Петропавловск-Камчатский всё ещё не может вас отпустить.` (longest line; wraps to 5-6 lines in the 400px desktop column at 34/42; mobile 28/34; check the 320 case)
- stats `60 стран, 2 418 300 км. Не учтено: 12 перелётов; добавить их можно в любой момент из журнала.` (space as thousands separator, not comma)
- button `Открыть журнал` (desktop) / `Открыть журнал →` (mobile)
- caption desktop `Штамп поставлен. Карточка растворится в вашем журнале.` / mobile `Штамп поставлен. Лист растворится в вашем журнале.` (card = карточка, sheet = лист)
- stamp `KUUKI · ВХОД` / `ДОБРО ПОЖАЛОВАТЬ` / `11 ОКТ 2026`
- labels `ДЕРЖАТЕЛЬ`, `ПЕРЕЛЁТЫ`, `ПЕРЕЛЁТЫ · СТРАНЫ`; name `Алекс Морган`; strip `412 · 60`.
- EN-only drafts: no RU lines drawn for small history, upcoming only or single flight.

## Open issues for implementers
- 18.1 heading `1 flights. Check 0.` needs singular / hide "Check 0".
- Apostrophes: 15.x boards use straight, 16-19 use typographic (’); pick typographic.
- 15.5 heading says "Check 3" but footer says `2 still unsure` / `Save 39`; same 18.3/18.5 (3 cards, but the unsure counter counts 2 because one card, Day missing, is empty): decide the rule.
- 19.5 narrator reuses the "can’t get rid of you" joke with a small N and 1 country; 19.4/19.10 upcoming-only is a proposed trigger.
- Desktop caption "card" vs mobile "sheet" is deliberate in the boards.
