# Leaderboard redesign

Status: draft spec, 2026-10-15. Direction approved by the owner; defaults below were taken for the three open questions and can still be overturned (see Assumptions).

Origin: `/dxe` review of `/leaderboard` (2026-10-15) and the follow-up conversation. Decorations stay in scope: the owner wants a pleasant interface, not a minimal one.

## Jobs

1. **Where am I?** My place in every category at a glance, and who is right above me.
2. **How do I climb?** The gap to the next place, in the category's own unit.
3. **Who leads?** The top three, celebrated.

Browsing strangers' profiles (`/fly/[username]`, drill transition) stays a secondary job.

## Concept: a departures board

Kuuki already speaks this language: split-flap digits in Journal Next up (`journal/next-up.tsx`), gate tiles on the profile (`.profile-gate` in `profile/profile.css`), gate-sign Rankings in Overview chapters. The leaderboard reuses them; it introduces no new visual language.

## Categories

Eight categories in two groups. Group labels: **In the sky / В небе** and **On the ground / На земле**.

| Group | Key | Label EN / RU | Value |
|---|---|---|---|
| Sky | `flights` | Flights / Перелёты | `user_stats.total_flights` |
| Sky | `distance` | Distance / Расстояние | `total_distance_km` |
| Sky | `countries` | **Countries on flights / Страны в перелётах** | `countries_count` (renamed; meaning unchanged, flights + legacy only) |
| Sky | `cities` | Airports / Аэропорты | `airports_count` (`cities` stays the API alias) |
| Sky | `airlines` | Airlines / Авиакомпании | `airlines_count` |
| Ground | `rail` | Trains / Поезда | completed `ground_journeys` with `mode='rail'` |
| Ground | `road` | Road trips / Автопутешествия | completed `ground_journeys` with `mode='road'` |
| Ground | `ground_countries` | Countries by land / Страны по земле | distinct `ground_journey_countries.country_code` over completed journeys |

The rename matches the Achievements ladder ("Countries on flights") and prevents a Passport total (all sources) from contradicting the leaderboard number next to it.

Ground distance is deliberately excluded: `segmentKm` is straight-line, not the travelled route.

## Eligibility

- **Sky:** unchanged. `is_public = 1`, `show_on_leaderboards = 1`, `total_flights >= 5`, published derived state.
- **Ground:** `is_public = 1`, `show_on_leaderboards = 1`, **`passport_publication = 'all'`**, at least **3 completed ground journeys** (rail and road together), published derived state.
- The ground gate keeps ADR 0007: ground countries are public only when the owner chose to publish all confirmed countries. Record this as an amendment to ADR 0007 when building.

## Data (backend wave, lands before UI)

- `leaderboard_cache` gains `period` (`all` | `YYYY`) and the three ground categories. The rebuild computes the current calendar year and all time.
- "This year" counts flights and completed ground journeys whose date falls in the current calendar year (flight local departure date; journey `start_date`). Distance and set-based counts (countries, airports, airlines, ground countries) are computed over that year's records only.
- **Fix:** rebuild eligibility includes `p.is_public = 1`, so the cache and the public read agree and ranks have no gaps.
- **Fix:** rank uses `RANK()` semantics (ties share a place: 1, 1, 3), not `ROW_NUMBER()` by signup date. Percentile follows the shared rank.
- Read API: **one payload for the whole page**: for every category × period, the podium, rows #4–#10 and the total; for a signed-in participant also their entry, neighbourhood (±2) and gap to the next place. Roughly 16 × 12 rows, small enough to ship at once. "Show all" fetches further pages on demand.
- Category and period switches are **client-side** over that payload, the URL mirrored with `replaceState` (as in the Journal). No Suspense boundary keyed on category, so switching never shows the skeleton.

## Page structure

Top to bottom, 720px column widening to the shell's content width only if the tile strip needs it on desktop.

1. **H1 "Leaderboard / Рейтинг"** with the period switch on the same row (end side): the existing `ui/segmented-control.tsx` with **2026 / All time** (`Всё время`), default All time, mirrored in `?period=`. Remove the "The community" eyebrow.
2. **Category strip** (gate tiles). Each tile is a link (`/leaderboard?category=…&period=…`, `aria-current="page"` on the selected one) with the label and one value:
   - participant: your rank as split-flap digits (`#12`, ties as `=3`);
   - not yet eligible: progress (`3/5`, `1/3`);
   - ground blocked only by publication: a lock glyph; the narrator line explains and links to Settings;
   - guest: the leader's value.
   Selected tile uses the header's selected style (`--accent-tint`, `--accent-on-tint`, 600), no underline or hairline.
   Compact variant of `.profile-gate`: 72px tall, rank 24/28 mono (`tabular-nums`), `min-inline-size` reserving four digits so a period switch (#9 → #124) never shifts the strip. Press `scale(0.96)` over `--dur-press` `--ease-out`; hover `--surface-inset` only under `(hover: hover) and (pointer: fine)`.
   Desktop: two rows, sky (5) then ground (3), group label above each. Phone (≤700px): one horizontal strip with `scroll-snap`, groups separated by space, the next tile half visible plus a 24px `mask-image` fade on any edge that can still scroll (removed at the ends). On load the selected tile is centred with `scrollIntoView({ inline: 'center', behavior: 'instant' })`.
3. **Narrator line.** One sarcastic sentence about the viewer in the selected category (`glados-copy`, EN + RU, [copy-lean-sarcastic]). Variants: leader, tied, close gap (≤ 2 units), far, not eligible, publication-blocked (calm, links to Settings), guest (invites sign-in). Facts in the line equal the numbers on screen. Replaces the "Ranked by…", "At least 5 flights required", `YourPlace` messages and the bottom "Sign in to participate".
4. **Podium.** Top three as gate signs: #1 centre and tallest, #2 left, #3 right (DOM/reading order 1, 2, 3). Avatar, name linking to the profile, value with unit, medal colour from `--rank-gold/silver/bronze`. Ties share a step label. With fewer than three participants an empty slot is a dashed sign **"Free / Свободно"**: in sky categories it links to Add flight, in ground ones to adding a ground journey; for a guest it links to sign-in.
5. **Board.** Header word above the rows: **Departures / Вылеты** for sky, **Departures / Отправления** for ground (EN keeps "Departures"). Rows from #4. Your row is highlighted (`--surface-inset`, accent start border). The profile link stretches over the whole row (`::after`), one link per row in the DOM; hover `--surface-inset` under `(hover: hover)`.
   - If total participants ≤ 20: show everyone.
   - Otherwise: #4–#10, then a gap row "· · ·", then your row ±2. The row above yours carries the gap: "1 country to @olga / до @olga 1 страна". A "Show all" button expands the full list (paged 50 at a time). New rows appear without a height animation and focus moves to the first new row.
   - Remove the sticky pinned row and the `YourPlace` paragraph; the neighbourhood replaces both.
6. **Footer** (muted, small): "Updated 4 min ago / Обновлено 4 мин назад" with the absolute time in `title` and a `<time>` element. Computed once at render; it does not tick.

## Components

No shadcn CLI and no new UI dependency. Kuuki's primitives live in `apps/next/src/client/ui/` (free Arc items adapted to Kuuki tokens, see `docs/research/2026-10-08-arc-source-inventory.md`). Arc Pro items (Race bar chart, Skeleton morph, Liquid tab bar) are not used.

| Element | Source | Action |
|---|---|---|
| Period switch | `ui/segmented-control.tsx` (`dense`) | reuse |
| Split-flap digits (tiles, podium, rank up) | private `Flap` in `journal/next-up.tsx` + `next-up.css` | extract to `ui/split-flap.tsx`; Next up becomes its second caller |
| Category tile | `.profile-gate` in `profile/profile.css` | extract a `GateTile` with `default` (profile, 104px) and `compact` (72px) sizes; profile and leaderboard both use it |
| Tile strip on phones | native `overflow-x` + `scroll-snap` + `mask-image` edge fades | local CSS, modelled on Arc's free Scroll area behaviour (fades only while content overflows); no adoption needed |
| Podium sign | new, built on `GateTile` surface tokens + `--rank-*` | new, leaderboard-only |
| Avatar | `profile/avatar.tsx` (`ProfileAvatar`) | reuse |
| Board rows | native `<ol>` / `<li value>` + stretched link | keep, restyle |
| Eligibility progress in tiles | text `3/5` (no bar) | none |
| Empty podium slot | new "Free" sign; page-level empty uses `ui/empty-state.tsx` only if all categories are empty | reuse / new |
| Loading | `ui/skeleton.tsx` shaped as strip + podium | reuse |
| Error | `app/(public)/leaderboard/error.tsx` + `ui/button.tsx` | keep, move under heading and strip |
| Show all | `ui/button.tsx` (quiet variant) | reuse |
| Narrator line | plain `<p>`, copy table in EN/RU | new copy |

## Motion

One number-motion language: the split-flap from Journal Next up (`next-up.css`, `rotateX(-90deg)` hinge, `--dur-fast` `--ease-out`, 40ms digit stagger). No slot-text here.

| Event | Frequency | Motion |
|---|---|---|
| Category or period switch | frequent | none: tile pill, values, narrator and board swap instantly |
| Tile press | frequent | `scale(0.96)`, `--dur-press` `--ease-out` |
| Rank up (per category, once per publication, from `recordRank` `celebrate`) | rare | the tile's digits flip old → new. Starts only when the tile is in view (`IntersectionObserver`); several improved tiles flip in sequence, 60ms apart. Rank down: no motion, the narrator handles it |
| Podium, first hard load per session | rare | signs rise #3 → #2 → #1: `translateY(8px)` + `opacity 0` → rest, 200ms `--ease-out`, 60ms apart; #1's digits flip last. Never blocks interaction. Client navigation paints settled |
| Show all | occasional | none (no height animation) |

**Reduced motion** keeps meaning, drops movement: no `rotateX` or `translateY`; rank up becomes a 150ms linear opacity crossfade of the new number; podium paints settled.

## Accessibility

- Category strip stays `<nav>` with links; each tile's accessible name is "Flights, your place 12" / "Перелёты, ваше место 12" (or "3 of 5 flights to join").
- Podium is an `<ol>` in rank order; visual height ordering is CSS only.
- Board is an `<ol>` with `value` on items so screen readers announce real ranks across the gap; the gap row is `aria-hidden` and announced instead by a visually hidden "Places 11 to 13" lead-in.
- Split-flap digits: one accessible text node per number; the flaps are `aria-hidden`.
- The category change status announcement stays.

## States

- **Loading:** skeleton keeps tile strip and podium geometry (no layout shift); copy "Loading rankings…".
- **Empty category:** podium with three Free signs; narrator line.
- **Error:** existing `error.tsx`, but rendered under the heading and category strip so the user can switch category.
- **Pending publication:** tiles show the last published rank; narrator says changes are still being published.

## Out of scope

- Ground distance or hours.
- Friends / follow-based boards, "Compare with me" (waits on record sharing).
- Seasons other than the calendar year.

## Assumptions (owner can overturn)

1. Ground categories require `passport_publication = 'all'` (no new consent toggle). Needs an ADR 0007 amendment.
2. Ground eligibility: 3 completed ground journeys.
3. Production participant count unknown; the ≤ 20 "show everyone" rule covers both small and large communities.

## Open risks

- Year computation for set-based counts needs per-record scans in the 5-minute rebuild; check D1 time and the 100-variable insert chunking (`ROWS_PER_INSERT`) with 8 categories × 2 periods.
- Ground categories may be nearly empty at launch; Free signs are the intended answer, not a bug.
- The leaderboard's `--rank-*` medal tokens on gate-sign surfaces need contrast checks in `tokens.test.ts`.
