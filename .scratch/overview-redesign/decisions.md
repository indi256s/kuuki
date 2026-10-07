# Overview redesign — interview decisions (2026-10-07)

Status: decisions captured, spec not written, nothing implemented. Wireframe direction: globe hero → four figures → reorderable sections (Records, Crossings, Fleet, Clock, Rhythm, Rankings).

## Supersedes in DESIGN.md (to update with the spec)
- D8 "period control only" → whole-page faceted filters.
- "No ambient loops" → the replay loop and the globe's atmosphere rim are allowed.
- `overview/copy.ts` "nothing here is a joke" → the sarcastic narrator is a product pillar.

## Filters
- Scope the whole page. Country rule: origin or destination in the country, transit stops excluded (D12 rule).
- Compute on the client from one owner payload; memory only, `no-store`, revalidate the revision stamp on focus or visibility change.
- OR within a facet, AND across facets. Facets: period (years + custom month range), country, region, airline, aircraft, route, manufacturer, body type, haul, domestic/international, departure-time band.
- The filter is remembered on the account. The H1 names the scope ("Hi, {name} · Japan, Turkish") and chips stay visible.
- UI: chips on the globe plus a command-style "+ Filter" popover that searches all facets (a full-height sheet on phones).
- Countries figure: the Passport number when unfiltered; countries reached by air when filtered, captioned "by air".
- Deltas compare the same filter against the previous period of the same length; hidden for all time.

## Globe
- MapLibre 6.12 globe plus flightcn, copied and adapted like `mapcn.tsx` (source, commit and MIT header; Kuuki airport data; token colors).
- Look: paper globe plus a flat accent-tinted rim (DESIGN.md exception). Layers: countries, routes (width by frequency), airports, night side.
- Camera: the visit-weighted centroid of the scope; re-frames when the filter changes. Full freedom on desktop.
- Mobile: axis lock. The first ~10px decides: vertical scrolls the page, horizontal spins (desk globe), two fingers tilt and zoom. 16px gutters plus a Fullscreen button.
- Out-of-scope countries and routes are ghosted (hatch, 15% hairlines). In-scope items are re-bucketed on the accent ramp.
- Microstates missing from the 110m outlines are drawn as dots. Without WebGL2: a static SVG orthographic globe, which is also the server-rendered first paint, crossfading to WebGL after idle.
- Route click: route card plus "Scope page to this route".

## Replay
- Chronological, loops forever, flightcn default planes. Length is logarithmic in flights: 10s + 12s × log2(n/10), clamped 12–120s.
- Pause, year scrubber and month label. Pause is remembered on the account; reduced motion always wins (static glyphs mid-arc). Off-screen or a hidden tab pauses it.
- Stats do not follow the replay. Upcoming flights appear as dashed ghost arcs at the end and stay visible; hovering the Next strip highlights the arc.
- Night side: the replay date sets the sun's declination (season); the hour stays at page-load time.

## Stats
- Inclusion: logged + awaiting (awaiting flagged); upcoming never counts.
- Distance: pure great-circle everywhere (D1 recompute, leaderboard and profile follow; earned badges kept).
- Time zones: clock shift (DST-aware) plus zones overflown, computed server-side at save time from a bundled tz dataset, with a backfill.
- Equator, date-line and polar-circle crossings follow the great-circle path. Calendar: local departure date. Home: most-departed airport, overridable in Settings.
- Durations use a provenance ladder: own times → route or flight-number median (pooled across users, aggregated, ≥3 samples) → Gemini schedule suggestion (reviewed) → calibrated model. Totals include estimates with "≈"; speed, records and Clock exclude estimates. Inferred departure times count only after the owner accepts them.
- Aircraft family: a curated `family` field for all reference types.
- Section minimums: Records ≥5 flights, Crossings ≥3 with tz, Fleet ≥5 typed, Clock ≥10 with departure time, Rhythm ≥2 months; below that, a sarcastic placeholder.
- Coverage line plus a fix action whenever coverage is below 100%.
- Rhythm heatmap: Flights | Distance | Hours toggle, each with its own legend. A cell scopes the page to that month. Latest 6 years plus "Show all".
- Rankings: top 5 plus "versus" rows; each row is a filter shortcut.
- No CO₂.
- Above ~5,000 flights the payload switches to route aggregates and the replay to monthly batches.

## Layout
- Slim Next/awaiting strip, then the globe and the four figures (both pinned).
- Sections can be reordered and hidden with always-on drag on the whole section header (long-press on touch, ⋯ menu fallback for keyboard). The layout is stored on the account; hidden means hidden.
- Record click opens the flight sheet and focuses the globe on that route.

## Voice
- An unnamed dry narrator: no signature, no "AI". Quips are triggered by data and stay stable for the same data (hash of user + scope).
- Allowed in section footers, figure captions, threshold placeholders and empty filter results. Nothing is off-limits.
- Corpus: about 40 triggers × 3 lines, EN and RU written natively (RU in a dry bureaucratic register, «вы»). The owner reviews it before the spec freezes.
- First run: an empty still globe plus the narrator, Import and Add; no sample data.

## Architecture and release
- One pure stats module in `packages/shared` (flights + refs + filter → sections), used by the Overview client and the `/fly` Worker. The legacy `advancedStats*` services retire after parity.
- Public `/fly`: globe (no scrubber) plus owner-chosen Records and Fleet; nothing finer than a month, nothing that reveals home.
- Charts (decided 2026-10-07): TanStack Charts (`@tanstack/charts`, 1.0.0; SVG, SSR, DOM-free `renderChartSvg` for the share card). No other chart library.
- Share: still 1200×1500 card PNG rendered by the Worker.
- Verification: golden fixtures (polar route, date line, red-eye across DST, transit, microstate, n = 0/1/10/500/5,001), property tests, and a parity report on the owner's account.
- Two releases (revised 2026-10-07). Release 1 is the D1 migrations alone: great-circle recompute, zones overflown, duration provenance and prefs columns. Release 1 goes through the runbook gates and needs separate authorization for the remote D1 writes. Release 2 replaces the page in place, on fully migrated data.
