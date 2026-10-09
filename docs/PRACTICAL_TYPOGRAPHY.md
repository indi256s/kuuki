# Practical Typography — Rules & Kuuki Compliance Audit

> A comprehensive catalog of rules from Butterick's _Practical Typography_ and how Kuuki's codebase measures up against each one.

---

## Part 1: Butterick's Rules

### 1. Body Text Fundamentals

These are the "Typography in Ten Minutes" rules — the five changes that produce 80% of the improvement.

| #   | Rule                       | Specification                                                                            | Rationale                                                                        |
| --- | -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1.1 | **Prioritize body text**   | Body text is the majority of your document; get it right first                           | Readers spend most time here — display text is decoration by comparison          |
| 1.2 | **Point size**             | Print: 10–12pt. Web: **15–25px**                                                         | Font metrics vary, so adjust visually rather than trusting numbers alone         |
| 1.3 | **Line spacing (leading)** | **120–145%** of the point size                                                           | Too tight = claustrophobic; too loose = lines disconnect from each other         |
| 1.4 | **Line length (measure)**  | **45–90 characters** per line (incl. spaces) ≈ 2–3 lowercase alphabets                   | Lines too long cause the eye to lose its place when returning to the left margin |
| 1.5 | **Professional fonts**     | Avoid system defaults (Arial, Times New Roman), monospaced for body, and most free fonts | Professional fonts have better spacing, kerning tables, and character sets       |

### 2. Text Emphasis

| #   | Rule                            | Detail                                                               |
| --- | ------------------------------- | -------------------------------------------------------------------- |
| 2.1 | **Bold or italic — never both** | Combining them creates visual noise; choose one                      |
| 2.2 | **Use emphasis sparingly**      | "When everything is emphasized, nothing is emphasized"               |
| 2.3 | **Never underline**             | Underline is a typewriter artifact; on the web, reserve it for links |
| 2.4 | **Sans serif → prefer bold**    | Bold is more visible than italic in sans-serif faces                 |
| 2.5 | **Serif → prefer italic**       | Italic has more visual distinction in serif faces                    |

### 3. Capitalization

| #   | Rule                                 | Detail                                                                          |
| --- | ------------------------------------ | ------------------------------------------------------------------------------- |
| 3.1 | **ALL CAPS: less than one line**     | Acceptable for labels, short headings — not for body text                       |
| 3.2 | **ALL CAPS require letterspacing**   | Add 5–12% extra tracking to improve readability                                 |
| 3.3 | **Small caps require letterspacing** | Same 5–12% rule applies; only use genuine small caps (not scaled-down capitals) |
| 3.4 | **Avoid Title Case for headings**    | "Your headings aren't titles" — use sentence case instead                       |

### 4. Spacing

| #   | Rule                                             | Detail                                                                  |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| 4.1 | **One space between sentences**                  | Two spaces is a typewriter convention; one is correct                   |
| 4.2 | **Paragraph spacing: indent OR space, not both** | First-line indent: 1–4× point size. Or: 4–10pt vertical space. Pick one |
| 4.3 | **Kerning always on**                            | Enables the font's built-in spacing adjustments between character pairs |
| 4.4 | **Generous whitespace**                          | Margins, padding, and breathing room signal quality and aid readability |
| 4.5 | **Don't stretch or compress letterspacing**      | Except for ALL CAPS and small caps (see §3)                             |

### 5. Punctuation & Special Characters

| #   | Rule                             | Detail                                                                                 |
| --- | -------------------------------- | -------------------------------------------------------------------------------------- |
| 5.1 | **Curly (smart) quotes**         | Use `"` `"` `'` `'` — never straight `"` `'` in prose                                  |
| 5.2 | **Proper ellipsis character**    | Use `…` (U+2026), not three periods `...`                                              |
| 5.3 | **Hyphens ≠ dashes**             | Hyphen `-` for compounds, en dash `–` for ranges, em dash `—` for parenthetical breaks |
| 5.4 | **Don't fake dashes**            | Never use `--` or `---` to approximate em/en dashes                                    |
| 5.5 | **Apostrophes point down**       | The closing single quote `'` — not the opening `'` or straight `'`                     |
| 5.6 | **Foot/inch marks are straight** | Use `′` `″` for measurements, not curly quotes                                         |
| 5.7 | **Nonbreaking spaces**           | After § and ¶ marks, and between numbers and their units                               |

### 6. Headings

| #   | Rule                                 | Detail                                                                        |
| --- | ------------------------------------ | ----------------------------------------------------------------------------- |
| 6.1 | **2–3 levels maximum**               | Most documents need no more than two; three if complex                        |
| 6.2 | **Modest size increases**            | If body is 12pt, try 13pt headings — not 18pt. The hierarchy should be subtle |
| 6.3 | **Space above and below**            | The best emphasis for a heading is whitespace, not formatting tricks          |
| 6.4 | **Don't center headings**            | Left-aligned headings are easier to scan (rare exceptions for title pages)    |
| 6.5 | **Don't underline headings**         | See §2.3                                                                      |
| 6.6 | **Suppress hyphenation in headings** | Hyphenated headings look broken                                               |

### 7. Layout

| #   | Rule                                    | Detail                                                                            |
| --- | --------------------------------------- | --------------------------------------------------------------------------------- |
| 7.1 | **Margins wider than you think**        | In print: often 1.5"–2". On web: prevent text from touching viewport edges        |
| 7.2 | **Line length governs margins**         | Set margins to achieve 45–90 characters, not the other way around                 |
| 7.3 | **Left-align body text**                | Justified requires good hyphenation; ragged right is safer                        |
| 7.4 | **Centered text sparingly**             | Only for short elements like titles, headings, and captions — never for body text |
| 7.5 | **Use hyphenation with justified text** | Without it, justified text creates "rivers" of whitespace                         |

### 8. Color & Contrast

| #   | Rule                                       | Detail                                                                           |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| 8.1 | **Screen text: dark gray, not pure black** | `#000000` on white is harsh; dark gray (e.g., `#333`) is more comfortable        |
| 8.2 | **Background: off-white, not pure white**  | A slight warmth or tint reduces glare                                            |
| 8.3 | **Color for links only**                   | On the web, colored text implies clickability — don't color non-interactive text |
| 8.4 | **Restraint with color**                   | "When everything is emphasized, nothing is emphasized" — applies to color too    |
| 8.5 | **Contrast must be sufficient**            | Text must be legible against its background; thin/small text needs more contrast |

### 9. Web-Specific Guidelines

| #   | Rule                                          | Detail                                                                             |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| 9.1 | **Don't use tiny text**                       | Web body text should be 15–25px; avoid text smaller than 15px for readable content |
| 9.2 | **Abandon default heading sizes**             | Browser defaults (32px h1, 24px h2) are too large; override them                   |
| 9.3 | **Use professional web fonts**                | Google Fonts, Adobe Fonts, or self-hosted — not system font stacks alone           |
| 9.4 | **Non-blocking font loading**                 | Fonts should not block page rendering; use `font-display: swap` or equivalent      |
| 9.5 | **Don't replicate print conventions blindly** | Web has different constraints (variable viewport, light-emitting screen)           |

---

## Part 2: Kuuki Compliance Audit

### Scorecard

| Rule                                    | Description                                             | Status      | Notes                                                                                                         |
| --------------------------------------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| **1. Body Text Fundamentals**           |                                                         |             |                                                                                                               |
| 1.1 Prioritize body text                | Body text is polished                                   | **PASS**    | DM Sans at considered sizes with feature settings                                                             |
| 1.2 Point size (15–25px)                | `text-base` = 16px                                      | **PASS**    | Within range                                                                                                  |
| 1.3 Line spacing (120–145%)             | Tailwind default `1.5` = 150%                           | **PARTIAL** | Slightly above 145% ceiling                                                                                   |
| 1.4 Line length (45–90 chars)           | Main containers use `max-w-7xl`                         | **PARTIAL** | 80rem (1280px) is wide; constrained in some contexts                                                          |
| 1.5 Professional fonts                  | DM Sans + JetBrains Mono                                | **PASS**    | Loaded via Google Fonts                                                                                       |
| **2. Text Emphasis**                    |                                                         |             |                                                                                                               |
| 2.1 Bold or italic, not both            | No combined usage found                                 | **PASS**    | Grep confirms zero `font-bold.*italic` matches                                                                |
| 2.2 Emphasis used sparingly             | Bold for headings/data only                             | **PASS**    | Italic limited to GLaDOS flavor text                                                                          |
| 2.3 Never underline                     | No `underline` on non-link text                         | **PASS**    |                                                                                                               |
| 2.4 Sans serif → bold for emphasis      | DM Sans uses bold correctly                             | **PASS**    |                                                                                                               |
| **3. Capitalization**                   |                                                         |             |                                                                                                               |
| 3.1 ALL CAPS < one line                 | Used for labels only                                    | **PASS**    | Short category labels, badges                                                                                 |
| 3.2 ALL CAPS + letterspacing            | `uppercase tracking-wider` paired                       | **PASS**    | 25+ instances confirm consistent pairing                                                                      |
| 3.3 Avoid Title Case headings           | Sentence case used                                      | **PASS**    |                                                                                                               |
| **4. Spacing**                          |                                                         |             |                                                                                                               |
| 4.1 One space between sentences         | JSON strings, no double spaces                          | **PASS**    |                                                                                                               |
| 4.2 Kerning enabled                     | `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` | **PASS**    | OpenType features active on `<body>`                                                                          |
| 4.3 Generous whitespace                 | `--spacing-page: clamp(1rem, 5vw, 3rem)`                | **PASS**    | Responsive page margins                                                                                       |
| 4.4 Tabular nums for data               | `.font-data { font-variant-numeric: tabular-nums }`     | **PASS**    | Used for flight numbers, distances, stats                                                                     |
| **5. Punctuation & Special Characters** |                                                         |             |                                                                                                               |
| 5.1 Curly quotes in prose               | Curly `'` in all contractions                           | **PASS**    | ~~Was FAIL~~ — Fixed: 51 straight apostrophes replaced with `'` (U+2019)                                      |
| 5.2 Proper ellipsis `…`                 | `…` used everywhere                                     | **PASS**    | ~~Was FAIL~~ — Fixed: 36 `...` replaced with `…` in en.json + ru.json                                         |
| 5.3 Proper dashes                       | Some em dashes present                                  | **PARTIAL** | `—` found in 7 about/feature strings; most prose uses `...` or `-` instead                                    |
| **6. Headings**                         |                                                         |             |                                                                                                               |
| 6.1 2–3 heading levels                  | 6 levels documented                                     | **PARTIAL** | Design system defines 6 sizes, but practical usage is ~3                                                      |
| 6.2 Modest size increases               | `text-base` (16px) → `text-4xl` (36px) = 2.25×          | **PARTIAL** | Hero/display text jumps are large; section headings are more modest                                           |
| 6.3 Space above and below               | `space-y-*` used consistently                           | **PASS**    |                                                                                                               |
| 6.4 Don't center headings               | Headings left-aligned in app                            | **PASS**    | Hero/landing are exceptions (appropriate)                                                                     |
| **7. Layout**                           |                                                         |             |                                                                                                               |
| 7.1 Adequate margins                    | Responsive padding with `clamp()`                       | **PASS**    |                                                                                                               |
| 7.2 Line length control                 | Mixed                                                   | **PARTIAL** | Landing page uses `max-w-2xl`/`max-w-4xl`; data pages use `max-w-7xl`                                         |
| 7.3 Left-align body text                | Body text left-aligned                                  | **PASS**    |                                                                                                               |
| 7.4 Centered text sparingly             | 40 files use `text-center`                              | **PARTIAL** | Mostly in hero, empty states, modals — acceptable contexts                                                    |
| **8. Color & Contrast**                 |                                                         |             |                                                                                                               |
| 8.1 Dark gray, not pure black           | `foreground: oklch(0.25 0.01 260)`                      | **PASS**    | Rich dark gray, not `#000`                                                                                    |
| 8.2 Off-white, not pure white           | `background: oklch(0.985 0.002 240)`                    | **PASS**    | Warm blue-tinted off-white                                                                                    |
| 8.3 Color for links only                | Primary color used for actions/links                    | **PASS**    |                                                                                                               |
| 8.4 Sufficient contrast                 | `muted-foreground/50` instances                         | **CONCERN** | 50% opacity on `oklch(0.55 ...)` may fail WCAG AA                                                             |
| **9. Web-Specific**                     |                                                         |             |                                                                                                               |
| 9.1 No tiny text (≥15px)                | `text-[10px]` minimum; tab bar raised to `text-xs`      | **PARTIAL** | ~~Was FAIL~~ — Fixed: eliminated `text-[9px]`; tab bar raised to 12px; `text-[10px]` remains for chart labels |
| 9.2 Override default heading sizes      | Custom scale defined                                    | **PASS**    |                                                                                                               |
| 9.3 Professional web fonts              | DM Sans + JetBrains Mono                                | **PASS**    |                                                                                                               |
| 9.4 Non-blocking font loading           | `media="print" onload="this.media='all'"`               | **PASS**    | With `<noscript>` fallback                                                                                    |

### Summary

| Grade       | Count | Percentage |
| ----------- | ----- | ---------- |
| **PASS**    | 24    | 75%        |
| **PARTIAL** | 7     | 22%        |
| **CONCERN** | 1     | 3%         |

---

### Detailed Findings

#### PASSES (22 rules) — Things Kuuki Gets Right

**Professional Font Selection (1.5, 9.3)**

Kuuki uses DM Sans for display/body and JetBrains Mono for data — both professional-quality fonts loaded via Google Fonts. The font stack includes sensible fallbacks:

```css
/* index.css:20-22 */
--font-display: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
--font-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

**Body Text Size (1.2)**

`text-base` maps to 16px — right in Butterick's recommended 15–25px web range.

**OpenType Features & Kerning (4.2)**

```css
/* index.css:252 */
font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
```

Active on `<body>`, enabling DM Sans's character variants. Combined with the global `letter-spacing: var(--tracking-normal)` at `-0.01em`, text has a refined, slightly tightened feel.

**Tabular Numerals (4.4)**

```css
/* index.css:294-298 */
.font-data {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

All data displays (flight distances, stats, leaderboard rankings) use this utility, ensuring columns align and numbers don't shift width when values change.

**ALL CAPS + Letterspacing (3.2)**

Every instance of `uppercase` in the codebase is paired with `tracking-wider` or `tracking-widest`:

```tsx
/* FlightForm.tsx:364 */
<h3 className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">

/* FlightTable.tsx:57 */
'text-xs font-medium tracking-wide uppercase text-muted-foreground'

/* ProfileStats.tsx:93 */
<p className="text-xs uppercase tracking-widest text-muted-foreground">
```

This is consistent across 25+ instances — a disciplined application of Butterick's rule.

**Dark Gray Text & Off-White Background (8.1, 8.2)**

```css
/* index.css:47-48 */
--background: oklch(0.985 0.002 240); /* warm off-white */
--foreground: oklch(0.25 0.01 260); /* rich dark gray */
```

Neither pure black (`#000`) nor pure white (`#fff`) appears in the design tokens. The OKLCH color space also ensures perceptually uniform lightness across hues.

**Non-Blocking Font Loading (9.4)**

```html
<!-- index.html:27 -->
<link href="...fonts..." rel="stylesheet" media="print" onload="this.media='all'" />
<noscript>
  <link href="...fonts..." rel="stylesheet" />
</noscript>
```

The `media="print"` trick loads fonts asynchronously (they won't block rendering), and the `<noscript>` fallback ensures fonts still load without JavaScript.

**Bold/Italic Never Combined (2.1)**

A codebase-wide grep for `font-bold.*italic` and `font-semibold.*italic` returned zero results. Bold is used for headings and data emphasis; italic is reserved for GLaDOS flavor text insights (`text-muted-foreground/50 italic`).

---

#### PARTIAL (6 rules) — Close But Not Quite

**Line Spacing at 150% (1.3)**

| Expected | Actual                                   | Delta             |
| -------- | ---------------------------------------- | ----------------- |
| 120–145% | 150% (Tailwind `leading-normal` = `1.5`) | +5% above ceiling |

Tailwind's default `line-height: 1.5` is applied globally. Butterick recommends 120–145%. The 150% value is widely accepted in web design and aids readability at typical viewport distances, but it technically exceeds the recommendation. No explicit `line-height` or `leading-*` overrides exist in `index.css`.

**Recommendation:** Consider `leading-snug` (`1.375` = 137.5%) for body text, which sits comfortably within range.

**Line Length on Data Pages (1.4, 7.2)**

Content containers vary by page type:

| Page              | Container   | Effective Width             |
| ----------------- | ----------- | --------------------------- |
| Landing           | `max-w-4xl` | 56rem (896px) — good        |
| Landing subtitle  | `max-w-2xl` | 42rem (672px) — excellent   |
| Profile           | `max-w-3xl` | 48rem (768px) — good        |
| Settings          | `max-w-2xl` | 42rem (672px) — excellent   |
| Import            | `max-w-5xl` | 64rem (1024px) — borderline |
| Dashboard/Flights | `max-w-7xl` | 80rem (1280px) — wide       |

Prose-heavy pages (landing, profile, settings) are well-constrained. Data-dense pages (dashboard, flights) use `max-w-7xl`, which at 1280px can push line lengths well beyond 90 characters — though these pages primarily contain cards and tables, not flowing prose.

**Recommendation:** No change needed — data pages use grid layouts where line length is governed by card widths, not the container.

**Heading Size Jumps (6.2)**

The documented size scale shows a 2.25× jump from body to display:

| Level   | Class                 | Size    | Ratio to body |
| ------- | --------------------- | ------- | ------------- |
| Body    | `text-base`           | 16px    | 1×            |
| Subhead | `text-lg`             | 18px    | 1.13×         |
| Heading | `text-2xl`            | 24px    | 1.5×          |
| Display | `text-4xl`            | 36px    | 2.25×         |
| Hero    | `text-5xl`–`text-6xl` | 48–60px | 3–3.75×       |

Butterick prefers modest jumps (12pt → 13pt). However, web design conventions differ from print — the hero text at `text-5xl`/`text-6xl` is used sparingly for landing pages and stats displays, not for document headings. Section headings within the app use `text-lg` to `text-2xl`, which are reasonable jumps.

**Heading Levels (6.1)**

The design system documents 6 size levels (Display → Caption), but actual component usage shows ~3 practical levels:

1. Page title (`text-2xl`–`text-4xl`)
2. Section title (`text-lg`–`text-xl`)
3. Card/label (`text-sm`–`text-base`)

This is functionally compliant, though the 6-level documentation could mislead developers into creating deep heading hierarchies.

**Centered Text (7.4)**

40 files use `text-center`, but examination shows it's confined to appropriate contexts:

- Hero sections (landing, auth pages)
- Empty states
- Modal content
- Profile stats display
- Loading screens

No long-form prose is centered. This is a **soft pass** — the usage aligns with Butterick's "sparingly, for short elements" guidance.

**Dashes (5.3)**

The codebase shows mixed dash usage. Em dashes (`—`) appear correctly in 7 i18n strings:

```json

```

However, many places where em dashes would be appropriate instead use `...` or hyphens, and en dashes (`–`) appear only once (`50–500`). The JSX code also uses em dashes as visual separators:

```tsx
/* FlightTable.tsx:291 */
<span className="text-muted-foreground/40 text-sm">—</span>
```

---

#### FAILS & CONCERNS (4 rules) — Needs Attention

**FAIL: Ellipsis Characters (5.2)**

**36 instances of `...` in en.json. Zero instances of `…`.**

This is the most pervasive typography issue. The three-period approximation produces incorrect spacing — the periods sit too far apart compared to the proper ellipsis glyph.

Examples by category:

_Loading states (14 instances):_

```json
"loading": "Loading...",
"saving": "Saving...",
"signingIn": "Signing in...",
"processing": "Processing...",
"searching": "Searching...",
"reading": "Reading file...",
"extracting": "Extracting text...",
"finding": "Finding flights...",
"scanning": "Scanning document...",
"deleting": "Deleting...",
"exporting": "Exporting..."
```

_Placeholders (8 instances):_

```json
"airportPlaceholder": "Search by code or city...",
"bioPlaceholder": "Tell us about yourself...",
"textPlaceholder": "Paste booking confirmations, itineraries...",
"selectCountry": "Select a country...",
"searchCountry": "Search country..."
```

_GLaDOS personality text (8 instances):_

```json
"The odometer appears... decorative.",
"Our servers are experiencing... turbulence.",
"The data is... revealing.",
"Your passport seems rather... underfilled."
```

**Fix:** Global find-and-replace `...` → `…` in both `en.json` and `ru.json`. Consider also adding a linting rule to prevent regression.

---

**FAIL: Micro-Text Below 15px (9.1)**

**35+ instances of `text-[9px]` and `text-[10px]` across the codebase.**

Butterick's web minimum is 15px. While some flexibility is warranted for data-dense UIs, 9–10px text is challenging even for young readers.

Affected components:

| Component                   | Size                        | Usage                                               |
| --------------------------- | --------------------------- | --------------------------------------------------- |
| `MapCard.tsx`               | `text-[9px]`                | Heatmap legend min/max labels                       |
| `AdvancedStatCards.tsx`     | `text-[9px]`, `text-[10px]` | Chart axes, manufacturer labels, ridgeline tooltips |
| `FlightForm.tsx`            | `text-[10px]`               | Section sub-labels ("Route", "Details", "Times")    |
| `FlightSuggestionsList.tsx` | `text-[10px]`               | Category headers                                    |
| `MobileTabBar.tsx`          | `text-[10px]`               | Tab labels                                          |
| `UpcomingFlightsBanner.tsx` | `text-[10px]`               | Badge text                                          |
| `FlightGanttBlock.tsx`      | `text-[10px]`               | "Dep" / "Arr" labels                                |
| `FlightCard.tsx`            | `text-[10px]`               | Days-away badge                                     |
| `RouteMapWithCountries.tsx` | `text-[10px]`               | Map overlay legend                                  |

**Context:** Chart labels and map annotations at 9–10px are common in data visualization (even tools like D3 default to 10px for axes). The trade-off is between data density and readability. The mobile tab bar at 10px is more concerning since it's a primary navigation element.

**Recommendation:** Raise `text-[9px]` → `text-[10px]` minimum. For primary UI elements like tab bars and form labels, use `text-xs` (12px) minimum. Reserve `text-[10px]` for chart annotations and secondary data labels only.

---

**FAIL: Curly Quotes in Prose (5.1)**

All contractions in `en.json` use straight apostrophes:

```json
"We'll figure it out."        → should be "We'll"
"let's not."                  → should be "let's"
"I've analyzed your fleet"    → should be "I've"
"You've been busy."           → should be "You've"
"couldn't save flight"        → should be "couldn't"
"doesn't exist"               → should be "doesn't"
"It's either reliable"        → should be "It's"
"That's about {{count}}"      → should be "That's"
```

**Why this matters:** Straight quotes are typewriter artifacts. Curly (typographic) quotes are the correct glyphs for prose. In a product with a strong design identity like Kuuki, this detail reinforces the "warm Japanese minimalism" aesthetic.

**Caveat:** JSON files only support straight quotes as string delimiters, but the _values_ within those strings can contain any Unicode characters. The curly apostrophe `'` (U+2019) is safe to use in string values.

**Fix:** Replace `'` with `'` (U+2019) in all English prose contractions. Russian text uses `«»` guillemets and doesn't have this issue.

---

**CONCERN: `muted-foreground/50` Contrast (8.5)**

Multiple components apply 50% opacity to already-muted text:

```tsx
/* AdvancedStatCards.tsx:619 */
<span className="text-xs text-muted-foreground/50 italic">

/* FlightForm.tsx:513 */
<span className="text-xs text-muted-foreground/50">{label}</span>

/* SignInForm.tsx:82 */
placeholder:text-muted-foreground/50
```

The base `--muted-foreground` is `oklch(0.55 0.01 260)` (light mode). At 50% opacity against `oklch(0.985 ...)` background, the effective contrast is approximately:

| Element               | Foreground     | Background     | Approx. Ratio | WCAG AA (4.5:1) |
| --------------------- | -------------- | -------------- | ------------- | --------------- |
| `muted-foreground`    | `oklch(0.55)`  | `oklch(0.985)` | ~4.8:1        | PASS            |
| `muted-foreground/50` | ~`oklch(0.77)` | `oklch(0.985)` | ~1.8:1        | **FAIL**        |
| `muted-foreground/60` | ~`oklch(0.72)` | `oklch(0.985)` | ~2.2:1        | **FAIL**        |

Text at `/50` opacity falls well below WCAG AA's 4.5:1 minimum. While these are used for decorative/secondary text (placeholders, chart annotations), they could present accessibility issues.

**Recommendation:** Use `muted-foreground/70` as the minimum opacity for any text that conveys information. Reserve `/50` and below for purely decorative elements (separator dots, background icons).

---

### Prioritized Recommendations

#### Priority 1 — Quick Wins (< 1 hour)

| #   | Fix                                                       | Effort           | Impact                                                    |
| --- | --------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| 1   | Replace `...` with `…` in `en.json` and `ru.json`         | Find-and-replace | High — affects every loading state and placeholder        |
| 2   | Replace straight `'` with curly `'` in prose contractions | Find-and-replace | Medium — refines text quality across all user-facing copy |

#### Priority 2 — Targeted Improvements (1–3 hours)

| #   | Fix                                                                 | Effort                | Impact                                           |
| --- | ------------------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| 3   | Audit `muted-foreground/50` text for WCAG AA compliance             | Per-component review  | Medium — accessibility improvement               |
| 4   | Raise mobile tab bar labels from `text-[10px]` to `text-xs` (12px)  | Single component edit | Medium — improves primary navigation readability |
| 5   | Set minimum `text-[10px]` for chart labels (eliminate `text-[9px]`) | 2 files               | Low — marginal improvement                       |

#### Priority 3 — Considered Changes (Optional)

| #   | Fix                                                                      | Effort             | Impact                                  |
| --- | ------------------------------------------------------------------------ | ------------------ | --------------------------------------- |
| 6   | Add `leading-snug` to body text to bring line-height from 150% to 137.5% | Global CSS change  | Low — current 150% is industry-standard |
| 7   | Document which of the 6 heading levels to actually use (recommend 3)     | Documentation only | Low — prevents future heading sprawl    |
| 8   | Add en dashes for all ranges in i18n strings                             | Content review     | Low — very few numeric ranges in copy   |

---

### Appendix: File References

| File                                                      | Role in Audit                                     |
| --------------------------------------------------------- | ------------------------------------------------- |
| `apps/web/src/index.css`                                  | Design tokens, typography utilities, color system |
| `apps/web/index.html`                                     | Font loading strategy                             |
| `docs/FRONTEND_GUIDELINES.md`                             | Design system documentation                       |
| `packages/shared/src/i18n/en.json`                        | English translations (1167 lines)                 |
| `packages/shared/src/i18n/ru.json`                        | Russian translations                              |
| `apps/web/src/components/dashboard/AdvancedStatCards.tsx` | Largest concentration of micro-text               |
| `apps/web/src/components/flights/FlightForm.tsx`          | Micro-text section headers                        |
| `apps/web/src/components/layout/MobileTabBar.tsx`         | Tab bar label sizing                              |

### Methodology

- **Rules** sourced from [practicaltypography.com](https://practicaltypography.com) — "Summary of Key Rules", "Typography in Ten Minutes", and topic-specific pages (headings, color, websites, ellipses, hyphens-and-dashes)
- **Code evidence** gathered via `Grep` across `apps/web/src/` and `packages/shared/src/i18n/`
- **Contrast ratios** estimated using OKLCH lightness values; formal testing with a contrast checker recommended for exact values
- **Character counts** verified with exact pattern matching (`...` vs `…`, `'` vs `'`)
